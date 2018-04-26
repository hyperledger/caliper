/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict'

const CLIENT_LOCAL = 'local';
const CLIENT_ZOO   = 'zookeeper';

var zkUtil  = require('./zoo-util.js');
var ZooKeeper = require('node-zookeeper-client');
var clientUtil = require('./client-util.js');
var Client = class {
    constructor(config, callback) {
        var conf = require(config);
        this.config = conf.test.clients;
        this.results = [];                          // output of recent test round
        this.updates = {id:0, data:[]};           // contains txUpdated messages
    }

    /**
    * init client objects
    * @return {Promise}
    */
    init() {
        if(this.config.hasOwnProperty('type')) {
            switch(this.config.type) {
                case CLIENT_LOCAL:
                    this.type = CLIENT_LOCAL;
                    if(this.config.hasOwnProperty('number')) {
                        this.number = this.config.number;
                    }
                    else {
                        this.number = 1;
                    }
                    return Promise.resolve(this.number);
                case CLIENT_ZOO:
                    return this._initZoo();
                default:
                    return Promise.reject(new Error('Unknown client type, should be local or zookeeper'));
            }
        }
        else {
            return Promise.reject(new Error('Failed to find client type in config file'));
        }
        return Promise.resolve();
    }

    /**
    * start the test
    * @message, {
    *              type: 'test',
    *              label : label name,
    *              numb:   total number of simulated txs,
    *              rateControl: rate controller to use
    *              trim:   trim options
    *              args:   user defined arguments,
    *              cb  :   path of the callback js file,
    *              config: path of the blockchain config file   // TODO: how to deal with the local config file when transfer it to a remote client (via zookeeper), as well as any local materials like cyrpto keys??
    *              out:    (optional)key of the output data
    *            };
    * @clientArgs {Array}, arguments that should be passed to each real client
    * @queryCB {callback}, callback of query message
    * @finishCB {callback}, callback after the test finished
    * @finshArgs{any}, args that should be passed to finishCB, the callback is invoke as finishCB(this.results, finshArgs)
    * @return {Promise}
    */
    startTest(message, clientArgs, finishCB, finshArgs) {
        var p;
        this.results = [];
        this.updates.data = [];
        this.updates.id++;
        switch(this.type) {
            case CLIENT_LOCAL:
                p = this._startLocalTest(message, clientArgs);
                break;
            case CLIENT_ZOO:
                 p = this._startZooTest(message, clientArgs);
                 break;
            default:
                return Promise.reject(new Error('Unknown client type: ' + this.type));
        }
        return p.then(()=>{
            return finishCB(this.results, finshArgs);
        })
        .then(()=>{
            return Promise.resolve();
        })
        .catch((err)=>{
            return Promise.reject(err);
        })
    }

    /**
    * send message to actual clients
    * @message {object}
    * @return {Number}, sent message numbers
    */
    sendMessage(message) {
        switch(this.type) {
            case CLIENT_LOCAL:
                return this._sendLocalMessage(message);
            case CLIENT_ZOO:
                return this._sendZooMessage(message).catch((err) => {
                    return 0;
                });
            default:
                console.log('Unknown client type: ' + this.type);
                return 0;
        }
    }

    stop() {
        switch(this.type) {
            case CLIENT_ZOO:
                this._stopZoo();
                break;
            case CLIENT_LOCAL:
                clientUtil.stop();
                break;
            default:
                ; // nothing to do
        }
    }


    getUpdates() {
        return this.updates;
    }


    /**
    * pseudo private functions
    */

    /**
    * functions for CLIENT_LOCAL
    */
    _startLocalTest(message, clientArgs) {
        message.totalClients = this.number;
        return clientUtil.startTest(this.number, message, clientArgs, this.updates.data, this.results);
    }

    _sendLocalMessage(message) {
        return clientUtil.sendMessage(message);
    }

    /**
    * functions for CLIENT_ZOO
    */
    /**
    * zookeeper structure
    * /caliper---clients---client_xxx   // list of clients
    *         |         |--client_yyy
    *         |         |--....
    *         |--client_xxx_in---msg_xxx {message}
    *         |               |--msg_xxx {message}
    *         |               |--......
    *         |--client_xxx_out---msg_xxx {message}
    *         |                |--msg_xxx {message}
    *         |--client_yyy_in---...
    */

    _initZoo() {
        const TIMEOUT = 5000;
        this.type = CLIENT_ZOO;
        this.zoo  = {
            server: '',
            zk: null,
            hosts: [],    // {id, innode, outnode}
            clientsPerHost: 1
        };

        if(!this.config.hasOwnProperty('zoo')) {
            return Promise.reject('Failed to find zoo property in config file');
        }

        var configZoo = this.config.zoo;
        if(configZoo.hasOwnProperty('server')) {
            this.zoo.server = configZoo.server;
        }
        else {
            return Promise.reject(new Error('Failed to find zookeeper server address in config file'));
        }
        if(configZoo.hasOwnProperty('clientsPerHost')) {
            this.zoo.clientsPerHost = configZoo.clientsPerHost;
        }

        var zk = ZooKeeper.createClient(this.zoo.server, {
            sessionTimeout: TIMEOUT,
            spinDelay : 1000,
            retries: 0
        });
        this.zoo.zk = zk;
        var zoo = this.zoo;
        var connectHandle = setTimeout(()=>{
                                console.log('Could not connect to ZooKeeper');
                                reject('Could not connect to ZooKeeper');
                            }, TIMEOUT+100);
        var p = new Promise((resolve, reject) => {
            zk.once('connected', () => {
                console.log('Connected to ZooKeeper');
                clearTimeout(connectHandle);
                zkUtil.existsP(zk, zkUtil.NODE_CLIENT, 'Failed to find clients due to')
                .then((found)=>{
                    if(!found) {
                        // since zoo-client(s) should create the node if it does not exist,no caliper node means no valid zoo-client now.
                        throw new Error('Could not found clients node in zookeeper');
                    }

                    return zkUtil.getChildrenP(
                        zk,
                        zkUtil.NODE_CLIENT,
                        null,
                        'Failed to list clients due to');
                })
                .then((clients) => {
                    // TODO: not support add/remove zookeeper clients now
                    console.log('get zookeeper clients:' + clients);
                    for (let i = 0 ; i < clients.length ; i++) {
                        let clientID = clients[i];
                        zoo.hosts.push({
                            id: clientID,
                            innode: zkUtil.getInNode(clientID),
                            outnode:zkUtil.getOutNode(clientID)
                        });
                    }
                    resolve(clients.length * zoo.clientsPerHost);
                })
                .catch((err)=>{
                    zk.close();
                    return reject(err);
                });
            });
        });
        console.log('Connecting to ZooKeeper......');
        zk.connect();
        return p;
    }

    _startZooTest(message, clientArgs) {
        var number = this.zoo.hosts.length;
        if (message.numb) {
            // Run specified number of transactions
            message.numb  = Math.floor(message.numb / number);
            if(message.numb < 1) {
                message.numb = 1;
            }
            // trim should be based on client number if specified with txNumber
            if (message.trim) {
                message.trim = Math.floor(message.trim / number);
            }
        } else if (message.txDuration) {
            // Run each client for time specified txDuration       
            // do nothing
        } else {
            return reject(new Error('Unconditioned transaction rate driving mode'));
        }
        
        message.clients = this.zoo.clientsPerHost;
        message.totalClients = this.zoo.clientsPerHost * number;
        return this._sendZooMessage(message, clientArgs)
                .then((number)=>{
                    if(number > 0) {
                        return zooStartWatch(this.zoo, this.updates.data,  this.results);
                    }
                    else {
                        return Promise.reject(new Error('Failed to start the remote test'));
                    }
                })
                .catch((err)=>{
                    console.log('Failed to start the remote test');
                    return Promise.reject(err);
                });
    }

    _sendZooMessage(message, clientArgs) {
        var promises = [];
        var succ = 0;
        if(Array.isArray(clientArgs)) {
            var argsSlice = clientArgs.length / this.zoo.hosts.length;
        }
        else {
            var msgBuffer = new Buffer(JSON.stringify(message));
        }
        this.zoo.hosts.forEach((host, idx)=>{
            let data;
            if(Array.isArray(clientArgs)) {
                let msg = message;
                msg['clientargs'] = clientArgs.slice(idx * argsSlice, idx * argsSlice+argsSlice);
                data = new Buffer(JSON.stringify(msg));
            }
            else {
                data = msgBuffer;
            }

            let p = zkUtil.createP(this.zoo.zk, host.innode+'/msg_', data, ZooKeeper.CreateMode.EPHEMERAL_SEQUENTIAL, 'Failed to send message (create node) due to')
                    .then((path)=>{
                        succ++;
                        return Promise.resolve();
                    })
                    .catch((err)=>{
                        return Promise.resolve();
                    });
            promises.push(p);
        });
        return Promise.all(promises)
                .then(()=>{
                    return Promise.resolve(succ);
                });
    }

    _stopZoo() {
        if(this.zoo && this.zoo.zk) {
            var msg = {type: 'quit'};
            this._sendZooMessage(msg).then(()=>{
                setTimeout(()=>{
                    this.zoo.zk.close();
                    this.zoo.hosts = [];
                }, 1000);
            })
        }
    }
}

module.exports = Client;


/*function zooMessageCallback(zk, path, queryCB, results) {
    return zkUtil.getDataP(zk, path, null, 'Failed to getData from zookeeper')
        .then((data)=>{
            let msg  = JSON.parse(data.toString());
            let stop = false;
            switch(msg.type) {
                case 'testResult':
                    results.push(msg.data);
                    stop = true;   // stop watching
                    break;
                case 'error':
                    console.log('Client encountered error, ' + msg.data);
                    stop = true;   // stop watching
                    break;
                case 'queryResult':
                    queryCB(msg.session, msg.data);
                    stop = false;
                    break;
                default:
                    console.log('Unknown message type: ' + msg.type);
                    stop = false;
                    break;
            }
            zk.remove(path, -1, (err)=>{
                if(err) {
                    console.log(err.stack);
                    return;
                }
            });
            return Promise.resolve(stop);
        });
}*/
function zooMessageCallback(data, updates, results) {
    var msg  = JSON.parse(data.toString());
    var stop = false;
    switch(msg.type) {
        case 'testResult':
            results.push(msg.data);
            stop = true;   // stop watching
            break;
        case 'error':
            console.log('Client encountered error, ' + msg.data);
            stop = true;   // stop watching
            break;
        case 'txUpdated':
            updates.push(msg.data);
            stop = false;
            break;
        default:
            console.log('Unknown message type: ' + msg.type);
            stop = false;
            break;
    }
    return Promise.resolve(stop);
}

function zooStartWatch(zoo, updates, results) {
    var promises = [];
    var zk   = zoo.zk;
    zoo.hosts.forEach((host)=>{
        let path = host.outnode;
        let p = zkUtil.watchMsgQueueP(
                    zk,
                    path,
                    (data)=>{
                        return zooMessageCallback(data, updates, results)
                            .catch((err) => {
                                console.log('Exception encountered when watching message from zookeeper, due to:');
                                console.log(err);
                                return Promise.resolve(true);
                            });
                    },
                    'Failed to watch zookeeper children'
                );
        promises.push(p);
    });
    return Promise.all(promises);
}
