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

const Web3 = require('web3');
const {BlockchainInterface, CaliperUtils, TxStatus} = require('@hyperledger/caliper-core');
const logger = CaliperUtils.getLogger('ethereum.js');

/**
 * @typedef {Object} EthereumInvoke
 *
 * @property {string} verb Required. The name of the smart contract function
 * @property {string} args Required. Arguments of the smart contract function in the order in which they are defined
 * @property {boolean} isView Optional. If method to call is a view.
 */

/**
 * Implements {BlockchainInterface} for a web3 Ethereum backend.
 */
class Ethereum extends BlockchainInterface {

    /**
     * Create a new instance of the {Ethereum} class.
     * @param {string} config_path The path of the network configuration file.
     * @param {string} workspace_root The absolute path to the root location for the application configuration files.
     */
    constructor(config_path, workspace_root) {
        super(config_path);
        this.bcType = 'ethereum';
        this.workspaceRoot = workspace_root;
        this.ethereumConfig = require(config_path).ethereum;
        this.web3 = new Web3(this.ethereumConfig.url);
        this.web3.transactionConfirmationBlocks = this.ethereumConfig.transactionConfirmationBlocks;
    }

    /**
     * Initialize the {Ethereum} object.
     * @return {object} Promise<boolean> True if the account got unlocked successful otherwise false.
     */
    init() {
        if (this.ethereumConfig.contractDeployerAddressPrivateKey) {
            this.web3.eth.accounts.wallet.add(this.ethereumConfig.contractDeployerAddressPrivateKey);
        } else if (this.ethereumConfig.contractDeployerAddressPassword) {
            return this.web3.eth.personal.unlockAccount(this.ethereumConfig.contractDeployerAddress, this.ethereumConfig.contractDeployerAddressPassword, 1000);
        }
    }

    /**
     * Deploy smart contracts specified in the network configuration file.
     * @return {object} Promise execution for all the contract creations.
     */
    async installSmartContract() {
        let promises = [];
        let self = this;
        logger.info('Creating contracts...');
        for (const key of Object.keys(this.ethereumConfig.contracts)) {
            let contractData = require(CaliperUtils.resolvePath(this.ethereumConfig.contracts[key].path, this.workspaceRoot)); // TODO remove path property
            this.ethereumConfig.contracts[key].abi = contractData.abi;
            promises.push(new Promise(async function(resolve, reject) {
                let contractInstance = await self.deployContract(contractData);
                logger.info('Deployed contract ' + contractData.name + ' at ' + contractInstance.options.address);
                self.ethereumConfig.contracts[key].address = contractInstance.options.address;
                resolve(contractInstance);
            }));
        }
        return Promise.all(promises);
    }

    /**
     * Return the Ethereum context associated with the given callback module name.
     * @param {string} name The name of the callback module as defined in the configuration files.
     * @param {object} args Unused.
     * @return {object} The assembled Ethereum context.
     * @async
     */
    async getContext(name, args) {
        let context = {fromAddress: this.ethereumConfig.fromAddress};
        context.web3 = this.web3;
        context.contracts = {};
        for (const key of Object.keys(args.contracts)) {
            context.contracts[key] = new this.web3.eth.Contract(args.contracts[key].abi, args.contracts[key].address);
        }
        context.nonces = {};
        context.nonces[this.ethereumConfig.fromAddress] = await this.web3.eth.getTransactionCount(this.ethereumConfig.fromAddress);
        if (this.ethereumConfig.fromAddressPrivateKey) {
            this.web3.eth.accounts.wallet.add(this.ethereumConfig.fromAddressPrivateKey);
        } else if (this.ethereumConfig.fromAddressPassword) {
            await context.web3.eth.personal.unlockAccount(this.ethereumConfig.fromAddress, this.ethereumConfig.fromAddressPassword, 1000);
        }
        return context;
    }

    /**
     * Release the given Ethereum context.
     * @param {object} context The Ethereum context to release.
     * @async
     */
    async releaseContext(context) {
        // nothing to do
    }

    /**
     * Invoke a smart contract.
     * @param {Object} context Context object.
     * @param {String} contractID Identity of the contract.
     * @param {String} contractVer Version of the contract.
     * @param {EthereumInvoke|EthereumInvoke[]} invokeData Smart contract methods calls.
     * @param {Number} timeout Request timeout, in seconds.
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async invokeSmartContract(context, contractID, contractVer, invokeData, timeout) {
        let invocations;
        if (!Array.isArray(invokeData)) {
            invocations = [invokeData];
        } else {
            invocations = invokeData;
        }
        let promises = [];
        invocations.forEach((item, index) => {
            promises.push(this.sendTransaction(context, contractID, contractVer, item, timeout));
        });
        return Promise.all(promises);
    }

    /**
     * Query a smart contract.
     * @param {Object} context Context object.
     * @param {String} contractID Identity of the contract.
     * @param {String} contractVer Version of the contract.
     * @param {EthereumInvoke|EthereumInvoke[]} invokeData Smart contract methods calls.
     * @param {Number} timeout Request timeout, in seconds.
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async querySmartContract(context, contractID, contractVer, invokeData, timeout) {
        let invocations;
        if (!Array.isArray(invokeData)) {
            invocations = [invokeData];
        } else {
            invocations = invokeData;
        }
        let promises = [];
        invocations.forEach((item, index) => {
            item.isView = true;
            promises.push(this.sendTransaction(context, contractID, contractVer, item, timeout));
        });
        return Promise.all(promises);
    }

    /**
     * Submit a transaction to the ethereum context.
     * @param {Object} context Context object.
     * @param {String} contractID Identity of the contract.
     * @param {String} contractVer Version of the contract.
     * @param {EthereumInvoke} methodCall Methods call data.
     * @param {Number} timeout Request timeout, in seconds.
     * @return {Promise<TxStatus>} Result and stats of the transaction invocation.
     */
    async sendTransaction(context, contractID, contractVer, methodCall, timeout) {
        let status = new TxStatus();
        let params = {from: context.fromAddress};
        try {
            context.engine.submitCallback(1);
            let receipt = null;
            let methodType = 'send';
            if (methodCall.isView) {
                methodType = 'call';
            } else {
                let nonce = context.nonces[context.fromAddress];
                context.nonces[context.fromAddress] = nonce + 1;
                params.nonce = nonce;
            }
            if (methodCall.args) {
                params.gas = 1000 + await context.contracts[contractID].methods[methodCall.verb](...methodCall.args).estimateGas();
                receipt = await context.contracts[contractID].methods[methodCall.verb](...methodCall.args)[methodType](params);
            } else {
                params.gas = 1000 + await context.contracts[contractID].methods[methodCall.verb].estimateGas(params);
                receipt = await context.contracts[contractID].methods[methodCall.verb]()[methodType](params);
            }
            status.SetID(receipt.transactionHash);
            status.SetResult(receipt);
            status.SetVerification(true);
            status.SetStatusSuccess();
        } catch (err) {
            status.SetStatusFail();
            logger.error('Failed tx on ' + contractID + ' calling method ' + methodCall.verb + ' nonce ' + params.nonce);
            logger.error(err);
        }
        return Promise.resolve(status);
    }

    /**
     * Query the given smart contract according to the specified options.
     * @param {object} context The Ethereum context returned by {getContext}.
     * @param {string} contractID The name of the contract.
     * @param {string} contractVer The version of the contract.
     * @param {string} key The argument to pass to the smart contract query.
     * @param {string} [fcn=query] The contract query function name.
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async queryState(context, contractID, contractVer, key, fcn = 'query') {
        let methodCall = {
            verb: fcn,
            args: [key],
            isView: true
        };
        return this.sendTransaction(context, contractID, contractVer, methodCall, 60);
    }

    /**
     * Deploys a new contract using the given web3 instance
     * @param {JSON} contractData Contract data with abi, bytecode and gas properties
     * @returns {Promise<web3.eth.Contract>} The deployed contract instance
     */
    deployContract(contractData) {
        let web3 = this.web3;
        let contractDeployerAddress = this.ethereumConfig.contractDeployerAddress;
        return new Promise(function(resolve, reject) {
            let contract = new web3.eth.Contract(contractData.abi);
            let contractDeploy = contract.deploy({
                data: contractData.bytecode
            });
            contractDeploy.send({
                from: contractDeployerAddress,
                gas: contractData.gas
            }).on('error', (error) => {
                reject(error);
            }).then((newContractInstance) => {
                resolve(newContractInstance);
            });
        });
    }

    /**
     * It passes deployed contracts addresses to all clients
     * @param {Number} number of clients to prepare
     * @returns {Array} client args
     */
    async prepareClients(number) {
        let result = [];
        for (let i = 0 ; i< number ; i++) {
            result[i] = {contracts: this.ethereumConfig.contracts};
        }
        return result;
    }
}

module.exports = Ethereum;
