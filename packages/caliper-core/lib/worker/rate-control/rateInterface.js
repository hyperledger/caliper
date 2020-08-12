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

/**
 * Base class for rate controllers.
 */
class RateInterface {

    /**
     * Initializes the rate controller instance.
     * @param {TestMessage} testMessage The testMessage passed for the round execution
     * @param {TransactionStatisticsCollector} stats The TX stats collector instance.
     * @param {number} workerIndex The 0-based index of the worker node.
     */
    constructor(testMessage, stats, workerIndex) {
        this.testMessage = testMessage;
        this.stats = stats;
        this.workerIndex = workerIndex;
        this.controller = testMessage.getRateControlSpec();
        this.options = this.controller.opts;
        this.roundIndex = testMessage.getRoundIndex();
        this.roundLabel = testMessage.getRoundLabel();
        this.numberOfWorkers = testMessage.getWorkersNumber();
    }

    /**
     * Perform the rate control action by blocking the execution for a certain amount of time.
     * @async
     */
    async applyRateControl() {
        throw new Error('Method \'applyRateControl\' is not implemented for this rate controller');
    }

    /**
     * Notify the rate controller about the end of the round.
     * @async
     */
    async end() {
        throw new Error('Method \'end\' is not implemented for this rate controller');
    }
}

module.exports = RateInterface;
