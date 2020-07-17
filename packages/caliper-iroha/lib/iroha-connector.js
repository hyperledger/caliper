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

const {BlockchainConnector, CaliperUtils, ConfigUtil, TxStatus} = require('@hyperledger/caliper-core');
const logger = CaliperUtils.getLogger('iroha-connector');

const IrohaService_v1Client = require('iroha-helpers/lib/proto/endpoint_grpc_pb');
const CommandService_v1Client = IrohaService_v1Client.CommandService_v1Client;
const QueryService_v1Client = IrohaService_v1Client.QueryService_v1Client;

const generateKeypair = require('iroha-helpers/lib/cryptoHelper.js').default;
const irohaCommands = require('iroha-helpers/lib/commands').default;
const irohaQueries = require('iroha-helpers/lib/queries').default;
const irohaUtil = require('iroha-helpers/lib/util.js');
const txHelper = require('iroha-helpers/lib/txHelper.js').default;

const fs = require('fs');
const grpc = require('grpc');

const DEFAULT_OPTIONS = {
    privateKeys: [''],
    creatorAccountId: '',
    quorum: 1,
    commandService: null,
    timeoutLimit: 5000
};

/**
 * Wrap the provided set of commands as Iroha transactions and send them to a peer node
 * {
 * privateKeys: [''],
 * creatorAccountId: '',
 * quorum: 1,
 * commandService: null,
 * timeoutLimit: 5000
 * }
 * @param {Object} commandOptions Common options for the commands
 * @param {Array} commands - commands to turn into transactions
 * @returns {Promise} promise with sent transactions
 */
async function batchCommand(
    {
        privateKeys,
        creatorAccountId,
        quorum,
        commandService,
        timeoutLimit
    } = DEFAULT_OPTIONS,
    commands) {
    try {
        if (!Array.isArray(commands)) {
            commands = [commands];
        }

        let txsToSend = commands.map(command => {
            let tx = txHelper.addCommand(
                txHelper.emptyTransaction(),
                command.fn,
                command.args
            );
            let txToSend = txHelper.addMeta(tx, {
                creatorAccountId: creatorAccountId,
                quorum: quorum
            });
            return irohaUtil.signWithArrayOfKeys(txToSend, privateKeys);
        });

        return irohaUtil.sendTransactions(txsToSend, commandService, timeoutLimit);
    } catch (err) {
        logger.error(err);
        return Promise.reject('Failed to submit Iroha transaction');
    }
}

/**
 * Create Iroha query and send it to a node
 * @param {Object} queryOptions queryOptions
 * @param {Array} commands query commands
 * @returns {Promise} promise with the results
 */
function irohaQuery(queryOptions, commands) {
    try {
        if (!Array.isArray(commands)) {
            commands = [commands];
        }

        let promises = [];
        for (let i = 0; i < commands.length; i++) {
            let queryArg = commands[i];
            let p = irohaQueries[queryArg.fn](queryOptions, queryArg.args);
            promises.push(p);
        }
        return Promise.all(promises);
    } catch (err) {
        logger.error(err);
        return Promise.reject('Failed to submit iroha query');
    }
}

/* eslint-disable require-jsdoc */
/**
 * Extends {BlockchainConnector} for a Iroha backend
 */
class IrohaConnector extends BlockchainConnector {
    /**
     * Create a new instance of the {Iroha} class.
     * @param {number} workerIndex The zero-based index of the worker who wants to create an adapter instance. -1 for the manager process.
     * @param {string} bcType The target SUT type
     */
    constructor(workerIndex, bcType) {
        super(workerIndex, bcType);
        this.configPath = CaliperUtils.resolvePath(ConfigUtil.get(ConfigUtil.keys.NetworkConfig));
        this.config = require(this.configPath).iroha;
        this.clientIndex = workerIndex;
        this.context = undefined;
    }

    /**
     *Initialize the {iroha} object.
     * @async
     * @returns{promise} promise
     */
    async init() {
        // TODO: How to judge Iroha service's status elegantly?
        return CaliperUtils.sleep(10000); // Wait for Iroha network to start up
    }

    /**
     * Deploy the smart contract specified in the network configuration file
     * @return {promise} Promise.resolve().
     * @async
     */
    async installSmartContract() {
        // Now Iroha doesn't support smart contract,
        // using internal transactions to construct contracts
        return Promise.resolve();
    }

    /**
     * Perform required information for test workers
     * @param {Number} number Workers count
     * @return {Promise} Params to be passed to a worker
     */
    async prepareWorkerArguments(number) {
        try {
            // get admin info
            let admin        = this.config.admin;
            let domain       = admin.domain;
            let adminAccount = admin.account + '@' + admin.domain;
            let privPath     = CaliperUtils.resolvePath(admin['key-priv']);
            let pubPath      = CaliperUtils.resolvePath(admin['key-pub']);
            let adminPriv    = fs.readFileSync(privPath).toString();
            let adminPub     = fs.readFileSync(pubPath).toString();
            // test
            logger.debug(`Admin's public key: ${adminPub}`);

            // asset info
            let asset = this.config.asset;
            let assetId;
            let assetAmount;
            if (asset) {
                assetId = asset.id + '#' + domain;
                assetAmount = asset.amount;
            }
            logger.debug(`assetId: ${assetId}`);
            logger.debug(`assetAmount: ${assetAmount}`);

            // create account for each worker
            let result = [];
            let node = this._findNode();
            logger.debug(`node:  ${node.torii}`);

            let commandService = new CommandService_v1Client(
                node.torii,
                grpc.credentials.createInsecure()
            );

            // build create account transaction
            let commandOptions = {
                privateKeys: [adminPriv],
                creatorAccountId: adminAccount,
                quorum: 1,
                commandService: commandService,
                timeoutLimit: 50000
            };
            // generate random name, [a-z]
            let seed = 'abcdefghijklmnopqrstuvwxyz';
            let accountNames = [];

            const generateName = function() {
                let name = '';
                for (let i = 0; i < 5; i++) {
                    name += seed.charAt(
                        Math.floor(Math.random() * seed.length)
                    );
                }
                if (accountNames.indexOf(name) < 0) {
                    return name;
                } else {
                    return generateName();
                }
            };
            let promises = [];
            for (let i = 0; i < number; i++) {
                let name = generateName();
                let id = name + '@' + domain;
                accountNames.push(name);

                let keypairs = generateKeypair.generateKeyPair();

                // worker data
                result.push({
                    name: name,
                    domain: domain,
                    id: id,
                    pubKey: keypairs.publicKey,
                    privKey: keypairs.privateKey,
                    assetId: assetId,
                    assetAmount: assetAmount
                });

                // commands to create worker's account, assign admin's role and let have some assets
                let p = irohaCommands.createAccount(commandOptions, {
                    accountName: name,
                    domainId: domain,
                    publicKey: keypairs.publicKey
                }).then(() => irohaCommands.appendRole(commandOptions, {
                    accountId: id,
                    roleName: 'admin'
                }).then(result => {
                    if (assetId && assetAmount) {
                        return irohaCommands.addAssetQuantity(commandOptions, {
                            assetId: assetId,
                            amount: assetAmount
                        }).then(() => irohaCommands.transferAsset(commandOptions, {
                            srcAccountId: adminAccount,
                            destAccountId: id,
                            assetId: assetId,
                            description: 'init top up',
                            amount: assetAmount
                        }));
                    }
                    return Promise.resolve(result);
                }));

                promises.push(p);
            }

            return Promise.all(promises)
                .then(res => {
                    logger.info('created clients succesfully');
                    return Promise.resolve(result);
                })
                .catch(e => Promise.reject(e));
        } catch (err) {
            logger.error(err);
            return Promise.reject(
                new Error('Failed in prepareWorkerArguments')
            );
        }
    }

    /**
     * Return the Iroha context associated with the given callback module name
     * @param {Number} roundIndex The zero-based round index of the test.
     * @param {object} args The client material returned by function prepareWorkerArguments
     * @return {object} The assembled Iroha context
     * @async
     */
    async getContext(roundIndex, args) {
        try {
            if (
                !args.hasOwnProperty('name') ||
                !args.hasOwnProperty('domain') ||
                !args.hasOwnProperty('id') ||
                !args.hasOwnProperty('pubKey') ||
                !args.hasOwnProperty('privKey')
            ) {
                throw new Error('Invalid Iroha::getContext arguments');
            }

            // save context for later use
            // since iroha requires sequential counter for messages from same account, the counter must be saved if getContext are invoked multiple times for the same account
            this.context = {
                name: args.name,
                domain: args.domain,
                id: args.id,
                pubKey: args.pubKey,
                privKey: args.privKey,
                assetId: args.assetId,
                txCounter: 1,
                queryCounter: 1
            };

            // find callbacks for simulated smart contract
            let fc = this.config.fakecontract;
            let fakeContracts = {};
            for (let i = 0; i < fc.length; i++) {
                let contract = fc[i];
                //load the fakeContract.
                let facPath  = CaliperUtils.resolvePath(contract.factory);
                let factory  = require(facPath);
                for(let j = 0 ; j < contract.id.length ; j++) {
                    let id = contract.id[j];
                    if (!factory.contracts.hasOwnProperty(id)) {
                        throw new Error(
                            'Could not get function ' + id + ' in ' + facPath
                        );
                    } else {
                        if (fakeContracts.hasOwnProperty(id)) {
                            logger.warn(
                                'WARNING: multiple callbacks for ' + id + ' have been found'
                            );
                        } else {
                            fakeContracts[id] = factory.contracts[id];
                        }
                    }
                }
            }
            let node = this._findNode();
            this.context.torii = node.torii;
            this.context.contract = fakeContracts;
            this.grpcCommandClient = new CommandService_v1Client(
                this.context.torii,
                grpc.credentials.createInsecure()
            );
            this.grpcQueryClient = new QueryService_v1Client(
                this.context.torii,
                grpc.credentials.createInsecure()
            );
            return Promise.resolve(this.context);
        } catch (err) {
            logger.error(
                `Error within getContext: ${err.stack ? err.stack : err}`
            );
            return Promise.reject(
                new Error('Failed when finding access point or user key')
            );
        }
    }

    /**
     * Release the given Iroha context
     * @returns {Promise} promise.resolve
     * @async
     */
    async releaseContext() {
        this.context = undefined;
    }

    /**
     * Invoke a smart contract
     * @param {String} contractID Contract ID
     * @param {String} contractVer Version of the contract (currently unused)
     * @param {Object | Array<Object>} invokeData Array of JSON-formatted arguments for multiple transactions
     * @param {Number} timeout Request timeout, in seconds
     * @return {Promise<object>} The promise for the result of the execution
     */
    async invokeSmartContract(contractID, contractVer, invokeData, timeout) {

        if (!this.context.contract.hasOwnProperty(contractID)) {
            throw new Error('Could not find contract named ' + contractID);
        }

        let invocations;
        if (!Array.isArray(invokeData)) {
            invocations = [invokeData];
        } else {
            invocations = invokeData;
        }

        return await this.executeCommands(
            this.context,
            contractID,
            invocations,
            timeout * 1000
        );
    }

    /**
     * Execute Iroha command/commands
     * @param {Object} context Context object
     * @param {String} contractID Identity of the contract
     * @param {Array} args formatted arguments for multiple transactions
     * @param {Number} timeout Request timeout, in seconds
     * @return {Promise<object>} The promise for the result of the execution
     */
    async executeCommands(context, contractID, args, timeout) {
        let commands = args.map(item => {
            let keypairs = generateKeypair.generateKeyPair();
            let argsIroha = {
                accountName: item.account,
                amount: item.amount,
                publicKey: keypairs.publicKey,
                verb: item.verb
            };
            return context.contract[contractID](context, argsIroha);
        });

        if (commands.length === 0) {
            throw new Error('Empty output of contract ' + contractID);
        }

        let status = new TxStatus(null);
        status.Set('timeout', timeout);

        this._onTxsSubmitted(args.length);

        // Submit the transaction
        let commandOptions = {
            privateKeys: [context.privKey],
            creatorAccountId: context.id,
            quorum: 1,
            commandService: this.grpcCommandClient,
            timeoutLimit: timeout
        };

        let p = batchCommand(commandOptions, commands);
        const results = await Promise.all([p])
            .then(res => {
                let txStatuses = commands.map(() => {
                    let statusCopy = Object.assign({}, status);
                    Object.setPrototypeOf(statusCopy, TxStatus.prototype);
                    statusCopy.SetStatusSuccess();
                    return statusCopy;
                });
                return Promise.resolve(txStatuses);
            })
            .catch(e => {
                status.SetStatusFail();
                return Promise.resolve(status);
            });

        this._onTxsFinished(results);
        return results;
    }

    /**
     * Query the given smart contract according to the specified options
     * @param {string} contractID The name of the contract
     * @param {string} contractVer The version of the contract
     * @param {string} account The argument to pass to the smart contract query
     * @param {string} [fcn=query] The contract query function name
     * @return {Promise<object>} The promise for the result of the execution
     */
    async queryState(contractID, contractVer, account, fcn = 'query') {
        if (!this.context.contract.hasOwnProperty(contractID)) {
            throw new Error('Could not find contract named ' + contractID);
        }
        let accountId = account + '@' + this.context.domain;
        let argsIroha = { accountId: accountId, verb: fcn };
        let commands = this.context.contract[contractID](this.context, argsIroha);
        if (commands.length === 0) {
            throw new Error('Empty output of contract ' + contractID);
        }

        let status = new TxStatus(null);
        this._onTxsSubmitted(1);

        try {
            let queryOptions = {
                privateKey: this.context.privKey,
                creatorAccountId: this.context.id,
                queryService: this.grpcQueryClient,
                timeoutLimit: 5000
            };
            await irohaQuery(queryOptions, commands);
            status.SetStatusSuccess();
        } catch (err) {
            logger.info(err);
            status.SetStatusFail();
        }

        this._onTxsFinished(status);
        return status;
    }

    /**
     * Find an node randomly according to the network configuration
     * @return {Promise<object>} The promise for the result of the execution
     */
    _findNode() {
        let nodes = [];
        for (let i in this.config.network) {
            if (this.config.network[i].hasOwnProperty('torii')) {
                nodes.push(this.config.network[i]);
            }
        }
        if (nodes.length === 0) {
            throw new Error('Could not find valid access points');
        }
        return nodes[Math.floor(Math.random() * nodes.length)];
    }
}
module.exports = IrohaConnector;
/* eslint-enable require-jsdoc */
