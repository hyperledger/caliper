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
const {ConnectorBase, CaliperUtils, ConfigUtil, TxStatus} = require('@hyperledger/caliper-core');

const logger = CaliperUtils.getLogger('ethereum-connector');

/**
 * @typedef {Object} EthereumInvoke
 *
 * @property {string} contract Required. The name of the smart contract
 * @property {string} verb Required. The name of the smart contract function
 * @property {string} args Required. Arguments of the smart contract function in the order in which they are defined
 * @property {boolean} readOnly Optional. If method to call is a view.
 */

/**
 * Extends {BlockchainConnector} for a web3 Ethereum backend.
 */
class EthereumConnector extends ConnectorBase {

    /**
     * Create a new instance of the {Ethereum} class.
     * @param {number} workerIndex The zero-based index of the worker who wants to create an adapter instance. -1 for the manager process.
     * @param {string} bcType The target SUT type
     */
    constructor(workerIndex, bcType) {
        super(workerIndex, bcType);

        let configPath = CaliperUtils.resolvePath(ConfigUtil.get(ConfigUtil.keys.NetworkConfig));
        let ethereumConfig = require(configPath).ethereum;

        // throws on configuration error
        this.checkConfig(ethereumConfig);

        this.ethereumConfig = ethereumConfig;
        this.web3 = new Web3(this.ethereumConfig.url);
        this.web3.transactionConfirmationBlocks = this.ethereumConfig.transactionConfirmationBlocks;
        this.workerIndex = workerIndex;
        this.context = undefined;
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
     * @param {Number} roundIndex The zero-based round index of the test.
     * @param {object} args worker arguments.
     * @return {object} The assembled Ethereum context.
     * @async
     */
    async getContext(roundIndex, args) {
        let context = {
            chainId: 1,
            clientIndex: this.workerIndex,
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
            let wallet = hdwallet.derivePath('m/44\'/60\'/' + this.workerIndex + '\'/0/0').getWallet();
            context.fromAddress = wallet.getChecksumAddressString();
            context.nonces[context.fromAddress] = await this.web3.eth.getTransactionCount(context.fromAddress);
            this.web3.eth.accounts.wallet.add(wallet.getPrivateKeyString());
        } else if (this.ethereumConfig.fromAddressPrivateKey) {
            context.nonces[this.ethereumConfig.fromAddress] = await this.web3.eth.getTransactionCount(this.ethereumConfig.fromAddress);
            this.web3.eth.accounts.wallet.add(this.ethereumConfig.fromAddressPrivateKey);
        } else if (this.ethereumConfig.fromAddressPassword) {
            await context.web3.eth.personal.unlockAccount(this.ethereumConfig.fromAddress, this.ethereumConfig.fromAddressPassword, 1000);
        }

        this.context = context;
        return context;
    }

    /**
     * Release the given Ethereum context.
     * @async
     */
    async releaseContext() {
        // nothing to do
    }

    /**
     * Submit a transaction to the ethereum context.
     * @param {EthereumInvoke} request Methods call data.
     * @return {Promise<TxStatus>} Result and stats of the transaction invocation.
     */
    async _sendSingleRequest(request) {
        const context = this.context;
        let status = new TxStatus();
        let params = {from: context.fromAddress};
        let contractInfo = context.contracts[request.contract];

        let receipt = null;
        let methodType = 'send';
        if (request.readOnly) {
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
            logger.error('Failed tx on ' + request.contract + ' calling method ' + request.verb + ' nonce ' + params.nonce);
            logger.error(err);
        };

        const onSuccess = (rec) => {
            status.SetID(rec.transactionHash);
            status.SetResult(rec);
            status.SetVerification(true);
            status.SetStatusSuccess();
        };

        if (request.args) {
            if (contractInfo.gas && contractInfo.gas[request.verb]) {
                params.gas = contractInfo.gas[request.verb];
            } else if (contractInfo.estimateGas) {
                params.gas = 1000 + await contractInfo.contract.methods[request.verb](...request.args).estimateGas();
            }

            try {
                receipt = await contractInfo.contract.methods[request.verb](...request.args)[methodType](params);
                onSuccess(receipt);
            } catch (err) {
                onFailure(err);
            }
        } else {
            if (contractInfo.gas && contractInfo.gas[request.verb]) {
                params.gas = contractInfo.gas[request.verb];
            } else if (contractInfo.estimateGas) {
                params.gas = 1000 + await contractInfo.contract.methods[request.verb].estimateGas(params);
            }

            try {
                receipt = await contractInfo.contract.methods[request.verb]()[methodType](params);
                onSuccess(receipt);
            } catch (err) {
                onFailure(err);
            }
        }

        return status;
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
     * It passes deployed contracts addresses to all workers (only known after deploy contract)
     * @param {Number} number of workers to prepare
     * @returns {Array} worker args
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

module.exports = EthereumConnector;
