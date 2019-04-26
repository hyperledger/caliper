/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/

'use strict';

const Util = require('../utils/caliper-utils');
const logger = Util.getLogger('zoo-client.js');
const Blockchain = require('../blockchain.js');
const ZooKeeper = require('node-zookeeper-client');
const zkUtil = require('./zoo-util.js');
const clientUtil = require('./client-util.js');
const path = require('path');


/**
 * Class for ZooKeeper Clients
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
class CaliperZooClient {

    /**
     * Create the zoo client
     * @param {Object} address the zookeeper address
     * @param {Object} clientFactory blockchain client factory
     * @param {String} networkRoot fully qualified path to the root location of network files
     */
    constructor(address, clientFactory, networkRoot) {
        this.address = address;
        this.clientFactory = clientFactory;
        this.zk = ZooKeeper.createClient(address);
        this.clientID = '';
        this.inNode = '';
        this.outNode = '';
        this.closed = false;
        this.results = [];   // contains testResult message data
        this.updates = [];   // contains txUpdated message data
        this.updateTail = 0;
        this.updateInter = null;
        this.updateTime = 1000;
        this.networkRoot = networkRoot;
    }

    /**
     * Remove unused znodes
     * @return {Promise} promise object
     */
    clear() {
        let promises = [];
        if(this.inNode !== '') {
            promises.push(zkUtil.removeChildrenP(this.zk, this.inNode, 'Failed to remove children due to'));
        }
        if(this.outNode !== '') {
            promises.push(zkUtil.removeChildrenP(this.zk, this.outNode, 'Failed to remove children due to'));
        }
        clientUtil.stop();
        return Promise.all(promises);
    }

    /**
     * Close zk client
     */
    close() {
        logger.info('closing zookeeper client...');
        if (this.closed) {
            return;
        }
        this.closed = true;
        this.clear().then(()=>{
            let promises = [];
            if(this.inNode !== '') {
                promises.push(zkUtil.removeP(this.zk, this.inNode, -1, 'Failed to remove inNode due to'));
            }
            if(this.outNode !== '') {
                promises.push(zkUtil.removeP(this.zk, this.outNode, -1, 'Failed to remove inNode due to'));
            }
        }).then(()=>{
            logger.info('Node ' + this.inNode + ' ' + this.outNode + ' is deleted');
            this.inNode = '';
            this.outNode = '';
            this.zk.close();
        }).catch((err)=>{
            this.inNode = '';
            this.outNode = '';
            this.zk.close();
        });
    }

    /**
     * Write data (send message) into zk
     * @param {Buffer} data message data
     * @return {Promise} promise object
     */
    write(data) {
        return zkUtil.createP(this.zk, this.outNode+'/msg_', data, ZooKeeper.CreateMode.EPHEMERAL_SEQUENTIAL, 'Failed to send message (create node) due to');
    }

    /**
     * Generate and send txUpdated message
     */
    txUpdate() {
        let len = this.updates.length;
        if(len === this.updateTail) {
            return;
        }

        let submitted = 0;
        let committed = [];
        for(let i = this.updateTail ; i < len ; i++) {
            submitted += this.updates[i].submitted;
            committed.push(this.updates[i].committed);
        }
        this.updateTail = len;

        let message = {type: 'txUpdated', data: {submitted: submitted}};
        if(Blockchain.mergeDefaultTxStats(committed) === 0) {
            message.data.committed = Blockchain.createNullDefaultTxStats();
        }
        else {
            message.data.committed = committed[0];
        }
        let buf = new Buffer(JSON.stringify(message));
        this.write(buf);
    }

    /**
     * Initialise global variables before test
     */
    beforeTest() {
        this.results = [];
        this.updates = [];
        this.updateTail = 0;
        const self = this;
        this.updateInter = setInterval( () => { self.txUpdate();  } , self.updateTime);
    }

    /**
     * Send results and release resources after test
     * @return {Promise} promise object
     */
    afterTest() {
        if(this.updateInter) {
            clearInterval(this.updateInter);
            this.updateInter = null;
            this.txUpdate();
        }

        return Util.sleep(200).then(()=>{
            let message = {type: 'testResult', data: this.results[0]};
            if(Blockchain.mergeDefaultTxStats(this.results) === 0) {
                message = {type: 'testResult', data: Blockchain.createNullDefaultTxStats()};
            }
            else {
                message = {type: 'testResult', data: this.results[0]};
            }
            let buf = new Buffer(JSON.stringify(message));
            return this.write(buf);
        }).catch((err) => {
            logger.error(err);
            return Promise.resolve();
        });
    }

    /**
     * Message handler
     * @param {Object} data message received
     * @return {Promise} returned bool value which indicates whether the zk connection has been closed or not
     */
    zooMessageCallback(data) {
        let msg  = JSON.parse(data.toString());
        logger.info('Receive message, type='+msg.type);

        switch(msg.type) {
        case 'test': {
            this.beforeTest();
            msg.root = this.networkRoot;
            zkUtil.removeChildrenP(this.zk, this.outNode, 'Failed to remove children in outNode due to').then(()=>{
                return clientUtil.startTest(msg.clients, msg, msg.clientargs, this.updates, this.results, this.clientFactory);
            }).then(() => {
                return this.afterTest();
            }).catch((err)=>{
                logger.error('==Exception while testing, ' + err);
                return this.afterTest();
            });
            break;
        }
        case 'quit': {
            this.clear();
            break;
        }
        default: {
            clientUtil.sendMessage(msg);
            break;
        }
        }
        return Promise.resolve(this.closed);
    }

    /**
     * Waiting for messages by watching corresponding zk nodes
     * @return {Promise} promise object
     */
    watch() {
        return zkUtil.watchMsgQueueP(
            this.zk,
            this.inNode,
            (data) => {
                return this.zooMessageCallback(data).catch((err) => {
                    logger.error('Exception encountered when watching message from zookeeper, due to:' + err);
                    return Promise.resolve(true);
                });
            },
            'Failed to watch children nodes in zookeeper'
        ).catch((err) => {
            logger.error(err);
            return Promise.resolve();
        });
    }

    /**
     * Start the zookeper client
     */
    start(){
        const self = this;
        this.zk.once('connected', function() {
            logger.info('Connected to ZooKeeper');
            zkUtil.existsP(self.zk, zkUtil.NODE_ROOT, 'Failed to find NODE_ROOT due to').then((found)=>{
                if(found) {
                    return Promise.resolve();
                }
                else {
                    return zkUtil.createP(self.zk, zkUtil.NODE_ROOT, null, ZooKeeper.CreateMode.PERSISTENT, 'Failed to create NODE_ROOT due to');
                }
            }).then(()=>{
                return zkUtil.existsP(self.zk, zkUtil.NODE_CLIENT, 'Failed to find clients node due to');
            }).then((found)=>{
                if(found) {
                    return Promise.resolve();
                }
                else {
                    return zkUtil.createP(self.zk, zkUtil.NODE_CLIENT, null, ZooKeeper.CreateMode.PERSISTENT, 'Failed to create clients node due to');
                }
            }).then(()=>{         // create client node
                let random = new Date().getTime();
                let clientPath = zkUtil.NODE_CLIENT + '/client_'+random+'_';
                return zkUtil.createP(self.zk, clientPath, null, ZooKeeper.CreateMode.EPHEMERAL_SEQUENTIAL, 'Failed to create client node due to');
            }).then((clientPath)=>{
                logger.info('Created client node:'+clientPath);
                self.clientID = path.basename(clientPath);
                self.inNode   = zkUtil.getInNode(self.clientID);
                self.outNode  = zkUtil.getOutNode(self.clientID);
                return zkUtil.createP(self.zk, self.inNode, null, ZooKeeper.CreateMode.PERSISTENT, 'Failed to create receiving queue due to');
            }).then((inPath)=>{
                logger.info('Created receiving queue at:'+inPath);
                return zkUtil.createP(self.zk, self.outNode, null, ZooKeeper.CreateMode.PERSISTENT, 'Failed to create sending queue due to');
            }).then((outPath)=>{
                logger.info('Created sending queue at:'+outPath);
                logger.info('Waiting for messages at:'+self.inNode+'......');
                self.watch();
            }).catch((err)=> {
                logger.error(err.stack ? err.stack : err);
                self.close();
            });
        });

        this.zk.connect();
    }

}

module.exports = CaliperZooClient;
