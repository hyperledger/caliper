/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file, definition of the Iroha class, which implements the Caliper's NBI for Hyperledger Iroha.
*/


'use strict';

const fs = require('fs');
const grpc = require('grpc');
const {
    ModelCrypto,
    ModelProtoTransaction,
    ModelProtoQuery,
    ModelTransactionBuilder,
    ModelQueryBuilder
} = require('iroha-lib');
const endpointPb = require('iroha-lib/pb/endpoint_pb.js');
const txStatus =  require('iroha-lib/pb/endpoint_pb.js').TxStatus;
const pbTransaction = require('iroha-lib/pb/block_pb.js').Transaction;
const pbQuery = require('iroha-lib/pb/queries_pb.js').Query;
const endpointGrpc = require('iroha-lib/pb/endpoint_grpc_pb.js');
const util = require('../comm/util.js');
const BlockchainInterface = require('../comm/blockchain-interface.js');
const irohaType = require('./type.js');
const TxStatus = require('../comm/transaction');

const txBuilder = new ModelTransactionBuilder();
const queryBuilder = new ModelQueryBuilder();
const crypto = new ModelCrypto();

let contexts = {};

/**
 * Convert between Iroha's Blob type and Uint8Array.
 * @param {iroha.Blob} blob The object with blob data.
 * @return {Uint8Array} The output JS byte array.
 */
function blob2array(blob) {
    let bytearray = new Uint8Array(blob.size());
    for (let i = 0 ; i < blob.size() ; ++i) {
        bytearray[i] = blob.get(i);
    }
    return bytearray;
}

/**
 * Create Iroha transaction and send it to a node.
 * @param {endpointGrpc.CommandServiceClient} client - GRPC endpoint
 * @param {string} account - creator account id
 * @param {number} time - time of creation
 * @param {iroha.Keypair} keys - keypair to sign
 * @param {Array} commands - transaction commands
 * @returns {Promise} promise with sended transaction
 */
function irohaCommand(client, account, time, keys, commands) {
    try {
        let tx = txBuilder.creatorAccountId(account).createdTime(time);
        let txHash;
        return commands.reduce((prev, command) => {
            return prev.then((trans) => {
                let tx   = command.tx;
                let args = command.args;
                if(args.length !== tx.argslen) {
                    return Promise.reject(new Error('Wrong arguments number for ' + tx.fn + ' : expected ' + tx.argslen + ' , got ' + args.length));
                }
                return Promise.resolve(trans[tx.fn].apply(trans, args));
            });
        }, Promise.resolve(tx))
            .then((transaction) => {
                tx = transaction.build();
                let txblob  = (new ModelProtoTransaction(tx))
                    .signAndAddSignature(keys)
                    .finish()
                    .blob();
                let txArray = blob2array(txblob);
                let txProto = pbTransaction.deserializeBinary(txArray);
                let txHashBlob  = tx.hash().blob();
                txHash = blob2array(txHashBlob);

                return new Promise((resolve, reject) => {
                    client.torii(txProto, (err, data) => {
                        if(err){
                            reject(err);
                        }
                        else {
                            resolve();
                        }
                    });
                });
            })
            .then(()=>{
                return Promise.resolve(txHash);
            })
            .catch((err)=>{
                util.log(err);
                return Promise.reject('Failed to submit Iroha transaction');
            });
    }
    catch(err) {
        util.log(err);
        return Promise.reject('Failed to submit Iroha transaction');
    }
}

/**
 * Create Iroha query and send it to a node.
 * @param {endpointGrpc.QueryServiceClient} client - GRPC endpoint
 * @param {string} account - creator account id
 * @param {number} time - time of creation
 * @param {number} counter - query counter
 * @param {iroha.Keypair} keys - keypair to sign
 * @param {Array} commands - query commands
 * @param {Function} callback - callback with query response
 * @returns {undefined}
 */
function irohaQuery(client, account, time, counter, keys, commands, callback) {
    try {
        let queryCommand = commands[0];
        let query = queryBuilder.creatorAccountId(account)
            .createdTime(time)
            .queryCounter(counter);
        let tx   = queryCommand.tx;
        let args = queryCommand.args;
        if(args.length !== tx.argslen) {
            throw new Error('Wrong arguments number for ' + tx.fn + ' : expected ' + tx.argslen + ' , got ' + args.length);
        }
        query = query[tx.fn].apply(query, args);
        query = query.build();
        let queryBlob  = (new ModelProtoQuery(query))
            .signAndAddSignature(keys)
            .finish()
            .blob();
        let queryArray = blob2array(queryBlob);
        let protoQuery = pbQuery.deserializeBinary(queryArray);
        let responseType = require('iroha-lib/pb/responses_pb.js').QueryResponse.ResponseCase;
        return new Promise((resolve, reject) => {
            client.find(protoQuery, (err, response) => {
                if(err){
                    reject(err);
                }
                else {
                    if(response.getResponseCase() === responseType.ERROR_RESPONSE) { // error response
                        util.log('Query: ', JSON.stringify(queryCommand));
                        reject(new Error('Query error, error code : ' + response.getErrorResponse().getReason()));
                    }
                    else {
                        callback(response);
                        resolve();
                    }
                }
            });
        });
    }
    catch(err) {
        util.log(err);
        return Promise.reject('Failed to submit iroha query');
    }
}

/* eslint-disable require-jsdoc */
/**
 * Implements {BlockchainInterface} for a Iroha backend.
 */
class Iroha extends BlockchainInterface {
    constructor(config_path) {
        super(config_path);
        this.statusInterval = null;
    }

    init() {
        // TODO: How to judge Iroha service's status elegantly?
        return util.sleep(10000); // Wait for Iroha network to start up
    }

    installSmartContract() {
        // Now Iroha doesn't support smart contract,
        // using internal transactions to construct contracts
        return Promise.resolve();
    }

    prepareClients(number) {
        try{
            util.log('Creating new account for test clients......');

            // get admin info
            let config = require(this.configPath);
            let admin        = config.iroha.admin;
            let domain       = admin.domain;
            let adminAccount = admin.account + '@' + admin.domain;
            let privPath     = util.resolvePath(admin['key-priv']);
            let pubPath      = util.resolvePath(admin['key-pub']);
            let adminPriv    = fs.readFileSync(privPath).toString();
            let adminPub     = fs.readFileSync(pubPath).toString();
            let adminKeys    = crypto.convertFromExisting(adminPub, adminPriv);

            // test
            util.log(`Admin's private key: ${adminPriv}`);
            util.log(`Admin's public key: ${adminPub}`);

            // create account for each client
            let result = [];
            let promises = [];
            let node = this._findNode();
            let grpcCommandClient = new endpointGrpc.CommandServiceClient(node.torii, grpc.credentials.createInsecure());
            let grpcQueryClient   = new endpointGrpc.QueryServiceClient(node.torii, grpc.credentials.createInsecure());

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
            for(let i = 0 ; i < number ; i++) {
                let keys = crypto.generateKeypair();
                let name = generateName();
                let id   = name + '@' + domain;
                accountNames.push(name);
                result.push({
                    name:    name,
                    domain:  domain,
                    id:      id,
                    pubKey:  keys.publicKey().hex(),
                    privKey: keys.privateKey().hex()
                });
                // build create account transaction
                let commands = [{
                    tx: irohaType.txType.CREATE_ACCOUNT,
                    args: [name, domain, keys.publicKey()]
                },
                {
                    tx: irohaType.txType.APPEND_ROLE,
                    args: [id, 'admin']
                },
                {
                    tx: irohaType.txType.APPEND_ROLE,
                    args: [id, 'moneyad']
                },];
                util.log('Create account for ' + id);
                let p = irohaCommand(grpcCommandClient, adminAccount, Date.now(), adminKeys, commands);
                promises.push(p);
            }
            let queryCounter = 1;
            return Promise.all(promises)
                .then(()=>{
                    util.log('Submitted create account transactions.');
                    return util.sleep(5000);
                })
                .then(()=>{
                    util.log('Query accounts to see if they already exist ......');
                    let promises = [];
                    for(let i = 0 ; i < result.length ; i++) {
                        let acc = result[i];
                        let p = new Promise((resolve, reject)=>{
                            irohaQuery(grpcQueryClient,
                                adminAccount,
                                Date.now(),
                                queryCounter,
                                adminKeys,
                                [{
                                    tx: irohaType.txType.GET_ACCOUNT,
                                    args: [acc.id]
                                }],
                                (response) => {
                                    let accountResp = response.getAccountResponse();
                                    util.log('Got account successfully: ' + accountResp.getAccount().getAccountId());
                                    resolve();
                                }
                            )
                                .catch((err)=>{
                                    util.log(err);
                                    reject(new Error('Failed to query account'));
                                });
                        });
                        queryCounter++;
                        promises.push(p);
                    }
                    return Promise.all(promises);
                })
                .then(()=>{
                    util.log('Finished create accounts, save key pairs for later use');
                    return Promise.resolve(result);
                })
                .catch(()=>{
                    return Promise.reject(new Error('Could not create accounts for Iroha clients'));
                });
        }
        catch (err) {
            util.log(err);
            return Promise.reject(new Error('Could not create accounts for Iroha clients'));
        }
    }

    getContext(name, args) {
        try {
            if(!args.hasOwnProperty('name') || !args.hasOwnProperty('domain') || !args.hasOwnProperty('id') || !args.hasOwnProperty('pubKey') || !args.hasOwnProperty('privKey')) {
                throw new Error('Invalid Iroha::getContext arguments');
            }
            if(!contexts.hasOwnProperty(args.id)) {
                // save context for later use
                // since iroha requires sequential counter for messages from same account, the counter must be save if getContext are invoked multiple times for the same account
                contexts[args.id] = {
                    name:         args.name,
                    domain:       args.domain,
                    id:           args.id,
                    pubKey:       args.pubKey,
                    privKey:      args.privKey,
                    keys:         crypto.convertFromExisting(args.pubKey, args.privKey),
                    txCounter:    1,
                    queryCounter: 1
                };


                let config = require(this.configPath);

                // find callbacks for simulated smart contract
                let fc = config.iroha.fakecontract;
                let fakeContracts = {};
                for(let i = 0 ; i < fc.length ; i++) {
                    let contract = fc[i];
                    let facPath  = util.resolvePath(contract.factory);
                    let factory  = require(facPath);
                    for(let j = 0 ; j < contract.id.length ; j++) {
                        let id = contract.id[j];
                        if(!factory.contracts.hasOwnProperty(id)) {
                            throw new Error('Could not get function "' + id + '" in ' + facPath);
                        }
                        else {
                            if(fakeContracts.hasOwnProperty(id)) {
                                util.log('WARNING: multiple callbacks for ' + id + ' have been found');
                            }
                            else {
                                fakeContracts[id] = factory.contracts[id];
                            }
                        }
                    }
                }

                let node = this._findNode();
                contexts[args.id].torii = node.torii;
                contexts[args.id].contract = fakeContracts;
            }

            this.grpcCommandClient = new endpointGrpc.CommandServiceClient(contexts[args.id].torii, grpc.credentials.createInsecure());
            this.grpcQueryClient   = new endpointGrpc.QueryServiceClient(contexts[args.id].torii, grpc.credentials.createInsecure());
            this.statusWaiting     = {};
            let self = this;
            const getStatus = function() {
                for(let key in self.statusWaiting) {
                    (function(id) {
                        let item   = self.statusWaiting[id];
                        let status = item.status;
                        let timeElapse =  Date.now() - status.GetTimeCreate();
                        if(timeElapse > status.Get('timeout')) {
                            util.log('Timeout when querying transaction\'s status');
                            status.SetStatusFail();
                            item.resolve(status);
                            delete self.statusWaiting[id];
                        }
                        else if(!item.isquery) {
                            item.isquery = true;
                            let request = new endpointPb.TxStatusRequest();
                            request.setTxHash(status.GetID());

                            self.grpcCommandClient.status(request, (err, response)=>{
                                item.isquery = false;
                                let final = false;
                                if(err) {
                                    util.log(err);
                                    status.SetStatusFail();
                                    final = true;
                                }
                                else {
                                    let s = response.getTxStatus();

                                    if(s === txStatus.COMMITTED) {
                                        status.SetStatusSuccess();
                                        final = true;
                                    }
                                    else if(s === txStatus.STATELESS_VALIDATION_FAILED ||
                                          s === txStatus.STATEFUL_VALIDATION_FAILED ||
                                          s === txStatus.NOT_RECEIVED) {
                                        status.SetStatusFail();
                                        final = true;
                                    }
                                }
                                if (final) {
                                    item.resolve(status);
                                    delete self.statusWaiting[id];
                                }
                            });
                        }
                    })(key);
                }
            };

            if(this.statusInterval) {
                clearInterval(this.statusInterval);
            }
            this.statusInterval = setInterval(getStatus, 1000);

            // return the context
            return Promise.resolve(contexts[args.id]);
        }
        catch (err) {
            util.log(err);
            return Promise.reject(new Error('Failed when finding access point or user key'));
        }
    }

    releaseContext(context) {
        if(this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null;
        }
        return Promise.resolve();
    }

    invokeSmartContract(context, contractID, contractVer, args, timeout) {
        let promises = [];
        args.forEach((item, index)=>{
            promises.push(this._invokeSmartContract(context, contractID, contractVer, item, timeout));
        });

        return Promise.all(promises);
    }

    _invokeSmartContract(context, contractID, contractVer, args, timeout) {
        try {
            if(!context.contract.hasOwnProperty(contractID)) {
                throw new Error('Could not find contract named ' + contractID);
            }

            let commands = context.contract[contractID](contractVer, context, args);
            if(commands.length === 0) {
                throw new Error('Empty output of contract ' + contractID);
            }
            let p;
            let status = new TxStatus(null);
            status.Set('timeout', timeout*1000);
            if(context.engine) {
                context.engine.submitCallback(1);
            }
            let key;
            if(irohaType.commandOrQuery(commands[0].tx) === 0) {
                p = new Promise((resolve, reject)=>{
                    let counter = context.txCounter;
                    key = context.id+'_command_'+counter;
                    context.txCounter++;
                    irohaCommand(this.grpcCommandClient, context.id, Date.now(), context.keys, commands)
                        .then((txid)=>{
                            status.SetID(txid);
                            this.statusWaiting[key] = {status:status, resolve:resolve, reject:reject, isquery: false};
                        });
                });
            }
            else {
                p = new Promise((resolve, reject)=>{
                    let counter = context.queryCounter;
                    context.queryCounter++;
                    irohaQuery(this.grpcQueryClient, context.id, Date.now(), counter, context.keys, commands,
                        (response) => {
                            status.SetStatusSuccess();
                            resolve(status);  // TODO: should check the response??
                        }
                    )
                        .catch((err)=>{
                            util.log(err);
                            status.SetStatusFail();
                            resolve(status);
                        });
                });
            }

            return p;
        }
        catch(err) {
            util.log(err);
            return Promise.reject();
        }
    }

    queryState(context, contractID, contractVer, key) {
        try {
            if(!context.contract.hasOwnProperty(contractID)) {
                throw new Error('Could not find contract named ' + contractID);
            }

            let commands = context.contract[contractID](contractVer, context, {verb: 'query', key: key});
            if(commands.length === 0) {
                throw new Error('Empty output of contract ' + contractID);
            }
            let status = new TxStatus(null);
            if(context.engine) {
                context.engine.submitCallback(1);
            }
            return new Promise((resolve, reject)=>{
                let counter = context.queryCounter;
                context.queryCounter++;
                irohaQuery(this.grpcQueryClient, context.id, Date.now(), counter, context.keys, commands,
                    (response) => {
                        status.SetStatusSuccess();
                        resolve(status);  // TODO: should check the response??
                    }
                )
                    .catch((err)=>{
                        util.log(err);
                        status.SetStatusFail();
                        resolve(status);
                    });
            });
        }
        catch(err) {
            util.log(err);
            return Promise.reject();
        }
    }

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
