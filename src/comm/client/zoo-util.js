/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/

'use strict'

module.exports.NODE_ROOT   = '/caliper';
module.exports.NODE_CLIENT = '/caliper/clients';

var ZooKeeper = require('node-zookeeper-client');
function exists(zookeeper, path, errLog) {
    return new Promise((resolve, reject) => {
        zookeeper.exists(path, (err, stat) => {
            if(err) {
                console.log(errLog);
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

function create(zookeeper, path, data, mode, errLog) {
    return new Promise((resolve, reject) => {
        zookeeper.create(path, data, ZooKeeper.ACL.OPEN_ACL_UNSAFE, mode, (err, path) => {
            if(err) {
                console.log(errLog);
                return reject(err);
            }
            else {
                return resolve(path);
            }
        });
    });
}
module.exports.createP = create;

function remove(zookeeper, path, version, errLog) {
    return new Promise((resolve, reject)=>{
        zookeeper.remove(path, version, (err)=>{
            if(err) {
                console.log(errLog);
                return reject(err);
            }
            return resolve();
        });
    });
}
module.exports.removeP = remove;

function getData(zookeeper, path,watcher, errLog) {
    return new Promise((resolve, reject) => {
        zookeeper.getData(path, watcher, (err, data, stat) => {
            if(err) {
                console.log(errLog);
                return reject(err);
            }
            else {
                return resolve(data);
            }
        });
    });
}
module.exports.getDataP = getData;

function getChildren(zookeeper, path, watcher, errLog) {
    return new Promise((resolve, reject) => {
         zookeeper.getChildren(path, watcher, (err, children, stat)=>{
            if (err) {
                console.log(errLog);
                return reject(err);
            }
            else {
                return resolve(children);
            }
         });
    });
}
module.exports.getChildrenP = getChildren;

function removeChildren(zookeeper, path, errLog) {
    return getChildren(zookeeper, path, null, '')
            .then((children)=>{
                var promises = [];
                children.forEach((child)=>{
                    let p = remove(zookeeper, path+'/'+child, -1, '');
                    promises.push(p);
                });
                return Promise.all(promises);
            })
            .catch((err)=>{
                console.log(errLog);
                console.log(err);
                return Promise.resolve();
            });
}
module.exports.removeChildrenP = removeChildren;

function watchMsgQueue(zookeeper, path, callback, errLog) {
    var lastnode = null;
    var cont     = true;
    var whilst = ( resolve, reject) => {
        return getChildren(
            zookeeper,
            path,
            (event)=>{
                if(cont) {
                    whilst(resolve, reject);
                }
                else {
                    console.log('Stopped watching at '+path);
                }
            },
            errLog
        )
        .then((children)=>{
            if(!cont) return;
            if(children.length === 0)  return;
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
                })
                .then((data)=>{
                    zookeeper.remove(path+'/'+item, -1, (err)=>{
                        if(err) {
                            console.log(err.stack);
                        }
                    });

                    return callback(data);
                })
                .then((stop)=>{
                    if(stop)
                    {
                        resolve();
                        cont = false;
                    }
                    return Promise.resolve();
                })
                .catch((err)=>{
                    return Promise.resolve();
                });
            }, Promise.resolve());
        })
        .catch((err)=>{
            console.log(errLog);
            cont = false;
            resolve();
        });
    }

    return new Promise((resolve, reject)=>{
        whilst( resolve, reject);
    });
}
module.exports.watchMsgQueueP = watchMsgQueue;


function watchChildren(zookeeper, path, callback, errLog) {
    var whilst = (resolve, reject) => {
        return getChildren(
            zookeeper,
            path,
            (event)=>{
                whilst(resolve, reject);
            },
            errLog
        )
        .then((children)=>{
            return callback(children)
                .then((stop)=>{
                    if(stop)
                    {
                        resolve();
                    }
                });
        })
        .catch((err)=>{
            console.log(errLog);
            reject(err);
        });
    }
    return new Promise((resolve, reject)=>{
        whilst(resolve, reject);
    });
}
module.exports.watchChildrenP = watchChildren;

function getInNode(clientID) {
    return this.NODE_ROOT+'/'+clientID+'_in';
}
module.exports.getInNode = getInNode;

function getOutNode(clientID) {
    return this.NODE_ROOT+'/'+clientID+'_out';
}
module.exports.getOutNode = getOutNode;