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
const _ = require('lodash');
const { Stream } = require('sawtooth-sdk/messaging/stream');
const {
    Message,
    EventList,
    EventSubscription,
    ClientEventsSubscribeRequest,
    ClientEventsSubscribeResponse,
    ClientEventsUnsubscribeRequest,
    ClientEventsUnsubscribeResponse
} = require('sawtooth-sdk/protobuf');

let lastKnownBlockId=null;
let stream;
let blockCommitSatus = new Map();
let currentBlockNum=0;

/**
* Get the last recent block id for the block chain
* @return {Promise<String>} last recent block id
*/
async function getCurrentBlockId() {
    const request = require('request-promise');
    let config = require(configPath);
    let restApiUrl = config.sawtooth.network.restapi.url;
    const blocks = restApiUrl + '/blocks?limit=1';
    let options = {
        uri: blocks
    };
    return request(options)
        .then(function(body) {
            let data = (JSON.parse(body)).data;
            if (data.length > 0) {
                currentBlockNum = parseInt(data[0].header.block_num);
                lastKnownBlockId = data[0].header_signature.toString();
                return currentBlockNum;
            }
        });
}

/**
 * Get block data from event message
 * @param {Object} events message
 * @return {Promise<object>} The promise for the result of event message
 */
async function getBlock(events) {
    const block = _.chain(events)
        .find(e => e.eventType === 'sawtooth/block-commit')
        .get('attributes')
        .map(a => [a.key, a.value])
        .fromPairs()
        .value();
    return {
        blockNum: parseInt(block.block_num),
        blockId: block.block_id.toString(),
        stateRootHash: block.state_root_hash
    };
}

/**
 * Handle event message to updated lastKnownBlockId for next event subscription
 * @param {Object} msg event message
 * @return {void}
 */
async function handleEvent(msg) {
    if (msg.messageType === Message.MessageType.CLIENT_EVENTS) {
        const events = EventList.decode(msg.content).events;
        getBlock(events).then(result => {
            lastKnownBlockId = result.blockId.toString();
            let blockNum=result.blockNum;
            //On receiving event with block, update the status of the block to success
            blockCommitSatus.set(blockNum, 'success');
        });
    } else {
        log('Warn: Received message of unknown type:', msg.messageType);
    }
}

/**
 * Subscribe to block-commit delta events
 * @param {Object} stream object to send event subscribe message
 * @return {void}
 */
async function subscribe(stream) {
    //Subscribe to block-commit delta event
    const blockSub = EventSubscription.create({
        eventType: 'sawtooth/block-commit'
    });

    if(lastKnownBlockId === null) {
        await getCurrentBlockId().then(() => {
        });
    }
    stream.send(
        Message.MessageType.CLIENT_EVENTS_SUBSCRIBE_REQUEST,
        ClientEventsSubscribeRequest.encode({
            subscriptions: [blockSub],
            lastKnownBlockIds: [lastKnownBlockId]
        }).finish()
    )
        .then(response => ClientEventsSubscribeResponse.decode(response))
        .then(decoded => {
            const status = _.findKey(ClientEventsSubscribeResponse.Status,
                val => val === decoded.status);
            if (status !== 'OK') {
                throw new Error(`Validator responded with status "${status}"`);
            }
        });
}

/**
 * Unsubscribe to block-commit delta events
 * @param {Object} stream1 object to send event unsubscribe message
 * @return {void}
 */
function unsubscribe(stream1) {
    stream1.send(
        Message.MessageType.CLIENT_EVENTS_UNSUBSCRIBE_REQUEST,
        ClientEventsUnsubscribeRequest.encode({
        }).finish()
    )
        .then(response => ClientEventsUnsubscribeResponse.decode(response))
        .then(decoded => {
            const status = _.findKey(ClientEventsUnsubscribeResponse.Status,
                val => val === decoded.status);
            if (status !== 'OK') {
                throw new Error(`Validator responded with status "${status}"`);
            }
        });
}
/**
 * Get batch commit event message on block commit
 * @param {Number} block_num of next block
 * @param {Number} batchStats Batch status object to update commit status
 * @return {Promise<object>} returns batch commit status
 */
function getBatchEventResponse(block_num, batchStats) {
    return new Promise(resolve => {
        while(blockCommitSatus.get(block_num) !== 'pending') {
            /* empty */
        }
        //remove the block number from map because we are done with this block
        blockCommitSatus.delete(block_num);
        batchStats.SetStatusSuccess();
        return resolve(batchStats);
    });
}

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
 * Submit a batch of transactions
 * @param {Number} block_num of batches
 * @param {Object} batchBytes batch bytes
 * @return {Promise<object>} The promise for the result of the execution.
 */
async function submitBatches(block_num, batchBytes) {
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
            let txnStatus = getBatchEventResponse(block_num, txStatus);
            return Promise.resolve(txnStatus);
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
    }

    /**
     * Initialize the {Sawtooth} object.
     * Nothing to do now
     * @return {Promise} The return promise.
     */
    init() {
        // todo: sawtooth
        let config = require(configPath);
        let validatorUrl = config.sawtooth.network.validator.url;
        if(validatorUrl === null) {
            log('Error: Validator url is missing!!!');
        }
        stream = new Stream(validatorUrl);
        stream.connect(() => {
            subscribe(stream);
            stream.onReceive(handleEvent);
        });
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
        let config = require(configPath);
        let validatorUrl = config.sawtooth.network.validator.url;
        if(validatorUrl === null) {
            log('Error: Validator url is missing!!!');
        }
        let stream1 = new Stream(validatorUrl);
        stream1.connect(() => {
            unsubscribe(stream1);
        });
        //stream.close();
        //stream1.close();
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
    async invokeSmartContract(context, contractID, contractVer, args, timeout) {
        let config = require(configPath);
        let builder = BatchBuilderFactory.getBatchBuilder(contractID, contractVer,config);
        const batchBytes = builder.buildBatch(args);
        if(context.engine) {
            context.engine.submitCallback(args.length);
        }
        //Get the next block number and status of block to pending
        if(currentBlockNum === 0) {
            await getCurrentBlockId().then(block_num => {
                currentBlockNum = block_num+1;
            });
        }
        else {
            currentBlockNum = currentBlockNum +1;
        }
        blockCommitSatus.set(currentBlockNum,'pending');
        return submitBatches(currentBlockNum, batchBytes).then((batchStats)=>{
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
