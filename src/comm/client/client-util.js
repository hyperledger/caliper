
/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict';
const log          = require('../util.js').log;
let processes  = {}; // {pid:{obj, promise}}
let txUpdateTime = 1000;
const kafka = require('kafka-node');
const listener_config = require("../../listener/listener-config.json");
let confirmedTransactions = [];
let cachedEvents = new Map();
let unConfirmedTransactions = [];
var txUpdateInter = null;
var globalConsumer;
const TxStatus = require('../transaction.js');
var updateTail;
const bc   = require('../blockchain.js');
let path = require('path');
const blockchain = new bc(path.join(__dirname, '../../../', 'benchmark/simple/fabric'));
let testfinished = false; 
var newNum = 0;
let global_pid;
let confirmTail = 0;
var totalTransactionsRecieved = 0;
var totalTransactionsCommitted = 0;
var totalTransactionsForMQ = 0;

function _consumeEvents(){

    var Consumer = kafka.Consumer;
    var KafkaClient = new kafka.KafkaClient({ kafkaHost: listener_config.broker_urls, requestTimeout: 300000000 });
    var options = {
    autoCommit: true,
    fetchMaxWaitMs: 1000,
    fetchMaxBytes: 5120 * 5120,
    encoding: 'buffer',
    groupId: "groupID" + Math.floor(Math.random() * Math.floor(100))};
 
    var topics = [{
        topic: listener_config.topic
    }];
 
    var consumer = new Consumer(KafkaClient, topics, options);
    globalConsumer = consumer;
    consumer.on('message', function (message) {
        
        var buf = new Buffer(message.value); // Read string into a buffer.
        var data = buf.toString('utf-8')
        var block = JSON.parse(data).block
        
        for (var index = 0; index < block.data.data.length; index++) {
            var channel_header = block.data.data[index].payload.header.channel_header;
            var transaction_id = channel_header.tx_id
            var confirmation_time = JSON.parse(data).validTime;
            if (cachedEvents.get(transaction_id)  == undefined)
            {
                cachedEvents.set(transaction_id, confirmation_time)
            }
           else if (cachedEvents.get(transaction_id) != undefined) {
               
                var transactionObject = cachedEvents.get(transaction_id);
                transactionObject.Set('time_final', confirmation_time);
                transactionObject.SetVerification(true);
                transactionObject.Set('status','success');
                cachedEvents.set(transaction_id, transactionObject);
                confirmedTransactions.push(transactionObject);
                totalTransactionsCommitted++;
            
            }
        }
    });
 
    consumer.on('error', function(err){   
        // retry if unable to connect to kafka
        _consumeEvents()
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
        totalTransactionsRecieved += data.submitted;
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
    //let path = require('path');
    let childProcess = require('child_process');
    let child = childProcess.fork(path.join(__dirname, 'local-client.js'));
    let pid   = child.pid.toString();
    processes[pid] = {obj: child, results: results, updates: updates};

    child.on('message', function(msg) {
        if(msg.type === 'testResult') {
            pushResult(pid, msg.data);
            setPromise(pid, true, msg.data);
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

    child.on('exit', function(){
        log('Client exited');
        setPromise(pid, true, null);
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

function update() {
    var data = [];
    var len  = unConfirmedTransactions.length;
    if(len > updateTail) {
        data = unConfirmedTransactions.slice(updateTail, len);
        updateTail = len;
    }
      verifyUnconfirmedTransactions(data);    
}

function verifyUnconfirmedTransactions(updates) {
  
        newNum = 0;
        for (let i = 0; i < updates.length; i++) {
            var sub = updates[i].submitted;
            newNum += sub;
            var submitted_transactions = updates[i].committed;

            for (let j =0; j < submitted_transactions.length; j++) {
                var transactionStatus = submitted_transactions[j].status
                var TransactionStatus = new TxStatus(transactionStatus.id, transactionStatus.status, transactionStatus.time_create, transactionStatus.time_final, 
                    transactionStatus.result, transactionStatus.verified, transactionStatus.flags, transactionStatus.error_messages);
                
                if (cachedEvents.get(TransactionStatus.GetID()) == undefined) {
                    
                    // make an entry into map only if it is not a query OR the error flag == 0
                    if (TransactionStatus.GetFlag() == 0) { 
                        cachedEvents.set(TransactionStatus.GetID(), TransactionStatus)
                    } else {
                        confirmedTransactions.push(TransactionStatus);
                        totalTransactionsCommitted++;
                    }
                }
                else  {
                    TransactionStatus.Set('time_final', cachedEvents.get(TransactionStatus.GetID()))
                    TransactionStatus.SetVerification(true)
                    TransactionStatus.Set('status', 'success')
                    cachedEvents.set(TransactionStatus.GetID(), TransactionStatus)
                    confirmedTransactions.push(TransactionStatus);
                    totalTransactionsCommitted++;
                }   
            }
        }
            let newResults = [];
            var len  = confirmedTransactions.length;
            if(len > confirmTail) {
                newResults = confirmedTransactions.slice(confirmTail, len);
                confirmTail = len;
            }
                let newStats = blockchain.getDefaultTxStats(newResults, false);
                var dataToUpdate = {submitted: 0, committed: newStats};
                pushUpdate(global_pid, dataToUpdate);  
               
    }
 
function updateResults(withMQ) {
    if (withMQ && unConfirmedTransactions.length != 0) {
        return new Promise(function(resolve, reject){
                (function wait(){
                    if (totalTransactionsCommitted ==  totalTransactionsForMQ && testfinished == true) { 
                        let finalStats = blockchain.getDefaultTxStats(confirmedTransactions, false);
                        pushResult(global_pid, finalStats);
                        clearInterval(txUpdateInter);
                        return resolve();
                    }
                    setTimeout(wait, 5000);
                })();
        })    
    }
    else {
        return new Promise(function(resolve, reject){
                resolve();
        }) 
    }
}

function startTest(number, message, clientArgs, updates, results, withMQ) {

    testfinished = false;   
    let count = 0;
    for(let i in processes) {
        i;  // avoid eslint error
        count++;
    }
    if(count === number) {
        
        if (withMQ) {
            txUpdateInter = setInterval(update, txUpdateTime);
            updateTail = 0;
            confirmTail = 0;
            unConfirmedTransactions = [];
            confirmedTransactions = [];
        }
       
        // already launched clients
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
        return Promise.all(promises).then(() =>{
            for(let client in processes) {
                delete client.promise;
            }
            testfinished = true;
            //if (withMQ) {  }
            return updateResults(withMQ);
           
        }) .then(() => {
            clearInterval(txUpdateInter);
            return Promise.resolve();
        })
    }
    // launch clients
    processes = {};
    for(let i = 0 ; i < number ; i++) {
        launchClient(updates, results);
    }

    // start test
     return startTest(number, message, clientArgs, updates, results, withMQ);
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
      globalConsumer.close(() => {});
}
module.exports.closeKafkaConsumer = closeKafkaConsumer;