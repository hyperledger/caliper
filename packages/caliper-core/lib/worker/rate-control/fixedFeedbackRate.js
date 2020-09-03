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
const util = require('../../common/utils/caliper-utils');

// TODO: clarify the implementation logic

/**
 * This controller will send transactions at a specified fixed interval,
 * but when too many transactions are unfinished, it will sleep a period
 * of time.
 *
 * @property {number} generalSleepTime The time to sleep when in normal operation.
 * @property {number} backOffTime Used in the calculation of sleep time when sending TPS needs to be decreased.
 * @property {number} unfinishedPerWorker The unfinished TX limit per worker nodes that trigger the decrease of TX sending rate, default 10.
 * @property {number} zeroSuccessfulCounter The number of times the controller found in a row that there haven't been any successful TXs yet.
 * @property {number} totalSleepTime The total number of milliseconds the controller slept in order to decrease TX sending rate.
 *
 * @extends RateInterface
 */
class FixedFeedbackRateController extends RateInterface {

    /**
     * Initializes the rate controller instance.
     * @param {TestMessage} testMessage start test message
     * @param {TransactionStatisticsCollector} stats The TX stats collector instance.
     * @param {number} workerIndex The 0-based index of the worker node.
     */
    constructor(testMessage, stats, workerIndex) {
        super(testMessage, stats, workerIndex);

        const tps = this.options.tps ? parseInt(this.options.tps) : 10;
        const tpsPerWorker = tps / this.numberOfWorkers;

        this.generalSleepTime = (tpsPerWorker > 0) ? 1000 / tpsPerWorker : 0;
        this.backOffTime = this.options.sleepTime || 100;

        const transactionLoad = this.options.transactionLoad ? this.options.transactionLoad : 10;
        this.unfinishedPerWorker = (transactionLoad / this.numberOfWorkers);
        this.zeroSuccessfulCounter = 0;
        this.totalSleepTime = 0;
    }

    /**
     * Perform the rate control action by blocking the execution for a certain amount of time.
     * @async
     */
    async applyRateControl() {
        let currentSubmitted = this.stats.getTotalSubmittedTx();
        if (this.generalSleepTime === 0 || currentSubmitted < this.unfinishedPerWorker) {
            return;
        }

        if (this.stats.getTotalFinishedTx() === 0) {
            return;
        }

        const unfinished = currentSubmitted - this.stats.getTotalFinishedTx();
        if (unfinished < this.unfinishedPerWorker / 2) {
            return;
        }

        let diff = (this.generalSleepTime * currentSubmitted - ((Date.now() - this.totalSleepTime) - this.stats.getRoundStartTime()));
        if (diff > 5) {
            await util.sleep(diff);
            return;
        }

        // Determines the sleep time for waiting until
        // successful transactions occur
        if (this.stats.getTotalSuccessfulTx() === 0) {
            this.zeroSuccessfulCounter++;
            for(let i = 30; i > 0; --i) {
                if(this.zeroSuccessfulCounter >= i) {
                    this.totalSleepTime += i * this.backOffTime;
                    await util.sleep(i * this.backOffTime);
                    return;
                }
            }
        }
        this.zeroSuccessfulCounter = 0;

        // Determines the sleep time according to the current number of
        // unfinished transactions with the configure one.
        for (let i = 10; i > 0; --i) {
            if (unfinished >= i * this.unfinishedPerWorker) {
                this.totalSleepTime += i * this.backOffTime;
                await util.sleep(i * this.backOffTime);
                return;
            }
        }
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
    return new FixedFeedbackRateController(testMessage, stats, workerIndex);
}

module.exports.createRateController = createRateController;
