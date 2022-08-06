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
const ConfigUtil = require('../../common/config/config-util');

const express = require('express');
const appServer = express();
const prometheusClient = require('prom-client');
const prometheusGcStats = require('prometheus-gc-stats');
const globalRegistry = prometheusClient.register;
const aggregatorRegistry = new prometheusClient.AggregatorRegistry();

const Logger = CaliperUtils.getLogger('prometheus-scrape-target');

/**
 * Class for creating a Prometheus scrape target
 */
class PrometheusScrapeTarget {
    /**
     * Constructor
     * @param {object} benchmarkConfig The benchmark configuration object.
     */
    constructor(benchmarkConfig) {
        this.benchmarkConfig = benchmarkConfig;

        const observerConfig = benchmarkConfig.monitors && benchmarkConfig.monitors.transaction ? benchmarkConfig.monitors.transaction : [];
        const prometheusConfig = observerConfig.find((observer) => observer.module === 'prometheus');
        const options = prometheusConfig ? prometheusConfig.options : {};
        this.metricPath = (options && options.metricPath) ? options.metricPath : '/metrics';
        this.scrapePort = (options && options.scrapePort) ? Number(options.scrapePort) : ConfigUtil.get(ConfigUtil.keys.Observer.Prometheus.ScrapePort);
        this.processMetricCollectInterval =  (options && options.processMetricCollectInterval) ? options.processMetricCollectInterval : undefined;

        Logger.debug(`Configuring Prometheus scrape server for manager on port ${this.scrapePort}, with metrics exposed on ${this.metricPath} endpoint`);

        if (this.processMetricCollectInterval) {
            this.processMetricHandle = prometheusClient.collectDefaultMetrics({
                register: globalRegistry,
                timestamps: false,
                timeout: this.processMetricCollectInterval
            });
            const startGcStats = prometheusGcStats(globalRegistry);
            startGcStats();
        }

        appServer.get(`${this.metricPath}`, async (req, res) => {
            try {
                const metrics = await aggregatorRegistry.clusterMetrics();
                res.set('Content-Type', aggregatorRegistry.contentType);
                res.end(metrics);
            } catch (err) {
                Logger.error('Error in metrics provision within manager', err.stack);
                res.status(500).end('Error collecting metrics from Hyperledger Caliper manager');
            }
        });
    }

    /**
     * Start the Prometheus scrape server
     */
    start() {
        Logger.debug('Starting Prometheus scrape server');
        this.server = appServer.listen(this.scrapePort);
        Logger.debug(`Enabled Prometheus scrape server on ${this.scrapePort}, with metrics exposed on ${this.metricPath} endpoint`);
    }

    /**
     * Stop the Prometheus scrape server
     */
    stop() {
        this.server.close();
    }
}

module.exports = PrometheusScrapeTarget;
