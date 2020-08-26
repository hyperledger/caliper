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
const PrometheusClient = require('../../common/prometheus/prometheus-push-client');
const CaliperUtils = require('../../common/utils/caliper-utils');

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
        this.sendInterval = options && options.sendInterval || 1000;
        this.intervalObject = undefined;

        this.prometheusClient = new PrometheusClient();
        this.prometheusClient.setGateway(options.push_url);

        this.internalStats = {
            previouslyCompletedTotal: 0,
            previouslySubmittedTotal: 0
        };
    }

    /**
     * Sends the current aggregated statistics to the master node when triggered by "setInterval".
     * @private
     */
    async _sendUpdate() {
        const stats = super.getCurrentStatistics();
        this.prometheusClient.configureTarget(stats.getRoundLabel(), stats.getRoundIndex(), stats.getWorkerIndex());

        // Observer based requirements
        this.prometheusClient.push('caliper_txn_success', stats.getTotalSuccessfulTx());
        this.prometheusClient.push('caliper_txn_failure', stats.getTotalFailedTx());
        this.prometheusClient.push('caliper_txn_pending', stats.getTotalSubmittedTx() - stats.getTotalFinishedTx());

        // TxStats based requirements, existing behaviour batches results bounded within txUpdateTime
        const completedTransactions = stats.getTotalSuccessfulTx() + stats.getTotalFailedTx();
        const submittedTransactions = stats.getTotalSubmittedTx();

        const batchCompletedTransactions = completedTransactions - this.internalStats.previouslyCompletedTotal;
        const batchTPS = (batchCompletedTransactions/this.sendInterval)*1000;  // txUpdate is in ms

        const batchSubmittedTransactions = submittedTransactions - this.internalStats.previouslyCompletedTotal;
        const batchSubmitTPS = (batchSubmittedTransactions/this.sendInterval)*1000;  // txUpdate is in ms
        const latency = (stats.getTotalLatencyForFailed() + stats.getTotalLatencyForSuccessful()) / completedTransactions;

        this.prometheusClient.push('caliper_tps', batchTPS);
        this.prometheusClient.push('caliper_latency', latency/1000);
        this.prometheusClient.push('caliper_txn_submit_rate', batchSubmitTPS);

        this.internalStats.previouslyCompletedTotal = batchCompletedTransactions;
        this.internalStats.previouslyCompletedTotal = batchSubmittedTransactions;
    }

    /**
     * Activates the TX observer instance and starts the regular update scheduling.
     * @param {number} roundIndex The 0-based index of the current round.
     * @param {string} roundLabel The roundLabel name.
     */
    async activate(roundIndex, roundLabel) {
        await super.activate(roundIndex, roundLabel);
        this.intervalObject = setInterval(async () => { await this._sendUpdate(); }, this.sendInterval);
    }

    /**
     * Deactivates the TX observer interface, and stops the regular update scheduling.
     */
    async deactivate() {
        await super.deactivate();

        this.internalStats = {
            previouslyCompletedTotal: 0,
            previouslySubmittedTotal: 0
        };

        if (this.intervalObject) {
            clearInterval(this.intervalObject);

            this.prometheusClient.push('caliper_txn_success', 0);
            this.prometheusClient.push('caliper_txn_failure', 0);
            this.prometheusClient.push('caliper_txn_pending', 0);
            await CaliperUtils.sleep(this.sendInterval);
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
