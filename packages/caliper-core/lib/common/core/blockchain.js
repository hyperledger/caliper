/*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

'use strict';

const Logger = require('../utils/caliper-utils').getLogger('blockchain');

/**
 * BlockChain class, define operations to interact with the blockchain system under test
 */
class Blockchain {
    /**
     * Constructor
     * @param {Object} bcObj the concrete blockchain object
     */
    constructor(bcObj) {
        this.bcObj = bcObj;
    }

    /**
     * return the blockchain type
     * @return {string} type of the blockchain
     */
    getType() {
        return this.bcObj.getType();
    }

    /**
    * Initialize test environment, e.g. create a fabric channel for the test
    * @async
    */
    async init() {
        await this.bcObj.init();
    }

    /**
     * Retrieve required arguments for test workers, e.g. retrieve information from the adaptor that is generated during an admin phase such as contract installation.
     * Information returned here is passed to the worker through the messaging protocol on test.
     * @param {Number} number total count of test workers
     * @return {Promise} array of obtained material for each test worker
     */
    async prepareWorkerArguments(number) {
        return await this.bcObj.prepareWorkerArguments(number);
    }

    /**
    * Install smart contract(s), detail information is defined in the blockchain configuration file
    * @async
    */
    async installSmartContract() {
        await this.bcObj.installSmartContract();
    }

    /**
     * Get a context for subsequent operations, e.g. invoke smart contract or query state
     * @param {String} name name of the context
     * @param {Object} args adapter specific arguments
     * @return {Promise} obtained context object
     * @async
     */
    async getContext(name, args) {
        return await this.bcObj.getContext(name, args);
    }

    /**
     * Release a context as well as related resources
     * @param {Object} context adapter specific object
     * @return {Promise} promise object
     */
    async releaseContext(context) {
        return await this.bcObj.releaseContext(context);
    }

    /**
     * Invoke smart contract/submit transactions and return corresponding transactions' status
     * @param {Object} context context object
     * @param {String} contractID identity of the contract
     * @param {String} contractVer version of the contract
     * @param {Array} args array of JSON formatted arguments for multiple transactions
     * @param {Number} timeout request timeout, in second
     * @return {Promise} txStatus object or an array of txStatus objects
     */
    async invokeSmartContract(context, contractID, contractVer, args, timeout) {
        let arg, time;    // compatible with old version
        if(Array.isArray(args)) {
            arg = args;
        }
        else if(typeof args === 'object') {
            arg = [args];
        }
        else {
            throw new Error('Invalid args for invokeSmartContract()');
        }

        if(typeof timeout !== 'number' || timeout < 0) {
            time = 120;
        }
        else {
            time = timeout;
        }

        return await this.bcObj.invokeSmartContract(context, contractID, contractVer, arg, time);
    }

    /**
     * Query state from the ledger using a smart contract
     * @param {Object} context context object
     * @param {String} contractID identity of the contract
     * @param {String} contractVer version of the contract
     * @param {Array} args array of JSON formatted arguments
     * @param {Number} timeout request timeout, in seconds
     * @return {Promise} query response object
     */
    async querySmartContract(context, contractID, contractVer, args, timeout) {
        let arg, time;
        if(Array.isArray(args)) {
            arg = args;
        }
        else if(typeof args === 'object') {
            arg = [args];
        }
        else {
            throw new Error('Invalid args for querySmartContract()');
        }

        if(typeof timeout !== 'number' || timeout < 0) {
            time = 120;
        }
        else {
            time = timeout;
        }

        return await this.bcObj.querySmartContract(context, contractID, contractVer, arg, time);
    }

    /**
     * Query state from the ledger
     * @param {Object} context context object from getContext
     * @param {String} contractID identity of the contract
     * @param {String} contractVer version of the contract
     * @param {String} key lookup key
     * @param {String=} [fcn] query function name
     * @return {Object} as invokeSmartContract()
     */
    async queryState(context, contractID, contractVer, key, fcn) {
        return await this.bcObj.queryState(context, contractID, contractVer, key, fcn);
    }

    /**
    * Calculate the default transaction statistics
    * @param {Array} resultArray array of txStatus
    * @param {Boolean} detail indicates whether to keep detailed information
    * @return {JSON} txStatistics JSON object
    */
    getDefaultTxStats(resultArray, detail) {
        let succ = 0, fail = 0, delay = 0;
        let minFinal, maxFinal, minCreate, maxCreate;
        let maxLastFinal;
        let minDelay = 100000, maxDelay = 0;
        let delays = [];
        let sTPTotal = 0;
        let sTTotal = 0;
        let invokeTotal = 0;
        for(let i = 0 ; i < resultArray.length ; i++) {
            let stat   = resultArray[i];
            sTPTotal = sTPTotal + stat.Get('sTP');
            sTTotal = sTTotal + stat.Get('sT');
            invokeTotal += stat.Get('invokeLatency');
            let create = stat.GetTimeCreate();

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

            if(stat.IsCommitted()) {
                succ++;
                let final = stat.GetTimeFinal();
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

            let curFinal = stat.GetTimeFinal();
            if(typeof maxLastFinal === 'undefined') {
                maxLastFinal = curFinal;
            }
            else{
                if(curFinal > maxLastFinal){
                    maxLastFinal = curFinal;
                }
            }
        }

        let stats = {
            'succ' : succ,
            'fail' : fail,
            'create' : {'min' : minCreate/1000, 'max' : maxCreate/1000},    // convert to second
            'final'  : {'min' : minFinal/1000,  'max' : maxFinal/1000, 'last' : maxLastFinal/1000 },
            'delay'  : {'min' : minDelay,  'max' : maxDelay, 'sum' : delay, 'detail': (detail?delays:[]) },
            'out' : [],
            'sTPTotal': sTPTotal,
            'sTTotal': sTTotal,
            'invokeTotal': invokeTotal,
            'length': resultArray.length
        };
        return stats;
    }

    /**
     * merge an array of default 'txStatistics', the result is in first object of the array
     * Note even failed the first object of the array may still be changed
     * @param {Array} resultArray txStatistics array
     * @return {Number} 0 if failed; otherwise 1
     */
    static mergeDefaultTxStats(resultArray) {
        try{
            // skip invalid result
            let skip = 0;
            for(let i = 0 ; i < resultArray.length ; i++) {
                let result = resultArray[i];

                if(!result.hasOwnProperty('succ') || !result.hasOwnProperty('fail') || (result.succ + result.fail) === 0) {
                    skip++;
                }
                else {
                    break;
                }
            }

            if(skip > 0) {
                resultArray.splice(0, skip);
            }

            if(resultArray.length === 0) {
                return 0;
            }

            let r = resultArray[0];
            for(let i = 1 ; i < resultArray.length ; i++) {
                let v = resultArray[i];
                if(!v.hasOwnProperty('succ') || !v.hasOwnProperty('fail') || (v.succ + v.fail) === 0) {
                    continue;
                }
                r.succ += v.succ;
                r.fail += v.fail;
                r.sTPTotal += v.sTPTotal;
                r.sTTotal += v.sTTotal;
                r.invokeTotal += v.invokeTotal;
                r.length += v.length;
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
                if(v.final.last > r.final.last){
                    r.final.last = v.final.last;
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
            Logger.error(err);
            return 0;
        }
    }

    /**
     * create a 'null' txStatistics object
     * @return {JSON} 'null' txStatistics object
     */
    static createNullDefaultTxStats() {
        return {succ: 0, fail: 0};
    }
}

module.exports = Blockchain;
