/**
 * Copyright 2017 HUAWEI. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * @file, definition of the Fabric class, which implements the caliper's NBI for hyperledger fabric
 */

'use strict';

const util = require('./util.js');
const e2eUtils = require('./e2eUtils.js');
const impl_create = require('./create-channel.js');
const impl_join = require('./join-channel.js');
const impl_install = require('./install-chaincode.js');
const impl_instantiate = require('./instantiate-chaincode.js');
const BlockchainInterface = require('../comm/blockchain-interface.js');
const commUtils = require('../comm/util');
const commLogger = commUtils.getLogger('fabric.js');
const TxStatus = require('../comm/transaction');

/**
 * Implements {BlockchainInterface} for a Fabric backend.
 */
class Fabric extends BlockchainInterface{
    /**
     * Create a new instance of the {Fabric} class.
     * @param {string} config_path The path of the Fabric network configuration file.
     */
    constructor(config_path) {
        super(config_path);
    }

    /**
     * Initialize the {Fabric} object.
     * @async
     */
    async init() {
        util.init(this.configPath);
        e2eUtils.init(this.configPath);
        try {
            await impl_create.run(this.configPath);
            await impl_join.run(this.configPath);
        } catch (err) {
            commLogger.error(`Fabric initialization failed: ${(err.stack ? err.stack : err)}`);
            throw err;
        }
    }

    /**
     * Deploy the chaincode specified in the network configuration file to all peers.
     * @async
     */
    async installSmartContract() {
        // todo: now all chaincodes are installed and instantiated in all peers, should extend this later
        try {
            await impl_install.run(this.configPath);
            await impl_instantiate.run(this.configPath);
        } catch (err) {
            commLogger.error(`Fabric chaincode install failed: ${(err.stack ? err.stack : err)}`);
            throw err;
        }
    }

    /**
     * Return the Fabric context associated with the given callback module name.
     * @param {string} name The name of the callback module as defined in the configuration files.
     * @param {object} args Unused.
     * @return {object} The assembled Fabric context.
     * @async
     */
    async getContext(name, args) {
        util.init(this.configPath);
        e2eUtils.init(this.configPath);

        let config  = require(this.configPath);
        let context = config.fabric.context;
        let channel;
        if(typeof context === 'undefined') {
            channel = util.getDefaultChannel();
        }
        else{
            channel = util.getChannel(context[name]);
        }

        if(!channel) {
            throw new Error('Could not find context information in the config file');
        }

        return await e2eUtils.getcontext(channel);
    }

    /**
     * Release the given Fabric context.
     * @param {object} context The Fabric context to release.
     * @async
     */
    async releaseContext(context) {
        await e2eUtils.releasecontext(context);
        await commUtils.sleep(1000);
    }

    /**
     * Invoke the given chaincode according to the specified options. Multiple transactions will be generated according to the length of args.
     * @param {object} context The Fabric context returned by {getContext}.
     * @param {string} contractID The name of the chaincode.
     * @param {string} contractVer The version of the chaincode.
     * @param {Array} args Array of JSON formatted arguments for transaction(s). Each element contains arguments (including the function name) passing to the chaincode. JSON attribute named transaction_type is used by default to specify the function name. If the attribute does not exist, the first attribute will be used as the function name.
     * @param {number} timeout The timeout to set for the execution in seconds.
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async invokeSmartContract(context, contractID, contractVer, args, timeout) {
        let promises = [];
        args.forEach((item, index)=>{
            try {
                let simpleArgs = [];
                let func;
                for(let key in item) {
                    if(key === 'transaction_type') {
                        func = item[key].toString();
                    }
                    else {
                        simpleArgs.push(item[key].toString());
                    }
                }
                if(func) {
                    simpleArgs.splice(0, 0, func);
                }
                promises.push(e2eUtils.invokebycontext(context, contractID, contractVer, simpleArgs, timeout));
            }
            catch(err) {
                commLogger.error(err);
                let badResult = new TxStatus('artifact');
                badResult.SetStatusFail();
                promises.push(Promise.resolve(badResult));
            }
        });
        return await Promise.all(promises);
    }

    /**
     * Query the given chaincode according to the specified options.
     * @param {object} context The Fabric context returned by {getContext}.
     * @param {string} contractID The name of the chaincode.
     * @param {string} contractVer The version of the chaincode.
     * @param {string} key The argument to pass to the chaincode query.
     * @param {string} [fcn=query] The chaincode query function name.
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async queryState(context, contractID, contractVer, key, fcn = 'query') {
        // TODO: change string key to general object
        return await e2eUtils.querybycontext(context, contractID, contractVer, key.toString(), fcn);
    }
}
module.exports = Fabric;
