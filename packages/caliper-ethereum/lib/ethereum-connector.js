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
const EEAClient = require('web3-eea');
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
        if (this.ethereumConfig.privacy) {
            this.web3eea = new EEAClient(this.web3, ethereumConfig.chainId);
        }
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
            const contract = this.ethereumConfig.contracts[key];
            const contractData = require(CaliperUtils.resolvePath(contract.path)); // TODO remove path property
            const contractGas = contract.gas;
            const estimateGas = contract.estimateGas;
            let privacy;
            if (this.ethereumConfig.privacy) {
                privacy = this.ethereumConfig.privacy[contract.private];
            }

            this.ethereumConfig.contracts[key].abi = contractData.abi;
            promises.push(new Promise(async function(resolve, reject) {
                let contractInstance;
                try {
                    if (privacy) {
                        contractInstance = await self.deployPrivateContract(contractData, privacy);
                        logger.info('Deployed private contract ' + contractData.name + ' at ' + contractInstance.options.address);
                    } else {
                        contractInstance = await self.deployContract(contractData);
                        logger.info('Deployed contract ' + contractData.name + ' at ' + contractInstance.options.address);
                    }
                } catch (err) {
                    reject(err);
                }
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

        if (this.ethereumConfig.privacy) {
            context.web3eea = this.web3eea;
            context.privacy = this.ethereumConfig.privacy;
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
        if (request.privacy) {
            return this._sendSinglePrivateRequest(request);
        }

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
     * Submit a private transaction to the ethereum context.
     * @param {EthereumInvoke} request Methods call data.
     * @return {Promise<TxStatus>} Result and stats of the transaction invocation.
     */
    async _sendSinglePrivateRequest(request) {
        const context = this.context;
        const web3eea = context.web3eea;
        const contractInfo = context.contracts[request.contract];
        const privacy = request.privacy;
        const sender = privacy.sender;

        const status = new TxStatus();

        const onFailure = (err) => {
            status.SetStatusFail();
            logger.error('Failed private tx on ' + request.contract + ' calling method ' + request.verb + ' private nonce ' + 0);
            logger.error(err);
        };

        const onSuccess = (rec) => {
            status.SetID(rec.transactionHash);
            status.SetResult(rec);
            status.SetVerification(true);
            status.SetStatusSuccess();
        };

        let payload;
        if (request.args) {
            payload = contractInfo.contract.methods[request.verb](...request.args).encodeABI();
        } else {
            payload = contractInfo.contract.methods[request.verb]().encodeABI();
        }

        const transaction = {
            to: contractInfo.contract._address,
            data: payload
        };

        try {
            if (request.readOnly) {
                transaction.privacyGroupId = await this.resolvePrivacyGroup(privacy);

                const value = await web3eea.priv.call(transaction);
                onSuccess(value);
            } else {
                transaction.nonce = sender.nonce;
                transaction.privateKey = sender.privateKey.substring(2);
                this.setPrivateTransactionParticipants(transaction, privacy);

                const txHash = await web3eea.eea.sendRawTransaction(transaction);
                const rcpt = await web3eea.priv.getTransactionReceipt(txHash, transaction.privateFrom);
                if (rcpt.status === '0x1')  {
                    onSuccess(rcpt);
                } else {
                    onFailure(rcpt);
                }
            }
        } catch(err) {
            onFailure(err);
        }

        return status;
    }


    /**
     * Deploys a new contract using the given web3 instance
     * @param {JSON} contractData Contract data with abi, bytecode and gas properties
     * @returns {Promise<web3.eth.Contract>} The deployed contract instance
     */
    async deployContract(contractData) {
        const web3 = this.web3;
        const contractDeployerAddress = this.ethereumConfig.contractDeployerAddress;
        const contract = new web3.eth.Contract(contractData.abi);
        const contractDeploy = contract.deploy({
            data: contractData.bytecode
        });

        try {
            return contractDeploy.send({
                from: contractDeployerAddress,
                gas: contractData.gas
            });
        } catch (err) {
            throw(err);
        }
    }

    /**
     * Deploys a new contract using the given web3 instance
     * @param {JSON} contractData Contract data with abi, bytecode and gas properties
     * @param {JSON} privacy Privacy options
     * @returns {Promise<web3.eth.Contract>} The deployed contract instance
     */
    async deployPrivateContract(contractData, privacy) {
        const web3 = this.web3;
        const web3eea = this.web3eea;
        // Using randomly generated account to deploy private contract to avoid public/private nonce issues
        const deployerAccount =  web3.eth.accounts.create();

        const transaction = {
            data: contractData.bytecode,
            nonce: deployerAccount.nonce,
            privateKey: deployerAccount.privateKey.substring(2),    // web3js-eea doesn't not accept private keys prefixed by '0x'
        };

        this.setPrivateTransactionParticipants(transaction, privacy);

        try {
            const txHash = await web3eea.eea.sendRawTransaction(transaction);
            const txRcpt = await web3eea.priv.getTransactionReceipt(txHash, transaction.privateFrom);

            if (txRcpt.status === '0x1') {
                return new web3.eth.Contract(contractData.abi, txRcpt.contractAddress);
            } else {
                logger.error('Failed private transaction hash ' + txHash);
                throw new Error('Failed private transaction hash ' + txHash);
            }
        } catch (err) {
            logger.error('Error deploying private contract: ', JSON.stringify(err));
            throw(err);
        }
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

    /**
     * Returns the privacy group id depending on the privacy mode being used
     * @param {JSON} privacy Privacy options
     * @returns {Promise<string>} The privacyGroupId
     */
    async resolvePrivacyGroup(privacy) {
        const web3eea = this.context.web3eea;

        switch(privacy.groupType) {
        case 'legacy': {
            const privGroups = await web3eea.priv.findPrivacyGroup({addresses: [privacy.privateFrom, ...privacy.privateFor]});
            if (privGroups.length > 0) {
                return privGroups.filter(function(el) {
                    return el.type === 'LEGACY';
                })[0].privacyGroupId;
            } else {
                throw new Error('Multiple legacy privacy groups with same members. Can\'t resolve privacyGroupId.');
            }
        }
        case 'pantheon':
        case 'onchain': {
            return privacy.privacyGroupId;
        } default: {
            throw new Error('Invalid privacy type');
        }
        }
    }

    /**
     * Set the participants of a privacy transaction depending on the privacy mode being used
     * @param {JSON} transaction Object representing the transaction fields
     * @param {JSON} privacy Privacy options
     */
    setPrivateTransactionParticipants(transaction, privacy) {
        switch(privacy.groupType) {
        case 'legacy': {
            transaction.privateFrom = privacy.privateFrom;
            transaction.privateFor = privacy.privateFor;
            break;
        }
        case 'pantheon':
        case 'onchain': {
            transaction.privateFrom = privacy.privateFrom;
            transaction.privacyGroupId = privacy.privacyGroupId;
            break;
        } default: {
            throw new Error('Invalid privacy type');
        }
        }
    }
}

module.exports = EthereumConnector;
