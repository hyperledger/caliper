/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file, definition of the BlockChain class, which is used to interact with backend's blockchain system
*/

'use strict'

var path = require('path');
var Blockchain = class {
    constructor(configPath) {
        var config = require(configPath);

        if(config.hasOwnProperty('fabric')) {
            var fabric = require('../fabric/fabric.js');
            this.bcType = 'fabric';
            this.bcObj = new fabric(configPath);
        }
        else if(config.hasOwnProperty('sawtooth')) {
            var sawtooth = require('../sawtooth/sawtooth.js')
            this.bcType = 'sawtooth';
            this.bcObj = new sawtooth(configPath);
        }
        else if(config.hasOwnProperty('iroha')) {
            var iroha = require('../iroha/iroha.js');
            this.bcType = 'iroha';
            this.bcObj = new iroha(configPath);
        }
        else if(config.hasOwnProperty('composer')) {
            var composer = require('../composer/composer.js')
            this.bcType = 'composer';
            this.bcObj = new composer(configPath);
        }
        else {
            this.bcType = 'unknown';
            throw new Error('Unknown blockchain config file ' + configPath);
        }
    }

    /**
    * return the blockchain type
    * @return {string}
    */
    gettype() {
        return this.bcType;
    }

    /**
    * prepare the underlying blockchain environment, e.g. join channel for fabric's peers
    * the function should be called only once for the same backend's blockchain system
    * even if multiple Blockchain objects are instantiated
    * @return {Promise}
    */
    init() {
        return this.bcObj.init();
    }

    /**
    * create needed materials for multiple clients, e.g create account for each client and return the key pairs
    * @number, number of clients
    * @return {Promise}, array of generated JSON object for each client. The array length should be equal to the input number
    *                    Each object should be passed to corresponding client and be used as a argument of getContext
    */
    prepareClients (number) {
        return this.bcObj.prepareClients(number);
    }

    /**
    * install smart contract on peers
    * the detailed smart contract's information should be defined in the configuration file
    * @return {Promise}
    */
    installSmartContract() {
        return this.bcObj.installSmartContract();
    }

    /**
    * get a system context that will be used to interact with backend's blockchain system
    * @name {string}, name of the context
    * @args {object}, a JSON object that contains required materials for the client to interact with SUT, e.g key pairs for the client
    *                 the actual format of the object is specified by each blochchain interface implementation
    * @return {Promise.resolve(context)}
    */
    getContext(name, args) {
        return this.bcObj.getContext(name, args);
    }

    /**
    * release the system context
    * @return {Promise}
    */
    releaseContext(context) {
        return this.bcObj.releaseContext(context);
    }

    /**
    * perform an 'invoke' transaction
    * @context {Object}, context returned by getContext
    * @contractID {string}, smart contract's id
    * @contractVer {string}, smart contract's version
    * @args {object}, invoking arguments
    * @timeout {Number}, return directly after that time in seconds has elapsed
    * @return {Promise.resolve(Object)}, return the key informations of the transaction, the format is
     *       {
    *           'id': transaction's id
    *           'status':  status of the transaction, should be:
    *                        - 'created': successfully created, but not validated or committed yet
    *                        - 'success': successfully validated and committed in the ledger
    *           'time_create': time(ms) that the transaction was created
    *           'time_final':  time(ms) that the transaction was known to be final and committed in ledger
    *           'result': response payloads of the transaction request
    *           ...... :  blockchain platform specific values
    *         }
    */
    invokeSmartContract(context, contractID, contractVer, args, timeout) {
        if(typeof timeout !== 'number' || timeout < 0) {
            return this.bcObj.invokeSmartContract(context, contractID, contractVer, args, 120);
        }
        else {
            return this.bcObj.invokeSmartContract(context, contractID, contractVer, args, timeout);
        }
    }

    /**
    * * perform a 'query' transaction to get state from the ledger
    * @return {Promsie}, same format as invokeSmartContract's returning
    */
    queryState(context, contractID, contractVer, key) {
        return this.bcObj.queryState(context, contractID, contractVer, key);
    }

    /**
    * txStatistics = {
    *     succ : ,                            // number of succeeded txs
    *     fail : ,                            // number of failed txs
    *     create : {min: , max: },            // min/max time of tx created, in second
    *     final  : {min: , max: },            // min/max time of tx becoming final, in second
    *     delay  : {min: , max: , sum: , detail:[...]},     // min/max/sum time of txs' processing delay,  in second
    *     // obsoleted throughput : {time: ,...},          // tps of each time slot
    *     out : []                            // user defined output data
    *     // obsoleted others: {object}                 // blockchain platform specific values
    * }
    */
    /**
    * generate and return the default statistics of transactions
    * @ results {Array}, results of 'invoke'/'query' transactions
    * @ detail {Boolean}, whether to keep detailed delay history
    * @ return {Promise.resolve(txStatistics)}
    */
    // TODO: should be moved to a dependent 'analyser' module in which to do all result analysing work
    getDefaultTxStats(results, detail) {
        var succ = 0, fail = 0, delay = 0;
        var minFinal, maxFinal, minCreate, maxCreate;
        var minDelay = 100000, maxDelay = 0;
        var delays = [];
        for(let i = 0 ; i < results.length ; i++) {
            let stat   = results[i];
            let create = stat['time_create'];

            if(typeof minCreate === 'undefined') {
                minCreate = create;
                maxCreate = create;
            }
            else {
                if(create < minCreate) {
                    minCreate = create;
                }
                if(create > maxCreate) {
                    maxCreate = create;
                }
            }

            if(stat.status === 'success') {
                succ++;
                let final = stat['time_final'];
                let d     = (final - create) / 1000;
                if(typeof minFinal === 'undefined') {
                    minFinal = final;
                    maxFinal = final;
                }
                else {
                    if(final < minFinal) {
                        minFinal = final;
                    }
                    if(final > maxFinal) {
                        maxFinal = final;
                    }
                }

                delay += d;
                if(d < minDelay) {
                    minDelay = d;
                }
                if(d > maxDelay) {
                    maxDelay = d;
                }

                if(detail) {
                    delays.push(d);
                }
            }
            else {
                fail++;
            }
        }

        var stats = {
            'succ' : succ,
            'fail' : fail,
            'create' : {'min' : minCreate/1000, 'max' : maxCreate/1000},    // convert to second
            'final'  : {'min' : minFinal/1000,  'max' : maxFinal/1000 },
            'delay'  : {'min' : minDelay,  'max' : maxDelay, 'sum' : delay, 'detail': (detail?delays:[]) },
            'out' : []
        };
        return stats;
    }

    /**
    * merge an array of default 'txStatistics', the merged result is in the first object
    * @ results {Array}, txStatistics array
    * @ return {Number}, 0 if failed; otherwise 1
    */
    static mergeDefaultTxStats(results) {
        try{
            // skip invalid result
            var skip = 0;
            for(let i = 0 ; i < results.length ; i++) {
                let result = results[i];
                if(!result.hasOwnProperty('succ') || !result.hasOwnProperty('fail') || (result.succ + result.fail) === 0) {
                    skip++;
                }
                else {
                    break;
                }
            }
            if(skip > 0) {
                results.splice(0, skip);
            }

            if(results.length === 0) return 0;

            var r = results[0];
            for(let i = 1 ; i < results.length ; i++) {
                let v = results[i];
                if(!v.hasOwnProperty('succ') || !v.hasOwnProperty('fail') || (v.succ + v.fail) === 0) {
                    continue;
                }
                r.succ += v.succ;
                r.fail += v.fail;
                r.out.push.apply(r.out, v.out);
                if(v.create.min < r.create.min) {
                    r.create.min = v.create.min;
                }
                if(v.create.max > r.create.max) {
                    r.create.max = v.create.max;
                }
                if(v.final.min < r.final.min) {
                    r.final.min = v.final.min;
                }
                if(v.final.max > r.final.max) {
                    r.final.max = v.final.max;
                }
                if(v.delay.min < r.delay.min) {
                    r.delay.min = v.delay.min;
                }
                if(v.delay.max > r.delay.max) {
                    r.delay.max = v.delay.max;
                }
                r.delay.sum += v.delay.sum;
                for(let j = 0 ; j < v.delay.detail.length ; j++) {
                    r.delay.detail.push(v.delay.detail[j]);
                }
            }
            return 1;
        }
        catch(err) {
            return 0;
        }
    }

    /**
    * create a 'null txStatistics'
    * @ results {Object}, txStatistics array
    */
    static createNullDefaultTxStats() {
        return {succ: 0, fail: 0};
    }
}

module.exports = Blockchain;