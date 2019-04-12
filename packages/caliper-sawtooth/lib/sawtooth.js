/**
 * Copyright 2017 HUAWEI All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 */


'use strict';

const { BlockchainInterface, CaliperUtils, TxStatus }= require('caliper-core');
const logger = CaliperUtils.getLogger('sawtooth.js');

const BatchBuilderFactory = require('./batch/BatchBuilderFactory.js');

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

const request = require('request-promise');
const _ = require('lodash');

let configPath;
let lastKnownBlockId=null;
//let blockCommitSatus = new Map();
let batchCommitStatus = new Map();
let currentBlockNum=0;
let currentEndpoint= 0;

/**
* Get the current rest end point
* @return {String} rest endpoint url
*/
function getRESTUrl() {
    let config = require(configPath);
    let restApiUrls = config.sawtooth.network.restapi.urls;
    currentEndpoint++;
    if(currentEndpoint >= restApiUrls.length) {
        currentEndpoint = currentEndpoint % restApiUrls.length;
    }
    return restApiUrls[currentEndpoint];
}

/**
* Get the last recent block id for the block chain
* @return {Promise<String>} last recent block id
*/
async function getCurrentBlockId() {
    const request = require('request-promise');
    let restAPIUrl = getRESTUrl();
    const blocks = restAPIUrl + '/blocks?limit=1';
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
 * Get batch ids from block
 * @param {String} blockId the ID of a block
 * @return {Promise<object>} The promise for the batch ids
 */
async function getBlockBatchIds(blockId) {
    const request = require('request-promise');
    let restAPIUrl = getRESTUrl();
    const blocks = restAPIUrl + '/blocks/' + blockId;
    let options = {
        uri: blocks
    };
    return request(options)
        .then(function(body) {
            let data = (JSON.parse(body)).data;
            if (data !== undefined) {
                let batchIds = data.header.batch_ids;
                return batchIds;
            }else{
                return [];
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
    let batchIds = await getBlockBatchIds(block.block_id);
    return {
        blockNum: parseInt(block.block_num),
        blockId: block.block_id.toString(),
        batchIds: batchIds,
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
        //logger.info('msg: ' + JSON.stringify(msg));
        const events = EventList.decode(msg.content).events;
        getBlock(events).then(result => {
            //On receiving event with block, update the statuses of the batches success
            for(let i = 0; i < result.batchIds.length; i++) {
                batchCommitStatus.set(result.batchIds[i].toString('hex'), 'success');
            }
        });
    } else {
        logger.warn('Warn: Received message of unknown type:', msg.messageType);
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
            stream1.close();
            return CaliperUtils.sleep(1000);
        });
}
/**
 * Get batch commit event message on block commit
 * @param {String} batchID The ID of a batch
 * @param {Number} batchStats Batch status object to update commit status
 * @param {Number} timeout The timeout for the execution in millseconds
 * @return {Promise<object>} returns batch commit status
 */
async function getBatchEventResponse(batchID, batchStats, timeout) {
    try {
        const beforeTime = Date.now();
        while(batchCommitStatus.get(batchID) === 'pending') {
            if((Date.now() - beforeTime) > timeout) {
                throw new Error('Timeout, batchID: ' + batchID);
            }
            await CaliperUtils.sleep(200);
        }
        batchStats.SetStatusSuccess();
        return batchStats;
    } catch(err){
        logger.info('getBatchEventResponse err: ' + err);
        batchStats.SetStatusFail();
        return batchStats;
    }
}

/**
 * Get state according from given address
 * @param {String} address Sawtooth address
 * @return {Promise<object>} The promise for the result of the execution.
 */
function getState(address) {
    let txStatus = new TxStatus(0);
    let restApiUrl = getRESTUrl();
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
            logger.error('Query failed, ' + (err.stack?err.stack:err));
            return Promise.resolve(txStatus);
        });
}

/**
 * Query state according to given address
 * @param {object} context Sawtooth context
 * @param {string} contractID The identity of the smart contract.
 * @param {string} contractVer The version of the smart contract.
 * @param {string} address Lookup address
 * @param {string} workspaceRoot the workspace root
 * @return {Promise<object>} The promise for the result of the execution.
 */
function querybycontext(context, contractID, contractVer, address, workspaceRoot) {
    let config = require(configPath);
    const builder = BatchBuilderFactory.getBatchBuilder(contractID, contractVer, config, workspaceRoot);
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
 * @param {Number} timeout The timeout to set for the execution in seconds
 * @return {Promise<object>} The promise for the result of the execution.
 */
async function submitBatches(block_num, batchBytes, timeout) {
    let txStatus = new TxStatus(0);
    let restApiUrl = getRESTUrl();
    const request = require('request-promise');
    let options = {
        method: 'POST',
        url: restApiUrl + '/batches',
        body: batchBytes,
        headers: {'Content-Type': 'application/octet-stream'}
    };
    return request(options)
        .then(function (body) {
            let batchId = (JSON.parse(body).link.split('id='))[1];
            if(batchCommitStatus.get(batchId) !== 'success') {
                batchCommitStatus.set(batchId,'pending');
            }
            let txnStatus = getBatchEventResponse(batchId, txStatus, timeout);
            return Promise.resolve(txnStatus);
        })
        .catch(function (err) {
            logger.error('Submit batches failed, ' + err);
            txStatus.SetStatusFail();
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
     * @param {string} workspace_root The absolute path to the root location for the application configuration files.
     */
    constructor(config_path, workspace_root) {
        super(config_path);
        configPath = config_path;
        this.bcType = 'sawtooth';
        this.workspaceRoot = workspace_root;
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
        let config  = require(this.configPath);
        let context = config.sawtooth.context;
        if(typeof context === 'undefined') {
            let validatorUrl = config.sawtooth.network.validator.url;
            if(validatorUrl === null) {
                logger.error('Error: Validator url is missing!!!');
            }
            let stream = new Stream(validatorUrl);
            stream.connect(() => {
                subscribe(stream);
                stream.onReceive(handleEvent);
            });
            context = {stream: stream};
        }
        return Promise.resolve(context);

    }

    /**
     * Release the Sawtooth context
     * @param {object} context Sawtooth context to be released.
     * @return {Promise} The return promise.
     */
    releaseContext(context) {
        return unsubscribe(context.stream);
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
        try {
            let config = require(configPath);
            let builder = BatchBuilderFactory.getBatchBuilder(contractID, contractVer, config, this.workspaceRoot);
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
            let batchStats = await submitBatches(currentBlockNum, batchBytes, timeout * 1000);

            let txStats = [];
            for(let i = 0 ; i < args.length ; i++) {
                let cloned = Object.assign({}, batchStats);
                Object.setPrototypeOf(cloned, TxStatus.prototype);
                txStats.push(cloned);
            }
            return txStats;
        } catch (err) {
            logger.error('invokeSmartContract failed, ' + err);
            let txStats = [];
            for(let i = 0 ; i < args.length ; i++) {
                let txStatus = new TxStatus(0);
                txStatus.SetStatusFail();
                txStats.push(txStatus);
            }
            return txStats;
        }
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
        return querybycontext(context, contractID, contractVer, queryName, this.workspaceRoot);
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
