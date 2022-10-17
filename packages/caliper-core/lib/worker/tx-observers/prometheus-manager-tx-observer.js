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
const WorkerMetricsMessage = require('../../common/messages/workerMetricsMessage');
const CaliperUtils = require('../../common/utils/caliper-utils');
const ConfigUtil = require('../../common/config/config-util');

const Logger = CaliperUtils.getLogger('prometheus-tx-observer');

/**
 * Prometheus Manager TX observer used to send updates to the Prometheus scrape server in the manager.
 */
class PrometheusManagerTxObserver extends TxObserverInterface {
    /**
     * Initializes the instance.
     * @param {object} options The observer configuration object.
     * @param {MessengerInterface} messenger The worker messenger instance. Not used.
     * @param {number} workerIndex The 0-based index of the worker node.
     * @param {string} managerUuid The UUID of the manager messenger.
     */
    constructor(options, messenger, workerIndex, managerUuid) {
        super(messenger, workerIndex);

        this.method = (options && options.method) ? options.method : ConfigUtil.get(ConfigUtil.keys.Observer.PrometheusManager.Method);

        switch (this.method) {
        case 'periodic': {
            this.updateInterval = (options && options.interval) ? options.interval : ConfigUtil.get(ConfigUtil.keys.Observer.PrometheusManager.Interval);
            this.intervalObject = undefined;
            if (this.updateInterval <= 0) {
                this.updateInterval = ConfigUtil.get(ConfigUtil.keys.Observer.PrometheusManager.Interval);
                Logger.warn(`Invalid update interval specified, using default value of ${this.updateInterval}`);
            }
            if (options && options.collationCount) {
                Logger.warn('Collation count is ignored when using periodic method');
            }
            break;
        }

        case 'collate' : {
            this.collationCount = (options && options.collationCount) ? options.collationCount : ConfigUtil.get(ConfigUtil.keys.Observer.PrometheusManager.CollationCount);
            if (this.collationCount <= 0) {
                this.collationCount = ConfigUtil.get(ConfigUtil.keys.Observer.PrometheusManager.CollationCount);
                Logger.warn(`Invalid collation count specified, using default value of ${this.collationCount}`);
            }
            if (options && options.interval) {
                Logger.warn('Update interval is ignored when using collate method');
            }
            break;
        }

        default: {
            const msg = `Unrecognised method '${this.method}' specified for prometheus manager, must be either 'collate' or 'periodic' `;
            Logger.error(msg);
            throw new Error(msg);
        }

        }

        this.pendingMessages = [];
        this.managerUuid = managerUuid;
    }
    /**
     * Called when TXs are submitted.
     * @param {number} count The number of submitted TXs. Can be greater than one for a batch of TXs.
     */
    txSubmitted(count) {
        const message = new WorkerMetricsMessage(this.messenger.getUUID(), [this.managerUuid], {
            event: 'txSubmitted',
            workerIndex: this.workerIndex,
            roundIndex: this.currentRound,
            roundLabel: this.roundLabel,
            count: count
        });
        this._appendMessage(message);
    }

    /**
     * Called when TXs are finished.
     * @param {TxStatus | TxStatus[]} results The result information of the finished TXs. Can be a collection of results for a batch of TXs.
     */
    txFinished(results) {
        if (Array.isArray(results)) {
            for (const result of results) {
                // pass/fail status from result.GetStatus()
                const message = new WorkerMetricsMessage(this.messenger.getUUID(), [this.managerUuid], {
                    event: 'txFinished',
                    workerIndex: this.workerIndex,
                    roundIndex: this.currentRound,
                    roundLabel: this.roundLabel,
                    status: result.GetStatus(),
                    latency: (result.GetTimeFinal() - result.GetTimeCreate()) / 1000
                });
                this._appendMessage(message);
            }
        } else {
            // pass/fail status from result.GetStatus()
            const message = new WorkerMetricsMessage(this.messenger.getUUID(), [this.managerUuid], {
                event: 'txFinished',
                workerIndex: this.workerIndex,
                roundIndex: this.currentRound,
                roundLabel: this.roundLabel,
                status: results.GetStatus(),
                latency: (results.GetTimeFinal() - results.GetTimeCreate()) / 1000
            });
            this._appendMessage(message);
        }
    }

    /**
     * Adds message to the pending message queue
     * @param {object} message Pending message
     * @private
     */
    async _appendMessage(message) {
        this.pendingMessages.push(message);

        if (this.method === 'collate' && this.pendingMessages.length === this.collationCount) {
            this._sendUpdate();
        }
    }

    /**
     * Sends the current aggregated statistics to the manager node when triggered by "setInterval".
     * @private
     */
    _sendUpdate() {
        for (const message of this.pendingMessages) {
            this.messenger.send(message);
        }
        this.pendingMessages = [];
    }

    /**
     * Activates the TX observer instance and starts the regular update scheduling.
     * @param {number} roundIndex The 0-based index of the current round.
     * @param {string} roundLabel The roundLabel name.
     */
    async activate(roundIndex, roundLabel) {
        await super.activate(roundIndex, roundLabel);

        if (this.method === 'periodic') {
            this.intervalObject = setInterval(async () => { this._sendUpdate(); }, this.updateInterval);
        }
    }

    /**
     * Deactivates the TX observer interface, and stops the regular update scheduling.
     */
    async deactivate() {
        await super.deactivate();

        if (this.intervalObject) {
            clearInterval(this.intervalObject);
            this.intervalObject = undefined;
        }
        await this._sendUpdate();
    }
}

/**
 * Factory function for creating a PrometheusManagerTxObserver instance.
 * @param {object} options The observer configuration object.
 * @param {MessengerInterface} messenger The worker messenger instance.
 * @param {number} workerIndex The 0-based index of the worker node.
 * @param {string} managerUuid The UUID of the manager messenger.
 * @return {TxObserverInterface} The observer instance.
 */
function createTxObserver(options, messenger, workerIndex, managerUuid) {
    return new PrometheusManagerTxObserver(options, messenger, workerIndex, managerUuid);
}

module.exports.createTxObserver = createTxObserver;
