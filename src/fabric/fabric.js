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
     * @return {Promise} The return promise.
     */
    init() {
        util.init(this.configPath);
        e2eUtils.init(this.configPath);
        return impl_create.run(this.configPath).then(() => {
            return impl_join.run(this.configPath);
        })
            .catch((err) => {
                commUtils.log('fabric.init() failed, ' + (err.stack ? err.stack : err));
                return Promise.reject(err);
            });
    }

    /**
     * Deploy the chaincode specified in the network configuration file to all peers.
     * @return {Promise} The return promise.
     */
    installSmartContract() {
        // todo: now all chaincodes are installed and instantiated in all peers, should extend this later
        return impl_install.run(this.configPath).then(() => {
            return impl_instantiate.run(this.configPath);
        })
            .catch((err) => {
                commUtils.log('fabric.installSmartContract() failed, ' + (err.stack ? err.stack : err));
                return Promise.reject(err);
            });
    }

    /**
     * Return the Fabric context associated with the given callback module name.
     * @param {string} name The name of the callback module as defined in the configuration files.
     * @param {object} args Unused.
     * @return {object} The assembled Fabric context.
     */
    getContext(name, args) {
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
            return Promise.reject(new Error('could not find context\'s information in config file'));
        }

        return e2eUtils.getcontext(channel);

    }

    /**
     * Release the given Fabric context.
     * @param {object} context The Fabric context to release.
     * @return {Promise} The return promise.
     */
    releaseContext(context) {
        return e2eUtils.releasecontext(context).then(() => {
            return commUtils.sleep(1000);
        });
    }

    /**
     * Invoke the given chaincode according to the specified options. Multiple transactions will be generated according to the length of args.
     * @param {object} context The Fabric context returned by {getContext}.
     * @param {string} contractID The name of the chaincode.
     * @param {string} contractVer The version of the chaincode.
     * @param {Array} args Array of JSON formatted arguments for transaction(s). Each element containts arguments (including the function name) passing to the chaincode. JSON attribute named transaction_type is used by default to specify the function name. If the attribute does not exist, the first attribute will be used as the function name.
     * @param {number} timeout The timeout to set for the execution in seconds.
     * @return {Promise<object>} The promise for the result of the execution.
     */
    invokeSmartContract(context, contractID, contractVer, args, timeout) {
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
                commUtils.log(err);
                let badResult = new TxStatus('artifact');
                badResult.SetStatusFail();
                promises.push(Promise.resolve(badResult));
            }
        });
        return Promise.all(promises);
    }

    /**
     * Query the given chaincode according to the specified options.
     * @param {object} context The Fabric context returned by {getContext}.
     * @param {string} contractID The name of the chaincode.
     * @param {string} contractVer The version of the chaincode.
     * @param {string} key The argument to pass to the chaincode query.
     * @return {Promise<object>} The promise for the result of the execution.
     */
    queryState(context, contractID, contractVer, key) {
        // TODO: change string key to general object
        return e2eUtils.querybycontext(context, contractID, contractVer, key.toString());
    }
}
module.exports = Fabric;
