/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict';

const CLIENT_LOCAL = 'local';
const CLIENT_ZOO   = 'zookeeper';

const zkUtil  = require('./zoo-util.js');
const ZooKeeper = require('node-zookeeper-client');
const clientUtil = require('./client-util.js');

const util = require('../util');
const logger = util.getLogger('client.js');


/**
 * Callback function to handle messages received from zookeeper clients
 * @param {Object} data message data
 * @param {Array} updates array to save txUpdate results
 * @param {Array} results array to save test results
 * @return {Promise} boolean value that indicates whether the test of corresponding client has already stopped
 */
function zooMessageCallback(data, updates, results) {
    let msg  = JSON.parse(data.toString());
    let stop = false;
    switch(msg.type) {
    case 'testResult':
        results.push(msg.data);
        stop = true;   // stop watching
        break;
    case 'error':
        logger.error('Client encountered error, ' + msg.data);
        stop = true;   // stop watching
        break;
    case 'txUpdated':
        updates.push(msg.data);
        stop = false;
        break;
    default:
        logger.warn('Unknown message type: ' + msg.type);
        stop = false;
        break;
    }
    return Promise.resolve(stop);
}

/**
 * Start watching zookeeper
 * @param {JSON} zoo zookeeper service informations
 * @param {Array} updates array to save txUpdate data
 * @param {Array} results array to save test resultss
 * @return {Promsise} promise object
 */
function zooStartWatch(zoo, updates, results) {
    let promises = [];
    let zk   = zoo.zk;
    zoo.hosts.forEach((host)=>{
        let path = host.outnode;
        let p = zkUtil.watchMsgQueueP(
            zk,
            path,
            (data)=>{
                return zooMessageCallback(data, updates, results).catch((err) => {
                    logger.error('Exception encountered when watching message from zookeeper, due to:' + err);
                    return Promise.resolve(true);
                });
            },
            'Failed to watch zookeeper children'
        );
        promises.push(p);
    });
    return Promise.all(promises);
}

/**
 * Class for test client
 */
class Client{
    /**
     * Constructor
     * @param {String} config path of the configuration file
     */
    constructor(config) {
        //let conf = require(config);
        let conf = util.parseYaml(config);
        this.config = conf.test.clients;
        this.results = [];                        // output of recent test round
        this.updates = {id:0, data:[]};           // contains txUpdated messages
    }

    /**
    * Initialise client object
    * @return {Promise} promise object
    */
    async init() {
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
                return this.number;
            case CLIENT_ZOO:
                return await this._initZoo();
            default:
                throw new Error('Unknown client type, should be local or zookeeper');
            }
        }
        else {
            throw new Error('Failed to find client type in config file');
        }
    }

    /**
    * Start the test
    * message = {
    *              type: 'test',
    *              label : label name,
    *              numb:   total number of simulated txs,
    *              rateControl: rate controller to use
    *              trim:   trim options
    *              args:   user defined arguments,
    *              cb  :   path of the callback js file,
    *              config: path of the blockchain config file   // TODO: how to deal with the local config file when transfer it to a remote client (via zookeeper), as well as any local materials like cyrpto keys??
    *            };
    * @param {JSON} message start message
    * @param {Array} clientArgs each element of the array contains arguments that should be passed to corresponding test client
    * @param {function} finishCB callback after the test finished
    * @param {any} finishArgs arguments that should be passed to finishCB, the callback is invoke as finishCB(this.results, finshArgs)
     * @async
    */
    async startTest(message, clientArgs, finishCB, finishArgs) {
        this.results = [];
        this.updates.data = [];
        this.updates.id++;

        switch(this.type) {
        case CLIENT_LOCAL:
            await this._startLocalTest(message, clientArgs);
            break;
        case CLIENT_ZOO:
            await this._startZooTest(message, clientArgs);
            break;
        default:
            throw new Error(`Unknown client type: ${this.type}`);
        }

        await finishCB(this.results, finishArgs);
    }

    /**
     * Stop the client
     */
    stop() {
        switch(this.type) {
        case CLIENT_ZOO:
            this._stopZoo();
            break;
        case CLIENT_LOCAL:
            clientUtil.stop();
            break;
        default:
                 // nothing to do
        }
    }

    /**
     * Get the update array
     * @return {Array} update array
     */
    getUpdates() {
        return this.updates;
    }

    /**
    * functions for CLIENT_LOCAL
    */

    /**
     * Start the test
     * @param {JSON} message start messages
     * @param {Array} clientArgs arguments for the test clients
     * @return {Promise} promise object
     * @async
     */
    async _startLocalTest(message, clientArgs) {
        message.totalClients = this.number;
        return await clientUtil.startTest(this.number, message, clientArgs, this.updates.data, this.results);
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

    /**
     * Connect to zookeeper server and look up available test clients
     * @return {Promise} number of available test clients
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

        let configZoo = this.config.zoo;
        if(configZoo.hasOwnProperty('server')) {
            this.zoo.server = configZoo.server;
        }
        else {
            return Promise.reject(new Error('Failed to find zookeeper server address in config file'));
        }
        if(configZoo.hasOwnProperty('clientsPerHost')) {
            this.zoo.clientsPerHost = configZoo.clientsPerHost;
        }

        let zk = ZooKeeper.createClient(this.zoo.server, {
            sessionTimeout: TIMEOUT,
            spinDelay : 1000,
            retries: 0
        });
        this.zoo.zk = zk;
        let zoo = this.zoo;
        let connectHandle = setTimeout(()=>{
            logger.error('Could not connect to ZooKeeper');
            Promise.reject('Could not connect to ZooKeeper');
        }, TIMEOUT+100);
        let p = new Promise((resolve, reject) => {
            zk.once('connected', () => {
                logger.info('Connected to ZooKeeper');
                clearTimeout(connectHandle);
                zkUtil.existsP(zk, zkUtil.NODE_CLIENT, 'Failed to find clients due to').then((found)=>{
                    if(!found) {
                        // since zoo-client(s) should create the node if it does not exist,no caliper node means no valid zoo-client now.
                        throw new Error('Could not found clients node in zookeeper');
                    }

                    return zkUtil.getChildrenP(
                        zk,
                        zkUtil.NODE_CLIENT,
                        null,
                        'Failed to list clients due to');
                }).then((clients) => {
                    // TODO: not support add/remove zookeeper clients now
                    logger.info('get zookeeper clients:' + clients);
                    for (let i = 0 ; i < clients.length ; i++) {
                        let clientID = clients[i];
                        zoo.hosts.push({
                            id: clientID,
                            innode: zkUtil.getInNode(clientID),
                            outnode:zkUtil.getOutNode(clientID)
                        });
                    }
                    resolve(clients.length * zoo.clientsPerHost);
                }).catch((err)=>{
                    zk.close();
                    return reject(err);
                });
            });
        });
        logger.info('Connecting to ZooKeeper......');
        zk.connect();
        return p;
    }

    /**
     * Start test on zookeeper mode
     * @param {JSON} message start message
     * @param {Array} clientArgs arguments for test clients
     * @return {Promise} promise object
     */
    _startZooTest(message, clientArgs) {
        let number = this.zoo.hosts.length;
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
            return Promise.reject(new Error('Unconditioned transaction rate driving mode'));
        }

        message.clients = this.zoo.clientsPerHost;
        message.totalClients = this.zoo.clientsPerHost * number;
        return this._sendZooMessage(message, clientArgs).then((number)=>{
            if(number > 0) {
                return zooStartWatch(this.zoo, this.updates.data,  this.results);
            }
            else {
                return Promise.reject(new Error('Failed to start the remote test'));
            }
        }).catch((err)=>{
            logger.error('Failed to start the remote test');
            return Promise.reject(err);
        });
    }

    /**
     * Send message to test clients via zookeeper service
     * @param {JSON} message message to be sent
     * @param {Array} clientArgs arguments for test clients
     * @return {Number} actual number of sent messages
     */
    _sendZooMessage(message, clientArgs) {
        let promises = [];
        let succ = 0;
        let argsSlice, msgBuffer;
        if(Array.isArray(clientArgs)) {
            argsSlice = clientArgs.length / this.zoo.hosts.length;
        }
        else {
            msgBuffer = new Buffer(JSON.stringify(message));
        }
        this.zoo.hosts.forEach((host, idx)=>{
            let data;
            if(Array.isArray(clientArgs)) {
                let msg = message;
                msg.clientargs = clientArgs.slice(idx * argsSlice, idx * argsSlice+argsSlice);
                data = new Buffer(JSON.stringify(msg));
            }
            else {
                data = msgBuffer;
            }

            let p = zkUtil.createP(this.zoo.zk, host.innode+'/msg_', data, ZooKeeper.CreateMode.EPHEMERAL_SEQUENTIAL, 'Failed to send message (create node) due to').then((path)=>{
                succ++;
                return Promise.resolve();
            }).catch((err)=>{
                return Promise.resolve();
            });
            promises.push(p);
        });
        return Promise.all(promises).then(()=>{
            return Promise.resolve(succ);
        });
    }

    /**
     * Stop the client
     */
    _stopZoo() {
        if(this.zoo && this.zoo.zk) {
            let msg = {type: 'quit'};
            this._sendZooMessage(msg).then(()=>{
                setTimeout(()=>{
                    this.zoo.zk.close();
                    this.zoo.hosts = [];
                }, 1000);
            });
        }
    }
}

module.exports = Client;
