/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/

'use strict';

module.exports.NODE_ROOT   = '/caliper';
module.exports.NODE_CLIENT = '/caliper/clients';

const ZooKeeper = require('node-zookeeper-client');
const logger    = require('../util.js').getLogger('zoo-util.js');
/**
 * Check if specified znode exists
 * @param {Object} zookeeper zk object
 * @param {String} path path of znode
 * @param {String} errLog specified informative error message
 * @return {Promise} returned bool indicates whether the znode exists or not
 */
function exists(zookeeper, path, errLog) {
    return new Promise((resolve, reject) => {
        zookeeper.exists(path, (err, stat) => {
            if(err) {
                logger.error(errLog);
                return reject(err);
            }
            if(stat) {
                return resolve(true);
            }
            else {
                return resolve(false);
            }
        });
    });
}
module.exports.existsP = exists;

/**
 * Create a znode
 * @param {Object} zookeeper zk object
 * @param {String} path path of the znode
 * @param {Buffer} data data of the znode
 * @param {Number} mode create mode
 * @param {String} errLog specified informative error message
 * @return {Promise} path of the created znode
 */
function create(zookeeper, path, data, mode, errLog) {
    return new Promise((resolve, reject) => {
        zookeeper.create(path, data, ZooKeeper.ACL.OPEN_ACL_UNSAFE, mode, (err, path) => {
            if(err) {
                logger.error(errLog);
                return reject(err);
            }
            else {
                return resolve(path);
            }
        });
    });
}
module.exports.createP = create;

/**
 * Remove a znode
 * @param {Object} zookeeper zk object
 * @param {String} path path of znode
 * @param {Number} version znode's version
 * @param {String} errLog specified informative error message
 * @return {Promise} promise object
 */
function remove(zookeeper, path, version, errLog) {
    return new Promise((resolve, reject)=>{
        zookeeper.remove(path, version, (err)=>{
            if(err) {
                logger.error(errLog);
                return reject(err);
            }
            return resolve();
        });
    });
}
module.exports.removeP = remove;

/**
 * Read data of specified znode
 * @param {Object} zookeeper zk object
 * @param {String} path path of znode
 * @param {Object} watcher zk watcher
 * @param {String} errLog specified informative error message
 * @return {Promise} data of specified znode
 */
function getData(zookeeper, path,watcher, errLog) {
    return new Promise((resolve, reject) => {
        zookeeper.getData(path, watcher, (err, data, stat) => {
            if(err) {
                logger.error(errLog);
                return reject(err);
            }
            else {
                return resolve(data);
            }
        });
    });
}
module.exports.getDataP = getData;

/**
 * Get children under specified znode
 * @param {Object} zookeeper zk object
 * @param {String} path path of znode
 * @param {Object} watcher zk watcher
 * @param {String} errLog specified informative error message
 * @return {Promise} children list
 */
function getChildren(zookeeper, path, watcher, errLog) {
    return new Promise((resolve, reject) => {
        zookeeper.getChildren(path, watcher, (err, children, stat)=>{
            if (err) {
                logger.error(errLog);
                return reject(err);
            }
            else {
                return resolve(children);
            }
        });
    });
}
module.exports.getChildrenP = getChildren;

/**
 * Remove all children under specified znode
 * @param {Object} zookeeper zk object
 * @param {String} path path of znode
 * @param {String} errLog specified informative error message
 * @return {Promise} promise object
 */
function removeChildren(zookeeper, path, errLog) {
    return getChildren(zookeeper, path, null, '').then((children)=>{
        let promises = [];
        children.forEach((child)=>{
            let p = remove(zookeeper, path+'/'+child, -1, '');
            promises.push(p);
        });
        return Promise.all(promises);
    }).catch((err)=>{
        logger.error(errLog);
        logger.error(err);
        return Promise.resolve();
    });
}
module.exports.removeChildrenP = removeChildren;

/**
 * Receive and handle upcoming messages by watching specified znode continuously
 * @param {Object} zookeeper zk object
 * @param {String} path path of znode
 * @param {Object} callback callback for new messages
 * @param {String} errLog specified informative error message
 * @return {Promise} promise object
 */
function watchMsgQueue(zookeeper, path, callback, errLog) {
    let lastnode = null;
    let cont     = true;
    /**
     * main process
     * @param {Object} resolve promise object
     * @param {Object} reject  promise object
     */
    let whilst = ( resolve, reject) => {
        getChildren(
            zookeeper,
            path,
            (event)=>{
                if(cont) {
                    whilst(resolve, reject);
                }
                else {
                    logger.info('Stopped watching at '+path);
                }
            },
            errLog
        ).then((children)=>{
            if(!cont) {return;}
            if(children.length === 0)  {return;}
            children.sort();    // handle message one by one
            let preKnown = lastnode;
            lastnode = children[children.length - 1];
            let newidx = -1;
            if(preKnown === null) {
                newidx = 0;
            }
            else {  // get recent unknown message
                for(let i = 0 ; i < children.length ; i++) {
                    if(children[i] > preKnown) {
                        newidx = i;
                        break;
                    }
                }
            }
            if(newidx < 0) {  // no new message
                return;
            }

            let newNodes = children.slice(newidx);
            newNodes.reduce( (prev, item) => {
                return prev.then( () => {
                    return getData(zookeeper, path+'/'+item, null, 'Failed to getData from zookeeper');
                }).then((data)=>{
                    zookeeper.remove(path+'/'+item, -1, (err)=>{
                        if(err) {
                            logger.error(err.stack);
                        }
                    });

                    return callback(data);
                }).then((stop)=>{
                    if(stop) {
                        resolve();
                        cont = false;
                    }
                    return Promise.resolve();
                }).catch((err)=>{
                    return Promise.resolve();
                });
            }, Promise.resolve());
        }).catch((err)=>{
            logger.error(errLog);
            cont = false;
            resolve();
        });
    };

    return new Promise((resolve, reject)=>{
        whilst( resolve, reject);
    });
}
module.exports.watchMsgQueueP = watchMsgQueue;

/**
 * Generate in node
 * @param {String} clientID identity of specified zk client
 * @return {String} path of the in node
 */
function getInNode(clientID) {
    return this.NODE_ROOT+'/'+clientID+'_in';
}
module.exports.getInNode = getInNode;

/**
 * Generate out node
 * @param {String} clientID identity of specified zk client
 * @return {String} path of the out node
 */
function getOutNode(clientID) {
    return this.NODE_ROOT+'/'+clientID+'_out';
}
module.exports.getOutNode = getOutNode;