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

const path = require('path');

const { BlockchainInterface, CaliperUtils, ConfigUtil, TxStatus }= require('@hyperledger/caliper-core');
const logger = CaliperUtils.getLogger('sawtooth.js');

const BatchBuilderFactory = require('./batch/BatchBuilderFactory.js');
const SawtoothHelper = require('./helpers/sawtooth-helper');

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

/**
 * Sawtooth class, which implements the caliper's NBI for hyperledger sawtooth lake
 */
class Sawtooth extends BlockchainInterface {
    /**
     * Constructor
     * @param {number} workerIndex The zero-based index of the worker who wants to create an adapter instance. -1 for the master process. Currently unused.
     */
    constructor(workerIndex) {
        super();
        const configPath = CaliperUtils.resolvePath(ConfigUtil.get(ConfigUtil.keys.NetworkConfig));
        this.config = require(configPath);
        this.bcType = 'sawtooth';
        this.workspaceRoot = path.resolve(ConfigUtil.get(ConfigUtil.keys.Workspace));
        this.clientIndex = workerIndex;

        // Internal properties required by Sawtooth adaptor
        this.lastKnownBlockId = null;
        this.batchCommitStatus = new Map();
        this.currentBlockNum = 0;
        this.currentEndpoint = 0;
        this.restURL = this.getRESTUrl();
    }

    /**
     * Retrieve the blockchain type the implementation relates to
     * @returns {string} the blockchain type
     */
    getType() {
        return this.bcType;
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
    async getContext(name, args) {
        let context = this.config.sawtooth.context;
        if (typeof context === 'undefined') {
            const validatorUrl = this.config.sawtooth.network.validator.url;
            if (validatorUrl === null) {
                logger.error('Error: Validator url is missing!!!');
            }
            const stream = new Stream(validatorUrl);
            stream.connect(() => {
                this.subscribe(stream, this.restURL);
                stream.onReceive((msg) => {
                    if (msg.messageType === Message.MessageType.CLIENT_EVENTS) {
                        //logger.info('msg: ' + JSON.stringify(msg));
                        const events = EventList.decode(msg.content).events;
                        SawtoothHelper.getBlock(events, this.restURL).then(result => {
                            //On receiving event with block, update the statuses of the batches success
                            for (let i = 0; i < result.batchIds.length; i++) {
                                this.batchCommitStatus.set(result.batchIds[i].toString('hex'), 'success');
                            }
                        });
                    } else {
                        logger.warn('Warn: Received message of unknown type:', msg.messageType);
                    }
                });
            });
            context = {
                stream,
                restURL: this.restURL
            };
        }
        return context;
    }

    /**
     * Release the Sawtooth context
     * @param {object} context Sawtooth context to be released.
     * @return {Promise} The return promise.
     */
    releaseContext(context) {
        return this.unsubscribe(context.stream);
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
            const builder = BatchBuilderFactory.getBatchBuilder(contractID, contractVer, this.config, this.workspaceRoot);
            const batchBytes = builder.buildBatch(args);
            if (context.engine) {
                context.engine.submitCallback(args.length);
            }
            //Get the next block number and status of block to pending
            if (this.currentBlockNum === 0) {
                const block_num = await SawtoothHelper.getCurrentBlockId(context.restURL);
                this.currentBlockNum = block_num + 1;
            } else {
                this.currentBlockNum = this.currentBlockNum + 1;
            }
            const batchStats = await this.submitBatches(this.currentBlockNum, batchBytes, context.restURL, timeout * 1000);

            const txStats = [];
            for (let i = 0 ; i < args.length ; i++) {
                const cloned = Object.assign({}, batchStats);
                Object.setPrototypeOf(cloned, TxStatus.prototype);
                txStats.push(cloned);
            }
            return txStats;
        } catch (err) {
            logger.error('invokeSmartContract failed, ' + err);
            const txStats = [];
            for(let i = 0 ; i < args.length ; i++) {
                const txStatus = new TxStatus(0);
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
        return this.queryByContext(context, contractID, contractVer, queryName, this.workspaceRoot);
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


    // ****************************
    // Sawtooth functions
    // ****************************

    /**
    * Get the current rest end point
    * @return {String} rest endpoint url
    */
    getRESTUrl() {
        const restApiUrls = this.config.sawtooth.network.restapi.urls;
        this.currentEndpoint++;
        if (this.currentEndpoint >= restApiUrls.length) {
            this.currentEndpoint = this.currentEndpoint % restApiUrls.length;
        }
        return restApiUrls[this.currentEndpoint];
    }

    /**
     * Subscribe to block-commit delta events
     * @param {Object} stream object to send event subscribe message
     * @param {string} restURL the restAPI URL in use
     * @return {void}
     */
    async subscribe(stream, restURL) {
        //Subscribe to block-commit delta event
        const blockSub = EventSubscription.create({
            eventType: 'sawtooth/block-commit'
        });

        if (this.lastKnownBlockId === null) {
            this.lastKnownBlockId = await SawtoothHelper.getCurrentBlockId(restURL);
        }

        stream.send(
            Message.MessageType.CLIENT_EVENTS_SUBSCRIBE_REQUEST,
            ClientEventsSubscribeRequest.encode({
                subscriptions: [blockSub],
                lastKnownBlockIds: [this.lastKnownBlockId]
            }).finish())
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
    unsubscribe(stream1) {
        stream1.send(
            Message.MessageType.CLIENT_EVENTS_UNSUBSCRIBE_REQUEST,
            ClientEventsUnsubscribeRequest.encode({
            }).finish())
            .then(response => ClientEventsUnsubscribeResponse.decode(response))
            .then(decoded => {
                const status = _.findKey(ClientEventsUnsubscribeResponse.Status, val => val === decoded.status);
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
     * @param {Number} timeout The timeout for the execution in mill-seconds
     * @return {Promise<object>} returns batch commit status
     */
    async getBatchEventResponse(batchID, batchStats, timeout) {
        try {
            const beforeTime = Date.now();
            while (this.batchCommitStatus.get(batchID) === 'pending') {
                if ((Date.now() - beforeTime) > timeout) {
                    throw new Error('Timeout, batchID: ' + batchID);
                }
                await CaliperUtils.sleep(200);
            }
            batchStats.SetStatusSuccess();
            return batchStats;
        } catch (err){
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
    getState(address) {
        const txStatus = new TxStatus(0);
        const stateLink = this.restURL + '/state?address=' + address;
        const options = {
            uri: stateLink
        };

        return request(options)
            .then((body) => {
                const data = (JSON.parse(body)).data;
                if (data.length > 0) {
                    const stateDataBase64 = data[0].data;
                    const stateDataBuffer = Buffer.from(stateDataBase64, 'base64');
                    const stateData = stateDataBuffer.toString('hex');

                    txStatus.SetStatusSuccess();
                    txStatus.SetResult(stateData);
                    return Promise.resolve(txStatus);
                } else {
                    throw new Error('no query responses');
                }
            })
            .catch((err) => {
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
    queryByContext(context, contractID, contractVer, address, workspaceRoot) {
        const builder = BatchBuilderFactory.getBatchBuilder(contractID, contractVer, this.config, workspaceRoot);
        const addr = builder.calculateAddress(address);
        if (context.engine) {
            context.engine.submitCallback(1);
        }
        return this.getState(addr);
    }

    /**
     * Submit a batch of transactions
     * @param {Number} block_num of batches
     * @param {Object} batchBytes batch bytes
     * @param {string} restURL the rest URL being used within this context
     * @param {Number} timeout The timeout to set for the execution in seconds
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async submitBatches(block_num, batchBytes, restURL, timeout) {
        const txStatus = new TxStatus(0);
        const options = {
            method: 'POST',
            url: restURL + '/batches',
            body: batchBytes,
            headers: {'Content-Type': 'application/octet-stream'}
        };
        return request(options)
            .then((body) => {
                const batchId = (JSON.parse(body).link.split('id='))[1];
                if (this.batchCommitStatus.get(batchId) !== 'success') {
                    this.batchCommitStatus.set(batchId,'pending');
                }
                const txnStatus = this.getBatchEventResponse(batchId, txStatus, timeout);
                return Promise.resolve(txnStatus);
            })
            .catch((err) => {
                logger.error('Submit batches failed, ' + err);
                txStatus.SetStatusFail();
                return Promise.resolve(txStatus);
            });
    }
}

module.exports = Sawtooth;
