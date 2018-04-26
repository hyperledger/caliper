/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file Implementation of default test client process.
*/

'use strict'

/* global variables */
var path  = require('path');
var bc    = require('../blockchain.js');
var RateControl = require('../rate-control/rateControl.js');
var Util = require('../util.js');

/**
 * Message handler
 */
process.on('message', function(message) {
    if(message.hasOwnProperty('type')) {
        try {
            switch(message.type) {
                case 'test':
                    var result;
                    doTest(message)
                    .then((output) => {
                        result = output;
                        return Util.sleep(200);
                    })
                    .then(() => {
                         process.send({type: 'testResult', data: result});
                    });
                    break;
                default:
                    process.send({type: 'error', data: 'unknown message type'});
            }
        }
        catch(err) {
            process.send({type: 'error', data: err});
        };
    }
    else {
         process.send({type: 'error', data: 'unknown message type'});
    }
})

var blockchain;
var results      = [];
var txNum        = 0;
var txLastNum    = 0;
var txUpdateTail = 0;
var txUpdateTime = 1000;
function txUpdate() {
    var newNum = txNum - txLastNum;
    txLastNum += newNum;

    var newResults =  results.slice(txUpdateTail);
    txUpdateTail += newResults.length;
    if(newResults.length === 0 && newNum === 0) {
        return;
    }

    var newStats;
    if(newResults.length === 0) {
        newStats = bc.createNullDefaultTxStats();
    }
    else {
        newStats = blockchain.getDefaultTxStats(newResults, false);
    }
    process.send({type: 'txUpdated', data: {submitted: newNum, committed: newStats}});
}

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

function beforeTest() {
    results  = [];
    txNum    = 0;
    txUpdateTail = 0;
    txLastNum = 0;
}

function doTest(msg) {
    console.log('doTest() with:', msg);
    let cb = require(path.join(__dirname, '../../..', msg.cb));
    blockchain = new bc(path.join(__dirname, '../../..', msg.config));    

    beforeTest();
    // start a interval to report results repeatedly
    let txUpdateInter = setInterval(txUpdate, txUpdateTime);
    var clearUpdateInter = function () {
        // stop reporter
        if(txUpdateInter) {
            clearInterval(txUpdateInter);
            txUpdateInter = null;
            txUpdate();
        }
    };
    
    return blockchain.getContext(msg.label, msg.clientargs)
    .then((context) => {
       if (msg.txDuration) {
           return runDuration(msg, cb, context);
       } else {
           return runFixedNumber(msg, cb, context);
       }
    })
    .then(() => {
        clearUpdateInter();
        return cb.end(results);
    })
    .then(() => {
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

        var stats = blockchain.getDefaultTxStats(results, true);
        return Promise.resolve(stats);
    })
    .catch((err) => {
        clearUpdateInter();
        console.log('Client ' + process.pid + ': error ' + (err.stack ? err.stack : err));
        return Promise.reject(err);
    });
}

async function runFixedNumber(msg, cb, context) {    
    console.log('Info: client ' + process.pid +  ' start test runFixedNumber()' + (cb.info ? (':' + cb.info) : ''));
    var rounds   = Array(msg.numb).fill(0);
    const rateControl = new RateControl(msg.rateControl, blockchain);
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
    return await blockchain.releaseContext(context);
}

async function runDuration(msg, cb, context) {
    console.log('Info: client ' + process.pid +  ' start test runDuration()' + (cb.info ? (':' + cb.info) : ''));
    var rateControl = new RateControl(msg.rateControl, blockchain);
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

    await Promise.all(results);
    return await blockchain.releaseContext(context);    
}