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
const table = require('table');
const Blockchain = require('./blockchain.js');
const Monitor = require('./monitor/monitor.js');
const Report  = require('./report.js');
const Client  = require('./client/client.js');
const Util = require('./util.js');
const logger = Util.getLogger('bench-flow.js');
let blockchain, monitor, report, client;
let success = 0, failure = 0;
let resultsbyround = [];    // results table for each test round
let round = 0;              // test round
let demo = require('../gui/src/demo.js');
let absConfigFile, absNetworkFile;
let absCaliperDir = path.join(__dirname, '..', '..');


/**
 * Generate mustache template for test report
 */
function createReport() {
    //let config = require(absConfigFile);
    let config = Util.parseYaml(absConfigFile);
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
    logger.info('\n' + t);
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
        (r.create.max === r.create.min) ? row.push((r.succ + r.fail) + ' tps') : row.push(((r.succ + r.fail) / (r.create.max - r.create.min)).toFixed(1) + ' tps');
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

        (r.final.max === r.create.min) ? row.push(r.succ + ' tps') : row.push(((r.succ / (r.final.max - r.create.min)).toFixed(1)) + ' tps');
        logger.debug('r.create.max: '+ r.create.max + ' r.create.min: ' + r.create.min + ' r.final.max: ' + r.final.max + ' r.final.min: '+ r.final.min);
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
 * @async
 */
async function defaultTest(args, clientArgs, final) {
    logger.info(`###### Testing '${args.label}' ######`);
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
            config: configPath
        };
        // condition for time based or number based test driving
        if (args.txNumber) {
            msg.numb = testRounds[i];
        } else if (args.txDuration) {
            msg.txDuration = testRounds[i];
        } else {
            throw new Error('Unspecified test driving mode');
        }
        tests.push(msg);
    }

    let testIdx = 0;

    for (let test of tests) {
        logger.info(`------ Test round ${round + 1} ------`);
        round++;
        testIdx++;

        test.roundIdx = round; // propagate round ID to clients
        demo.startWatch(client);
        try {
            await client.startTest(test, clientArgs, processResult, testLabel);

            demo.pauseWatch();
            success++;
            logger.info(`------ Passed '${testLabel}' testing ------`);

            // prepare for the next round
            if(!final || testIdx !== tests.length) {
                logger.info('Waiting 5 seconds for the next round...');
                await Util.sleep(5000);
                await monitor.restart();
            }
        } catch (err) {
            demo.pauseWatch();
            failure++;
            logger.error(`------ Failed '${testLabel}' testing with the following error ------
${err.stack ? err.stack : err}`);
            // continue with next round
        }
    }
}

/**
 * Executes the given command asynchronously.
 * @param {string} command The command to execute through a newly spawn shell.
 * @return {Promise} The return promise is resolved upon the successful execution of the command, or rejected with an Error instance.
 * @async
 */
function execAsync(command) {
    return new Promise((resolve, reject) => {
        logger.info(`Executing command: ${command}`);
        let child = exec(command, {cwd: absCaliperDir}, (err, stdout, stderr) => {
            if (err) {
                logger.error(`Unsuccessful command execution. Error code: ${err.code}. Terminating signal: ${err.signal}`);
                return reject(err);
            }
            return resolve();
        });
        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);
    });
}

/**
 * Start a default test flow to run the tests
 * @param {String} configFile path of the test configuration file
 * @param {String} networkFile path of the blockchain configuration file
 */
module.exports.run = async function(configFile, networkFile) {
    logger.info('####### Caliper Test ######');
    absConfigFile  = Util.resolvePath(configFile);
    absNetworkFile = Util.resolvePath(networkFile);
    blockchain = new Blockchain(absNetworkFile);
    monitor = new Monitor(absConfigFile);
    client  = new Client(absConfigFile);
    createReport();
    demo.init();

    //let configObject = require(absConfigFile);
    let configObject = Util.parseYaml(absConfigFile);
    let networkObject = require(absNetworkFile);

    try {
        if (networkObject.hasOwnProperty('caliper') && networkObject.caliper.hasOwnProperty('command') && networkObject.caliper.command.hasOwnProperty('start')) {
            if (!networkObject.caliper.command.start.trim()) {
                throw new Error('Start command is specified but it is empty');
            }

            await execAsync(networkObject.caliper.command.start);
        }

        await blockchain.init();
        await blockchain.installSmartContract();
        let numberOfClients = await client.init();
        let clientArgs = await blockchain.prepareClients(numberOfClients);

        try {
            await monitor.start();
            logger.info('Started monitor successfully');
        } catch (err) {
            logger.error('Could not start monitor, ' + (err.stack ? err.stack : err));
        }

        let allTests = configObject.test.rounds;
        let testIdx = 0;
        let testNum = allTests.length;

        for (let test of allTests) {
            ++testIdx;
            await defaultTest(test, clientArgs, (testIdx === testNum));
        }

        logger.info('---------- Finished Test ----------\n');
        printResultsByRound();
        monitor.printMaxStats();
        await monitor.stop();

        let date = new Date().toISOString().replace(/-/g,'').replace(/:/g,'').substr(0,15);
        let output = path.join(process.cwd(), `report-${date}.html`);
        await report.generate(output);
        logger.info(`Generated report at ${output}`);

        client.stop();

    } catch (err) {
        logger.error(`Error: ${err.stack ? err.stack : err}`);
    }finally {
        demo.stopWatch();

        if (networkObject.hasOwnProperty('caliper') && networkObject.caliper.hasOwnProperty('command') && networkObject.caliper.command.hasOwnProperty('end')) {
            if (!networkObject.caliper.command.end.trim()) {
                logger.error('End command is specified but it is empty');
            } else {

                await execAsync(networkObject.caliper.command.end);
            }
        }

        // NOTE: keep the below multi-line formatting intact, otherwise the indents will interfere with the template literal
        let testSummary = `# Test summary: ${success} succeeded, ${failure} failed #`;
        logger.info(`
        
${'#'.repeat(testSummary.length)}
${testSummary}
${'#'.repeat(testSummary.length)}
`);
    }
};
