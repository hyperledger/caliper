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

const TxObserverInterface = require('./tx-observer-interface');
const CaliperUtils = require('../../common/utils/caliper-utils');
const ConfigUtil = require('../../common/config/config-util');
const Constants = require('../../common/utils/constants');

const prometheusClient = require('prom-client');
const prometheusGcStats = require('prometheus-gc-stats');

const Logger = CaliperUtils.getLogger('prometheus-push-tx-observer');

/**
 * Prometheus TX observer used to maintain Prometheus metrics for the push-based scenario (through a push gateway).
 */
class PrometheusPushTxObserver extends TxObserverInterface {
    /**
     * Initializes the observer instance.
     * @param {object} options The observer configuration object.
     * @param {MessengerInterface} messenger The worker messenger instance.
     * @param {number} workerIndex The 0-based index of the worker node.
     */
    constructor(options, messenger, workerIndex) {
        super(messenger, workerIndex);
        this.pushInterval = (options && options.pushInterval) ? options.pushInterval : ConfigUtil.get(ConfigUtil.keys.Observer.PrometheusPush.Interval);
        this.processMetricCollectInterval =  (options && options.processMetricCollectInterval) ? options.processMetricCollectInterval : undefined;
        this.intervalObject = undefined;

        // do not use global registry to avoid conflicts with other potential prom-based observers
        this.registry = new prometheusClient.Registry();

        // automatically apply default internal and user supplied labels
        this.defaultLabels = (options && options.defaultLabels) ? options.defaultLabels : {};
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

        if (!(options && options.pushUrl)) {
            const msg = 'PushGateway transaction observer must be provided with a pushUrl within the passed options';
            Logger.error(msg);
            throw new Error(msg);
        }
        const url = CaliperUtils.augmentUrlWithBasicAuth(options.pushUrl, Constants.AuthComponents.PushGateway);
        this.prometheusPushGateway = new prometheusClient.Pushgateway(url, null, this.registry);
    }

    /**
     * Sends the current aggregated statistics to the master node when triggered by "setInterval".
     * @private
     */
    async _sendUpdate() {
        this.prometheusPushGateway.pushAdd({jobName: 'workers'}, function(err, _resp, _body) {
            if (err) {
                Logger.error(`Error sending update to Prometheus Push Gateway: ${err.stack}`);
            }
        });
    }

    /**
     * Activates the TX observer instance and starts the regular update scheduling.
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

        this.intervalObject = setInterval(async () => { await this._sendUpdate(); }, this.pushInterval);
    }

    /**
     * Deactivates the TX observer interface, and stops the regular update scheduling.
     */
    async deactivate() {
        await super.deactivate();
        this.counterTxSubmitted.reset();
        this.counterTxFinished.reset();
        this.histogramLatency.reset();
        this.registry.resetMetrics();

        if (this.intervalObject) {
            clearInterval(this.intervalObject);
            await this._sendUpdate();
        }
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
 * Factory function for creating a PrometheusPushTxObserver instance.
 * @param {object} options The observer configuration object.
 * @param {MessengerInterface} messenger The worker messenger instance.
 * @param {number} workerIndex The 0-based index of the worker node.
 * @return {TxObserverInterface} The observer instance.
 */
function createTxObserver(options, messenger, workerIndex) {
    return new PrometheusPushTxObserver(options, messenger, workerIndex);
}

module.exports.createTxObserver = createTxObserver;
