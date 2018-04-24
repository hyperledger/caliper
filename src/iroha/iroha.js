/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file, definition of the Fabric class, which implements the caliper's NBI for hyperledger fabric
*/


'use strict'

var BlockchainInterface = require('../comm/blockchain-interface.js');
var iroha = require('./external/irohanode');
var txBuilder = new iroha.ModelTransactionBuilder();
var queryBuilder = new iroha.ModelQueryBuilder();
var crypto = new iroha.ModelCrypto();
var protoTxHelper = new iroha.ModelProtoTransaction();
var protoQueryHelper = new iroha.ModelProtoQuery();
var pbTransaction = require('./external/block_pb.js').Transaction;
var pbQuery = require('./external/queries_pb.js').Query;
var grpc = require('grpc');
var endpointGrpc = require('./external/endpoint_grpc_pb.js');
var endpointPb = require('./external/endpoint_pb.js');
var txStatus =  require('./external/endpoint_pb.js').TxStatus;
var irohaType = require('./type.js');
var fs = require('fs');
var path = require('path');
var util = require('../comm/util.js');


var contexts = {};
function blob2array(blob) {
    var bytearray = new Uint8Array(blob.size());
    for (let i = 0 ; i < blob.size() ; ++i) {
        bytearray[i] = blob.get(i);
    }
    return bytearray;
}

class Iroha extends BlockchainInterface{
    constructor(config_path) {
        super(config_path);
        this.statusInterval = null;
    }

    init() {
        // return Promise.resolve();
        return util.sleep(5000); // wait for iroha network to start up
                            // TODO: how to judge iroha service's status elegantly?
    }

    installSmartContract() {

        // now iroha doesn't support smart contract, using internal transactions to construct contracts

        return Promise.resolve();
    }

    prepareClients (number) {
        try{
            console.log('Creating new account for test clients......');

            // get admin infro
            var config = require(this.configPath);
            var admin        = config.iroha.admin;
            var domain       = admin.domain;
            var adminAccount = admin.account + '@' + admin.domain;
            var privPath     = path.join(__dirname, '../..', admin['key-priv']);
            var pubPath      = path.join(__dirname, '../..', admin['key-pub']);
            var adminPriv    = fs.readFileSync(privPath).toString();
            var adminPub     = fs.readFileSync(pubPath).toString();
            var adminKeys    = crypto.convertFromExisting(adminPub, adminPriv);

             // test
             console.log(adminPriv);
             console.log(adminPub);

            // create account for each client
            var result = [];
            var promises = [];
            var node = this._findNode();
            var grpcCommandClient = new endpointGrpc.CommandServiceClient(node.torii, grpc.credentials.createInsecure());
            var grpcQueryClient   = new endpointGrpc.QueryServiceClient(node.torii, grpc.credentials.createInsecure());

            // generate random name, [a-z]
            var seed = "abcdefghijklmnopqrstuvwxyz";
            var accountNames = [];
            var generateName = function() {
                var name = "";
                for(let i = 0 ; i < 5 ; i++) {
                    name += seed.charAt(Math.floor(Math.random() * seed.length));
                }
                if(accountNames.indexOf(name) < 0) {
                    return name;
                }
                else {
                    return generateName();
                }
            }
            var txCounter = 1;
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
                                    tx: irohaType.txType['CREATE_ACCOUNT'],
                                    args: [name, domain, keys.publicKey()]
                               },
                               {
                                    tx: irohaType.txType['APPEND_ROLE'],
                                    args: [id, 'admin']
                               },
                               {
                                    tx: irohaType.txType['APPEND_ROLE'],
                                    args: [id, 'moneyadm']
                               },];
                console.log('Create account for ' + id);
                let p = irohaCommand(grpcCommandClient, adminAccount, Date.now(), txCounter, adminKeys, commands);
                txCounter++;
                promises.push(p);
            }
            var queryCounter = 1;
            return Promise.all(promises)
                    .then(()=>{
                        console.log('Submitted create account transactions.');
                        return util.sleep(5000);
                    })
                    .then(()=>{
                        console.log('Query accounts to see if they already exist ......')
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
                                                            tx: irohaType.txType['GET_ACCOUNT'],
                                                            args: [acc.id]
                                                       }],
                                                       (response) => {
                                                           let accountResp = response.getAccountResponse();
                                                           console.log('Got account successfully: ' + accountResp.getAccount().getAccountId());
                                                           resolve();
                                                       }
                                            )
                                            .catch((err)=>{
                                                console.log(err);
                                                reject(new Error('Failed to query account'));
                                            });
                            });
                            queryCounter++;
                            promises.push(p);
                        }
                        return Promise.all(promises);
                    })
                    .then(()=>{
                        console.log('Finished create accounts, save key pairs for later use');
                        return Promise.resolve(result);
                    })
                    .catch(()=>{
                        return Promise.reject(new Error('Could not create accounts for Iroha clients'));
                    });
        }
        catch (err) {
            console.log(err);
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
                }


                var config = require(this.configPath);

                // find callbacks for simulated smart contract
                var fc = config.iroha.fakecontract;
                var fakeContracts = {};
                for(let i = 0 ; i < fc.length ; i++) {
                    let contract = fc[i];
                    let facPath  = path.join(__dirname, '../..', contract.factory);
                    let factory  = require(facPath);
                    for(let j = 0 ; j < contract.id.length ; j++) {
                        let id = contract.id[j]
                        if(!factory.contracts.hasOwnProperty(id)) {
                            throw new Error('Could not get function "' + id + '" in ' + facPath);
                        }
                        else {
                            if(fakeContracts.hasOwnProperty(id)) {
                                console.log('WARNING: multiple callbacks for ' + id + ' have been found');
                            }
                            else {
                                fakeContracts[id] = factory.contracts[id];
                            }
                        }
                    }
                }

                var node = this._findNode();
                contexts[args.id]['torii'] = node.torii;
                contexts[args.id]['contract'] = fakeContracts;
            }

            this.grpcCommandClient = new endpointGrpc.CommandServiceClient(contexts[args.id]['torii'], grpc.credentials.createInsecure());
            this.grpcQueryClient   = new endpointGrpc.QueryServiceClient(contexts[args.id]['torii'], grpc.credentials.createInsecure());
            this.statusWaiting     = {};
            var self = this;
            function getStatus() {
                 for(var key in self.statusWaiting) {
                    (function(id) {
                        let item   = self.statusWaiting[id];
                        let status = item.status;
                        let timeElapse =  Date.now() - status.time_create;
                        if(timeElapse > status.timeout) {
                            console.log("Timeout when querying transaction's status");
                            status.status = 'failed';
                            status.final  = Date.now();
                            item.resolve(status);
                            delete self.statusWaiting[id];
                        }
                        else if(!item.isquery) {
                            item.isquery = true;
                            let request = new endpointPb.TxStatusRequest();
                            request.setTxHash(status.id);

                            self.grpcCommandClient.status(request, (err, response)=>{
                                item.isquery = false;
                                let final = false;
                                if(err) {
                                    console.log(err);
                                    status.status = 'failed';
                                    final = true;
                                }
                                else {
                                    let s = response.getTxStatus();

                                    if(s === txStatus['COMMITTED']) {
                                        status.status = 'success';
                                        final = true;
                                    }
                                    else if(s === txStatus['STATELESS_VALIDATION_FAILED']
                                          || s === txStatus['STATEFUL_VALIDATION_FAILED']
                                          || s === txStatus['NOT_RECEIVED']) {
                                        status.status = 'failed';
                                        final = true;
                                    }
                                }
                                if (final) {
                                    status.time_final  = Date.now();
                                    item.resolve(status);
                                    delete self.statusWaiting[id];
                                }
                            });
                        }
                    })(key);
                 }
            }

            if(this.statusInterval) {
                clearInterval(this.statusInterval);
            }
            this.statusInterval = setInterval(getStatus, 1000);

            // return the context
            return Promise.resolve(contexts[args.id]);
        }
        catch (err) {
            console.log(err);
            return Promise.reject(new Error('Failed when finding access point or user key'));
        }
    }

    releaseContext(context) {
        if(this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null
        }
        return Promise.resolve();
    }

    invokeSmartContract(context, contractID, contractVer, args, timeout) {
        try {
            if(!context.contract.hasOwnProperty(contractID)) {
                throw new Error('Could not find contract named ' + contractID);
            }

            var commands = context.contract[contractID](contractVer, context, args);
            if(commands.length === 0) {
                throw new Error('Empty output of contract ' + contractID);
            }
            var p;
            var status = {
                id           : null,
                status       : 'created',
                time_create  : Date.now(),
                time_final   : 0,
                timeout      : timeout*1000,
                result       : null
            };
            var key;
            if(irohaType.commandOrQuery(commands[0].tx) === 0) {
                p = new Promise((resolve, reject)=>{
                    let counter = context.txCounter;
                    key = context.id+'_command_'+counter;
                    context.txCounter++;
                    irohaCommand(this.grpcCommandClient, context.id, Date.now(), counter, context.keys, commands)
                    .then((txid)=>{
                        status.id = txid;
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
                                   status.status = 'success';
                                   status.time_final = Date.now();
                                   resolve(status);  // TODO: should check the response??
                               }
                    )
                    .catch((err)=>{
                        console.log(err);
                        status.status = 'failed';
                        status.time_final = Date.now();
                        resolve(status);
                    });
                });
            }

            return p;
        }
        catch(err) {
            console.log(err);
            return Promise.reject();
        }
    }

    queryState(context, contractID, contractVer, key) {
        try {
            if(!context.contract.hasOwnProperty(contractID)) {
                throw new Error('Could not find contract named ' + contractID);
            }

            var commands = context.contract[contractID](contractVer, context, {verb: 'query', key: key});
            if(commands.length === 0) {
                throw new Error('Empty output of contract ' + contractID);
            }
            var status = {
                id           : null,
                status       : 'created',
                time_create  : Date.now(),
                time_final   : 0,
                result       : null
            };
            return new Promise((resolve, reject)=>{
                let counter = context.queryCounter;
                context.queryCounter++;
                irohaQuery(this.grpcQueryClient, context.id, Date.now(), counter, context.keys, commands,
                           (response) => {
                               status.status = 'success';
                               status.time_final = Date.now();
                               resolve(status);  // TODO: should check the response??
                           }
                )
                .catch((err)=>{
                    console.log(err);
                    status.status = 'failed';
                    status.time_final = Date.now();
                    resolve(status);
                });
            });
        }
        catch(err) {
            console.log(err);
            return Promise.reject();
        }
    }

    _findNode() {
        var nodes  = [];
        var config = require(this.configPath);
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

function irohaCommand(client, account, time, counter, keys, commands) {
    try {
         var tx = txBuilder.creatorAccountId(account)
                            .txCounter(counter)
                            .createdTime(time);
         var txHash;
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
            let txblob  = protoTxHelper.signAndAddSignature(tx, keys).blob();
            let txArray = blob2array(txblob);
            let txProto = pbTransaction.deserializeBinary(txArray);
            let txHashBlob  = tx.hash().blob();
            txHash = blob2array(txHashBlob);

            return new Promise((resolve, reject) => {
                            client.torii(txProto, (err, data)=>{
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
            console.log(err);
            return Promise.reject('Failed to submit iroha tranaction');
         })
    }
    catch(err) {
        console.log(err);
        return Promise.reject('Failed to submit iroha tranaction');
    }
}

function irohaQuery(client, account, time, counter, keys, commands, callback) {
    try {
        var queryCommand = commands[0];
        var query = queryBuilder.creatorAccountId(account)
                                .createdTime(time)
                                .queryCounter(counter);
        var tx   = queryCommand.tx;
        var args = queryCommand.args;
        if(args.length !== tx.argslen) {
            throw new Error('Wrong arguments number for ' + tx.fn + ' : expected ' + tx.argslen + ' , got ' + args.length);
        }
        query = query[tx.fn].apply(query, args);
        query = query.build();
        var queryBlob  = protoQueryHelper.signAndAddSignature(query, keys).blob();
        var queryArray = blob2array(queryBlob);
        var protoQuery = pbQuery.deserializeBinary(queryArray);
        var responseType = require('./external/responses_pb.js').QueryResponse.ResponseCase;
        return new Promise((resolve, reject)=>{
                    client.find(protoQuery, (err, response)=>{
                        if(err){
                            reject(err);
                        }
                        else {
                            if(response.getResponseCase() === responseType['ERROR_RESPONSE']) { // error response
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
        console.log(err);
        return Promise.reject('Failed to submit iroha query');
    }
}