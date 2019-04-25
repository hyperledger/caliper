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

const {BlockchainInterface, CaliperUtils, TxStatus} = require('caliper-core');
const commLogger = CaliperUtils.getLogger('fabric.js');

/**
 * Implements {BlockchainInterface} for a Fabric backend.
 */
class Fabric extends BlockchainInterface {
    /**
     * Create a new instance of the {Fabric} class.
     * @param {string} config_path The absolute path of the Fabric network configuration file.
     * @param {string} workspace_root The absolute path to the root location for the application configuration files.
     */
    constructor(config_path, workspace_root) {
        super(config_path);
        this.bcType = 'fabric';
        this.workspaceRoot = workspace_root;
    }

    /**
     * Initialize the {Fabric} object.
     * @async
     */
    async init() {
        util.init(this.configPath, this.workspaceRoot);
        e2eUtils.init(this.configPath, this.workspaceRoot);
        try {
            await impl_create.run(this.configPath, this.workspaceRoot);
            await impl_join.run(this.configPath, this.workspaceRoot);
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
     * @param {Integer} clientIdx The client index.
     * @param {Object} txFile the file information for reading or writing.
     * @return {object} The assembled Fabric context.
     * @async
     */
    async getContext(name, args, clientIdx, txFile) {
        util.init(this.configPath, this.workspaceRoot);
        e2eUtils.init(this.configPath, this.workspaceRoot);
        this.txFile = txFile;
        if(this.txFile){
            this.txFile.name = name;
            commLogger.debug('getContext) name: ' + name +  ' clientIndex: ' + clientIdx + ' txFile: ' + JSON.stringify(this.txFile));
            if(this.txFile.readWrite === 'read') {
                if(this.txFile.roundCurrent === 0){
                    await e2eUtils.readFromFile(this.txFile.name);
                }
            }
        }

        let fabricSettings  = require(this.configPath);
        let context = fabricSettings.fabric.context;

        // Either using network mode or baseAPI mode
        if (fabricSettings.info.contractInvoke) {
            // Create in memory wallet using org0
            const org = fabricSettings.fabric.channel[0].organizations[0];
            const userId = fabricSettings.fabric.network[org].user.name;
            const wallet = await e2eUtils.createInMemoryWallet(org);

            const opts = {
                wallet: wallet,
                identity: userId,
                discovery: {enabled: false}
            };

            // clientTlsIdentity is conditional on config
            if (fabricSettings.fabric.network.orderer.url.startsWith('grpcs')) {
                opts.clientTlsIdentity = 'tlsId';
            }

            // Retrieve gateway using ccp and options
            const gateway = await e2eUtils.retrieveGateway(fabricSettings.fabric.ccp, opts);

            // Retrieve and return the network using the network API commands
            commLogger.info(`Retrieving network from channelName ${context[name]}`);
            const network = await gateway.getNetwork(context[name]);
            return {gateway: gateway, network: network, clientIdx};
        } else {
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

            return await e2eUtils.getcontext(channel, clientIdx, txFile);
        }
    }

    /**
     * Release the given Fabric context.
     * @param {object} context The Fabric context to release.
     * @async
     */
    async releaseContext(context) {
        if(this.txFile && this.txFile.readWrite === 'write') {
            if(this.txFile.roundCurrent === (this.txFile.roundLength - 1)){
                await e2eUtils.writeToFile(this.txFile.name);
            }
        }
        if (context.gateway) {
            await context.gateway.disconnect();
        } else {
            await e2eUtils.releasecontext(context);
        }
        await CaliperUtils.sleep(1000);
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
                if(context.gateway) {
                    promises.push(e2eUtils.submitTransaction(context, simpleArgs));
                } else {
                    promises.push(e2eUtils.invokebycontext(context, contractID, contractVer, simpleArgs, timeout));
                }
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
     * @param {string} arg The argument to pass to the chaincode query.
     * @param {string} [fcn=query] The chaincode query function name.
     * @param {Boolean} consensus boolean flag to indicate if the query is to be recorded ont the ledger or not
     * @return {Promise<object>} The promise for the result of the execution.
     */
    queryState(context, contractID, contractVer, arg, fcn = 'query', consensus) {

        // Branch on interaction type
        if(context.gateway) {
            if (consensus) {
                return e2eUtils.submitTransaction(context, arg);
            } else {
                return e2eUtils.executeTransaction(context, arg);
            }
        } else {
            return e2eUtils.querybycontext(context, contractID, contractVer, arg.toString(), fcn);
        }
    }
}
module.exports = Fabric;
