/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file Implementation of the temporary demo
*/


'use strict'

/* global variables */
const kafka = require('kafka-node');
const listener_config = require("../../../listener/listener-config.json")
var cb;
var testLabel;
var totalTxnsPerRound = 0;
var cachedEvents;
var confirmedTransactions;
var totalSubmitted = 0;
var totalSucc = 0;
var totalFail = 0;
var path = require('path');
const bc   = require('../../comm/blockchain.js');
const blockchain = new bc(path.join(__dirname, '../../../', 'benchmark/simple/fabric'));
var demoFile = path.join(__dirname, '../output/demoOptional.json');
var demoInterval = 1;   // interval length(s)
var demoXLen = 60;     // default x axis length
var demoData;
var demoInterObj = null;
var demoSessionID = 0;
const TxStatus = require('../../comm/transaction.js');

function demoInit() {
    var fs = require('fs');
    demoData =  {
        throughput: {
            x: [],
            submitted: [0],
            succeeded: [0],
            failed: [0]
        },
        latency: {
            x: [],
            max: [0],
            min: [0],
            avg: [0]
        },
        summary: {
            txSub: 0,
            txSucc: 0,
            txFail: 0,
            round: 0,
        },
        report: ''
    }
    for(let i = 0 ; i < demoXLen ; i++) {
        demoData.throughput.x.push(i * demoInterval);
        demoData.latency.x.push(i * demoInterval);
    }
    fs.writeFileSync(demoFile,  JSON.stringify(demoData));
}
module.exports.init = demoInit;

// TODO: need to limit the maximum length for X-Axis
function demoRefreshX() {

    var len = demoData.throughput.submitted.length;
    while(demoData.throughput.x.length < len) {
        if(demoData.throughput.x.length === 0) {
            demoData.throughput.x[0] = 0;
        }
        else {
            let last = demoData.throughput.x[demoData.throughput.x.length - 1];
            demoData.throughput.x.push(last + demoInterval);
        }
    }
    len = demoData.latency.max.length;
    while(demoData.latency.x.length < len) {
        if(demoData.latency.x.length === 0) {
            demoData.latency.x[0] = 0;
        }
        else {
            let last = demoData.latency.x[demoData.latency.x.length - 1];
            demoData.latency.x.push(last + demoInterval);
        }
    }
}

function demoAddThroughput(sub, suc, fail) {
    demoData.throughput.submitted.push(sub/demoInterval);
    demoData.throughput.succeeded.push(suc/demoInterval);
    demoData.throughput.failed.push(fail/demoInterval);
    demoData.summary.txSub  = sub;
    demoData.summary.txSucc = suc;
    demoData.summary.txFail = fail;
}

function demoAddLatency(max, min, avg) {
    demoData.latency.max.push(max);
    demoData.latency.min.push(min);
    demoData.latency.avg.push(avg);
}

function demoRefreshData(updates, label) {

    for (let i = 0; i < updates.length; i++) {
        var sub = updates[i].submitted
        totalSubmitted += sub
        var submitted_transactions = updates[i].committed
    
        for (let j =0; j < submitted_transactions.length; j++) {
            var transactionStatus = submitted_transactions[j].status
            var TransactionStatus = new TxStatus(transactionStatus.id, transactionStatus.status, transactionStatus.time_create, transactionStatus.time_final, 
                transactionStatus.result, transactionStatus.verified, transactionStatus.flags, transactionStatus.error_messages);
                
            if (cachedEvents.get(TransactionStatus.GetID()) == undefined) {
                cachedEvents.set(TransactionStatus.GetID(), TransactionStatus)
                if (label == 'query') {
                    confirmedTransactions.push(TransactionStatus)
                    getDefaultStats(totalSubmitted, confirmedTransactions, label) 
                }
            }
            else {
                TransactionStatus.Set('time_final', cachedEvents.get(TransactionStatus.GetID()))
                TransactionStatus.SetVerification(true)
                TransactionStatus.Set('status', 'success')
                cachedEvents.set(TransactionStatus.GetID(), TransactionStatus)
                confirmedTransactions.push(TransactionStatus)
                getDefaultStats(totalSubmitted, confirmedTransactions, label)
               
            }   
        }
    }
}
  
function getDefaultStats(submitted, confirmedTransactionsArray, testLabel) {

        let newStats = blockchain.getDefaultTxStats(confirmedTransactionsArray, false);
        var succ = totalSucc + newStats.succ
        var fail = totalFail + newStats.fail
        var deMax = -1, deMin = -1, deAvg = 0;     
        if(newStats.succ > 0) {
            if(deMax === -1 || deMax < newStats.delay.max) {
                deMax = newStats.delay.max;
            }
            if(deMin === -1 || deMin > newStats.delay.min) {
                deMin = newStats.delay.min;
            }
            deAvg += newStats.delay.sum;

        if(newStats.succ > 0) {
            deAvg /= newStats.succ;
        }
        demoAddThroughput(submitted, succ, fail);

        if(deMax === NaN || deMin === NaN || deAvg === 0) {
            demoAddLatency(0,0,0);
        }
        else {
            demoAddLatency(deMax, deMin, deAvg);
        }
    }

    demoRefreshX();

    var fs = require('fs');
    fs.writeFileSync(demoFile,  JSON.stringify(demoData));

      console.log('[Transaction Info] - Submitted: ' + totalSubmitted
        + ' Succ: ' + succ
        + ' Fail:' + fail
        + ' Unfinished:' + (totalSubmitted - succ - fail));

        if (totalTxnsPerRound ==  confirmedTransactionsArray.length)
        {  
            let finalStats = blockchain.getDefaultTxStats(confirmedTransactionsArray, true);
            totalSucc += finalStats.succ
            totalFail += finalStats.fail
             cb(finalStats, testLabel).then( () => {
                 client.sendMessage({type: 'roundsComplete', data: true})
             })
        }    
}

var client;
var started = false;
var updateTail = 0;
var confirmedTail = 0;
var updateID   = 0;

function update(label) {
    var updates = client.getUpdates();
   
    if(updates.id > updateID) { // new buffer
        updateTail = 0;
        updateID   = updates.id;
    }
    var data = [];
    var len  = updates.data.length;
    if(len > updateTail) {
        data = updates.data.slice(updateTail, len);
        updateTail = len;
    }
     demoRefreshData(data, label);
}

function demoStartWatch(clientObj, numb, processResult, testLabel) {

    if (testLabel == 'query') {
        if(demoInterObj) {
            clearInterval(demoInterObj);
            demoInterObj = null;
        }
    }
    // start the kafka consumer, fetch the blocks, store them in-memory Map.
    confirmedTransactions = []
    cachedEvents = new Map()
    totalTxnsPerRound = numb
    cb = processResult
    client  = clientObj;
    started = true;
    if(demoInterObj === null) {
        updateTail = 0;
        updateID   = 0;
        confirmedTail = 0;

        // start a interval to query updates
        demoInterObj = setInterval(update.bind(null, testLabel), demoInterval * 1000);

        // consume events from MQ only of test is of type 'open'
        if (testLabel != "query") {
            consumeEvents(testLabel)
        }
    }
}
module.exports.startWatch = demoStartWatch;

function consumeEvents(testLabel){
    var Consumer = kafka.Consumer;
    var KafkaClient = new kafka.KafkaClient({ kafkaHost: listener_config.broker_urls, requestTimeout: 300000000 });
    var options = {
	autoCommit: false,
	fetchMaxWaitMs: 1000,
	fetchMaxBytes: 5120 * 5120,
	encoding: 'buffer',
	groupId: "groupID" + Math.floor(Math.random() * Math.floor(100))};

    var topics = [{
        topic: listener_config.topic
    }];

    var consumer = new Consumer(KafkaClient, topics, options);
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
            // update the global hash map
            else if (cachedEvents.get(transaction_id) != undefined){

                var transactionObject = cachedEvents.get(transaction_id); 
                transactionObject.Set('time_final',confirmation_time)
                transactionObject.SetVerification(true)
                transactionObject.Set('status','success')
                cachedEvents.set(transaction_id, transactionObject);
                confirmedTransactions.push(transactionObject)
                getDefaultStats(totalSubmitted, confirmedTransactions, testLabel)
            }
        }
    });

    consumer.on('error', function(err){   
        // retry if unable to connect to kafka
        consumeEvents(testLabel)
    })
} 

function demoPauseWatch(label) {
    demoData.summary.round += 1;
    started = false;
    
    //demoRefreshData('all');
}

module.exports.pauseWatch = demoPauseWatch;

function demoStopWatch(output) {
    if(demoInterObj) {
        clearInterval(demoInterObj);
        demoInterObj = null;
    }
    demoData.report = output;
     update()
}

module.exports.stopWatch = demoStopWatch;
