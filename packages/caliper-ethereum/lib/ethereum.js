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

const EthereumHDKey = require('ethereumjs-wallet/hdkey');
const Web3 = require('web3');
const {BlockchainInterface, CaliperUtils, ConfigUtil, TxStatus} = require('@hyperledger/caliper-core');
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
     * @param {number} workerIndex The zero-based index of the worker who wants to create an adapter instance. -1 for the master process.
     */
    constructor(workerIndex) {
        super();
        this.bcType = 'ethereum';

        let configPath = CaliperUtils.resolvePath(ConfigUtil.get(ConfigUtil.keys.NetworkConfig));
        let ethereumConfig = require(configPath).ethereum;

        // throws on configuration error
        this.checkConfig(ethereumConfig);

        this.ethereumConfig = ethereumConfig;
        this.web3 = new Web3(this.ethereumConfig.url);
        this.web3.transactionConfirmationBlocks = this.ethereumConfig.transactionConfirmationBlocks;
        this.clientIndex = workerIndex;
    }

    /**
     * Check the ethereum networkconfig file for errors, throw if invalid
     * @param {object} ethereumConfig The ethereum networkconfig to check.
     */
    checkConfig(ethereumConfig) {
        if (!ethereumConfig.url) {
            throw new Error(
                'No URL given to access the Ethereum SUT. Please check your network configuration. ' +
                'Please see https://hyperledger.github.io/caliper/v0.3/ethereum-config/ for more info.'
            );
        }

        if (ethereumConfig.url.toLowerCase().indexOf('http') === 0) {
            throw new Error(
                'Ethereum benchmarks must not use http(s) RPC connections, as there is no way to guarantee the ' +
                'order of submitted transactions when using other transports. For more information, please see ' +
                'https://github.com/hyperledger/caliper/issues/776#issuecomment-624771622'
            );
        }

        //TODO: add validation logic for the rest of the configuration object
    }

    /**
     * Retrieve the blockchain type the implementation relates to
     * @returns {string} the blockchain type
     */
    getType() {
        return this.bcType;
    }

    /**
     * Initialize the {Ethereum} object.
     * @param {boolean} workerInit Indicates whether the initialization happens in the worker process.
     * @return {object} Promise<boolean> True if the account got unlocked successful otherwise false.
     */
    init(workerInit) {
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
            let contractData = require(CaliperUtils.resolvePath(this.ethereumConfig.contracts[key].path)); // TODO remove path property
            let contractGas = this.ethereumConfig.contracts[key].gas;
            let estimateGas = this.ethereumConfig.contracts[key].estimateGas;
            this.ethereumConfig.contracts[key].abi = contractData.abi;
            promises.push(new Promise(async function(resolve, reject) {
                let contractInstance = await self.deployContract(contractData);
                logger.info('Deployed contract ' + contractData.name + ' at ' + contractInstance.options.address);
                self.ethereumConfig.contracts[key].address = contractInstance.options.address;
                self.ethereumConfig.contracts[key].gas = contractGas;
                self.ethereumConfig.contracts[key].estimateGas = estimateGas;
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
        let context = {
            chainId: 1,
            clientIndex: this.clientIndex,
            gasPrice: 0,
            contracts: {},
            nonces: {},
            web3: this.web3
        };

        context.gasPrice = this.ethereumConfig.gasPrice !== undefined
            ? this.ethereumConfig.gasPrice
            : await this.web3.eth.getGasPrice();

        context.chainId = this.ethereumConfig.chainId !== undefined
            ? this.ethereumConfig.chainId
            : await this.web3.eth.getChainId();

        for (const key of Object.keys(args.contracts)) {
            context.contracts[key] = {
                contract: new this.web3.eth.Contract(args.contracts[key].abi, args.contracts[key].address),
                gas: args.contracts[key].gas,
                estimateGas: args.contracts[key].estimateGas
            };
        }

        if (this.ethereumConfig.fromAddress) {
            context.fromAddress = this.ethereumConfig.fromAddress;
        }

        if (this.ethereumConfig.contractDeployerAddress) {
            context.contractDeployerAddress = this.ethereumConfig.contractDeployerAddress;
            context.contractDeployerAddressPrivateKey = this.ethereumConfig.contractDeployerAddressPrivateKey;
        }

        if (this.ethereumConfig.fromAddressSeed) {
            let hdwallet = EthereumHDKey.fromMasterSeed(this.ethereumConfig.fromAddressSeed);
            let wallet = hdwallet.derivePath('m/44\'/60\'/' + this.clientIndex + '\'/0/0').getWallet();
            context.fromAddress = wallet.getChecksumAddressString();
            context.nonces[context.fromAddress] = await this.web3.eth.getTransactionCount(context.fromAddress);
            this.web3.eth.accounts.wallet.add(wallet.getPrivateKeyString());
        } else if (this.ethereumConfig.fromAddressPrivateKey) {
            context.nonces[this.ethereumConfig.fromAddress] = await this.web3.eth.getTransactionCount(this.ethereumConfig.fromAddress);
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
        let contractInfo = context.contracts[contractID];

        context.engine.submitCallback(1);
        let receipt = null;
        let methodType = 'send';
        if (methodCall.isView) {
            methodType = 'call';
        } else if (context.nonces && (typeof context.nonces[context.fromAddress] !== 'undefined')) {
            let nonce = context.nonces[context.fromAddress];
            context.nonces[context.fromAddress] = nonce + 1;
            params.nonce = nonce;

            // leaving these values unset causes web3 to fetch gasPrice and
            // chainId on the fly. This can cause transactions to be
            // reordered, which in turn causes nonce failures
            params.gasPrice = context.gasPrice;
            params.chainId = context.chainId;
        }

        const onFailure = (err) => {
            status.SetStatusFail();
            logger.error('Failed tx on ' + contractID + ' calling method ' + methodCall.verb + ' nonce ' + params.nonce);
            logger.error(err);
        };

        const onSuccess = (rec) => {
            status.SetID(rec.transactionHash);
            status.SetResult(rec);
            status.SetVerification(true);
            status.SetStatusSuccess();
        };

        if (methodCall.args) {
            if (contractInfo.gas && contractInfo.gas[methodCall.verb]) {
                params.gas = contractInfo.gas[methodCall.verb];
            } else if (contractInfo.estimateGas) {
                params.gas = 1000 + await contractInfo.contract.methods[methodCall.verb](...methodCall.args).estimateGas();
            }

            try {
                receipt = await contractInfo.contract.methods[methodCall.verb](...methodCall.args)[methodType](params);
                onSuccess(receipt);
            } catch (err) {
                onFailure(err);
            }
        } else {
            if (contractInfo.gas && contractInfo.gas[methodCall.verb]) {
                params.gas = contractInfo.gas[methodCall.verb];
            } else if (contractInfo.estimateGas) {
                params.gas = 1000 + await contractInfo.contract.methods[methodCall.verb].estimateGas(params);
            }

            try {
                receipt = await contractInfo.contract.methods[methodCall.verb]()[methodType](params);
                onSuccess(receipt);
            } catch (err) {
                onFailure(err);
            }
        }

        return status;
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
     * It passes deployed contracts addresses to all clients (only known after deploy contract)
     * @param {Number} number of clients to prepare
     * @returns {Array} client args
     * @async
     */
    async prepareWorkerArguments(number) {
        let result = [];
        for (let i = 0 ; i<= number ; i++) {
            result[i] = {contracts: this.ethereumConfig.contracts};
        }
        return result;
    }
}

module.exports = Ethereum;
