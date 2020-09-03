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
let Sleep = require('../../common/utils/caliper-utils').sleep;

/**
 * Rate controller for generating a linearly changing workload.
 *
 * @property {number} startingSleepTime The sleep time for the first transaction in milliseconds.
 * @property {number} gradient The gradient of the line.
 * @property {function} _interpolate Function for calculating the current time to sleep (either from TX index, or from the elapsed time).
 *
 * @extends RateInterface
 */
class LinearRateController extends RateInterface {
    /**
     * Initializes the rate controller instance.
     * @param {TestMessage} testMessage The testMessage passed for the round execution
     * @param {TransactionStatisticsCollector} stats The TX stats collector instance.
     * @param {number} workerIndex The 0-based index of the worker node.
     * @param {number} roundIndex The 0-based index of the current round.
     * @param {number} numberOfWorkers The total number of worker nodes.
     * @param {object} roundConfig The round configuration object.
     */
    constructor(testMessage, stats, workerIndex) {
        super(testMessage, stats, workerIndex);

        // distributing TPS among workers
        let startingTps = Number(this.options.startingTps) / this.numberOfWorkers;
        let finishingTps = Number(this.options.finishingTps) / this.numberOfWorkers;
        this.startingSleepTime = 1000 / startingTps;
        let finishingSleepTime = 1000 / finishingTps;

        // based on linear interpolation between two points with (time/index, sleep time) axes
        let duration = this.testMessage.getNumberOfTxs() || (this.testMessage.getRoundDuration() * 1000);
        this.gradient = (finishingSleepTime - this.startingSleepTime) / duration;

        // to avoid constant if/else check with the same result
        this._interpolate = this.testMessage.getNumberOfTxs() ? this._interpolateFromIndex : this._interpolateFromTime;
    }

    /**
     * Interpolates the current sleep time from the transaction index.
     * @return {number} The interpolated sleep time.
     */
    _interpolateFromIndex() {
        return this.startingSleepTime + this.stats.getTotalSubmittedTx() * this.gradient;
    }

    /**
     * Interpolates the current sleep time from the elapsed time.
     * @return {number} The interpolated sleep time.
     */
    _interpolateFromTime() {
        return this.startingSleepTime + (Date.now() - this.stats.getRoundStartTime()) * this.gradient;
    }

    /**
     * Perform the rate control action by blocking the execution for a certain amount of time.
     * @async
     */
    async applyRateControl() {
        let currentSleepTime = this._interpolate();
        if (currentSleepTime > 5) {
            await Sleep(currentSleepTime);
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
    return new LinearRateController(testMessage, stats, workerIndex);
}

module.exports.createRateController = createRateController;
