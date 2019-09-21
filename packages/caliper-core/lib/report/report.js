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

const ReportBuilder = require('./report-builder');
const Blockchain = require('../blockchain');
const CaliperUtils = require('../utils/caliper-utils');
const logger = CaliperUtils.getLogger('report-builder');

const table = require('table');

/**
 * Class for building a report
 */
class Report {

    /**
     * Constructor
     * @param {Monoitor} monitor the test monitor
     */
    constructor(monitor) {
        this.monitor = monitor;
        this.reportBuilder = new ReportBuilder();
        this.resultsbyround = [];
    }

    /**
     * Generate mustache template for test report
     * @param {String} absConfigFile the config file used by this flow
     * @param {String} absNetworkFile the network config file used by this flow
     * @param {String} blockchainType the blockchain target type
     */
    createReport(absConfigFile, absNetworkFile, blockchainType) {
        let config = CaliperUtils.parseYaml(absConfigFile);
        this.reportBuilder.addMetadata('DLT', blockchainType);
        try{
            this.reportBuilder.addMetadata('Benchmark', config.test.name);
        }
        catch(err) {
            this.reportBuilder.addMetadata('Benchmark', ' ');
        }
        try {
            this.reportBuilder.addMetadata('Description', config.test.description);
        }
        catch(err) {
            this.reportBuilder.addMetadata('Description', ' ');
        }
        try{
            let r = 0;
            for(let i = 0 ; i < config.test.rounds.length ; i++) {
                if(config.test.rounds[i].hasOwnProperty('txNumber')) {
                    r += config.test.rounds[i].txNumber.length;
                } else if (config.test.rounds[i].hasOwnProperty('txDuration')) {
                    r += config.test.rounds[i].txDuration.length;
                }
            }
            this.reportBuilder.addMetadata('Test Rounds', r);
            this.reportBuilder.setBenchmarkInfo(JSON.stringify(config.test, null, 2));
        }
        catch(err) {
            this.reportBuilder.addMetadata('Test Rounds', ' ');
        }

        let sut = CaliperUtils.parseYaml(absNetworkFile);
        if(sut.hasOwnProperty('info')) {
            for(let key in sut.info) {
                this.reportBuilder.addSUTInfo(key, sut.info[key]);
            }
        }
        this.reportBuilder.addLabelDescriptionMap(config.test.rounds);
    }

    /**
     * print table
     * @param {Array} value rows of the table
     */
    printTable(value) {
        let t = table.table(value, {border: table.getBorderCharacters('ramac')});
        logger.info('\n' + t);
    }

    /**
     * get the default result table's title
     * @return {Array} row of the title
     */
    getResultTitle() {
        // temporarily remove percentile return ['Name', 'Succ', 'Fail', 'Send Rate', 'Max Latency', 'Min Latency', 'Avg Latency', '75%ile Latency', 'Throughput'];
        return ['Name', 'Succ', 'Fail', 'Send Rate', 'Max Latency', 'Min Latency', 'Avg Latency', 'Throughput'];
    }

    /**
     * get rows of the default result table
     * @param {Array} r array of txStatistics JSON objects
     * @return {Array} rows of the default result table
     */
    getResultValue(r) {
        let row = [];
        try {
            row.push(r.label);
            row.push(r.succ);
            row.push(r.fail);
            (r.create.max === r.create.min) ? row.push((r.succ + r.fail) + ' tps') : row.push(((r.succ + r.fail) / (r.create.max - r.create.min)).toFixed(1) + ' tps');
            row.push(r.delay.max.toFixed(2) + ' s');
            row.push(r.delay.min.toFixed(2) + ' s');
            row.push((r.delay.sum / r.succ).toFixed(2) + ' s');

            (r.final.last === r.create.min) ? row.push(r.succ + ' tps') : row.push((r.succ / (r.final.last - r.create.min)).toFixed(1) + ' tps');
            logger.debug('r.create.max: '+ r.create.max + ' r.create.min: ' + r.create.min + ' r.final.max: ' + r.final.max + ' r.final.min: '+ r.final.min + ' r.final.last: ' + r.final.last);
            logger.debug(' throughput for only success time computed: '+  (r.succ / (r.final.max - r.create.min)).toFixed(1));
        }
        catch (err) {
            row = [r.label, 0, 0, 'N/A', 'N/A', 'N/A', 'N/A', 'N/A'];
        }
        return row;
    }

    /**
     * print the performance testing results of all test rounds
     */
    printResultsByRound() {
        this.resultsbyround[0].unshift('Test');
        for(let i = 1 ; i < this.resultsbyround.length ; i++) {
            this.resultsbyround[i].unshift(i.toFixed(0));
        }
        logger.info('###all test results:###');
        this.printTable(this.resultsbyround);

        this.reportBuilder.setSummaryTable(this.resultsbyround);
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
    processResult(results, label){
        try{
            let resultTable = [];
            resultTable[0] = this.getResultTitle();
            let r;
            if(Blockchain.mergeDefaultTxStats(results) === 0) {
                r = Blockchain.createNullDefaultTxStats();
                r.label = label;
            }
            else {
                r = results[0];
                r.label = label;
                resultTable[1] = this.getResultValue(r);
            }

            let sTP = r.sTPTotal / r.length;
            let sT = r.sTTotal / r.length;
            logger.debug('sendTransactionProposal: ' + sTP + 'ms length: ' + r.length);
            logger.debug('sendTransaction: ' + sT + 'ms');
            logger.debug('invokeLantency: ' + r.invokeTotal / r.length + 'ms');
            if(this.resultsbyround.length === 0) {
                this.resultsbyround.push(resultTable[0].slice(0));
            }
            if(resultTable.length > 1) {
                this.resultsbyround.push(resultTable[1].slice(0));
            }
            logger.info('###test result:###');
            this.printTable(resultTable);
            let idx = this.reportBuilder.addBenchmarkRound(label);
            this.reportBuilder.setRoundPerformance(label, idx, resultTable);
            let resourceTable = this.monitor.getDefaultStats();
            if(resourceTable.length > 0) {
                logger.info('### resource stats ###');
                this.printTable(resourceTable);
                this.reportBuilder.setRoundResource(label, idx, resourceTable);
            }
            return Promise.resolve();
        }
        catch(err) {
            logger.error(err);
            return Promise.reject(err);
        }
    }

    /**
     * Print the generated report to file
     * @param {string} outFile the name of the file to write
     * @async
     */
    async finalize(outFile) {
        await this.reportBuilder.generate(outFile);
    }
}

module.exports = Report;
