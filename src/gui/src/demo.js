/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file Implementation of the temporary demo
*/


'use strict'

/* global variables */
var logger = require('../../comm/util.js').getLogger('demo.js');
var path = require('path');
var demoFile = path.join(__dirname, '../output/demo.json');
var demoInterval = 1;   // interval length(s)
var demoXLen = 60;     // default x axis length
var demoData;
var demoInterObj = null;
var demoSessionID = 0;
function demoInit() {
    var fs = require('fs');
    demoData =  {
        maxlen : 300,
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

function demoAddThroughput(sub, suc, fail) {
    demoData.throughput.submitted.push(sub/demoInterval);
    demoData.throughput.succeeded.push(suc/demoInterval);
    demoData.throughput.failed.push(fail/demoInterval);
    if (demoData.throughput.x.length < demoData.throughput.submitted.length) {
        let last = demoData.throughput.x[demoData.throughput.x.length - 1];
        demoData.throughput.x.push(last + demoInterval);
    }
    if (demoData.throughput.submitted.length > demoData.maxlen) {
        demoData.throughput.submitted.shift();
        demoData.throughput.succeeded.shift();
        demoData.throughput.failed.shift();
        demoData.throughput.x.shift();
    }
    demoData.summary.txSub  += sub;
    demoData.summary.txSucc += suc;
    demoData.summary.txFail += fail;
}
function demoAddLatency(max, min, avg) {
    demoData.latency.max.push(max);
    demoData.latency.min.push(min);
    demoData.latency.avg.push(avg);
    if(demoData.latency.x.length < demoData.latency.max.length) {
        let last = demoData.latency.x[demoData.latency.x.length - 1];
        demoData.latency.x.push(last + demoInterval);
    }
    if (demoData.latency.max.length > demoData.maxlen) {
        demoData.latency.max.shift();
        demoData.latency.min.shift();
        demoData.latency.avg.shift();
        demoData.latency.x.shift();
    }
}

function demoRefreshData(updates) {
    if(updates.length  === 0) {
        demoAddThroughput(0,0,0);
        demoAddLatency(0,0,0);
    }
    else {
        var sub = 0, suc = 0, fail = 0;
        var deMax = -1, deMin = -1, deAvg = 0;
        for(let i = 0 ; i < updates.length ; i++) {
            let data = updates[i];
            sub += data.submitted;
            suc += data.committed.succ;
            fail += data.committed.fail;

            if(data.committed.succ > 0) {
                if(deMax === -1 || deMax < data.committed.delay.max) {
                    deMax = data.committed.delay.max;
                }
                if(deMin === -1 || deMin > data.committed.delay.min) {
                    deMin = data.committed.delay.min;
                }
                deAvg += data.committed.delay.sum;
            }
        }
        if(suc > 0) {
            deAvg /= suc;
        }
        demoAddThroughput(sub, suc, fail);

        if(deMax === NaN || deMin === NaN || deAvg === 0) {
            demoAddLatency(0,0,0);
        }
        else {
            demoAddLatency(deMax, deMin, deAvg);
        }

    }

   // if(started) {
        logger.info('[Transaction Info] - Submitted: ' + demoData.summary.txSub
        + ' Succ: ' + demoData.summary.txSucc
        + ' Fail:' +  demoData.summary.txFail
        + ' Unfinished:' + (demoData.summary.txSub - demoData.summary.txSucc - demoData.summary.txFail));
   // }

    var fs = require('fs');
    fs.writeFileSync(demoFile,  JSON.stringify(demoData));
}

var client;
var started = false;
var timelength = 0;
var updateTail = 0;
var updateID   = 0;
function update() {
    timelength++;
    if (typeof client === 'undefined') {
        demoRefreshData([]);
        return;
    }
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
    demoRefreshData(data);
}
function demoStartWatch(clientObj) {
    //demoProcesses = processes.slice();
    client  = clientObj;
    started = true;
    timelength = 0;
    if(demoInterObj === null) {
        updateTail = 0;
        updateID   = 0;
        // start a interval to query updates
        demoInterObj = setInterval(update, demoInterval * 1000);
    }
}
module.exports.startWatch = demoStartWatch;

function demoPauseWatch() {
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
    update();
    timelength = 0;
}

module.exports.stopWatch = demoStopWatch;

