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

const {
    ConnectorBase,
    CaliperUtils,
    ConfigUtil
} = require('@hyperledger/caliper-core');
const installSmartContractImpl = require('./installSmartContract');
const invokeSmartContractImpl = require('./invokeSmartContract');
const generateRawTransactionImpl = require('./generateRawTransactions');
const sendRawTransactionImpl = require('./sendRawTransactions');
const commLogger = CaliperUtils.getLogger('fiscoBcos-connector');

/**
 * Extends {BlockchainConnector} for a FISCO BCOS backend.
 */
class FiscoBcosConnector extends ConnectorBase {
    /**
     * Create a new instance of the {FISCO BCOS} connector class.
     * @param {number} workerIndex The zero-based index of the worker who wants to create an adapter instance. -1 for the manager process.
     * @param {string} bcType The target SUT type
     */
    constructor(workerIndex, bcType) {
        super(workerIndex, bcType);
        this.workspaceRoot = path.resolve(ConfigUtil.get(ConfigUtil.keys.Workspace));
        let networkConfig = CaliperUtils.resolvePath(ConfigUtil.get(ConfigUtil.keys.NetworkConfig));
        this.fiscoBcosSettings = CaliperUtils.parseYaml(networkConfig)['fisco-bcos'];

        if (this.fiscoBcosSettings.network && this.fiscoBcosSettings.network.authentication) {
            for (let k in this.fiscoBcosSettings.network.authentication) {
                this.fiscoBcosSettings.network.authentication[k] = CaliperUtils.resolvePath(this.fiscoBcosSettings.network.authentication[k]);
            }
        }
        this.clientIdx = workerIndex;
        this.context = undefined;
    }

    /**
     * Initialize the {FISCO BCOS} object.
     * @async
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async init() {
        return Promise.resolve();
    }

    /**
     * Deploy the smart contract specified in the network configuration file to all nodes.
     * @async
     */
    async installSmartContract() {
        const fiscoBcosSettings = this.fiscoBcosSettings;
        try {
            await installSmartContractImpl.run(fiscoBcosSettings, this.workspaceRoot);
        } catch (error) {
            commLogger.error(`FISCO BCOS smart contract install failed: ${(error.stack ? error.stack : error)}`);
            throw error;
        }
    }

    /**
     * Get a context for subsequent operations
     * 'engine' attribute of returned context object must be reserved for benchmark engine to extend the context
     *  engine = {
     *   submitCallback: callback which must be called once new transaction(s) is submitted, it receives a number argument which tells how many transactions are submitted
     * }
     * @param {Number} roundIndex The zero-based round index of the test.
     * @param {Object} args adapter specific arguments
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async getContext(roundIndex, args) {
        this.context = {};
        return this.context;
    }

    /**
     * Release a context as well as related resources
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async releaseContext() {
        this.context = undefined;
    }

    /**
     * Invoke/query the given smart contract according to the specified options. Multiple transactions will be generated according to the length of args.
     * @param {Object | Array<Object>} requests Array of JSON formatted arguments for transaction(s). Each element contains arguments (including the function name) passing to the smart contract. JSON attribute named transaction_type is used by default to specify the function name. If the attribute does not exist, the first attribute will be used as the function name.
     * @param {boolean} readOnly Indicates whether the request is a query or not.
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async _sendRequest(requests, readOnly) {
        /**
         * requests = [
         * { contractId: string, args: object},
         * ...
         * ]
         */
        let promises = [];

        let requestsArray;
        if (!Array.isArray(requests)) {
            requestsArray = [requests];
        } else {
            requestsArray = requests;
        }

        try {
            requestsArray.forEach((request) => {
                let fcn = null;
                let fcArgs = [];

                for (let key in request.args) {
                    if (key === 'transaction_type') {
                        fcn = request.args[key].toString();
                    } else {
                        fcArgs.push(request.args[key].toString());
                    }
                }

                this._onTxsSubmitted(1);
                promises.push(invokeSmartContractImpl.run(this.fiscoBcosSettings, request.contractId, fcn, fcArgs, this.workspaceRoot, readOnly));
            });

            const results = await Promise.all(promises);
            this._onTxsFinished(results);
            return results;
        } catch (error) {
            commLogger.error(`FISCO BCOS smart contract ${readOnly ? 'query': 'invoke'} failed: ${(error.stack ? error.stack : JSON.stringify(error))}`);
            throw error;
        }
    }

    /**
     * Prepare the request for sending.
     * @param {FabricRequestSettings} request The request object.
     */
    async _sendSingleRequest(request) {
        /**
         * request = { contractId: string, args: object, readOnly: boolean }
         */

        try {
            let fcn = null;
            let fcArgs = [];

            for (let key in request.args) {
                if (key === 'transaction_type') {
                    fcn = request.args[key].toString();
                } else {
                    fcArgs.push(request.args[key].toString());
                }
            }

            return invokeSmartContractImpl.run(this.fiscoBcosSettings, request.contractId, fcn, fcArgs,
                this.workspaceRoot, request.readOnly);
        } catch (error) {
            commLogger.error(`FISCO BCOS smart contract ${request.readOnly ? 'query': 'invoke'} failed: ${(error.stack ? error.stack : JSON.stringify(error))}`);
            throw error;
        }
    }

    /**
     * Generate an raw transaction and store in local file
     * @param {String} contractID Identity of the contract
     * @param {Object} arg Arguments of the transaction
     * @param {String} file File path which will be used to store then transaction
     * @return {TaskStatus} Indicates whether the transaction is written to the file successfully or not
     */
    async generateRawTransaction(contractID, arg, file) {
        this._onTxsSubmitted(1);
        const result = await generateRawTransactionImpl.run(this.fiscoBcosSettings, this.workspaceRoot, contractID, arg, file);
        this._onTxsFinished(result);
        return result;
    }

    /**
     * Send raw transactions
     * @param {Object} context The FISCO BCOS context returned by {getContext}
     * @param {Array} transactions List of raw transactions
     * @return {Promise} The promise for the result of the execution
     */
    async sendRawTransaction(context, transactions) {
        return sendRawTransactionImpl.run(this.fiscoBcosSettings, transactions, this._onTxsSubmitted, this._onTxsFinished);
    }
}

module.exports = FiscoBcosConnector;
