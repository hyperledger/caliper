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
const TxObserverInterface = require('./tx-observer-interface');

const express = require('express');
const appServer = express();
const prometheusClient = require('prom-client');
const prometheusGcStats = require('prometheus-gc-stats');

const Logger = CaliperUtils.getLogger('prometheus-tx-observer');

/**
 * Prometheus TX observer used to maintain Prometheus metrics by acting as a scrape target.
 */
class PrometheusTxObserver extends TxObserverInterface {
    /**
     * Initializes the instance.
     * @param {object} options The observer configuration object.
     * @param {MessengerInterface} messenger The worker messenger instance. Not used.
     * @param {number} workerIndex The 0-based index of the worker node.
     */
    constructor(options, messenger, workerIndex) {
        super(messenger, workerIndex);
        this.metricPath = (options && options.metricPath) ? options.metricPath : '/metrics';
        this.scrapePort = (options && options.scrapePort) ? Number(options.scrapePort) : ConfigUtil.get(ConfigUtil.keys.Observer.Prometheus.ScrapePort);
        if (CaliperUtils.isForkedProcess()) {
            this.scrapePort += workerIndex;
        }
        this.processMetricCollectInterval =  (options && options.processMetricCollectInterval) ? options.processMetricCollectInterval : undefined;
        this.defaultLabels = (options && options.defaultLabels) ? options.defaultLabels : {};

        Logger.debug(`Configuring Prometheus scrape server for worker ${workerIndex} on port ${this.scrapePort}, with metrics exposed on ${this.metricPath} endpoint`);

        // do not use global registry to avoid conflicts with other potential prom-based observers
        this.registry = new prometheusClient.Registry();

        // automatically apply default internal and user supplied labels
        this.defaultLabels.workerIndex = this.workerIndex;
        this.defaultLabels.roundIndex = this.currentRound;
        this.defaultLabels.roundLabel = this.roundLabel;
        this.registry.setDefaultLabels(this.defaultLabels);

        // Exposed metrics
        this.counterTxSubmitted = new prometheusClient.Counter({
            name: 'caliper_tx_submitted',
            help: 'The total number of submitted transactions.',
            registers: [this.registry]
        });

        this.counterTxFinished = new prometheusClient.Counter({
            name: 'caliper_tx_finished',
            help: 'The total number of finished transactions.',
            labelNames: ['final_status'],
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
            labelNames: ['final_status'],
            buckets,
            registers: [this.registry]
        });

        // setting an interval enables the default metric collection
        if (this.processMetricCollectInterval) {
            this.processMetricHandle = prometheusClient.collectDefaultMetrics({
                register: this.registry,
                timestamps: false,
                timeout: this.processMetricCollectInterval
            });
            const startGcStats = prometheusGcStats(this.registry);
            startGcStats();
        }

        // configure server for Prometheus scrapes:
        appServer.get(`${this.metricPath}`, async (req, res) => {
            try {
                res.set('Content-Type', this.registry.contentType);
                res.end(await this.registry.metrics());
            } catch (err) {
                Logger.error(`Error in metrics provision within worker ${this.workerIndex}`, err.stack);
                res.status(500).end(`Error collecting metrics from Hyperledger Caliper worker ${this.workerIndex}`);
            }
        });
    }

    /**
     * Activates the TX observer instance, and in turn, the new TX statistics collector.
     * @param {number} roundIndex The 0-based index of the current round.
     * @param {string} roundLabel The roundLabel name.
     */
    async activate(roundIndex, roundLabel) {
        await super.activate(roundIndex, roundLabel);

        // update worker and round metadata
        this.defaultLabels.workerIndex = this.workerIndex;
        this.defaultLabels.roundIndex = this.currentRound;
        this.defaultLabels.roundLabel = this.roundLabel;
        this.registry.setDefaultLabels(this.defaultLabels);

        // Enable server
        this.server = appServer.listen(this.scrapePort);
        Logger.debug(`Enabled Prometheus scrape server on ${this.scrapePort}, with metrics exposed on ${this.metricPath} endpoint`);
    }

    /**
     * Deactivates the TX observer interface, and resets all metric collectors
     */
    async deactivate() {
        await super.deactivate();
        this.counterTxSubmitted.reset();
        this.counterTxFinished.reset();
        this.histogramLatency.reset();
        this.registry.resetMetrics();

        // Disable server
        this.server.close();
    }

    /**
     * Called when TXs are submitted.
     * @param {number} count The number of submitted TXs. Can be greater than one for a batch of TXs.
     */
    txSubmitted(count) {
        this.counterTxSubmitted.inc(count);
    }

    /**
     * Called when TXs are finished.
     * @param {TxStatus | TxStatus[]} results The result information of the finished TXs. Can be a collection of results for a batch of TXs.
     */
    txFinished(results) {
        if (Array.isArray(results)) {
            for (const result of results) {
                // pass/fail status from result.GetStatus()
                this.counterTxFinished.labels(result.GetStatus()).inc();
                this.histogramLatency.labels(result.GetStatus()).observe(result.GetTimeFinal() - result.GetTimeCreate());
            }
        } else {
            // pass/fail status from result.GetStatus()
            this.counterTxFinished.labels(results.GetStatus()).inc();
            this.histogramLatency.labels(results.GetStatus()).observe((results.GetTimeFinal() - results.GetTimeCreate())/1000);
        }
    }
}

/**
 * Factory function for creating a PrometheusTxObserver instance.
 * @param {object} options The observer configuration object.
 * @param {MessengerInterface} messenger The worker messenger instance.
 * @param {number} workerIndex The 0-based index of the worker node.
 * @return {TxObserverInterface} The observer instance.
 */
function createTxObserver(options, messenger, workerIndex) {
    return new PrometheusTxObserver(options, messenger, workerIndex);
}

module.exports.createTxObserver = createTxObserver;
