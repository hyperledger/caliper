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
const PrometheusQueryHelper = require('../../common/prometheus/prometheus-query-helper');
const Blockchain = require('../../common/core/blockchain');
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
     * @param {JSON} results txStatistics JSON object
     * @return {Map} a Map of key value pairing to create the default result table
     */
    getLocalResultValues(testLabel, results) {
        Logger.debug ('getLocalResultValues called with: ', JSON.stringify(results));
        const resultMap = this.getResultColumnMap();
        resultMap.set('Name', testLabel ? testLabel : 'unknown');
        resultMap.set('Succ', results.hasOwnProperty('succ') ? results.succ : '-');
        resultMap.set('Fail', results.hasOwnProperty('fail') ? results.fail : '-');
        resultMap.set('Max Latency (s)', (results.hasOwnProperty('delay') && results.delay.hasOwnProperty('max')) ? results.delay.max.toFixed(2) : '-');
        resultMap.set('Min Latency (s)', (results.hasOwnProperty('delay') && results.delay.hasOwnProperty('min')) ? results.delay.min.toFixed(2) : '-');
        resultMap.set('Avg Latency (s)', (results.hasOwnProperty('delay') && results.delay.hasOwnProperty('sum') && results.hasOwnProperty('succ')) ? (results.delay.sum / results.succ).toFixed(2) : '-');

        // Send rate needs a little more conditioning than sensible for a ternary op
        if (results.hasOwnProperty('succ') && results.hasOwnProperty('fail') && results.hasOwnProperty('create') && results.create.hasOwnProperty('max') && results.create.hasOwnProperty('min')) {
            const sendRate = (results.create.max === results.create.min) ? (results.succ + results.fail) : ((results.succ + results.fail) / (results.create.max - results.create.min)).toFixed(1);
            resultMap.set('Send Rate (TPS)', sendRate);
        } else {
            resultMap.set('Send Rate (TPS)', '-');
        }

        // Observed TPS needs a little more conditioning than sensible for a ternary op
        if (results.hasOwnProperty('succ') && results.hasOwnProperty('final') && results.final.hasOwnProperty('last') && results.hasOwnProperty('create') && results.create.hasOwnProperty('min')) {
            const tps = (results.final.last === results.create.min) ? results.succ  : (results.succ / (results.final.last - results.create.min)).toFixed(1);
            resultMap.set('Throughput (TPS)', tps);
        } else {
            resultMap.set('Throughput (TPS)', '-');
        }

        return resultMap;
    }

    /**
     * Create a result mapping through querying a Prometheus server
     * @param {string} testLabel the test label name
     * @param {string} round the test round
     * @param {number} startTime start time for Prometheus data query, in milliseconds since epoch
     * @param {number} endTime end time for Prometheus data query, in milliseconds since epoch
     * @return {Map} a Map of key value pairing to create the result table
     */
    async getPrometheusResultValues(testLabel, round, startTime, endTime) {
        const startQuery = startTime/1000; //convert to seconds
        const endQuery = endTime/1000;

        const resultMap = this.getResultColumnMap();
        resultMap.set('Name', testLabel ? testLabel : 'unknown');

        // Successful transactions
        const txSuccessQuery = `sum(caliper_txn_success{instance="${testLabel}", round="${round}"})`;
        const txSuccessCountResponse = await this.queryClient.query(txSuccessQuery, endQuery);
        const txSuccessCount = txSuccessCountResponse ? PrometheusQueryHelper.extractFirstValueFromQueryResponse(txSuccessCountResponse) : '-';
        resultMap.set('Succ', txSuccessCount);

        // Failed transactions
        const txFailQuery = `sum(caliper_txn_failure{instance="${testLabel}", round="${round}"})`;
        const txFailCountResponse = await this.queryClient.query(txFailQuery, endQuery);
        const txFailCount = txFailCountResponse ? PrometheusQueryHelper.extractFirstValueFromQueryResponse(txFailCountResponse) : '-';
        resultMap.set('Fail', txFailCount);

        // Maximum latency
        const maxLatencyQuery = `max(caliper_latency{instance="${testLabel}", round="${round}"})`;
        const maxLatenciesResponse = await this.queryClient.rangeQuery(maxLatencyQuery, startQuery, endQuery);
        const maxLatenciesStats = PrometheusQueryHelper.extractStatisticFromRange(maxLatenciesResponse, 'max');
        const maxLatency = maxLatenciesStats.has('unknown') ? maxLatenciesStats.get('unknown').toFixed(2) : '-';
        resultMap.set('Max Latency (s)', maxLatency);

        // Min latency
        const minLatencyQuery = `min(caliper_latency{instance="${testLabel}", round="${round}"})`;
        const minLatenciesResponse = await this.queryClient.rangeQuery(minLatencyQuery, startQuery, endQuery);
        const minLatenciesStats = PrometheusQueryHelper.extractStatisticFromRange(minLatenciesResponse, 'min');
        const minLatency = minLatenciesStats.has('unknown') ? minLatenciesStats.get('unknown').toFixed(2) : '-';
        resultMap.set('Min Latency (s)', minLatency);

        // Avg Latency
        const avgLatencyQuery = `avg(caliper_latency{instance="${testLabel}", round="${round}"})`;
        const avgLatenciesResponse = await this.queryClient.rangeQuery(avgLatencyQuery, startQuery, endQuery);
        const avgLatenciesStats = PrometheusQueryHelper.extractStatisticFromRange(avgLatenciesResponse, 'avg');
        const avgLatency = avgLatenciesStats.has('unknown') ? avgLatenciesStats.get('unknown').toFixed(2) : '-';
        resultMap.set('Avg Latency (s)', avgLatency);

        // Avg Submit Rate within the time bounding
        const avgSubmitRateQuery = `sum(caliper_txn_submit_rate{instance="${testLabel}", round="${round}"})`;
        const avgSubmitRateResponse = await this.queryClient.rangeQuery(avgSubmitRateQuery, startQuery, endQuery);
        const avgSubmitRateStats = PrometheusQueryHelper.extractStatisticFromRange(avgSubmitRateResponse, 'avg');
        const avgSubmitRate = avgSubmitRateStats.has('unknown') ? avgSubmitRateStats.get('unknown').toFixed(2) : '-';
        resultMap.set('Send Rate (TPS)', avgSubmitRate);

        // Average TPS (completed transactions)
        const tps = ((txSuccessCount + txFailCount)/(endQuery - startQuery)).toFixed(1);
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
     * @param {JSON} results JSON object {tsStats: txStats[], start: number, end: number} containing an array of txStatistics
     * @param {Object} roundConfig test round configuration object
     * @return {Promise} promise object containing the current report index
     */
    async processLocalTPSResults(results, roundConfig){
        try {
            let resultSet;

            if (Blockchain.mergeDefaultTxStats(results) === 0) {
                resultSet = Blockchain.createNullDefaultTxStats();
            } else {
                resultSet = results[0];
            }

            const resultMap = this.getLocalResultValues(roundConfig.label, resultSet);
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
            Logger.error(`processLocalTPSResults failed with error: ${error}`);
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
     * Augment the report with details generated through extraction from Prometheus
     * @param {JSON} timing JSON object containing start/end times required to query
     * the prometheus server
     * @param {Object} roundConfig test round configuration object
     * @param {number} round the current test round
     * @return {Promise} promise object containing the report index
     * @async
     */
    async processPrometheusTPSResults(timing, roundConfig, round){
        try {
            const resultMap = await this.getPrometheusResultValues(roundConfig.label, round, timing.start, timing.end);

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
        } catch (error) {
            Logger.error(`processPrometheusTPSResults failed with error: ${error}`);
            throw error;
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
