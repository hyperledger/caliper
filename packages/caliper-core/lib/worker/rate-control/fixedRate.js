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

let RateInterface = require('./rateInterface.js');
let Sleep = require('../../common/utils/caliper-utils').sleep;

/**
 * Rate controller that sends transactions at a fixed rate.
 *
 * @property {number} sleepTime The number of milliseconds to sleep to keep the specified TX sending rate.
 *
 * @extends RateInterface
 *
*/
class FixedRate extends RateInterface {

    /**
     * Initializes the rate controller instance.
     * @param {TestMessage} testMessage start test message
     * @param {TransactionStatisticsCollector} stats The TX stats collector instance.
     * @param {number} workerIndex The 0-based index of the worker node.
     */
    constructor(testMessage, stats, workerIndex) {
        super(testMessage, stats, workerIndex);

        const tps = this.options.tps ? this.options.tps : 10;
        const tpsPerWorker = tps / this.numberOfWorkers;
        this.sleepTime = (tpsPerWorker > 0) ? 1000/tpsPerWorker : 0;
    }

    /**
     * Perform the rate control action by blocking the execution for a certain amount of time.
     * @async
     */
    async applyRateControl() {
        if (this.sleepTime === 0) {
            return;
        }

        const totalSubmitted = this.stats.getTotalSubmittedTx();
        const diff = (this.sleepTime * totalSubmitted - (Date.now() - this.stats.getRoundStartTime()));
        await Sleep(diff);
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
    return new FixedRate(testMessage, stats, workerIndex);
}

module.exports.createRateController = createRateController;
