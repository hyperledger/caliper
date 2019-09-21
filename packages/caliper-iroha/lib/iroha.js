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
const grpc = require('grpc');

const IrohaService_v1Client = require('iroha-helpers/lib/proto/endpoint_grpc_pb');
const CommandService_v1Client = IrohaService_v1Client.CommandService_v1Client;
const QueryService_v1Client = IrohaService_v1Client.QueryService_v1Client;

const generateKeypair = require('iroha-helpers/lib/cryptoHelper.js').default;

const {BlockchainInterface, CaliperUtils, TxStatus} = require('caliper-core');
const logger = CaliperUtils.getLogger('iroha.js');

const irohaQueries = require('iroha-helpers/lib/queries').default;
const irohaUtil = require('iroha-helpers/lib/util.js');
const txHelper = require('iroha-helpers/lib/txHelper.js').default;
const TxStatusLib = require('iroha-helpers/lib/proto/endpoint_pb.js').TxStatus;
const TxStatusRequest = require('iroha-helpers/lib/proto/endpoint_pb.js').TxStatusRequest;


/**
 * Create Iroha transactions and send them to a node.
 * @param {Array} txs txToSends
 * @param {Object} txClient - transaction client
 * @param {timeoutLimit} timeoutLimit timeout
 * @returns {Array} hashes
 */
async function sendTransactions(txs, txClient, timeoutLimit){
    try{
        const hashes = txs.map(x => txHelper.hash(x));
        const txList = txHelper.createTxListFromArray(txs);
        let p = new Promise((resolve, reject) => {
            const timer = setTimeout(()=>{
                txClient.$channel.close();
                reject(new Error('Please check IP address OR your internet connection'));
            }, timeoutLimit);
            txClient.listTorii(txList, (err) => {
                clearTimeout(timer);
                if(err) {
                    return reject(err);
                }
                resolve();
            });
        });
        await p;
        return hashes;
    }catch(e){
        logger.error(e);
        return Promise.reject(new Error('failed to send txs.'));
    }
}

/**
 * Create Iroha transactions and send them to a node.
 * @param {Array} hashes txToSends
 * @param {Object} txClient - transaction client
 * @param {Number} timeoutLimit timeout
 * @param {Array} requiredStatuses status
 * @returns {Promise} promise with transactions' statuses
 */
async function getTxStatus(hashes, txClient, timeoutLimit, requiredStatuses = ['COMMITTED']){
    try{
        let requests = hashes.map(hash => new Promise((resolve, reject) =>{
            let statuses = [];
            let request = new TxStatusRequest();
            request.setTxHash(hash.toString('hex'));
            let timer = setTimeout(()=>{
                txClient.$channel.close();
                reject(new Error('Query txStatus timeout'));
            }, timeoutLimit);

            let stream = txClient.statusStream(request);
            stream.on('data', function (response){
                statuses.push(response);
            });
            stream.on('end', function (end){
                clearTimeout(timer);
                statuses.length > 0? resolve(statuses[statuses.length - 1].getTxStatus()) : resolve(null);
            });
        }));
        let values = await Promise.all(requests);
        let statuses = values.map(x => x!== null ? irohaUtil.getProtoEnumName(TxStatusLib, 'iroha.protocol.Txstatus', x) : null);
        let results = [];
        statuses.forEach(item =>{
            if(requiredStatuses.includes(item)){
                results.push('COMMITTED');
            }else{
                results.push('failure');
            }
        });

        return Promise.resolve(results);
    }catch(e){
        logger.error(e);
        return Promise.reject(new Error('txs aren\'t committed to the ledger'));
    }
}

/**
 * Create Iroha transactions and send them to a node.
 * {
 * privateKeys: [''],
 * creatorAccountId: '',
 * quorum: 1,
 * commandService: null,
 * timeoutLimit: 5000
 * }
 * @param {Object} commandOption commandOptions
 * @param {Array} commandArgs - transaction commands
 * @returns {Promise} promise with sended transactions
 */
async function irohaCommand(commandOption, commandArgs) {
    try {

        let commands;
        if(!Array.isArray(commandArgs)){
            commands = [commandArgs];
        }else{
            commands = commandArgs;
        }

        let privateKeys = commandOption.privateKeys;
        let creatorAccountId = commandOption.creatorAccountId;
        let quorum = commandOption.quorum;
        let txClient = commandOption.commandService;
        let timeoutLimit = commandOption.timeoutLimit;

        let txToSends = [];
        for (let i = 0; i < commands.length; i++) {
            let commandArg = commands[i];
            let tx = txHelper.addCommand(txHelper.emptyTransaction(), commandArg.fn, commandArg.args);
            let txToSend = txHelper.addMeta(tx,{
                creatorAccountId: creatorAccountId,
                quorum: quorum
            });
            txToSend = irohaUtil.signWithArrayOfKeys(txToSend, privateKeys);
            txToSends.push(txToSend);
        }

        let hashes = await sendTransactions(txToSends,txClient,timeoutLimit);// batch mode
        let results = await getTxStatus(hashes,txClient,timeoutLimit);
        return Promise.resolve(results);
    }
    catch(err) {
        logger.error(err);
        return Promise.reject('Failed to submit Iroha transaction');
    }
}

/**
 * Create Iroha query and send it to a node.
 * @param {Object} queryOptions queryOptions
 * @param {Array} commands query commands
 * @returns {Promise} promise with the results.
 */
function irohaQuery(queryOptions, commands) {
    try {

        if(!Array.isArray(commands)){
            commands = [commands];
        }

        let promises = [];
        for(let i = 0; i < commands.length; i++){
            let queryArg = commands[i];
            let p = irohaQueries[queryArg.fn](queryOptions,queryArg.args);
            promises.push(p);
        }
        return Promise.all(promises);
    }
    catch(err) {
        logger.error(err);
        return Promise.reject('Failed to submit iroha query');
    }
}

/* eslint-disable require-jsdoc */
/**
 * Implements {BlockchainInterface} for a Iroha backend.
 */
class Iroha extends BlockchainInterface {
    constructor(config_path, workspace_root) {
        super(config_path);
        this.bcType = 'iroha';
        this.workspaceRoot = workspace_root;
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
     * Deploy the smart contract specified in the network configuration file.
     * @return {promise} Promise.resolve().
     * @async
     */
    async installSmartContract() {
        // Now Iroha doesn't support smart contract,
        // using internal transactions to construct contracts
        return Promise.resolve();
    }

    /**
     * Perform required preparation for test clients
     * @param {Number} number count of test clients
     * @return {Promise} obtained material for test clients
     */
    async prepareClients(number) {
        try{
            // get admin info
            let config = require(this.configPath);
            let admin        = config.iroha.admin;
            let domain       = admin.domain;
            let adminAccount = admin.account + '@' + admin.domain;
            let privPath     = CaliperUtils.resolvePath(admin['key-priv'], this.workspaceRoot);
            let pubPath      = CaliperUtils.resolvePath(admin['key-pub'], this.workspaceRoot);
            let adminPriv    = fs.readFileSync(privPath).toString();
            let adminPub     = fs.readFileSync(pubPath).toString();
            // test
            logger.info(`Admin's private key: ${adminPriv}`);
            logger.info(`Admin's public key: ${adminPub}`);

            // create account for each client
            let result = [];
            let node = this._findNode();
            logger.info('node: ' + node.torii);

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
                for(let i = 0 ; i < 5 ; i++) {
                    name += seed.charAt(Math.floor(Math.random() * seed.length));
                }
                if(accountNames.indexOf(name) < 0) {
                    return name;
                }
                else {
                    return generateName();
                }
            };
            let promises = [];
            for(let i = 0 ; i < number ; i++) {
                let name = generateName();
                let id   = name + '@' + domain;
                accountNames.push(name);

                let keypairs = generateKeypair.generateKeyPair();
                //client information
                result.push({
                    name:    name,
                    domain:  domain,
                    id:      id,
                    pubKey:  keypairs.publicKey,
                    privKey: keypairs.privateKey
                });

                let commands = [{
                    fn: 'createAccount',
                    args: {accountName: name, domainId: domain, publicKey: keypairs.publicKey}
                },
                {
                    fn: 'appendRole',
                    args: {accountId: id, roleName: 'admin'}
                }];

                let p = irohaCommand(commandOptions,commands[0]).then(()=>
                    irohaCommand(commandOptions,commands[1]));

                promises.push(p);
            }

            let responses = await Promise.all(promises);
            let queryCounter = 0;

            for(let i=0;i<responses.length;i++){
                if(responses[i][0] === 'COMMITTED'){
                    queryCounter++;
                }
            }
            if(queryCounter!== responses.length){
                return Promise.reject(new Error('failed to create clients'));
            }
            else{
                logger.info('created clients succesfully');
                return Promise.resolve(result);
            }
        }
        catch(err){
            logger.error(err);
            return Promise.reject(new Error('Failed when prepareClients'));
        }
    }

    /**
     * Return the Iroha context associated with the given callback module name.
     * @param {string} name The name of the callback module as defined in the configuration files, for example open or query.
     * @param {object} args Unused, the client material returned by function prepareClient.
     * @param {Integer} clientIdx The client index.
     * @param {Object} txFile the file information for reading or writing.
     * @return {object} The assembled Iroha context.
     * @async
     */
    async getContext(name, args, clientIdx, txFile) {
        try {
            if(!args.hasOwnProperty('name') || !args.hasOwnProperty('domain') || !args.hasOwnProperty('id') || !args.hasOwnProperty('pubKey') || !args.hasOwnProperty('privKey')) {
                throw new Error('Invalid Iroha::getContext arguments');
            }
            let context = {};
            // save context for later use
            // since iroha requires sequential counter for messages from same account, the counter must be save if getContext are invoked multiple times for the same account
            context = {
                name:         args.name,
                domain:       args.domain,
                id:           args.id,
                pubKey:       args.pubKey,
                privKey:      args.privKey,
                txCounter:    1,
                queryCounter: 1
            };
            let config = require(this.configPath);

            // find callbacks for simulated smart contract
            let fc = config.iroha.fakecontract;
            let fakeContracts = {};
            for(let i = 0 ; i < fc.length ; i++) {
                let contract = fc[i];
                //load the fakeContract.
                let facPath  = CaliperUtils.resolvePath(contract.factory,this.workspaceRoot);
                let factory  = require(facPath);
                for(let j = 0 ; j < contract.id.length ; j++) {
                    let id = contract.id[j];
                    if(!factory.contracts.hasOwnProperty(id)) {
                        throw new Error('Could not get function "' + id + '" in ' + facPath);
                    }
                    else {
                        if(fakeContracts.hasOwnProperty(id)) {
                            logger.warn('WARNING: multiple callbacks for ' + id + ' have been found');
                        }
                        else {
                            fakeContracts[id] = factory.contracts[id];
                        }
                    }
                }
            }
            let node = this._findNode();
            context.torii = node.torii;
            context.contract = fakeContracts;
            this.grpcCommandClient = new CommandService_v1Client(context.torii, grpc.credentials.createInsecure());
            this.grpcQueryClient = new QueryService_v1Client(context.torii, grpc.credentials.createInsecure());
            return Promise.resolve(context);
        }catch(err) {
            logger.error(err);
            return Promise.reject(new Error('Failed when finding access point or user key'));
        }
    }

    /**
     * Release the given Iroha context.
     * @param {object} context The Burrow context to release.
     * @returns {Promise} promise.resolve
     * @async
     */
    async releaseContext(context) {
        return Promise.resolve();
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
        let results = await this._invokeSmartContract(context,contractID,contractVer,args,timeout*1000);
        return Promise.resolve(results);
    }

    /**
     * Invoke a smart contract.
     * @param {Object} context Context object.
     * @param {String} contractID Identity of the contract.
     * @param {String} contractVer Version of the contract.
     * @param {json}  args formatted arguments for multiple transactions.
     * @param {Number} timeout Request timeout, in seconds.
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async _invokeSmartContract(context, contractID, contractVer, args, timeout) {
        if(!context.contract.hasOwnProperty(contractID)) {
            throw new Error('Could not find contract named ' + contractID);
        }
        let commands = args.map(item => {
            let keypairs = generateKeypair.generateKeyPair();
            let argsIroha = {
                accountName: item.account,
                domainId: context.domain,
                publicKey: keypairs.publicKey,
                verb: item.verb
            };
            return context.contract[contractID](context, argsIroha);
        });

        if(commands.length === 0) {
            throw new Error('Empty output of contract ' + contractID);
        }

        let status = new TxStatus(null);
        status.Set('timeout', timeout);

        if(context.engine) {
            context.engine.submitCallback(args.length);
        }
        try {
            //Submit the transaction.
            let commandOptions = {
                privateKeys: [context.privKey],
                creatorAccountId: context.id,
                quorum: 1,
                commandService: this.grpcCommandClient,
                timeoutLimit: timeout
            };

            let results =  await irohaCommand(commandOptions, commands);
            let txStatuses = [];
            results.forEach(item => {
                let cloned = Object.assign({}, status);
                Object.setPrototypeOf(cloned,TxStatus.prototype);
                if(item === 'COMMITTED'){
                    cloned.SetStatusSuccess();
                }else{
                    cloned.SetStatusFail();
                }
                txStatuses.push(cloned);
            });
            return Promise.resolve(txStatuses);
        }
        catch(err) {
            status.SetStatusFail();
            return Promise.resolve(status);
        }
    }

    /**
     * Query the given smart contract according to the specified options.
     * @param {object} context The Iroha context returned by {getContext}.
     * @param {string} contractID The name of the contract.
     * @param {string} contractVer The version of the contract.
     * @param {string} account The argument to pass to the smart contract query.
     * @param {string} [fcn=query] The contract query function name.
     * @return {Promise<object>} The promise for the result of the execution.
     */
    async queryState(context, contractID, contractVer, account, fcn = 'query') {
        if(!context.contract.hasOwnProperty(contractID)) {
            throw new Error('Could not find contract named ' + contractID);
        }
        let accountId = account + '@' + context.domain;
        let argsIroha = {accountId: accountId, verb: fcn};
        let commands = context.contract[contractID](context, argsIroha);
        if(commands.length === 0) {
            throw new Error('Empty output of contract ' + contractID);
        }

        let status = new TxStatus(null);
        if(context.engine) {
            context.engine.submitCallback(1);
        }
        try {

            let queryOptions = {
                privateKey: context.privKey,
                creatorAccountId: context.id,
                queryService: this.grpcQueryClient,
                timeoutLimit: 5000
            };
            await irohaQuery(queryOptions,commands);
            status.SetStatusSuccess();
            return Promise.resolve(status);
        }
        catch(err) {
            logger.info(err);
            status.SetStatusFail();
            return Promise.resolve(status);
        }
    }

    /**
     * Find an node randomly according to the network configuration.
     * @return {Promise<object>} The promise for the result of the execution.
     */
    _findNode() {
        let nodes  = [];
        let config = require(this.configPath);
        for(let i in config.iroha.network) {
            if(config.iroha.network[i].hasOwnProperty('torii')) {
                nodes.push(config.iroha.network[i]);
            }
        }
        if(nodes.length === 0) {
            throw new Error('Could not find valid access points');
        }
        return nodes[Math.floor(Math.random()*(nodes.length))];
    }

}
module.exports = Iroha;
/* eslint-enable require-jsdoc */
