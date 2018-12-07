/**
 * Copyright 2017 HUAWEI. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * @file, definition of the Burrow class, which implements the Caliper's NBI for Hyperledger Burrow.
 */

'use strict';

const fs = require('fs');
const monax = require('@monax/burrow');
const BlockchainInterface = require('../comm/blockchain-interface.js');
const util = require('../comm/util.js');
const logger = util.getLogger('burrow.js');
const TxStatus = require('../comm/transaction');

/**
 * Implements {BlockchainInterface} for a Burrow backend.
 */
class Burrow extends BlockchainInterface{

    /**
   * Create a new instance of the {Burrow} class.
   * @param {string} config_path The path of the Fabric network configuration file.
   */
    constructor(config_path) {
        super(config_path);
        this.statusInterval = null;
    }

    /**
     * Initialize the {Burrow} object.
     * @return {time} sleep
     */
    init() {
        return util.sleep(2000);
    }

    /**
     * Deploy the chaincode specified in the network configuration file to all peers.
     * @return {Burrow} resolve
     */
    installSmartContract() {
        // TODO: complete
        return Promise.resolve();
    }

    /**
     * Return the Burrow context associated with the given callback module name.
     * @param {string} name The name of the callback module as defined in the configuration files.
     * @param {object} args Unused.
     * @return {object} The assembled Fabric context.
     * @async
     */
    getContext(name, args) {
        let config  = require(this.configPath);
        let context = config.burrow.context;
        if(typeof context === 'undefined') {

            let grpc = config.burrow.network.validator.grpc;
            if(grpc === null) {
                logger.error('Error: Validator url not set.');
            }
            let account = fs.readFileSync(util.resolvePath(config.burrow.network.validator.address)).toString();

            logger.info(`Account: ${account}`);
            logger.info(`GRPC: ${grpc}`);

            let options = {objectReturn: true};
            let burrow = monax.createInstance(grpc, account, options);
            context = {stream: burrow, account: account};
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
   * Invoke a smart contract.
   * @param {Object} context context object
   * @param {String} contractID identity of the contract
   * @param {String} contractVer version of the contract
   * @param {Array} args array of JSON formatted arguments for multiple transactions
   * @param {Number} timeout request timeout, in seconds
   * @return {Promise<object>} the promise for the result of the execution.
   */
    async invokeSmartContract(context, contractID, contractVer, args, timeout) {
        let promises = [];
        args.forEach((item, index)=>{
            promises.push(this.burrowTransaction(context, contractID, contractVer, item, timeout));
        });
        return await Promise.all(promises);
    }

    /**
   * Submit a transaction to the burrow daemon with the specified options.
   * @param {Object} context context object
   * @param {String} contractID identity of the contract
   * @param {String} contractVer version of the contract
   * @param {Array} args array of JSON formatted arguments for multiple transactions
   * @param {Number} timeout request timeout, in seconds
   * @return {Promise<TxStatus>} result and stats of the transaction invocation.
   */
    async burrowTransaction(context, contractID, contractVer, args, timeout) {
        let status = new TxStatus(args.account);
        status.Set('timeout', timeout*1000);
        if(context.engine) {
            context.engine.submitCallback(1);
        }

        let tx = {
            Input: {
                Address: Buffer.from(context.account,'hex'),
                Amount: args.money
            },
            GasLimit: 5000,
            Fee: 5000
        };

        return context.stream.transact.CallTxSync(tx).then((execution)=>{
            status.SetID(execution.TxHash.toString());
            status.SetStatusSuccess();
            return status;
        });
    }

    /**
     * Query the given chaincode according to the specified options.
     * @param {object} context The Burrow context returned by {getContext}.
     * @param {string} contractID The name of the chaincode.
     * @param {string} contractVer The version of the chaincode.
     * @param {string} key The argument to pass to the chaincode query.
     * @param {string} [fcn=query] The chaincode query function name.
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async queryState(context, contractID, contractVer, key, fcn = 'query') {
        return Promise.resolve();
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
