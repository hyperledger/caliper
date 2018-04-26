/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file Implementation of the default test framework which start a test flow to run multiple tests according to the configuration file
*/


'use strict'

/* global variables */
var childProcess = require('child_process');
var exec = childProcess.exec;
var path = require('path');
var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);
var table = require('table');
var Blockchain = require('./blockchain.js');
var Monitor = require('./monitor.js');
var Report  = require('./report.js');
var Client  = require('./client/client.js');
var Util = require('./util.js');
var blockchain, monitor, report, client;
var resultsbyround = [];    // results table for each test round
var round = 0;              // test round
//var cache = {};             // memory cache to store defined output from child process, so different test case could exchange data if needed
                             // this should only be used to exchange small amount of data
                             // obsoleted
var demo = require('../gui/src/demo.js')
var absConfigFile, absNetworkFile;
var absCaliperDir = path.join(__dirname, '../..');

// obsoleted
/**
* Read cached data by key name
* @key {string}
* @return {Object}, cached data
*/
/*function getCache(key) {
    return cache[key];
}*/

/**
* Write data in the global cache
* @data {Object}, key/value
*/
/*function putCache(data) {
    if(typeof data === 'undefined') {
        return;
    }
    if(cache.hasOwnProperty(data.key)) {
        if(Array.isArray(data.value)) {
            cache[data.key].push.apply(cache[data.key], data.value);     // so if child processes return multiple arrays, combine them together as a single array
        }
        else {
            cache[v.key].push(data.value);
        }
    }
    else {
        if(Array.isArray(data.value)) {
            cache[data.key] = data.value;
        }
        else {
            cache[data.key] = [data.value];
        }
    }
}*/

/**
* Start a default test flow to run the tests
* @config_path {string},path of the local configuration file
*/
module.exports.run = function(configFile, networkFile) {
    test("#######Caliper Test######", (t) => {
        global.tapeObj = t;
        absConfigFile  = configFile;
        absNetworkFile = networkFile;
        blockchain = new Blockchain(absNetworkFile);
        monitor = new Monitor(absConfigFile);
        client  = new Client(absConfigFile);
        createReport();
        demo.init();
        var startPromise = new Promise((resolve, reject) => {
            let config = require(absConfigFile);
            if (config.hasOwnProperty('command') && config.command.hasOwnProperty('start')){
                console.log(config.command.start);
                let child = exec(config.command.start, {cwd: absCaliperDir}, (err, stdout, stderr) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
                child.stdout.pipe(process.stdout);
                child.stderr.pipe(process.stderr);
            }
            else {
                resolve();
            }
        });

        startPromise.then(() => {
            return blockchain.init();
        })
        .then( () => {
            return blockchain.installSmartContract();
        })
        .then( () => {
            return client.init().then((number)=>{
                return blockchain.prepareClients(number);
            });
        })
        .then( (clientArgs) => {

            monitor.start().then(()=>{
                console.log('started monitor successfully');
            })
            .catch( (err) => {
                console.log('could not start monitor, ' + (err.stack ? err.stack : err));
            });

            var allTests  = require(absConfigFile).test.rounds;
            var testIdx   = 0;
            var testNum   = allTests.length;
            //demo.startWatch(client);
            return allTests.reduce( (prev, item) => {
                return prev.then( () => {
                    ++testIdx;
                    return defaultTest(item, clientArgs, (testIdx === testNum))
                });
            }, Promise.resolve());
        })
        .then( () => {
            console.log('----------finished test----------\n');
            printResultsByRound();
            monitor.printMaxStats();
            monitor.stop();
            let date = new Date().toISOString().replace(/-/g,'').replace(/:/g,'').substr(0,15);
            let output = path.join(process.cwd(), 'report'+date+'.html' );
            return report.generate(output).then(()=>{
                demo.stopWatch(output);
                console.log('Generated report at ' + output);
                return Promise.resolve();
            });
        })
        .then( () => {
            client.stop();
            let config = require(absConfigFile);
            if (config.hasOwnProperty('command') && config.command.hasOwnProperty('end')){
                console.log(config.command.end);
                let end = exec(config.command.end, {cwd: absCaliperDir});
                end.stdout.pipe(process.stdout);
                end.stderr.pipe(process.stderr);
            }
            t.end();
        })
        .catch( (err) => {
            demo.stopWatch();
            console.log('unexpected error, ' + (err.stack ? err.stack : err));
            let config = require(absConfigFile);
            if (config.hasOwnProperty('command') && config.command.hasOwnProperty('end')){
                console.log(config.command.end);
                let end = exec(config.command.end, {cwd: absCaliperDir});
                end.stdout.pipe(process.stdout);
                end.stderr.pipe(process.stderr);
            }
            t.end();
        });
    });
}

function createReport() {
    var config = require(absConfigFile);
    report  = new Report();
    report.addMetadata('DLT', blockchain.gettype());
    try{
        report.addMetadata('Benchmark', config.test.name);
    }
    catch(err) {
        report.addMetadata('Benchmark', ' ');
    }
    try{
        report.addMetadata('Description', config.test.description);
    }
    catch(err) {
        report.addMetadata('Description', ' ');
    }
    try{
        var r = 0;
        for(let i = 0 ; i < config.test.rounds.length ; i++) {
            if(config.test.rounds[i].hasOwnProperty('txNumber')) {
                r += config.test.rounds[i].txNumber.length;
            }
        }
        report.addMetadata('Test Rounds', r);

        report.setBenchmarkInfo(JSON.stringify(config.test, null, 2))
    }
    catch(err) {
        report.addMetadata('Test Rounds', ' ');
    }

    var sut = require(absNetworkFile);
    if(sut.hasOwnProperty('info')) {
        for(let key in sut.info) {
            report.addSUTInfo(key, sut.info[key]);
        }
    }
}

/**
* load client(s) to do performance tests
* @args {Object}: testing arguments
* @clientArgs {Array}: arguments for the client
* @final {boolean}: =true, the last test; otherwise, =false
* @return {Promise}
*/
function defaultTest(args, clientArgs, final) {
    return new Promise( function(resolve, reject) {
        var t = global.tapeObj;
        t.comment('\n\n###### testing \'' + args.label + '\' ######');
        var testLabel   = args.label;
        var testRounds  = args.txDuration ? args.txDuration : args.txNumber;
        var tests = []; // array of all test rounds
        var configPath = path.relative(absCaliperDir, absNetworkFile);
        for(let i = 0 ; i < testRounds.length ; i++) {
            let msg = {
                type: 'test',
                label : args.label,
                rateControl: args.rateControl[i] ? args.rateControl[i] : {type:'fixed-rate', 'opts' : {'tps': 1}},
                trim: args.trim ? args.trim : 0,
                args: args.arguments,
                cb  : args.callback,
                config: configPath
             };
  
            // condition for time based or number based test driving
            if (args.txNumber) {
                msg.numb = testRounds[i];
            } else if (args.txDuration) {
                msg.txDuration = testRounds[i]
            } else {
                return reject(new Error('Unspecified test driving mode'));
            }

            tests.push(msg);
        }
        var testIdx = 0;
        return tests.reduce( function(prev, item) {
            return prev.then( () => {
                console.log('----test round ' + round + '----');
                round++;
                testIdx++;
                demo.startWatch(client);

                return client.startTest(item, clientArgs, processResult, testLabel)
                .then( () => {
                    demo.pauseWatch();
                    t.pass('passed \'' + testLabel + '\' testing');
                    return Promise.resolve();
                })
                .then( () => {
                    if(final && testIdx === tests.length) {
                        return Promise.resolve();
                    }
                    else {
                        console.log('wait 5 seconds for next round...');
                        return Util.sleep(5000).then( () => {
                            return monitor.restart();
                        })
                    }
                })
                .catch( (err) => {
                    demo.pauseWatch();
                    t.fail('failed \''  + testLabel + '\' testing, ' + (err.stack ? err.stack : err));
                    return Promise.resolve();   // continue with next round ?
                });
            });
        }, Promise.resolve())
        .then( () => {
            return resolve();
        })
        .catch( (err) => {
            t.fail(err.stack ? err.stack : err);
            return reject(new Error('defaultTest failed'));
        });
    });
}


/**
* fork a child process to act as a client to interact with backend's blockchain system
* @msg {Object}, message to be sent to child process
* @processes {Array}
* @t {Object}, tape object
*/
/*function loadProcess(msg, t, processes) {
    return new Promise( function(resolve, reject) {
        var child = childProcess.fork(path.join(absCaliperDir, './src/comm/bench-client.js'));
        processes.push(child);
        child.on('message', function(message) {
            if(message.type === 'testResult') {
                results.push(message.data);
                resolve();
                child.kill();
            }
            else if(message.type === 'error') {
                reject('client encountered error, ' + message.data);
                child.kill();
            }
            else if(message.type === 'queryResult') {
                demo.queryCB(message.session, message.data);
            }
        });

        child.on('error', function(){
            reject('client encountered unexpected error');
        });

        child.on('exit', function(){
            console.log('client exited');
            resolve();
        });

        child.send(msg);
    });
}*/

/**
* merge testing results from multiple child processes and store the merged result in the global result array
* result format: {
*     succ : ,                            // number of succeeded txs
*     fail : ,                            // number of failed txs
*     create : {min: , max: },            // min/max time of tx created
*     final  : {min: , max: },            // min/max time of tx becoming final
*     delay  : {min: , max: , sum: },     // min/max/sum time of txs' processing delay
*     throughput : {time: ,...}           // tps of each time slot
*     // obsoleted out: {key, value}                   // output that should be cached for following tests
* }
* @opt, operation being tested
* @return {Promise}
*/
// TODO: should be moved to a dependent 'analyser' module in which to do all result analysing work
function processResult(results, opt){
    try{
        var resultTable = [];
        resultTable[0] = getResultTitle();
        var r;
        if(Blockchain.mergeDefaultTxStats(results) === 0) {
            r = Blockchain.createNullDefaultTxStats;
            r['opt'] = opt;
        }
        else {
             r = results[0];
            /*for(let i = 0 ; i < r.out.length ; i++) {
                putCache(r.out[i]);
            }*/
            r['opt'] = opt;
            resultTable[1] = getResultValue(r);
        }

        if(resultsbyround.length === 0) {
            resultsbyround.push(resultTable[0].slice(0));
        }
        if(resultTable.length > 1) {
            resultsbyround.push(resultTable[1].slice(0));
        }
        console.log('###test result:###');
        printTable(resultTable);
        var idx = report.addBenchmarkRound(opt);
        report.setRoundPerformance(idx, resultTable);
        var resourceTable = monitor.getDefaultStats();
        if(resourceTable.length > 0) {
            console.log('### resource stats ###');
            printTable(resourceTable);
            report.setRoundResource(idx, resourceTable);
        }
        return Promise.resolve();
    }
    catch(err) {
        console.log(err);
        return Promise.reject(err);
    }
}

/**
* print table format value
* @value {Array}, values of the table
*/
function printTable(value) {
    var t = table.table(value, {border: table.getBorderCharacters('ramac')});
    console.log(t);
}

/**
* get the default result table's title
* @return {Array}, result table's title
*/
function getResultTitle() {
    // TODO: allow configure percentile value
    return ['Name', 'Succ', 'Fail', 'Send Rate', 'Max Latency', 'Min Latency', 'Avg Latency', '75%ile Latency', 'Throughput'];
}

/**
* get the default formatted result table's values
* @r {Object}, result's value
* @return {Array}, formatted result table's values
*/
function getResultValue(r) {
    var row = [];
    try {
        row.push(r.opt);
        row.push(r.succ);
        row.push(r.fail);
        (r.create.max === r.create.min) ? row.push((r.succ + r.fail) + ' tps') : row.push(((r.succ + r.fail) / (r.create.max - r.create.min)).toFixed(0) + ' tps');
        row.push(r.delay.max.toFixed(2) + ' s');
        row.push(r.delay.min.toFixed(2) + ' s');
        row.push((r.delay.sum / r.succ).toFixed(2) + ' s');
        if(r.delay.detail.length === 0) {
            row.push('N/A');
        }
        else{
            r.delay.detail.sort(function(a, b) {
                return a-b;
            });
            row.push(r.delay.detail[Math.floor(r.delay.detail.length * 0.75)].toFixed(2) + ' s');
        }

        (r.final.max === r.final.min) ? row.push(r.succ + ' tps') : row.push(((r.succ / (r.final.max - r.create.min)).toFixed(0)) + ' tps');
    }
    catch (err) {
        row = [r.opt, 0, 0, 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A'];
    }

    return row;
}

/**
* print the performance testing results of all test rounds
*/
function printResultsByRound() {
    resultsbyround[0].unshift('Test');
    for(let i = 1 ; i < resultsbyround.length ; i++) {
        resultsbyround[i].unshift(i.toFixed(0));
    }
    console.log('###all test results:###');
    printTable(resultsbyround);

    report.setSummaryTable(resultsbyround);
}