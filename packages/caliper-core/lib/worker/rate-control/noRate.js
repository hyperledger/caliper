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

/**
 * Rate controller for pausing load generation for a given time.
 * Can only be applied for duration-based rounds! Only meaningful as a sub-controller in a composite rate.
 *
 * @property {number} sleepTime The length of the round in milliseconds (i.e., the time to sleep).
 *
 * @extends RateInterface
 */
class NoRateController extends RateInterface {
    /**
     * Initializes the rate controller instance.
     * @param {TestMessage} testMessage start test message
     * @param {TransactionStatisticsCollector} stats The TX stats collector instance.
     * @param {number} workerIndex The 0-based index of the worker node.
     */
    constructor(testMessage, stats, workerIndex) {
        super(testMessage, stats, workerIndex);
        if (testMessage.getNumberOfTxs()) {
            throw new Error('The no-rate controller can only be applied for duration-based rounds');
        }

        this.sleepTime = testMessage.getRoundDuration() * 1000;
    }

    /**
     * Perform the rate control action by blocking the execution for a certain amount of time.
     * @async
     */
    async applyRateControl() {
        await Sleep(this.sleepTime);
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
    return new NoRateController(testMessage, stats, workerIndex);
}

module.exports.createRateController = createRateController;
