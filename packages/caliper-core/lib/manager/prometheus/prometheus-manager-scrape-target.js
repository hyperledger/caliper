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

const Logger = CaliperUtils.getLogger('prometheus-scrape-target');

/**
 * Class for creating a Prometheus scrape target
 */
class PrometheusManagerScrapeTarget {
    /**
     * Constructor
     * @param {object} benchmarkConfig The benchmark configuration object.
     */
    constructor(benchmarkConfig) {
        this.benchmarkConfig = benchmarkConfig;

        const observerConfig = benchmarkConfig.monitors && benchmarkConfig.monitors.transaction ? benchmarkConfig.monitors.transaction : [];
        const prometheusConfig = observerConfig.find((observer) => observer.module === 'prometheus-manager');
        const options = prometheusConfig ? prometheusConfig.options : {};
        this.metricPath = (options && options.metricPath) ? options.metricPath : '/metrics';
        this.scrapePort = (options && options.scrapePort) ? Number(options.scrapePort) : ConfigUtil.get(ConfigUtil.keys.Observer.Prometheus.ScrapePort);
        this.processMetricCollectInterval =  (options && options.processMetricCollectInterval) ? options.processMetricCollectInterval : undefined;

        Logger.debug(`Configuring Prometheus scrape server for manager on port ${this.scrapePort}, with metrics exposed on ${this.metricPath} endpoint`);

        this.registry = new prometheusClient.Registry();
        this.labelNames = ['workerIndex', 'roundIndex', 'roundLabel'];

        // Exposed metrics
        this.counterTxSubmitted = new prometheusClient.Counter({
            name: 'caliper_tx_submitted',
            help: 'The total number of submitted transactions.',
            labelNames: this.labelNames,
            registers: [this.registry]
        });

        this.counterTxFinished = new prometheusClient.Counter({
            name: 'caliper_tx_finished',
            help: 'The total number of finished transactions.',
            labelNames: ['final_status', ...this.labelNames],
            registers: [this.registry]
        });

        // configure buckets
        let buckets = prometheusClient.linearBuckets(0.1, 0.5, 10); // default
        if (options && options.histogramBuckets) {
            if (options.histogramBuckets.explicit) {
                buckets = options.histogramBuckets.explicit;
            } else if (options.histogramBuckets.linear) {
                let linear = options.histogramBuckets.linear;
                buckets = prometheusClient.linearBuckets(linear.start, linear.width, linear.count);
            } else if (options.histogramBuckets.exponential) {
                let exponential = options.histogramBuckets.exponential;
                buckets = prometheusClient.exponentialBuckets(exponential.start, exponential.factor, exponential.count);
            }
        }

        this.histogramLatency = new prometheusClient.Histogram({
            name: 'caliper_tx_e2e_latency',
            help: 'The histogram of end-to-end transaction latencies in seconds.',
            labelNames: ['final_status', ...this.labelNames],
            buckets,
            registers: [this.registry]
        });

        if (this.processMetricCollectInterval) {
            this.processMetricHandle = prometheusClient.collectDefaultMetrics({
                register: this.registry,
                timestamps: false,
                timeout: this.processMetricCollectInterval
            });
            const startGcStats = prometheusGcStats(this.registry);
            startGcStats();
        }

        appServer.get(`${this.metricPath}`, async (req, res) => {
            try {
                const metrics = await this.registry.metrics();
                res.set('Content-Type', this.registry.contentType);
                res.end(metrics);
            } catch (err) {
                Logger.error('Error in metrics provision within manager', err.stack);
                res.status(500).end('Error collecting metrics from Hyperledger Caliper manager');
            }
        });
    }

    /**
     * Process update from worker
     * @param {object} data The data to process
     */
    processUpdate(data) {
        if (data.event === 'txSubmitted') {
            const labels = [data.workerIndex, data.roundIndex, data.roundLabel];
            this.counterTxSubmitted.labels(...labels).inc(data.count);
        } else if (data.event === 'txFinished') {
            const labels = [data.status, data.workerIndex, data.roundIndex, data.roundLabel];
            this.counterTxFinished.labels(...labels).inc();
            this.histogramLatency.labels(...labels).observe(data.latency);
        }
    }

    /**
     * Reset the Prometheus scrape server
     */
    reset() {
        this.counterTxSubmitted.reset();
        this.counterTxFinished.reset();
        this.histogramLatency.reset();
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

module.exports = PrometheusManagerScrapeTarget;
