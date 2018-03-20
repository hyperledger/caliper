/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict'

const CLIENT_LOCAL = 'local';
const CLIENT_ZOO   = 'zookeeper';

var zkUtil     = require('./zoo-util.js');
var processes  = {}; // {pid:{obj, promise}}

function setPromise(pid, isResolve, msg) {
    var p = processes[pid];
    if(p && p.promise && typeof p.promise !== 'undefined') {
        if(isResolve) {
            p.promise.resolve(msg);
        }
        else {
            p.promise.reject(msg);
        }
    }
}

function pushResult(pid, data) {
    var p = processes[pid];
    if(p && p.results && typeof p.results !== 'undefined') {
        p.results.push(data);
    }
}

function pushUpdate(pid, data) {
    var p = processes[pid];
    if(p && p.updates && typeof p.updates !== 'undefined') {
        p.updates.push(data);
    }
}

function updateCallback(pid, session, data) {
    var p = processes[pid];
    if(p && p.updateCB && typeof p.updateCB !== 'undefined') {
        p.updateCB(session, data);
    }
}

function launchClient(message, updateCB, results) {
    var path = require('path');
    var childProcess = require('child_process');
    var child = childProcess.fork(path.join(__dirname, 'local-client.js'));
    var pid   = child.pid.toString();
    processes[pid] = {obj: child, results: results, updateCB: updateCB};

    child.on('message', function(msg) {
        if(msg.type === 'testResult') {
            pushResult(pid, msg.data);
            setPromise(pid, true, null);
        }
        else if(msg.type === 'error') {
            setPromise(pid, false, new Error('Client encountered error:' + msg.data));
        }
        else if(msg.type === 'txUpdated') {
            pushUpdate(pid, msg.data);
        }
    });

    child.on('error', function(){
        setPromise(pid, false, new Error('Client encountered unexpected error'));
    });

    child.on('exit', function(){
        console.log('Client exited');
        setPromise(pid, true, null);
    });
}

function startTest(number, message, clientArgs, updates, results) {
    let count = 0;    
    for (let i in processes) {
        count++;
    }
    if(count === number) {  // already launched clients
        let txPerClient;
        if (message.numb) {
            // Run specified number of transactions
            txPerClient  = Math.floor(message.numb / number);

            // trim should be based on client number if specified with txNumber
            if (message.trim) {
                message.trim = Math.floor(message.trim / number);
            }

            if(txPerClient < 1) {
                txPerClient = 1;
            }
            message.numb = txPerClient;
        } else if (message.txDuration) {
            // Run for time specified txDuration based on clients
            // Do nothing, we run for the time specified within message.txDuration
        } else {
            return reject(new Error('Unconditioned transaction rate driving mode'));
        }
        
        message.clients = number;

        let promises = [];
        let idx = 0;
        for(let id in processes) {
            let client = processes[id];
            let p = new Promise((resolve, reject) => {
                client['promise'] = {
                    resolve: resolve,
                    reject:  reject
                }
            });
            promises.push(p);
            client['results'] = results;
            client['updates'] = updates;
            message['clientargs'] = clientArgs[idx];
            idx++;

            client.obj.send(message);
        }

        return Promise.all(promises)
                .then(()=>{
                    // clear promises
                    for(let client in processes) {
                        delete client.promise;
                    }
                    return Promise.resolve();
                })
                .catch((err)=>{
                    return Promise.reject(err);
                });

    }

    // launch clients
    processes = {};
    for(let i = 0 ; i < number ; i++) {
        launchClient(message, updates, results);
    }

    // start test
    return startTest(number, message, clientArgs, updates, results);
}
module.exports.startTest = startTest;

function sendMessage(message) {
    for(let pid in processes) {
        processes[pid].obj.send(message);
    }
    return processes.length;
}
module.exports.sendMessage = sendMessage;

function stop() {
    for(let pid in processes) {
        processes[pid].obj.kill();
    }
    processes = {};
}
module.exports.stop = stop;