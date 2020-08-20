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

const fs = require('fs');
const burrowTS = require('@hyperledger/burrow');
const { BlockchainConnector, CaliperUtils, ConfigUtil, TxStatus } = require('@hyperledger/caliper-core');
const logger = CaliperUtils.getLogger('burrow-connector');

/**
    Read the connection details from the config file.
    @param {object} config Adapter config.
    @return {object} url, account Connection settings.
*/
function burrowConnect(config) {
    let host = config.burrow.network.validator.host;
    if (host === null) {
        throw new Error('host url not set');
    }

    let port = config.burrow.network.validator.port;
    if (port === null) {
        throw new Error('grpc port not set');
    }

    let account;
    try {
        account = fs.readFileSync(CaliperUtils.resolvePath(config.burrow.network.validator.address)).toString();
    } catch (err) {
        account = config.burrow.network.validator.address.toString();
    }
    logger.info(`Account: ${account}`);
    if (account === null) {
        throw new Error('no validator account found');
    }

    return {
        url: host + ':' + port,
        account: account,
    };
}

/**
 * Extends {BlockchainConnector} for a Burrow backend.
 */
class BurrowConnector extends BlockchainConnector {

    /**
   * Create a new instance of the {Burrow} class.
   * @param {number} workerIndex The zero-based index of the worker who wants to create an adapter instance. -1 for the master process.
   * @param {string} bcType The target SUT type
   */
    constructor(workerIndex, bcType) {
        super(workerIndex, bcType);
        let configPath = CaliperUtils.resolvePath(ConfigUtil.get(ConfigUtil.keys.NetworkConfig));
        this.config = require(configPath);
    }

    /**
     * Initialize the {Burrow} object.
     * @param {boolean} workerInit Indicates whether the initialization happens in the worker process.
     */
    async init(workerInit) {
        return await CaliperUtils.sleep(2000);
    }

    /**
     * Deploy the smart contract specified in the network configuration file.
     * @return {object} Promise execution for namereg.
     */
    async installSmartContract() {
        let connection = burrowConnect(this.config);
        let burrow = new burrowTS.Burrow(connection.url, connection.account);
        let data, abi, bytecode, contract;
        try {
            data = JSON.parse(fs.readFileSync(CaliperUtils.resolvePath(this.config.contract.path)).toString());
            abi = data.Abi;
            bytecode = data.Evm.Bytecode.Object;
            contract = await burrow.contracts.deploy(abi, bytecode);
            logger.info('contract address:',contract.address);

        } catch (err) {
            logger.error('deploy contract error',err);
            throw err;
        }
        return  new Promise(function (resolve, reject) {
            burrow.namereg.set('DOUG', contract.address, 50000, 5000,(err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        }).then(function (result) {
            return result;
        },err => {
            logger.info('namereg reject error:',err);
        });
    }

    /**
     * Return the Burrow context associated with the given callback module name.
     * @param {number} roundIndex The zero-based round index of the test.
     * @param {object} args Unused.
     * @return {Promise<object>} The assembled Burrow context.
     * @async
     */
    async getContext(roundIndex, args) {
        let context = this.config.burrow.context;
        if (typeof context === 'undefined') {
            const self = this;
            let connection = burrowConnect(this.config);
            let burrow = new burrowTS.Burrow(connection.url, connection.account);
            let contractMetaData = JSON.parse(fs.readFileSync(CaliperUtils.resolvePath(this.config.contract.path)).toString());
            // get the contract address from the namereg
            return  new Promise(function (resolve, reject) {
                burrow.namereg.get('DOUG', (err, result) => {
                    if(err){
                        reject(err);
                    }else{
                        let address=result.getData();
                        let  contract = new burrowTS.Contract(contractMetaData.Abi,contractMetaData.Evm.Bytecode.Object,address,burrow);
                        context = { account: connection.account, address: address,contract:contract, burrow: burrow };
                        self.config.burrow.context = context;
                        resolve(context);
                    }
                });
            }).then(function(result){
                return Promise.resolve(result);
            },err => {
                logger.info('getContext reject error:',err);
                return Promise.reject(err);
            });
        }
        return Promise.resolve(context);
    }

    /**
     * Release the given Burrow context.
     * @async
     */
    async releaseContext() {
        // nothing to do
    }

    /**
     * Send a request to a smart contract.
     * @param {Object} request eg {'verb':'invoke','function': 'getInt','args': []}
     * @return {Promise<TxStatus>} The promise for the result of the execution.
     */
    async _sendSingleRequest(request) {
        // request = {
        //     verb: 'transfer/invoke',
        //     function
        //     args
        // }

        if (request.verb === 'transfer') {
            return this.accountTransfer(this.config.burrow.context, request);
        }

        if(request.verb === 'invoke'){
            if (!request.hasOwnProperty('function')) {
                return Promise.reject(new Error('missed argument: function'));
            }
            if (!request.hasOwnProperty('args')) {
                return Promise.reject(new Error('missed argument: args'));
            }
            return this.doInvoke(this.config.burrow.context, request);
        }
    }

    /**
   * Submit a transaction to the burrow daemon with the specified request.
   * @param {Object} context Context object.
   * @param {Object} request eg:{'function': 'setInt','args': [1000]}
   * @return {Promise<TxStatus>} Result and stats of the transaction invocation.
   */
    async doInvoke(context, request) {
        let status = new TxStatus();

        //let contract = await context.burrow.contracts.address(context.address);
        //Todo: can't get contract with burrow.contracts.address
        return  context.contract[request.function](...request.args).then(function (result) {
            status.SetStatusSuccess();
            return status;
        },err => {
            status.SetStatusFail();
            logger.info('invoke reject error:',err);
            return status;
        });
    }
    /**
   * Submit a transaction to the burrow daemon with the specified request.
   * @param {Object} context Context object.
   * @param {object} request {toAccount:'',money:''}
   * @return {Promise<TxStatus>} Result and stats of the transaction invocation.
   */
    async accountTransfer(context, request) {
        let account=context.account;
        let toAccount=request.toAccount;
        let amount= parseFloat(request.money);
        let status = new TxStatus(toAccount);

        let inputTx=new burrowTS.payload.TxInput();
        inputTx.setAddress(Buffer.from(account, 'hex'));
        inputTx.setAmount(amount);

        let sendTx=new burrowTS.payload.SendTx();
        sendTx.addInputs(inputTx);
        let outputTx=new burrowTS.payload.TxInput();
        outputTx.setAddress(Buffer.from(toAccount, 'hex'));
        outputTx.setAmount(amount);
        sendTx.addOutputs(outputTx);
        return new Promise(function (resolve, reject) {
            context.burrow.tc.sendTxSync(sendTx, (err, data) => {
                if(err){
                    status.SetStatusFail();
                    reject(err);
                }else{
                    status.SetID(data.getReceipt().getTxhash_asB64());
                    status.SetStatusSuccess();
                    resolve(data);
                }
            });
        }).then(function (result) {
            return status;
        },err => {
            logger.info('sendTx reject error:',err);
            return status;
        });
    }
}
module.exports = BurrowConnector;
