/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict';
const log          = require('../util.js').log;
let processes  = {}; // {pid:{obj, promise}}

/**
 * Call the Promise function for a process
 * @param {String} pid pid of the process
 * @param {Boolean} isResolve indicates resolve(true) or reject(false)
 * @param {Object} msg input for the Promise function
 */
function setPromise(pid, isResolve, msg) {
    let p = processes[pid];
    if(p && p.promise && typeof p.promise !== 'undefined') {
        if(isResolve) {
            p.promise.resolve(msg);
        }
        else {
            p.promise.reject(msg);
        }
    }
}

/**
 * Push test result from a child process into the global array
 * @param {String} pid pid of the child process
 * @param {Object} data test result
 */
function pushResult(pid, data) {
    let p = processes[pid];
    if(p && p.results && typeof p.results !== 'undefined') {
        p.results.push(data);
    }
}

/**
 * Push update value from a child process into the global array
 * @param {String} pid pid of the child process
 * @param {Object} data update value
 */
function pushUpdate(pid, data) {
    let p = processes[pid];
    if(p && p.updates && typeof p.updates !== 'undefined') {
        p.updates.push(data);
    }
}

/**
 * Launch a child process to do the test
 * @param {Array} updates array to save txUpdate results
 * @param {Array} results array to save the test results
 */
function launchClient(updates, results) {
    let path = require('path');
    let childProcess = require('child_process');
    let child = childProcess.fork(path.join(__dirname, 'local-client.js'));
    let pid   = child.pid.toString();
    processes[pid] = {obj: child, results: results, updates: updates};

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

    child.on('exit', function(code, signal){
        log('Client exited ');
        setPromise(pid, false, new Error('Client already exited'));
    });
}

/**
 * Start a test
 * @param {Number} number test clients' count
 * @param {JSON} message start message
 * @param {Array} clientArgs each element contains specific arguments for a client
 * @param {Array} updates array to save txUpdate results
 * @param {Array} results array to save the test results
 * @return {Promise} promise object
 */
function startTest(number, message, clientArgs, updates, results) {
    let count = 0;
    for(let i in processes) {
        i;  // avoid eslint error
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
            return Promise.reject(new Error('Unconditioned transaction rate driving mode'));
        }

        message.clients = number;

        let promises = [];
        let idx = 0;
        for(let id in processes) {
            let client = processes[id];
            let p = new Promise((resolve, reject) => {
                client.promise = {
                    resolve: resolve,
                    reject:  reject
                };
            });
            promises.push(p);
            client.results = results;
            client.updates = updates;
            message.clientargs = clientArgs[idx];
            message.clientIdx = idx;
            idx++;

            client.obj.send(message);
        }

        return Promise.all(promises).then(()=>{
            // clear promises
            for(let client in processes) {
                delete client.promise;
            }
            return Promise.resolve();
        }).catch((err)=>{
            return Promise.reject(err);
        });

    }

    // launch clients
    processes = {};
    for(let i = 0 ; i < number ; i++) {
        launchClient(updates, results);
    }

    // start test
    return startTest(number, message, clientArgs, updates, results);
}
module.exports.startTest = startTest;

/**
 * Send message to all child processes
 * @param {JSON} message message
 * @return {Number} number of child processes
 */
function sendMessage(message) {
    for(let pid in processes) {
        processes[pid].obj.send(message);
    }
    return processes.length;
}
module.exports.sendMessage = sendMessage;

/**
 * Stop all test clients(child processes)
 */
function stop() {
    for(let pid in processes) {
        processes[pid].obj.kill();
    }
    processes = {};
}
module.exports.stop = stop;
