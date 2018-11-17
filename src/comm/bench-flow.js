/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file Implementation of the default test framework which start a test flow to run multiple tests according to the configuration file
*/


'use strict';

// global variables
const childProcess = require('child_process');
const exec = childProcess.exec;
const path = require('path');
const tape = require('tape');
const _test = require('tape-promise');
const test = _test(tape);
const table = require('table');
const Blockchain = require('./blockchain.js');
const Monitor = require('./monitor.js');
const Report  = require('./report.js');
const Client  = require('./client/client.js');
const Util = require('./util.js');
const logger = Util.getLogger('bench-flow.js');
let blockchain, monitor, report, client;
let resultsbyround = [];    // results table for each test round
let round = 0;              // test round
let demo = require('../gui/src/demo.js');
let absConfigFile, absNetworkFile;
let absCaliperPath = '../';
let listener_child;
let configurationType;
let absCaliperDir = path.join(__dirname, '..', '..');


/**
 * Generate mustache template for test report
 */
function createReport() {
    let config = require(absConfigFile);
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
        let r = 0;
        for(let i = 0 ; i < config.test.rounds.length ; i++) {
            if(config.test.rounds[i].hasOwnProperty('txNumber')) {
                r += config.test.rounds[i].txNumber.length;
            }
        }
        report.addMetadata('Test Rounds', r);

        report.setBenchmarkInfo(JSON.stringify(config.test, null, 2));
    }
    catch(err) {
        report.addMetadata('Test Rounds', ' ');
    }

    let sut = require(absNetworkFile);
    if(sut.hasOwnProperty('info')) {
        for(let key in sut.info) {
            report.addSUTInfo(key, sut.info[key]);
        }
    }
}

/**
 * print table
 * @param {Array} value rows of the table
 */
function printTable(value) {
    let t = table.table(value, {border: table.getBorderCharacters('ramac')});
    logger.info(t);
}

/**
 * get the default result table's title
 * @return {Array} row of the title
 */
function getResultTitle() {
    // temporarily remove percentile return ['Name', 'Succ', 'Fail', 'Send Rate', 'Max Latency', 'Min Latency', 'Avg Latency', '75%ile Latency', 'Throughput'];
    return ['Name', 'Succ', 'Fail', 'Send Rate', 'Max Latency', 'Min Latency', 'Avg Latency', 'Throughput'];
}

/**
 * get rows of the default result table
 * @param {Array} r array of txStatistics JSON objects
 * @return {Array} rows of the default result table
 */
function getResultValue(r) {

    let row = [];
    try {
        row.push(r.label);
        row.push(r.succ);
        row.push(r.fail);
        (r.create.max === r.create.min) ? row.push((r.succ + r.fail) + ' tps') : row.push(((r.succ + r.fail) / (r.create.max - r.create.min)).toFixed(0) + ' tps');
        row.push(r.delay.max.toFixed(2) + ' s');
        row.push(r.delay.min.toFixed(2) + ' s');
        row.push((r.delay.sum / r.succ).toFixed(2) + ' s');
        // temporarily remove percentile
        /*if(r.delay.detail.length === 0) {
            row.push('N/A');
        }
        else{
            r.delay.detail.sort(function(a, b) {
                return a-b;
            });
            row.push(r.delay.detail[Math.floor(r.delay.detail.length * 0.75)].toFixed(2) + ' s');
        }*/

        (r.final.max === r.final.min) ? row.push(r.succ + ' tps') : row.push(((r.succ / (r.final.max - r.create.min)).toFixed(0)) + ' tps');
    }
    catch (err) {
        // temporarily remove percentile row = [r.label, 0, 0, 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A'];
        row = [r.label, 0, 0, 'N/A', 'N/A', 'N/A', 'N/A', 'N/A'];
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
    logger.info('###all test results:###');
    printTable(resultsbyround);

    report.setSummaryTable(resultsbyround);
}


/**
 * merge testing results from various clients and store the merged result in the global result array
 * txStatistics = {
 *     succ   : ,                        // number of committed txns
 *     fail   : ,                        // number of failed txns
 *     create : {min:, max: },            // min/max time when txns were created/submitted
 *     final  : {min:, max: },            // min/max time when txns were committed
 *     delay  : {min:, max: , sum:, detail:[]},     // min/max/sum of txns' end2end delay, as well as all txns' delay
 * }
 * @param {Array} results array of txStatistics
 * @param {String} label label of the test round
 * @return {Promise} promise object
 */
function processResult(results, label){
    try{
        let resultTable = [];
        resultTable[0] = getResultTitle();
        let r;
        if(Blockchain.mergeDefaultTxStats(results) === 0) {
            r = Blockchain.createNullDefaultTxStats();
            r.label = label;
        }
        else {
            r = results[0];
            r.label = label;
            resultTable[1] = getResultValue(r);
        }

        if(resultsbyround.length === 0) {
            resultsbyround.push(resultTable[0].slice(0));
        }
        if(resultTable.length > 1) {
            resultsbyround.push(resultTable[1].slice(0));
        }
        logger.info('###test result:###');
        printTable(resultTable);
        let idx = report.addBenchmarkRound(label);
        report.setRoundPerformance(idx, resultTable);
        let resourceTable = monitor.getDefaultStats();
        if(resourceTable.length > 0) {
            logger.info('### resource stats ###');
            printTable(resourceTable);
            report.setRoundResource(idx, resourceTable);
        }
        return Promise.resolve();
    }
    catch(err) {
        logger.error(err);
        return Promise.reject(err);
    }
}

/**
 * load client(s) to do performance tests
 * @param {JSON} args testing arguments
 * @param {Array} clientArgs arguments for clients
 * @param {Boolean} final =true, the last test round; otherwise, =false
 * @return {Promise} promise object
 */
function defaultTest(args, clientArgs, final) {
    return new Promise( function(resolve, reject) {
        const t = global.tapeObj;
        t.comment('\n\n###### testing \'' + args.label + '\' ######');
        logger.info('###### testing \'' + args.label + '\' ######');
        let testLabel   = args.label;
        let testRounds  = args.txDuration ? args.txDuration : args.txNumber;
        let tests = []; // array of all test rounds
        let configPath = path.relative(absCaliperDir, absNetworkFile);
        for(let i = 0 ; i < testRounds.length ; i++) {
            let msg = {
                type: 'test',
                label : args.label,
                rateControl: args.rateControl[i] ? args.rateControl[i] : {type:'fixed-rate', 'opts' : {'tps': 1}},
                trim: args.trim ? args.trim : 0,
                args: args.arguments,
                cb  : args.callback,
                config: configPath,
                withMQ: configurationType
            };
            // condition for time based or number based test driving
            if (args.txNumber) {
                msg.numb = testRounds[i];
            } else if (args.txDuration) {
                msg.txDuration = testRounds[i];
            } else {
                return reject(new Error('Unspecified test driving mode'));
            }
            tests.push(msg);
        }
        let testIdx = 0;

        return tests.reduce( function(prev, item) {
            return prev.then( () => {
                logger.info('----test round ' + round + '----');
                round++;
                testIdx++;
                item.roundIdx = round; // propagate round ID to clients
                demo.startWatch(client);
                return client.startTest(item, clientArgs, processResult, testLabel).then( () => {
                    demo.pauseWatch();
                    t.pass('passed \'' + testLabel + '\' testing');
                    logger.info('passed \'' + testLabel + '\' testing');
                    return Promise.resolve();

                }).then( () => {
                    if(final && testIdx === tests.length) {
                        return Promise.resolve();
                    }
                    else {

                        logger.info('wait 5 seconds for next round...');
                        return Util.sleep(5000).then( () => {
                            return monitor.restart();
                        });
                    }

                }).catch( (err) => {
                    demo.pauseWatch();
                    t.fail('failed \''  + testLabel + '\' testing, ' + (err.stack ? err.stack : err));
                    logger.error('failed \''  + testLabel + '\' testing, ' + (err.stack ? err.stack : err));
                    return Promise.resolve();   // continue with next round ?
                });
            });
        }, Promise.resolve()).then( () => {
            return resolve();
        }).catch( (err) => {
            t.fail(err.stack ? err.stack : err);
            logger.error(err.stack ? err.stack : err);
            return reject(new Error('defaultTest failed'));
        });
    });
}

/**
 * Start a default test flow to run the tests
 * @param {String} configFile path of the test configuration file
 * @param {String} networkFile path of the blockchain configuration file
 */
module.exports.run = function(configFile, networkFile) {
    let localConfig = require(configFile);
    configurationType = localConfig.test.clients.WITH_MQ;
    logger.info('#######Caliper Test######');
    test('#######Caliper Test######', (t) => {
        global.tapeObj = t;
        absConfigFile  = Util.resolvePath(configFile);
        absNetworkFile = Util.resolvePath(networkFile);
        blockchain = new Blockchain(absNetworkFile);
        monitor = new Monitor(absConfigFile);
        client  = new Client(absConfigFile);
        createReport();
        demo.init();
        let startPromise = new Promise((resolve, reject) => {
            let config = require(absConfigFile);
            if (config.hasOwnProperty('command') && config.command.hasOwnProperty('start')){
                logger.info(config.command.start);
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
            if (configurationType) {
                let blockListenerPath = path.join(__dirname, absCaliperPath, 'listener/block-listener-handler.js');
                listener_child = childProcess.fork(blockListenerPath);
                listener_child.on('error', function () {
                    logger.error('client encountered unexpected error');
                });
                listener_child.send({ type:'test', config: configFile });
            }
            return blockchain.init();
        }).then( () => {

            return blockchain.installSmartContract();
        }).then( () => {
            return client.init(demo, configFile, absCaliperDir, listener_child, t).then((number)=>{
                return blockchain.prepareClients(number);
            });
        }).then( (clientArgs) => {
            monitor.start().then(()=>{
                logger.info('started monitor successfully');
            }).catch( (err) => {
                logger.error('could not start monitor, ' + (err.stack ? err.stack : err));
            });

            let allTests  = require(absConfigFile).test.rounds;
            let testIdx   = 0;
            let testNum   = allTests.length;
            return allTests.reduce( (prev, item) => {
                return prev.then( () => {
                    ++testIdx;
                    return defaultTest(item, clientArgs, (testIdx === testNum));
                });
            }, Promise.resolve());
        }).then( () => {
            if (configurationType) {
                listener_child.send({type:'closeKafkaProducer', config: configFile});
            }
            logger.info('----------finished test----------\n');
            printResultsByRound();
            monitor.printMaxStats();
            monitor.stop();
            let date = new Date().toISOString().replace(/-/g,'').replace(/:/g,'').substr(0,15);
            let output = path.join(process.cwd(), 'report'+date+'.html' );
            return report.generate(output).then(()=>{
                demo.stopWatch(output);
                logger.info('Generated report at ' + output);
                return Promise.resolve();
            });
        }).then( () => {
            client.stop();
            let config = require(absConfigFile);
            if (config.hasOwnProperty('command') && config.command.hasOwnProperty('end')){
				logger.info(config.command.end);
                let end = exec(config.command.end, {cwd: absCaliperDir}, (error, stdout, stderr) => {
					  if (error) {
						throw error;
					  }
					  t.end();
					  //process.exit();
					});
                end.stdout.pipe(process.stdout);
                end.stderr.pipe(process.stderr);
            }
            t.end();
        }).catch( (err) => {
			if (configurationType) {
                listener_child.send({type:'closeKafkaProducer', config: configFile});
            }
            demo.stopWatch();
            logger.error('unexpected error, ' + (err.stack ? err.stack : err));
            let config = require(absConfigFile);
            if (config.hasOwnProperty('command') && config.command.hasOwnProperty('end')){
				 logger.info(config.command.end);
                let end = exec(config.command.end, {cwd: absCaliperDir}, (error, stdout, stderr) => {
					  if (error) {
						throw error;
					  }
					  t.end();
					  //process.exit();
					});
                end.stdout.pipe(process.stdout);
                end.stderr.pipe(process.stderr);
            }
				t.end();
        });
    });
};
