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

const CaliperUtils = require('../../common/utils/caliper-utils');
const ChartBuilder = require('../charts/chart-builder');
const Constants = require('../../common/utils/constants');
const ConfigUtil = require('../../common/config/config-util');
const MonitorInterface = require('./monitor-interface');
const PrometheusQueryClient = require('../../common/prometheus/prometheus-query-client');
const PrometheusQueryHelper = require('../../common/prometheus/prometheus-query-helper');
const Util = require('../../common/utils/caliper-utils.js');

const Logger = Util.getLogger('monitor-prometheus');

/**
 * Prometheus monitor implementation
 */
class PrometheusMonitor extends MonitorInterface {

    /**
     * Constructor
     * @param {JSON} resourceMonitorOptions Configuration options for the monitor
     */
    constructor(resourceMonitorOptions) {
        super(resourceMonitorOptions);
        this.precision = ConfigUtil.get(ConfigUtil.keys.Report.Precision, 3);

        // Might be using basic auth
        const url = CaliperUtils.augmentUrlWithBasicAuth(this.options.url, Constants.AuthComponents.Prometheus);
        this.prometheusQueryClient = new PrometheusQueryClient(url);
        // User defined options for monitoring
        if (this.options.hasOwnProperty('metrics')) {
            // Might have an include list
            if (this.options.metrics.hasOwnProperty('include')) {
                this.include = this.options.metrics.include;
            } else {
                Logger.info('No monitor metrics `include` option specified, will provide statistics on all items retrieved by queries');
            }

            // Might have user specified queries to run
            if (this.options.metrics.hasOwnProperty('queries')) {
                this.queries = this.options.metrics.queries;
            } else {
                Logger.warn('No monitor metrics `queries` options specified, unable to provide statistics on any resources');
            }
        } else {
            Logger.warn('No monitor `metrics` specified, will not provide statistics on any resources');
        }
    }

    /**
     * Retrieve the query client
     * @returns {PrometheusQueryClient} the query client
     */
    getQueryClient(){
        return this.prometheusQueryClient;
    }

    /**
    * start monitoring - reset the initial query time index
    * @async
    */
    async start() {
        this.startTime = Date.now()/1000;
    }

    /**
     * Stop the monitor - kill startTime
     * @async
     */
    async stop() {
        this.startTime = undefined;
    }

    /**
    * restart monitoring - reset the initial query time index
    * @async
    */
    async restart() {
        await this.start();
    }

    /**
     * Get a Map of Prometheus query result items
     * @param {string} query the prometheus query to be made
     * @param {string} tag the short tag name for the query
     * @return {Map} Map of items to build results for, with default null entries
     */
    getResultColumnMapForQueryTag(query, tag) {
        const resultMap = new Map();
        resultMap.set('Metric', tag);
        resultMap.set('Prometheus Query', query);
        resultMap.set('Name', 'N/A');
        return resultMap;
    }

    /**
     * Get statistics from Prometheus via queries that target the Prometheus server
     * @param {string} testLabel the current test label
     * @returns {Map<string, string>[]} Array of Maps detailing the resource utilization requests
     * @async
     */
    async getStatistics(testLabel) {
        this.endTime = Date.now()/1000;

        const resourceStats = [];
        const chartArray = [];
        const chartStats = [];
        if (this.queries) {
            for (const queryObject of this.queries) {
                // Each queryObject is taken directly from the parse monitor config file and of the form
                // {
                //     name: 'tag name',
                //     query: 'the prometheus query to be made',
                //     statistic: 'the action to be taken on returned metrics'
                //     step: step size
                //     multiplier: a multiplier to use on the returned prometheus value
                //     label: a matching label for the component of interest
                // }
                const queryString = PrometheusQueryHelper.buildStringRangeQuery(queryObject.query, this.startTime, this.endTime, queryObject.step);
                const response = await this.prometheusQueryClient.getByEncodedUrl(queryString);

                // Retrieve map of component names and corresponding values for the issued query
                const componentNameValueMap = PrometheusQueryHelper.extractStatisticFromRange(response, queryObject.statistic, queryObject.label);

                const metricArray = [];
                let newQueryObjectIteration = true;
                for (const [key, value] of componentNameValueMap.entries()) {
                    // Filter here, based on a regex match
                    if (this.includeStatistic(key)) {
                        // Build report table information
                        const watchItemStat = newQueryObjectIteration ? this.getResultColumnMapForQueryTag(queryObject.query, queryObject.name) : this.getResultColumnMapForQueryTag('', '');
                        newQueryObjectIteration = false;
                        watchItemStat.set('Name', key);
                        const multiplier = queryObject.multiplier ? queryObject.multiplier : 1;
                        watchItemStat.set('Value', (value*multiplier).toPrecision(this.precision));
                        // Store
                        resourceStats.push(watchItemStat);

                        // Build separate charting information
                        const metricMap = new Map();
                        metricMap.set('Name',  watchItemStat.get('Name'));
                        metricMap.set(queryObject.name, watchItemStat.get('Value'));
                        metricArray.push(metricMap);
                    }
                }
                if (metricArray.length > 0) {
                    chartArray.push(metricArray);
                }
            }

            // Retrieve Chart data
            const chartTypes = this.options.charting;
            if (chartTypes) {
                for (const metrics of chartArray) {
                    const stats = ChartBuilder.retrieveChartStats(this.constructor.name, chartTypes, `${testLabel}_${metrics[0].get('Name')}`, metrics);
                    chartStats.push(...stats);
                }
            }
        } else {
            Logger.debug('No queries specified for monitor - skipping action');
        }
        return { resourceStats, chartStats };
    }

    /**
     * Check if the passed key should be included
     * @param {string} componentName the name to test for inclusion against the user supplied list of components to monitor
     * @returns {boolean} boolean flag for inclusion
     */
    includeStatistic(componentName) {
        let includeStat = false;
        for (const includeItem of this.include) {
            const regex = RegExp(includeItem);
            if (regex.test(componentName)) {
                includeStat = true;
                continue;
            }
        }
        return includeStat;
    }

}

module.exports = PrometheusMonitor;
