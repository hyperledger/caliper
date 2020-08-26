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
const ConfigUtil = require('../../common/config/config-util.js');
const TransactionStatisticsCollector = require('../../common/core/transaction-statistics-collector');

/**
 * Interface of TX observers.
 *
 * @property {boolean} active Indicates whether the TX observer is active or not.
 * @property {number} workerIndex The 0-based index of the worker node.
 * @property {number} currentRound The 0-based index of the current round.
 * @property {TransactionStatisticsCollector[]} Collection of TX statistics corresponding to each round.
 * @property {MessengerInterface} messenger The worker messenger instance.
 */
class TxObserverInterface {
    /**
     * Initializes the TX observer instance.
     * @param {MessengerInterface} messenger The worker messenger instance.
     * @param {number} workerIndex The 0-based index of the worker node.
     */
    constructor(messenger, workerIndex) {
        this.messenger = messenger;
        this.active = false;
        this.workerIndex = workerIndex;
        this.currentRound = 0;
        this.roundStatistics = [];

        // config path
        this.benchmarkConfigPath = CaliperUtils.resolvePath(ConfigUtil.get(ConfigUtil.keys.BenchConfig));

        // config object
        const benchmarkConfig = CaliperUtils.parseYaml(this.benchmarkConfigPath);
        this.observerConfig = benchmarkConfig.monitors && benchmarkConfig.monitors.transaction ? benchmarkConfig.monitors.transaction : [];
    }

    /**
     * Return an array of declared txObservers
     * @return {string[]} An array of declared txObservers
     */
    getDeclaredTxObservers() {
        return this.observerConfig;
    }

    /**
     * Activates the TX observer instance, and in turn, the new TX statistics collector.
     * @param {number} roundIndex The 0-based index of the current round.
     * @param {string} roundLabel The roundLabel name.
     */
    async activate(roundIndex, roundLabel) {
        this.active = true;
        this.currentRound = roundIndex;
        this.roundLabel = roundLabel;
        this.roundStatistics[this.currentRound] = new TransactionStatisticsCollector(this.workerIndex, roundIndex, roundLabel);
        this.roundStatistics[this.currentRound].activate();
    }

    /**
     * Deactivates the TX observer interface, and in turn, the current TX statistics collector.     */
    async deactivate() {
        this.active = false;
        this.roundStatistics[this.currentRound].deactivate();
    }

    /**
     * Called when TXs are submitted.
     * @param {number} count The number of submitted TXs. Can be greater than one for a batch of TXs.
     */
    txSubmitted(count) {
        this.roundStatistics[this.currentRound].txSubmitted(count);
    }

    /**
     * Called when TXs are finished.
     * @param {TxStatus | TxStatus[]} results The result information of the finished TXs. Can be a collection of results for a batch of TXs.
     */
    txFinished(results) {
        this.roundStatistics[this.currentRound].txFinished(results);
    }

    /**
     * Return the underlying TX statistics collector.
     * @return {TransactionStatisticsCollector} The TX statistics collector instance.
     */
    getCurrentStatistics() {
        return this.roundStatistics[this.currentRound];
    }
}

module.exports = TxObserverInterface;
