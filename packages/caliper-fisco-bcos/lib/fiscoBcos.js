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

const {
    BlockchainInterface,
    CaliperUtils
} = require('@hyperledger/caliper-core');
const installSmartContractImpl = require('./installSmartContract');
const invokeSmartContractImpl = require('./invokeSmartContract');
const generateRawTransactionImpl = require('./generateRawTransactions');
const sendRawTransactionImpl = require('./sendRawTransactions');
const Color = require('./common').Color;
const commLogger = CaliperUtils.getLogger('fiscoBcos.js');

/**
 * Implements {BlockchainInterface} for a FISCO BCOS backend.
 */
class FiscoBcos extends BlockchainInterface {
    /**
     * Create a new instance of the {FISCO BCOS} class.
     * @param {string} config_path The absolute path of the FISCO BCOS network configuration file.
     * @param {string} workspace_root The absolute path to the root location for the application configuration files.
     */
    constructor(config_path, workspace_root) {
        super(config_path);
        this.bcType = 'fisco-bcos';
        this.workspaceRoot = workspace_root;
        this.fiscoBcosSettings = CaliperUtils.parseYaml(this.configPath)['fisco-bcos'];
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
        const fiscoBcosSettings = CaliperUtils.parseYaml(this.configPath)['fisco-bcos'];
        try {
            await installSmartContractImpl.run(fiscoBcosSettings, this.workspaceRoot);
        } catch (error) {
            commLogger.error(Color.error(`FISCO BCOS smart contract install failed: ${(error.stack ? error.stack : error)}`));
            throw error;
        }
    }

    /**
     * Get a context for subsequent operations
     * 'engine' attribute of returned context object must be reserved for benchmark engine to extend the context
     *  engine = {
     *   submitCallback: callback which must be called once new transaction(s) is submitted, it receives a number argument which tells how many transactions are submitted
     * }
     * @param {String} name name of the context
     * @param {Object} args adapter specific arguments
     * @param {Integer} clientIdx the client index
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async getContext(name, args, clientIdx) {
        return Promise.resolve();
    }

    /**
     * Release a context as well as related resources
     * @param {Object} context adapter specific object
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async releaseContext(context) {
        return Promise.resolve();
    }

    /**
     * Invoke the given smart contract according to the specified options. Multiple transactions will be generated according to the length of args.
     * @param {object} context The FISCO BCOS context returned by {getContext}.
     * @param {string} contractID The name of the smart contract.
     * @param {string} contractVer The version of the smart contract.
     * @param {Array} args Array of JSON formatted arguments for transaction(s). Each element contains arguments (including the function name) passing to the smart contract. JSON attribute named transaction_type is used by default to specify the function name. If the attribute does not exist, the first attribute will be used as the function name.
     * @param {number} timeout The timeout to set for the execution in seconds.
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async invokeSmartContract(context, contractID, contractVer, args, timeout) {
        let promises = [];
        try {
            args.forEach((arg) => {
                let fcn = null;
                let fcArgs = [];

                for (let key in arg) {
                    if (key === 'transaction_type') {
                        fcn = arg[key].toString();
                    } else {
                        fcArgs.push(arg[key].toString());
                    }
                }
                promises.push(invokeSmartContractImpl.run(context, this.fiscoBcosSettings, contractID, fcn, fcArgs, this.workspaceRoot));
            });

            return await Promise.all(promises);
        } catch (error) {
            commLogger.error(Color.error(`FISCO BCOS smart contract invoke failed: ${(error.stack ? error.stack : JSON.stringify(error))}`));
            throw error;
        }
    }

    /**
     * Query state from the ledger
     * @param {Object} context The FISCO BCOS context returned by {getContext}
     * @param {String} contractID Identity of the contract
     * @param {String} contractVer Version of the contract
     * @param {String} key lookup key
     * @param {String} fcn The smart contract query function name
     * @return {Promise<object>} The result of the query.
     */
    async queryState(context, contractID, contractVer, key, fcn) {
        try {
            return invokeSmartContractImpl.run(context, this.fiscoBcosSettings, contractID, fcn, key, this.workspaceRoot, true);
        } catch (error) {
            commLogger.error(Color.error(`FISCO BCOS smart contract query failed: ${(error.stack ? error.stack : error)}`));
            throw error;
        }
    }

    /**
     * Generate an raw transaction and store in local file
     * @param {Object} context The FISCO BCOS context returned by {getContext}
     * @param {String} contractID Identity of the contract
     * @param {Object} arg Arguments of the transaction
     * @param {String} file File path which will be used to store then transaction
     * @return {TaskStatus} Indicates whether the transaction is written to the file successfully or not
     */
    async generateRawTransaction(context, contractID, arg, file) {
        return generateRawTransactionImpl.run(this.fiscoBcosSettings, this.workspaceRoot, context, contractID, arg, file);
    }

    /**
     * Send raw transactions
     * @param {Object} context The FISCO BCOS context returned by {getContext}
     * @param {Array} transactions List of raw transactions
     * @return {Promise} The promise for the result of the execution
     */
    async sendRawTransaction(context, transactions) {
        return sendRawTransactionImpl.run(this.fiscoBcosSettings, context, transactions);
    }
}

module.exports = FiscoBcos;
