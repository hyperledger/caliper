/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


'use strict';

const logger = require('../../utils/caliper-utils').getLogger('demo.js');
const fs = require('fs-extra');
const {join} = require('path');
const demoPath = '/tmp/caliper/output';
const demoFile = join(demoPath, 'demo.json');

let demoInterval = 1;   // interval length(s)
let demoXLen = 60;     // default x axis length
let demoData;
let demoInterObj = null;

/**
 * Demonstration
 */
function demoInit() {
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
    };

    for(let i = 0 ; i < demoXLen ; i++) {
        demoData.throughput.x.push(i * demoInterval);
        demoData.latency.x.push(i * demoInterval);
    }

    if (!fs.existsSync(demoPath)) {
        fs.mkdirpSync(demoPath);
    }

    fs.writeFileSync(demoFile,  JSON.stringify(demoData));
}
module.exports.init = demoInit;
/**
 * Add Throughput
 * @param {*} sub submitted
 * @param {*} suc successful
 * @param {*} fail fail
 */
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

/**
 * Add Latency
 * @param {*} max the maximum
 * @param {*} min the minimum
 * @param {*} avg the average
 */
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

/**
 * Refresh addat
 * @param {*} updates updates to use
 */
function demoRefreshData(updates) {
    if(updates.length  === 0) {
        demoAddThroughput(0,0,0);
        demoAddLatency(0,0,0);
    }
    else {
        let sub = 0, suc = 0, fail = 0;
        let deMax = -1, deMin = -1, deAvg = 0;
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

        if(isNaN(deMax) || isNaN(deMin) || deAvg === 0) {
            demoAddLatency(0,0,0);
        }
        else {
            demoAddLatency(deMax, deMin, deAvg);
        }

    }

    logger.info('[Transaction Info] - Submitted: ' + demoData.summary.txSub +
    ' Succ: ' + demoData.summary.txSucc +
    ' Fail:' +  demoData.summary.txFail +
    ' Unfinished:' + (demoData.summary.txSub - demoData.summary.txSucc - demoData.summary.txFail));

    let fs = require('fs');
    fs.writeFileSync(demoFile,  JSON.stringify(demoData));
}

let client;
let updateTail = 0;
let updateID   = 0;

/**
 * Perform an update
 */
function update() {
    if (typeof client === 'undefined') {
        demoRefreshData([]);
        return;
    }
    let updates = client.getUpdates();
    if(updates.id > updateID) { // new buffer
        updateTail = 0;
        updateID   = updates.id;
    }
    let data = [];
    let len  = updates.data.length;
    if(len > updateTail) {
        data = updates.data.slice(updateTail, len);
        updateTail = len;
    }
    demoRefreshData(data);
}

/**
 * demoStartWatch
 * @param {*} clientObj the client object
 */
function demoStartWatch(clientObj) {
    //demoProcesses = processes.slice();
    client  = clientObj;
    if(demoInterObj === null) {
        updateTail = 0;
        updateID   = 0;
        // start a interval to query updates
        demoInterObj = setInterval(update, demoInterval * 1000);
    }
}
module.exports.startWatch = demoStartWatch;

/**
 * demoPauseWatch
 */
function demoPauseWatch() {
    demoData.summary.round += 1;
}

module.exports.pauseWatch = demoPauseWatch;

/**
 * demoStopWatch
 * @param {*} output the output
 */
function demoStopWatch(output) {
    if(demoInterObj) {
        clearInterval(demoInterObj);
        demoInterObj = null;
    }
    demoData.report = output;
    update();
}

module.exports.stopWatch = demoStopWatch;

