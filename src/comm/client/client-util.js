/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict';
const logger = require('../util.js').getLogger('client-util.js');
const path = require('path');
const childProcess = require('child_process');
const Util = require('../util.js');
let processes  = {}; // {pid:{obj, promise}}
let confirmedTransactions = [];
let cachedEvents = new Map();
let unConfirmedTransactions = [];
let txUpdateInter = null;
let globalConsumer;
const TxStatus = require('../transaction.js');
let updateTail;
const bc   = require('../blockchain.js');
let blockchain;
let testfinished = false;
let global_pid;
let confirmTail = 0;
let totalTransactionsCommitted = 0;
let totalTransactionsForMQ = 0;
let invokeCallback = false;
const cfUtil = require('../config-util.js');

/**
 * consume block events and confirmation time of every transaction from Kafka MQ
 * @param {String} networkFile path of the network config file
 * @param {Function} cb callback function to return control to caller
 */
function _consumeEvents(networkFile, cb){
    blockchain = new bc(Util.resolvePath(networkFile));
    const kafka = require('kafka-node');
    const listener_config = require('../../listener/listener-config.json');
    let Consumer = kafka.Consumer;
    let KafkaClient = new kafka.KafkaClient({ kafkaHost: listener_config.broker_urls, requestTimeout: 300000000 });
    let options = {
        autoCommit: true,
        fetchMaxWaitMs: 1000,
        fetchMaxBytes: 5120 * 5120,
        encoding: 'buffer',
        groupId: 'groupID' + Math.floor(Math.random() * Math.floor(100))
    };
    let topics = [{
        topic: listener_config.topic
    }];
    let consumer = new Consumer(KafkaClient, topics, options);
    globalConsumer = consumer;
    consumer.on('message', function (message) {
        let buf = new Buffer(message.value); // Read string into a buffer.
        let data = buf.toString('utf-8');
        let block = JSON.parse(data).block;
        for (let index = 0; index < block.data.data.length; index++) {
            let channel_header = block.data.data[index].payload.header.channel_header;
            let transaction_id = channel_header.tx_id;
            let confirmation_time = JSON.parse(data).validTime;
            if (cachedEvents.get(transaction_id) === undefined)
            {
                cachedEvents.set(transaction_id, confirmation_time);
            }else if(cachedEvents.get(transaction_id) !== undefined && typeof cachedEvents.get(transaction_id) !== 'number') {
                let transactionObject = cachedEvents.get(transaction_id);
                transactionObject.Set('time_final', confirmation_time);
                transactionObject.SetVerification(true);
                transactionObject.Set('status','success');
                cachedEvents.set(transaction_id, transactionObject);
                confirmedTransactions.push(transactionObject);
                totalTransactionsCommitted++;
            }
            else {
                if (!invokeCallback) {
                    invokeCallback = true;
                    cb(new Error('Error executing benchmark test: Please ensure Kafka MQ is cleared before running the benchmark tests. Run `docker-compose -f docker-compose-kafka.yaml down` on the machine where kafka containers are running'));
                }
            }
        }
    });
    consumer.on('error', function(err){
        globalConsumer.close(() => {
            _consumeEvents();
        });
    });
}
module.exports._consumeEvents = _consumeEvents;

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
 * Push update value from a child process into the global array
 * @param {String} pid pid of the child process
 * @param {Object} data update value
 */
function pushUpdateForMQ(pid, data) {
    totalTransactionsForMQ += data.submitted;
    unConfirmedTransactions.push(data);
}

/**
 * Launch a child process to do the test
 * @param {Array} updates array to save txUpdate results
 * @param {Array} results array to save the test results
 */
function launchClient(updates, results) {
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
        else if(msg.type === 'txUpdatedWithMQ') {
            global_pid = pid;
            pushUpdateForMQ(pid, msg.data);
        }
    });

    child.on('error', function(){
        setPromise(pid, false, new Error('Client encountered unexpected error'));
    });

    child.on('exit', function(code, signal){
        logger.info('Client exited ');
        setPromise(pid, false, new Error('Client already exited'));
    });
}

/**
 *
 * @param {Array} updates array to process txUpdates
 */
function verifyUnconfirmedTransactions(updates) {
    for (let i = 0; i < updates.length; i++) {
        let submitted_transactions = updates[i].committed;
        for (let j =0; j < submitted_transactions.length; j++) {
            let transactionStatus = submitted_transactions[j].status;
            let TransactionStatus = new TxStatus(transactionStatus.id);
            TransactionStatus.Set('time_create', transactionStatus.time_create);
            TransactionStatus.Set('needVerifyWithMQ', transactionStatus.needVerifyWithMQ);
            TransactionStatus.Set('status', transactionStatus.status);
            TransactionStatus.Set('time_final', transactionStatus.time_final);
            TransactionStatus.Set('result', transactionStatus.result);
            TransactionStatus.Set('verified', transactionStatus.verified);
            TransactionStatus.Set('flags', transactionStatus.flags);
            TransactionStatus.Set('error_messages', transactionStatus.error_messages);
            if (cachedEvents.get(TransactionStatus.GetID()) === undefined) {
                if (TransactionStatus.GetFlag() === 0) {
                    cachedEvents.set(TransactionStatus.GetID(), TransactionStatus);
                } else {
                    confirmedTransactions.push(TransactionStatus);
                    totalTransactionsCommitted++;
                }
            }
            else  {
                TransactionStatus.Set('time_final', cachedEvents.get(TransactionStatus.GetID()));
                TransactionStatus.SetVerification(true);
                TransactionStatus.Set('status', 'success');
                cachedEvents.set(TransactionStatus.GetID(), TransactionStatus);
                confirmedTransactions.push(TransactionStatus);
                totalTransactionsCommitted++;
            }
        }
    }
    let newResults = [];
    let len  = confirmedTransactions.length;
    if(len > confirmTail) {
        newResults = confirmedTransactions.slice(confirmTail, len);
        confirmTail = len;
    }
    let newStats = blockchain.getDefaultTxStats(newResults, false);
    let dataToUpdate = {submitted: 0, committed: newStats};
    pushUpdate(global_pid, dataToUpdate);
}

/**
 * Update
 *
 */
function update() {
    let data = [];
    let len  = unConfirmedTransactions.length;
    if(len > updateTail) {
        data = unConfirmedTransactions.slice(updateTail, len);
        updateTail = len;
    }
    verifyUnconfirmedTransactions(data);
}

/**
 * updateResults
 * @param {*} withMQ flag to determine if running MQ mode
 * @return {Promise} promise object
 */
function updateResults(withMQ) {
    if (withMQ && unConfirmedTransactions.length !== 0) {
        return new Promise(function(resolve, reject) {
            (function wait(){
                if (totalTransactionsCommitted === totalTransactionsForMQ && testfinished === true) {
                    let finalStats = blockchain.getDefaultTxStats(confirmedTransactions, false);
                    pushResult(global_pid, finalStats);
                    clearInterval(txUpdateInter);
                    return resolve();
                }
                setTimeout(wait, 5000);
            })();
        });
    }
    else {
        return new Promise(function(resolve, reject){
            resolve();
        });
    }
}

/**
 * Start a test
 * @param {Number} number test clients' count
 * @param {JSON} message start message
 * @param {Array} clientArgs each element contains specific arguments for a client
 * @param {Array} updates array to save txUpdate results
 * @param {Array} results array to save the test results
 * @async
 */
async function startTest(number, message, clientArgs, updates, results) {
    let withMQ = cfUtil.getConfigSetting('core:with-mq', false);
    let count = 0;
    let txUpdateTime = 1000;
    testfinished = false;
    for(let i in processes) {
        i;  // avoid eslint error
        count++;
    }

    if (count !== number) {
        // launch clients
        processes = {};
        for(let i = 0 ; i < number ; i++) {
            launchClient(updates, results);
        }
    }

    if (withMQ) {
        txUpdateInter = setInterval(update, txUpdateTime);
        updateTail = 0;
        confirmTail = 0;
        unConfirmedTransactions = [];
        confirmedTransactions = [];
    }
    let txPerClient;
    let totalTx = message.numb;
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
        throw new Error('Unconditioned transaction rate driving mode');
        //return Promise.reject(new Error('Unconditioned transaction rate driving mode'));
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

        if(totalTx % number !== 0 && idx === number-1){
            message.numb = totalTx - txPerClient*(number - 1);
        }

        // send message to client and update idx
        client.obj.send(message);
        idx++;
    }

    await Promise.all(promises);
    // clear promises
    for(let client in processes) {
        delete client.promise;
    }
    testfinished = true;
    await updateResults(withMQ);
    clearInterval(txUpdateInter);
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

/**
 * Close kafka consumer
 */
function closeKafkaConsumer() {
    globalConsumer.close(() => {
    });

}
module.exports.closeKafkaConsumer = closeKafkaConsumer;
