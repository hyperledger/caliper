/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/

'use strict';

// global variables
const path = require('path');
const bc   = require('../blockchain.js');
const RateControl = require('../rate-control/rateControl.js');
const Util = require('../util.js');
const log  = Util.log;

let blockchain;
let results      = [];
let txNum        = 0;
let txLastNum    = 0;
let txUpdateTail = 0;
let txUpdateTime = 1000;

/**
 * Calculate realtime transaction statistics and send the txUpdated message
 */
function txUpdate() {
    let newNum = txNum - txLastNum;
    txLastNum += newNum;

    let newResults =  results.slice(txUpdateTail);
    txUpdateTail += newResults.length;
    if(newResults.length === 0 && newNum === 0) {
        return;
    }

    let newStats;
    if(newResults.length === 0) {
        newStats = bc.createNullDefaultTxStats();
    }
    else {
        newStats = blockchain.getDefaultTxStats(newResults, false);
    }
    process.send({type: 'txUpdated', data: {submitted: newNum, committed: newStats}});
}

/**
 * Add new test result into global array
 * @param {Object} result test result, should be an array or a single JSON object
 */
function addResult(result) {
    if(Array.isArray(result)) { // contain multiple results
        for(let i = 0 ; i < result.length ; i++) {
            results.push(result[i]);
        }
    }
    else {
        results.push(result);
    }
}

/**
 * Call before starting a new test
 */
function beforeTest() {
    results  = [];
    txNum    = 0;
    txUpdateTail = 0;
    txLastNum = 0;
}

/**
 * Perform test with specified number of transactions
 * @param {JSON} msg start test message
 * @param {Object} cb callback module
 * @param {Object} context blockchain context
 * @return {Promise} promise object
 */
async function runFixedNumber(msg, cb, context) {
    log('Info: client ' + process.pid +  ' start test runFixedNumber()' + (cb.info ? (':' + cb.info) : ''));
    let rounds   = Array(msg.numb).fill(0);
    let rateControl = new RateControl(msg.rateControl, blockchain);
    rateControl.init(msg);

    await cb.init(blockchain, context, msg.args);
    const start = Date.now();

    let promises = [];
    for (let i = 0 ; i < rounds.length ; i++) {
        promises.push(cb.run().then((result) => {
            addResult(result);
            return Promise.resolve();
        }));
        // Increment on txNum as is a global var used in txUpdate()
        await rateControl.applyRateControl(start, txNum++, results);
    }

    await Promise.all(promises);
    await rateControl.end();
    return await blockchain.releaseContext(context);
}

/**
 * Perform test with specified test duration
 * @param {JSON} msg start test message
 * @param {Object} cb callback module
 * @param {Object} context blockchain context
 * @return {Promise} promise object
 */
async function runDuration(msg, cb, context) {
    log('Info: client ' + process.pid +  ' start test runDuration()' + (cb.info ? (':' + cb.info) : ''));
    let rateControl = new RateControl(msg.rateControl, blockchain);
    rateControl.init(msg);
    const duration = msg.txDuration; // duration in seconds

    await cb.init(blockchain, context, msg.args);
    const start = Date.now();

    let promises = [];
    while ((Date.now() - start)/1000 < duration) {
        promises.push(cb.run().then((result) => {
            addResult(result);
            return Promise.resolve();
        }));
        // Increment on txNum as is a global var used in txUpdate()
        await rateControl.applyRateControl(start, txNum++, results);
    }

    await Promise.all(promises);
    await rateControl.end();
    return await blockchain.releaseContext(context);
}

/**
 * Perform the test
 * @param {JSON} msg start test message
 * @return {Promise} promise object
 */
function doTest(msg) {
    log('doTest() with:', msg);
    let cb = require(path.join(__dirname, '../../..', msg.cb));
    blockchain = new bc(path.join(__dirname, '../../..', msg.config));

    beforeTest();
    // start an interval to report results repeatedly
    let txUpdateInter = setInterval(txUpdate, txUpdateTime);
    /**
     * Clear the update interval
     */
    let clearUpdateInter = function () {
        // stop reporter
        if(txUpdateInter) {
            clearInterval(txUpdateInter);
            txUpdateInter = null;
            txUpdate();
        }
    };

    return blockchain.getContext(msg.label, msg.clientargs).then((context) => {
        if (msg.txDuration) {
            return runDuration(msg, cb, context);
        } else {
            return runFixedNumber(msg, cb, context);
        }
    }).then(() => {
        clearUpdateInter();
        return cb.end(results);
    }).then(() => {
        // conditionally trim beginning and end results for this test run
        if (msg.trim) {
            let trim;
            if (msg.txDuration) {
                // Considering time based number of transactions
                trim = Math.floor(msg.trim * (results.length / msg.txDuration));
            } else {
                // Considering set number of transactions
                trim = msg.trim;
            }
            let safeCut = (2 * trim) < results.length ? trim : results.length;
            results = results.slice(safeCut, results.length - safeCut);
        }

        let stats = blockchain.getDefaultTxStats(results, true);
        return Promise.resolve(stats);
    }).catch((err) => {
        clearUpdateInter();
        log('Client ' + process.pid + ': error ' + (err.stack ? err.stack : err));
        return Promise.reject(err);
    });
}

/**
 * Message handler
 */
process.on('message', function(message) {
    if(message.hasOwnProperty('type')) {
        try {
            switch(message.type) {
            case 'test': {
                let result;
                doTest(message).then((output) => {
                    result = output;
                    return Util.sleep(200);
                }).then(() => {
                    process.send({type: 'testResult', data: result});
                });
                break;
            }
            default: {
                process.send({type: 'error', data: 'unknown message type'});
            }
            }
        }
        catch(err) {
            process.send({type: 'error', data: err});
        }
    }
    else {
        process.send({type: 'error', data: 'unknown message type'});
    }
});