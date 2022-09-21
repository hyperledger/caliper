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

const PrometheusUpdateMessage = require('../../common/messages/prometheusUpdateMessage');

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

        this.managerUuid = managerUuid;
    }
    /**
     * Called when TXs are submitted.
     * @param {number} count The number of submitted TXs. Can be greater than one for a batch of TXs.
     */
    txSubmitted(count) {
        const message = new PrometheusUpdateMessage(this.messenger.getUUID(), [this.managerUuid], {
            event: 'txSubmitted',
            workerIndex: this.workerIndex,
            roundIndex: this.currentRound,
            roundLabel: this.roundLabel,
            count: count
        });
        this.messenger.send(message);
    }

    /**
     * Called when TXs are finished.
     * @param {TxStatus | TxStatus[]} results The result information of the finished TXs. Can be a collection of results for a batch of TXs.
     */
    txFinished(results) {
        if (Array.isArray(results)) {
            for (const result of results) {
                // pass/fail status from result.GetStatus()
                const message = new PrometheusUpdateMessage(this.messenger.getUUID(), [this.managerUuid], {
                    event: 'txFinished',
                    workerIndex: this.workerIndex,
                    roundIndex: this.currentRound,
                    roundLabel: this.roundLabel,
                    status: result.GetStatus(),
                    latency: result.GetTimeFinal() - result.GetTimeCreate()
                });
                this.messenger.send(message);
            }
        } else {
            // pass/fail status from result.GetStatus()
            const message = new PrometheusUpdateMessage(this.messenger.getUUID(), [this.managerUuid], {
                event: 'txFinished',
                workerIndex: this.workerIndex,
                roundIndex: this.currentRound,
                roundLabel: this.roundLabel,
                status: results.GetStatus(),
                latency: (results.GetTimeFinal() - results.GetTimeCreate())/1000
            });
            this.messenger.send(message);
        }
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
