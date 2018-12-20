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
     * Deploy the smart contract specified in the network configuration file.
     * @return {object} Promise execution for namereg.
     */
    async installSmartContract() {
        let config  = require(this.configPath);
        let grpc = config.burrow.network.validator.grpc;
        if(grpc === null) {
            logger.error('Error: Validator url not set.');
        }
        let account = fs.readFileSync(util.resolvePath(config.burrow.network.validator.address)).toString();
        let options = {objectReturn: true};
        let burrow = monax.createInstance(grpc, account, options);
        let data = JSON.parse(fs.readFileSync(util.resolvePath(config.contract.path)).toString());
        let abi = data.Abi;
        let bytecode = data.Evm.Bytecode.Object;

        const contract = burrow.contracts.new(abi, bytecode);
        let contractAddress = await contract._constructor('');
        logger.info(`Contract: ${contractAddress}`);

        // this stores the contract address in a namereg for easy retreival
        let setPayload = {
            Input: {
                Address: Buffer.from(account,'hex'),
                Amount: 50000
            },
            Name: 'DOUG',
            Data: contractAddress,
            Fee: 5000
        };

        return burrow.transact.NameTxSync(setPayload);
    }

    /**
     * Return the Burrow context associated with the given callback module name.
     * @param {string} name The name of the callback module as defined in the configuration files.
     * @param {object} args Unused.
     * @return {object} The assembled Burrow context.
     * @async
     */
    async getContext(name, args) {
        let config  = require(this.configPath);
        let context = config.burrow.context;

        if(typeof context === 'undefined') {

            let grpc = config.burrow.network.validator.grpc;
            if(grpc === null) {
                logger.error('Error: Validator url not set.');
            }
            let account = fs.readFileSync(util.resolvePath(config.burrow.network.validator.address)).toString();

            // logger.info(`Account: ${account}`);
            // logger.info(`GRPC: ${grpc}`);

            let options = {objectReturn: true};
            let burrow = monax.createInstance(grpc, account, options);

            // get the contract address from the namereg
            let address = (await burrow.query.GetName({Name: 'DOUG'})).Data;
            context = {stream: burrow, account: account, address: address};
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
   * @param {Object} context Context object.
   * @param {String} contractID Identity of the contract.
   * @param {String} contractVer Version of the contract.
   * @param {Array} args Array of JSON formatted arguments for multiple transactions.
   * @param {Number} timeout Request timeout, in seconds.
   * @return {Promise<object>} The promise for the result of the execution.
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
   * @param {Object} context Context object.
   * @param {String} contractID Identity of the contract.
   * @param {String} contractVer Version of the contract.
   * @param {Array} args Array of JSON formatted arguments for multiple transactions.
   * @param {Number} timeout Request timeout, in seconds.
   * @return {Promise<TxStatus>} Result and stats of the transaction invocation.
   */
    async burrowTransaction(context, contractID, contractVer, args, timeout) {
        let status = new TxStatus(args.account);
        if(context.engine) {
            context.engine.submitCallback(1);
        }

        let tx = {
            Input: {
                Address: Buffer.from(context.account,'hex'),
                Amount: args.money
            },
            Address: Buffer.from(context.address, 'hex'),
            GasLimit: 5000,
            Fee: 5000
        };

        try {
            let execution = await context.stream.transact.CallTxSync(tx);
            status.SetID(execution.TxHash.toString());
            status.SetStatusSuccess();
        } catch (err) {
            status.SetStatusFail();
        }

        return status;
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
