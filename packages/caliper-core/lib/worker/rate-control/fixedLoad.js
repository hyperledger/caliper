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

const RateInterface = require('./rateInterface.js');
const Sleep = require('../../common/utils/caliper-utils').sleep;
const Logger = require('../../common/utils/caliper-utils').getLogger('fixedBacklog.js');

/**
 * Rate controller for driving at a target load (backlog TXs). This controller will aim to maintain a defined backlog
 * of unfinished TXs by modifying the driven TPS.
 *
 * @property {number} sleepTime The number of milliseconds to sleep to keep the specified TX sending rate.
 * @property {number} targetLoad The number of unfinished TX limit per worker nodes that trigger the decrease of TX sending rate, default 10.
 *
 * @extends RateInterface
 */
class FixedLoad extends RateInterface {

    /**
     * Initializes the rate controller instance.
     * @param {TestMessage} testMessage start test message
     * @param {TransactionStatisticsCollector} stats The TX stats collector instance.
     * @param {number} workerIndex The 0-based index of the worker node.
     */
    constructor(testMessage, stats, workerIndex) {
        super(testMessage, stats, workerIndex);

        const tps = this.options.startTps ? parseInt(this.options.startTps) : 5;
        const tpsPerWorker = tps / this.numberOfWorkers;
        this.sleepTime = 1000 / tpsPerWorker;
        const transactionLoad = this.options.transactionLoad ? parseInt(this.options.transactionLoad) : 10;
        this.targetLoad = transactionLoad / this.numberOfWorkers;
    }

    /**
    * Perform the rate control action
    * @async
    */
    async applyRateControl() {

        // Waiting until transactions have completed.
        if (this.stats.getTotalFinishedTx() === 0) {
            await Sleep(this.sleepTime);
            return;
        }

        // Get transaction details
        let unfinished = this.stats.getTotalSubmittedTx() - this.stats.getTotalFinishedTx();

        // Shortcut if we are below the target threshold
        if (unfinished < this.targetLoad) {
            return;
        }

        const targetLoadDifference = unfinished - this.targetLoad;

        // Shortcut if we are below the target threshold and need to increase the loading
        if (targetLoadDifference < 0) {
            Logger.debug('Difference between current and desired transaction loading: ' + targetLoadDifference);
            return;
        }

        // Determine the current TPS
        const completedTransactions = this.stats.getTotalSuccessfulTx() + this.stats.getTotalFailedTx();
        const latency = (this.stats.getTotalLatencyForSuccessful() + this.stats.getTotalLatencyForFailed()) / 1000;
        const tps = (completedTransactions / latency);

        // Determine the required sleep to reduce the backlog ( deltaTXN * 1/TPS = sleep in seconds to build the desired txn load)
        let sleepTime = 0;
        if (tps !== 0) {
            sleepTime = targetLoadDifference * 1000 / tps;
        } else {
            sleepTime = targetLoadDifference * this.sleepTime;
        }

        Logger.debug('Difference between current and desired transaction backlog: ' + targetLoadDifference);
        await Sleep(sleepTime);
    }

    /**
     * Notify the rate controller about the end of the round.
     * @async
     */
    async end() { }
}

/**
 * Factory for creating a new rate controller instance.
 * @param {TestMessage} testMessage start test message
 * @param {TransactionStatisticsCollector} stats The TX stats collector instance.
 * @param {number} workerIndex The 0-based index of the worker node.
 *
 * @return {RateInterface} The new rate controller instance.
 */
function createRateController(testMessage, stats, workerIndex) {
    return new FixedLoad(testMessage, stats, workerIndex);
}

module.exports.createRateController = createRateController;
