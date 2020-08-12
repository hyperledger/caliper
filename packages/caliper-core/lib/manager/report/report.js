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
const CaliperUtils = require('../../common/utils/caliper-utils');
const Logger = CaliperUtils.getLogger('report-builder');

const table = require('table');

/**
 * Class for building a report
 */
class Report {

    /**
     * Constructor for the Report object
     * @param {MonitorOrchestrator} monitorOrchestrator the test monitor
     * @param {object} benchmarkConfig The benchmark configuration object.
     * @param {object} networkConfig The network configuration object.
     */
    constructor(monitorOrchestrator, benchmarkConfig, networkConfig) {
        this.benchmarkConfig = benchmarkConfig;
        this.networkConfig = networkConfig;
        this.monitorOrchestrator = monitorOrchestrator;

        this.reportBuilder = new ReportBuilder();
        this.resultsByRound = [];
        this.queryClient = (monitorOrchestrator && monitorOrchestrator.hasMonitor('prometheus')) ? monitorOrchestrator.getMonitor('prometheus').getQueryClient() : null;
    }

    /**
     * Generate mustache template for test report.
     */
    createReport() {
        let test = this.benchmarkConfig.test;
        this.reportBuilder.addMetadata('DLT', this.networkConfig.caliper.blockchain);
        try{
            this.reportBuilder.addMetadata('Name', test.name);
        }
        catch(err) {
            this.reportBuilder.addMetadata('Name', ' ');
        }
        try {
            this.reportBuilder.addMetadata('Description', test.description);
        }
        catch(err) {
            this.reportBuilder.addMetadata('Description', ' ');
        }
        try {
            this.reportBuilder.addMetadata('Benchmark Rounds', test.rounds.length);
        }
        catch(err) {
            this.reportBuilder.addMetadata('Benchmark Rounds', ' ');
        }

        if(this.networkConfig.hasOwnProperty('info')) {
            for(let key in this.networkConfig.info) {
                this.reportBuilder.addSUTInfo(key, this.networkConfig.info[key]);
            }
        }
        this.reportBuilder.setBenchmarkInfo(JSON.stringify(test, null, 2));
        this.reportBuilder.addLabelDescriptionMap(test.rounds);
    }

    /**
     * Convert a result map to a table Array
     * @param {Map | Map[]} resultMap a key/value result map or an array of such maps
     * @return {sting[]} the table array
     */
    convertToTable(resultMap) {

        // Format the Map into a table that may be printed using the npm table module
        // tableRow[0] = array of column titles
        // tableRow[1+] = array column values

        let tableArray = [];
        if (Array.isArray(resultMap)){
            // More complex case, we have multiple results to deal with
            for (const result of resultMap) {
                const titles = [];
                const values = [];
                for (const key of result.keys()){
                    titles.push(key);
                    values.push(result.get(key));
                }
                if (!tableArray.length) {
                    tableArray.push(titles);
                }
                tableArray.push(values);
            }
        } else {
            const titles = [];
            const values = [];
            for (const key of resultMap.keys()){
                titles.push(key);
                values.push(resultMap.get(key));
            }
            tableArray.push(titles);
            tableArray.push(values);
        }
        return tableArray;
    }

    /**
     * print table
     * @param {string[]} tableArray a table array containing performance information compatible with the npm table module
     */
    printTable(tableArray) {
        // tableArray[0] = array of column titles
        // tableArray[1+] = array column values
        if (tableArray.length > 0) {
            let t = table.table(tableArray, {border: table.getBorderCharacters('ramac')});
            Logger.info('\n' + t);
        } else {
            Logger.error('No data within test result; implies error within configuration files');
        }
    }

    /**
     * Get a Map of result items
     * @return {Map} Map of items to build results for, with default null entries
     */
    getResultColumnMap() {
        const columns = ['Name', 'Succ', 'Fail', 'Send Rate (TPS)', 'Max Latency (s)', 'Min Latency (s)', 'Avg Latency (s)', 'Throughput (TPS)'];
        const resultMap = new Map();

        for (const item of columns) {
            resultMap.set(item, 'N/A');
        }

        return resultMap;
    }

    /**
     * Create a result map from locally gathered values
     * @param {string} testLabel the test label name
     * @param {TransactionStatisticsCollector} results TransactionStatisticsCollector containing cumulative worker transaction statistics
     * @return {Map} a Map of key value pairing to create the default result table
     */
    getResultValues(testLabel, results) {
        Logger.debug ('getLocalResultValues called with: ', JSON.stringify(results));
        const resultMap = this.getResultColumnMap();
        resultMap.set('Name', testLabel ? testLabel : 'unknown');
        resultMap.set('Succ', results.getTotalSuccessfulTx());
        resultMap.set('Fail', results.getTotalFailedTx());
        resultMap.set('Max Latency (s)', CaliperUtils.millisToSeconds(results.getMaxLatencyForSuccessful()).toFixed(2));
        resultMap.set('Min Latency (s)', CaliperUtils.millisToSeconds(results.getMinLatencyForSuccessful()).toFixed(2));
        resultMap.set('Avg Latency (s)', results.getTotalSuccessfulTx() > 0 ? (CaliperUtils.millisToSeconds(results.getTotalLatencyForSuccessful() / results.getTotalSuccessfulTx())).toFixed(2) : '-');

        // Send rate
        const sendRate = ((results.getTotalSuccessfulTx() + results.getTotalFailedTx()) / (CaliperUtils.millisToSeconds(results.getLastCreateTime() - results.getFirstCreateTime()))).toFixed(1);
        resultMap.set('Send Rate (TPS)', sendRate);

        // Observed TPS
        const tps = ((results.getTotalSuccessfulTx() + results.getTotalFailedTx()) / (CaliperUtils.millisToSeconds(results.getLastFinishTime() - results.getFirstCreateTime()))).toFixed(1);
        resultMap.set('Throughput (TPS)', tps);

        return resultMap;
    }

    /**
     * Print the performance testing results of all test rounds
     */
    printResultsByRound() {
        const tableArray = this.convertToTable(this.resultsByRound);
        Logger.info('### All test results ###');
        this.printTable(tableArray);

        this.reportBuilder.setSummaryTable(tableArray);
    }

    /**
     * Augment the report with details generated through extraction from local process reporting
     * @param {TransactionStatisticsCollector} results cumulative results from all worker TransactionStatisticsCollectors
     * @param {Object} roundConfig test round configuration object
     * @return {Promise} promise object containing the current report index
     */
    async processTPSResults(results, roundConfig) {
        try {
            const resultMap = this.getResultValues(roundConfig.label, results);
            // Add this set of results to the main round collection
            this.resultsByRound.push(resultMap);

            // Print TPS result for round to console
            Logger.info('### Test result ###');
            const tableArray = this.convertToTable(resultMap);
            this.printTable(tableArray);

            // Add TPS to the report
            let idx = this.reportBuilder.addBenchmarkRound(roundConfig);
            this.reportBuilder.setRoundPerformance(roundConfig.label, idx, tableArray);

            return idx;
        } catch(error) {
            Logger.error(`processTPSResults failed with error: ${error}`);
            throw error;
        }
    }

    /**
     * Retrieve the resource monitor statistics and add to the report index
     * @param {number} idx the report index to add the resource statistics under
     * @param {string} label the test label
     */
    async buildRoundResourceStatistics(idx, label) {
        // Retrieve statistics from all monitors
        const types = this.monitorOrchestrator.getAllMonitorTypes();
        for (const type of types) {
            const { resourceStats, chartStats } = await this.monitorOrchestrator.getStatisticsForMonitor(type, label);
            const resourceTable = this.convertToTable(resourceStats);
            if (resourceTable.length > 0) {
                Logger.info(`### ${type} resource stats ###'`);
                this.printTable(resourceTable);
                this.reportBuilder.setRoundResourceTable(label, idx, resourceTable, chartStats, type);
            }
        }
    }

    /**
     * Print the generated report to file
     * @async
     */
    async finalize() {
        await this.reportBuilder.generate();
    }
}

module.exports = Report;
