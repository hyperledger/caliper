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
const { BlockchainInterface, CaliperUtils, ConfigUtil, TxStatus } = require('@hyperledger/caliper-core');
const logger = CaliperUtils.getLogger('burrow.js');

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
 * Implements {BlockchainInterface} for a Burrow backend.
 */
class Burrow extends BlockchainInterface {

    /**
   * Create a new instance of the {Burrow} class.
   * @param {number} workerIndex The zero-based index of the worker who wants to create an adapter instance. -1 for the master process. Currently unused.
   */
    constructor(workerIndex) {
        super();
        let configPath = CaliperUtils.resolvePath(ConfigUtil.get(ConfigUtil.keys.NetworkConfig));
        this.config = require(configPath);
        this.statusInterval = null;
        this.bcType = 'burrow';
    }

    /**
     * Retrieve the blockchain type the implementation relates to
     * @returns {string} the blockchain type
     */
    getType() {
        return this.bcType;
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
     * @param {string} name The name of the callback module as defined in the configuration files.
     * @param {object} args Unused.
     * @return {object} The assembled Burrow context.
     * @async
     */
    async getContext(name, args) {
        let context = this.config.burrow.context;
        if (typeof context === 'undefined') {
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
                        resolve(context);
                    }
                });
            }).then(function(result){
                return Promise.resolve(result);
            },err => {
                logger.info('getContext reject error:',err);
                Promise.reject(err);
            });
        }
        return Promise.resolve(context);
    }

    /**
     * Release the given Burrow context.
     * @param {object} context The Burrow context to release.
     * @async
     */
    async releaseContext(context) {
        // nothing to do
    }
    /**
     * Query state from the ledger using a smart contract
     * @param {Object} context context object
     * @param {String} contractID identity of the contract
     * @param {String} contractVer version of the contract
     * @param {Array} args array of JSON formatted arguments
     * @param {Number} timeout request timeout, in seconds
     * @return {Promise} query response object
     */
    async querySmartContract(context, contractID, contractVer, args, timeout) {
        let promises = [];
        args.forEach((item, index) => {
            promises.push(this.doInvoke(context, contractID, contractVer, item, timeout));
        });
        return await Promise.all(promises);
    }
    /**
   * Invoke a smart contract.
   * @param {Object} context Context object.
   * @param {String} contractID Identity of the contract.
   * @param {String} contractVer Version of the contract.
   * @param {Array} args eg {'verb':'invoke','funName': 'getInt','funArgs': []}
   * @param {Number} timeout Request timeout, in seconds.
   * @return {Promise<object>} The promise for the result of the execution.
   */
    async invokeSmartContract(context, contractID, contractVer, args, timeout) {
        let promises = [];
        args.forEach((item, index) => {
            if(item.verb==='transfer'){
                promises.push(this.acccountTransfer(context, item, timeout));
            }else if(item.verb==='invoke'){
                if (!item.hasOwnProperty('funName')) {
                    return Promise.reject(new Error(' missed argument:funName '));
                }
                if (!item.hasOwnProperty('funArgs')) {
                    return Promise.reject(new Error(' missed argument:funArgs '));
                }
                promises.push(this.doInvoke(context, contractID, contractVer, item, timeout));
            }
        });
        return await Promise.all(promises);
    }

    /**
   * Submit a transaction to the burrow daemon with the specified options.
   * @param {Object} context Context object.
   * @param {String} contractID Identity of the contract.
   * @param {String} contractVer Version of the contract.
   * @param {Object} arg eg:{'funName': 'setInt','funArgs': [1000]}
   * @param {Number} timeout Request timeout, in seconds.
   * @return {Promise<TxStatus>} Result and stats of the transaction invocation.
   */
    async doInvoke(context, contractID, contractVer, arg, timeout) {
        let status = new TxStatus();
        if (context.engine) {
            context.engine.submitCallback(1);
        }
        //let contract = await context.burrow.contracts.address(context.address);
        //Todo: can't get contract with burrow.contracts.address
        return  context.contract[arg.funName](...arg.funArgs).then(function (result) {
            status.SetStatusSuccess();
            return status;
        },err => {
            status.SetStatusFail();
            logger.info('invoke reject error:',err);
            return status;
        });
    }
    /**
   * Submit a transaction to the burrow daemon with the specified options.
   * @param {Object} context Context object.
   * @param {String} arg {toAccount:'',money:''}
   * @param {Number} timeout Request timeout, in seconds.
   * @return {Promise<TxStatus>} Result and stats of the transaction invocation.
   */
    async acccountTransfer(context, arg, timeout) {
        let account=context.account;
        let toAccount=arg.toAccount;
        let amount= parseFloat(arg.money);
        let status = new TxStatus(toAccount);
        if (context.engine) {
            context.engine.submitCallback(1);
        }

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

    /**
     * Query the given smart contract according to the specified options.
     * @param {object} context The Burrow context returned by {getContext}.
     * @param {string} contractID The name of the contract.
     * @param {string} contractVer The version of the contract.
     * @param {string} key The argument to pass to the smart contract query.
     * @param {string} [fcn=query] The contract query function name.
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async queryState(context, contractID, contractVer, key, fcn = 'query') {
        let status = new TxStatus();
        if (context.engine) {
            context.engine.submitCallback(1);
        }
        return new Promise(function (resolve, reject) {
            let getAccountParam=new burrowTS.rpcquery.GetAccountParam();
            getAccountParam.setAddress(Buffer.from(context.address, 'hex'));
            context.burrow.qc.getAccount(getAccountParam, function (error, data) {
                if (error) {
                    status.SetStatusFail();
                    reject(error);
                } else {
                    status.SetStatusSuccess();
                    resolve(data);
                }
            });
        }).then(function (result) {
            return status;
        },error => {
            logger.info('queryState reject error:',error);
            return status;
        });
    }

    /**
   * Get adapter specific transaction statistics.
   * @param {JSON} stats txStatistics object
   * @param {Array} results array of txStatus objects.
   */
    getDefaultTxStats(stats, results) {
        // empty
    }
}
module.exports = Burrow;
