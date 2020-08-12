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
const RateInterface = require('./rateInterface');
const path = require('path');
const logger = CaliperUtils.getLogger('rateControl.js');

const builtInControllers = new Map([
    ['composite-rate', path.join(__dirname, 'compositeRate.js')],
    ['fixed-load', path.join(__dirname, 'fixedLoad.js')],
    ['fixed-feedback-rate', path.join(__dirname, 'fixedFeedbackRate.js')],
    ['fixed-rate', path.join(__dirname, 'fixedRate.js')],
    ['linear-rate', path.join(__dirname, 'linearRate.js')],
    ['maximum-rate', path.join(__dirname, 'maxRate.js')],
    ['zero-rate', path.join(__dirname, 'noRate.js')],
    ['record-rate', path.join(__dirname, 'recordRate.js')],
    ['replay-rate', path.join(__dirname, 'replayRate.js')]
]);

/**
 * Proxy class for creating and managing the configured rate controller.
 *
 * @property {RateInterface} controller The managed rate controller instance.
 *
 * @extends RateInterface
 */
class RateControl extends RateInterface {

    /**
     * Initializes the rate controller proxy.
     * @param {TestMessage} testMessage start test message
     * @param {TransactionStatisticsCollector} stats The TX stats collector instance.
     * @param {number} workerIndex The 0-based index of the worker node.
     */
    constructor(testMessage, stats, workerIndex) {
        super(testMessage, stats, workerIndex);

        logger.debug(`Creating rate controller of type ${testMessage.getRateControlSpec().type} for worker #${workerIndex} in round #${testMessage.getRoundIndex()}`, testMessage.getRateControlSpec());
        const factoryFunction = CaliperUtils.loadModuleFunction(builtInControllers, testMessage.getRateControlSpec().type, 'createRateController');
        if (!factoryFunction) {
            throw new Error(`${testMessage.getRateControlSpec().type} does not export the mandatory factory function`);
        }

        this.controller = factoryFunction(testMessage, stats, workerIndex);
    }

    /**
     * Perform the rate control action by blocking the execution for a certain amount of time.
     * Delegates to the underlying rate controller.
     * @async
     */
    async applyRateControl() {
        await this.controller.applyRateControl();
    }

    /**
     * Notify the rate controller about the end of the round.
     * Delegates to the underlying rate controller.
     * @async
     */
    async end() {
        await this.controller.end();
    }
}

module.exports = RateControl;
