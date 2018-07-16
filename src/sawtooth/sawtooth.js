/**
 * Copyright 2017 HUAWEI All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 */


'use strict';

const BlockchainInterface = require('../comm/blockchain-interface.js');
const BatchBuilderFactory = require('./Application/BatchBuilderFactory.js');
const log = require('../comm/util.js').log;
let configPath;
const request = require('request-promise');
const TxStatus = require('../comm/transaction');

/**
 * Get state according from given address
 * @param {String} address Sawtooth address
 * @return {Promise<object>} The promise for the result of the execution.
 */
function getState(address) {
    let txStatus = new TxStatus(0);
    let config = require(configPath);
    let restApiUrl = config.sawtooth.network.restapi.url;
    const stateLink = restApiUrl + '/state?address=' + address;
    let options = {
        uri: stateLink
    };
    return request(options)
        .then(function(body) {
            let data = (JSON.parse(body)).data;

            if (data.length > 0) {
                let stateDataBase64 = data[0].data;
                let stateDataBuffer = new Buffer(stateDataBase64, 'base64');
                let stateData = stateDataBuffer.toString('hex');

                txStatus.SetStatusSuccess();
                txStatus.SetResult(stateData);
                return Promise.resolve(txStatus);
            }
            else {
                throw new Error('no query responses');
            }
        })
        .catch(function (err) {
            log('Query failed, ' + (err.stack?err.stack:err));
            return Promise.resolve(txStatus);
        });
}

/**
 * Query state according to given address
 * @param {object} context Sawtooth context
 * @param {string} contractID The identity of the smart contract.
 * @param {string} contractVer The version of the smart contract.
 * @param {string} address Lookup address
 * @return {Promise<object>} The promise for the result of the execution.
 */
function querybycontext(context, contractID, contractVer, address) {
    const builder = BatchBuilderFactory.getBatchBuilder(contractID, contractVer);
    const addr = builder.calculateAddress(address);
    if(context.engine) {
        context.engine.submitCallback(1);
    }
    return getState(addr);
}

/**
 * Send a request to Sawtooth network to get status of given batch
 * @param {Object} resolve promise resolve object
 * @param {String} statusLink request uri
 * @param {Object} invoke_status execution result object
 * @param {Object} intervalID object for the request interval
 * @param {Object} timeoutID object for the request timeout
 * @return {Promise<object>} The promise for the result of the execution.
 */
function getBatchStatusByRequest(resolve, statusLink, invoke_status, intervalID, timeoutID) {
    let options = {
        uri: statusLink
    };
    return request(options)
        .then(function(body) {
            let batchStatuses = JSON.parse(body).data;
            let hasPending = false;
            for (let index in batchStatuses){
                let batchStatus = batchStatuses[index].status;
                if (batchStatus === 'PENDING'){
                    hasPending = true;
                    break;
                }
            }
            if (hasPending !== true){
                invoke_status.SetStatusSuccess();
                clearInterval(intervalID);
                clearTimeout(timeoutID);
                return resolve(invoke_status);
            }
        })
        .catch(function (err) {
            log(err);
            return resolve(invoke_status);
        });
}

/**
 * Get status of given batch
 * @param {String} link request uri
 * @param {Object} invoke_status execution result
 * @return {Promise<object>} The promise for the result of the execution.
 */
function getBatchStatus(link, invoke_status) {
    let statusLink = link;
    let intervalID = 0;
    let timeoutID = 0;

    let repeat = (ms, invoke_status) => {
        return new Promise((resolve) => {
            intervalID = setInterval(function(){
                return getBatchStatusByRequest(resolve, statusLink, invoke_status, intervalID, timeoutID);
            }, ms);

        });
    };

    let timeout = (ms, invoke_status) => {
        return new Promise((resolve) => {
            timeoutID = setTimeout(function(){
                clearInterval(intervalID );
                return resolve(invoke_status);
            }, ms);
        });
    };


    return  Promise.race([repeat(500, invoke_status), timeout(30000, invoke_status)])
        .then(function () {
            return Promise.resolve(invoke_status);
        })
        .catch(function(error) {
            log('getBatchStatus error: ' + error);
            return Promise.resolve(invoke_status);
        });
}


/**
 * Submit a batch of transactions
 * @param {Object} batchBytes batch bytes
 * @return {Promise<object>} The promise for the result of the execution.
 */
function submitBatches(batchBytes) {
    let txStatus = new TxStatus(0);
    let config = require(configPath);
    let restApiUrl = config.sawtooth.network.restapi.url;
    const request = require('request-promise');
    let options = {
        method: 'POST',
        url: restApiUrl + '/batches',
        body: batchBytes,
        headers: {'Content-Type': 'application/octet-stream'}
    };
    return request(options)
        .then(function (body) {
            let link = JSON.parse(body).link;
            return getBatchStatus(link, txStatus);
        })
        .catch(function (err) {
            log('Submit batches failed, ' + (err.stack?err.stack:err));
            return Promise.resolve(txStatus);
        });
}

/**
 * Sawtooth class, which implements the caliper's NBI for hyperledger sawtooth lake
 */
class Sawtooth extends BlockchainInterface {
    /**
     * Constructor
     * @param {String} config_path path of the Sawtooth configuration file
     */
    constructor(config_path) {
        super(config_path);
        configPath = config_path;
        this.batchBuilder;
    }

    /**
     * Initialize the {Sawtooth} object.
     * Nothing to do now
     * @return {Promise} The return promise.
     */
    init() {
        // todo: sawtooth
        return Promise.resolve();
    }

    /**
     * Deploy the chaincode specified in the network configuration file to all peers.
     * Not supported now
     * @return {Promise} The return promise.
     */
    installSmartContract() {
        // todo:
        return Promise.resolve();
    }

    /**
     * Return the Sawtooth context
     * Nothing to do now
     * @param {string} name Unused.
     * @param {object} args Unused.
     * @return {Promise} The return promise.
     */
    getContext(name, args) {
        return Promise.resolve();

    }

    /**
     * Release the Sawtooth context
     * @param {object} context Sawtooth context to be released.
     * @return {Promise} The return promise.
     */
    releaseContext(context) {
        // todo:
        return Promise.resolve();
    }

    /**
     * Invoke the given smart contract according to the specified options.
     * @param {object} context Sawtooth context
     * @param {string} contractID The identity of the contract.
     * @param {string} contractVer The version of the contract.
     * @param {Array} args array of JSON formatted arguments for multiple transactions
     * @param {number} timeout The timeout to set for the execution in seconds.
     * @return {Promise<object>} The promise for the result of the execution.
     */
    invokeSmartContract(context, contractID, contractVer, args, timeout) {
        let builder = BatchBuilderFactory.getBatchBuilder(contractID, contractVer);
        const batchBytes = builder.buildBatch(args);
        if(context.engine) {
            context.engine.submitCallback(args.length);
        }
        return submitBatches(batchBytes).then((batchStats)=>{
            // use batchStats for all transactions in this batch
            let txStats = [];
            for(let i = 0 ; i < args.length ; i++) {
                let cloned = Object.assign({}, batchStats);
                Object.setPrototypeOf(cloned, TxStatus.prototype);
                txStats.push(cloned);
            }
            return Promise.resolve(txStats);
        });
    }

    /**
     * Query state according to given name
     * @param {object} context Sawtooth context
     * @param {string} contractID The identity of the smart contract.
     * @param {string} contractVer The version of the smart contract.
     * @param {string} queryName Lookup name
     * @return {Promise<object>} The promise for the result of the execution.
     */
    queryState(context, contractID, contractVer, queryName) {
        return querybycontext(context, contractID, contractVer, queryName);
    }

    /**
     * Calculate basic statistics of the execution results.
     * Nothing to do now.
     * @param {object} stats Unused.
     * @param {object[]} results Unused.
     */
    getDefaultTxStats(stats, results) {
        // nothing to do now
    }
}

module.exports = Sawtooth;
