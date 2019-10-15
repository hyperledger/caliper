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

const Util = require('../utils/caliper-utils.js');

const Logger = Util.getLogger('monitor-prometheus.js');
const MonitorInterface = require('./monitor-interface');
const PrometheusPushClient = require('../prometheus/prometheus-push-client');
const PrometheusQueryClient = require('../prometheus/prometheus-query-client');
const PrometheusQueryHelper = require('../prometheus/prometheus-query-helper');

/**
 * Prometheus monitor implementation
 */
class PrometheusMonitor extends MonitorInterface {

    /**
     * Constructor
     * @param {JSON} monitorConfig Monitor config information
     * @param {*} interval resource fetching interval
     */
    constructor(monitorConfig, interval) {
        super(monitorConfig, interval);
        this.prometheusPushClient = new PrometheusPushClient(monitorConfig.pushUrl);
        this.prometheusQueryClient = new PrometheusQueryClient(monitorConfig.url);
        // User defined options for monitoring
        if (monitorConfig.hasOwnProperty('metrics')) {
            // Might have an ignore list
            if (monitorConfig.metrics.hasOwnProperty('ignore')) {
                this.ignore = monitorConfig.metrics.ignore;
            } else {
                Logger.info('No monitor metrics `ignore` option specified, will provide statistics on all items retrieved by queries');
            }

            // Might have user specified queries to run
            if (monitorConfig.metrics.hasOwnProperty('include')) {
                this.include =  monitorConfig.metrics.include;
            } else {
                Logger.info('No monitor metrics `include` options specified, unable to provide statistics on any resources');
            }
        } else {
            Logger.info('No monitor `metrics` specified, will not provide statistics on any resources');
        }
    }

    /**
     * Retrieve the push client
     * @returns {PrometheusPushClient} the push client
     */
    getPushClient(){
        return this.prometheusPushClient;
    }

    /**
     * Retrieve the query client
     * @returns {PrometheusQueryClient} the query client
     */
    getQueryClient(){
        return this.prometheusQueryClient;
    }

    /**
     * Retrieve the PushGateway URL from the monitor config
     * @returns{String} the PushGateway URL
     */
    getPushGatewayURL(){
        return this.monitorConfig.push_url;
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
     * @returns {Map<string, string>[]} Array of Maps detailing the resource utilization requests
     * @async
     */
    async getStatistics() {
        this.endTime = Date.now()/1000;

        if (this.include) {
            const resourceStats = [];

            for (const metricKey of Object.keys(this.include)) {
                let newKey = true;
                // Each metric is of the form
                // Tag0: {
                //     query: 'the prometheus query to be made',
                //     statistic: 'the action to be taken on returned metrics'
                //     step: step size
                // }
                const params = this.include[metricKey];
                const queryString = PrometheusQueryHelper.buildStringRangeQuery(params.query, this.startTime, this.endTime, params.step);
                const response = await this.prometheusQueryClient.getByEncodedUrl(queryString);

                // Retrieve base mapped statistics and coerce into correct format
                const resultMap = PrometheusQueryHelper.extractStatisticFromRange(response, params.statistic, params.label);

                for (const [key, value] of resultMap.entries()) {
                    // Filter here
                    if (this.ignore.includes(key)) {
                        continue;
                    } else {
                        // Transfer into display array
                        const watchItemStat = newKey ? this.getResultColumnMapForQueryTag(params.query, metricKey) : this.getResultColumnMapForQueryTag('', '');
                        watchItemStat.set('Name', key);
                        const multiplier = params.multiplier ? params.multiplier : 1;
                        watchItemStat.set('Value', (value*multiplier).toFixed(2));
                        // Store
                        resourceStats.push(watchItemStat);
                        newKey = false;
                    }
                }
            }
            return resourceStats;
        } else {
            Logger.debug('No include options specified for monitor - skipping action');
        }
    }

}

module.exports = PrometheusMonitor;
