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
const RateControl = require('./rateControl.js');
const TransactionStatisticsCollector = require('../../common/core/transaction-statistics-collector');
const logger = require('../../common/utils/caliper-utils').getLogger('composite-rate-controller');

/**
 * Encapsulates a controller and its scheduling information.
 *
 * @property {boolean} isLast Indicates whether the controller is the last in the round.
 * @property {RateControl} controller The controller instance.
 * @property {number} lastTxIndex The last TX index associated with the controller based on its weight. Only used in Tx number-based rounds.
 * @property {number} relFinishTime The finish time of the controller based on its weight, relative to the start time of the round. Only used in duration-based rounds.
 * @property {TransactionStatisticsCollector} txStatSubCollector The TX stat (sub-)collector associated with the sub-controller.
 */
class ControllerData {
    /**
     * Initialize a new instance of the ControllerData class.
     * @param {RateControl} controller The controller instance.
     * @param {TransactionStatisticsCollector} txStatSubCollector The TX stat (sub-)collector associated with the sub-controller.
     */
    constructor(controller, txStatSubCollector) {
        this.isLast = false;
        this.controller = controller;
        this.lastTxIndex = 0;
        this.relFinishTime = 0;
        this.txStatSubCollector = txStatSubCollector;
    }
}

/**
 * Composite rate controller for applying different rate controllers after one an other in the same round.
 *
 * @property {ControllerData[]} controllers The collection of relevant controllers and their scheduling information.
 * @property {number} activeControllerIndex The index of the currently active controller.
 * @property {function} controllerSwitch Duration-based or Tx number-based function for handling controller switches.
 *
 * @extends RateInterface
 */
class CompositeRateController extends RateInterface{
    /**
     * Initializes the rate controller instance.
     * @param {TestMessage} testMessage start test message
     * @param {TransactionStatisticsCollector} stats The TX stats collector instance.
     * @param {number} workerIndex The 0-based index of the worker node.
     */
    constructor(testMessage, stats, workerIndex) {
        super(testMessage, stats, workerIndex);

        this.controllers = [];
        this.activeControllerIndex = 0;
        this.controllerSwitch = null;

        this._prepareControllers();
    }

    /**
     * Internal method for preparing the sub-controllers and their scheduling information.
     * @private
     */
    _prepareControllers() {
        let weights = this.options.weights;
        let rateControllers = this.options.rateControllers;

        if (!Array.isArray(weights) || !Array.isArray(rateControllers)) {
            let msg = 'Weight and controller definitions must be arrays.';
            logger.error(msg);
            throw new Error(msg);
        }

        if (weights.length !== rateControllers.length) {
            let msg = 'The number of weights and controllers must be the same.';
            logger.error(msg);
            throw new Error(msg);
        }

        const nan = weights.find(w => isNaN(Number(w)));
        if (nan) {
            let msg = `Not-a-number element among weights: ${nan}`;
            logger.error(msg);
            throw new Error(msg);
        }

        // store them explicitly as numbers to avoid surprises later
        weights = weights.map(w => Number(w));

        // check for negative weights
        // zero weights should be fine to allow easy temporary removal of controllers from the config file
        const negativeWeight = weights.find(w => w < 0);
        if (negativeWeight) {
            let msg = `Negative element among weights: ${negativeWeight}`;
            logger.error(msg);
            throw new Error(msg);
        }

        // normalize weights
        const weightSum = weights.reduce((prev, w) => prev + w, 0);
        if (weightSum === 0) {
            let msg = 'Every weight is zero.';
            logger.error(msg);
            throw new Error(msg);
        }
        weights = weights.map(w => w / weightSum);

        // pre-set switch logic to avoid an other condition check during rate control
        this.controllerSwitch = this.roundConfig.txNumber ? this._controllerSwitchForTxNumber : this._controllerSwitchForDuration;

        let currentWeightSum = 0;
        // create controller instances, skip zero-weight cases
        for (let i = 0; i < weights.length; ++i) {
            if (weights[i] === 0) {
                continue;
            }

            let currentWeight = weights[i];
            let currentControllerOptions = rateControllers[i];

            currentWeightSum += currentWeight;

            // create a modified copy of the round configuration according to the weights
            let controllerRoundConfig = Object.assign({}, this.roundConfig);

            // lie to the sub-controller that it's the only one
            controllerRoundConfig.rateControl = currentControllerOptions;

            // create the sub-collector to be activated later, and add it to the current stats collector (which could be another sub-collector)
            let statSubCollector = new TransactionStatisticsCollector(this.workerIndex, this.roundIndex, this.roundLabel);
            this.stats.addSubCollector(statSubCollector);

            // scale down number of TXs or the duration
            if (this.roundConfig.txNumber) {
                controllerRoundConfig.txNumber = Math.floor(this.roundConfig.txNumber * currentWeight);

                // the sub-controller is initialized with the TX stat sub-collector, which is inactive at this point (i.e., the round hasn't started for it)
                let subcontroller = new RateControl(rateControllers[i], statSubCollector, this.workerIndex, this.roundIndex, this.numberOfWorkers, controllerRoundConfig);
                let controllerData = new ControllerData(subcontroller, statSubCollector);

                // the sub-controller should be switched after this TX index
                controllerData.lastTxIndex = Math.floor(this.roundConfig.txNumber * currentWeightSum);
                this.controllers.push(controllerData);
            } else {
                controllerRoundConfig.txDuration = Math.floor(this.roundConfig.txDuration * currentWeight);

                // the sub-controller is initialized with the TX stat sub-collector, which is inactive at this point (i.e., the round hasn't started for it)
                let subcontroller = new RateControl(rateControllers[i], statSubCollector, this.workerIndex, this.roundIndex, this.numberOfWorkers, controllerRoundConfig);
                let controllerData = new ControllerData(subcontroller, statSubCollector);

                // the sub-controller should be switched "around" this time
                controllerData.relFinishTime = Math.floor(this.roundConfig.txDuration * 1000 * currentWeightSum);
                this.controllers.push(controllerData);
            }
        }

        // mark the last controller
        this.controllers[this.controllers.length - 1].isLast = true;

        // activate the TX stats sub-collector of the first sub-controller, i.e., start the round for it (and the TX event processing)
        this.controllers[0].txStatSubCollector.activate();
    }

    /**
     * Internal method for switching controller (when needed) in a duration-based round.
     * @private
     * @async
     */
    async _controllerSwitchForDuration() {
        const roundStartTime = this.stats.getRoundStartTime();
        const currentIndex = this.stats.getTotalSubmittedTx();
        let active = this.controllers[this.activeControllerIndex];

        const timeNow = Date.now();
        // don't switch from the last controller, or if it isn't time yet
        if (active.isLast || ((timeNow - roundStartTime) < active.relFinishTime)) {
            return;
        }

        // clean up previous sub-controller and its TX stat collector
        active.txStatSubCollector.deactivate();
        await active.controller.end();

        // activate next sub-controller and its TX stat collector
        this.activeControllerIndex++;
        active = this.controllers[this.activeControllerIndex];
        active.txStatSubCollector.activate();

        logger.debug(`Switching controller in worker #${this.workerIndex} for round #${this.roundIndex} at TX #${currentIndex} after ${Date.now() - roundStartTime} ms.`);
    }

    /**
     * Internal method for switching controller (when needed) in a TX number-based round.
     * @private
     * @async
     */
    async _controllerSwitchForTxNumber() {
        const roundStartTime = this.stats.getRoundStartTime();
        const currentIndex = this.stats.getTotalSubmittedTx();
        let active = this.controllers[this.activeControllerIndex];

        // don't switch from the last controller, or if it isn't "time" yet
        if (active.isLast || (currentIndex <= active.lastTxIndex)) {
            return;
        }

        // clean up previous sub-controller and its TX stat collector
        active.txStatSubCollector.deactivate();
        await active.controller.end();

        // activate next sub-controller and its TX stat collector
        this.activeControllerIndex++;
        active = this.controllers[this.activeControllerIndex];
        active.txStatSubCollector.activate();

        logger.debug(`Switching controller in worker #${this.workerIndex} for round #${this.roundIndex} at TX #${currentIndex} after ${Date.now() - roundStartTime} ms.`);
    }

    /**
     * Perform the rate control action by blocking the execution for a certain amount of time.
     * Delegates to the currently active sub-controller.
     * @async
     */
    async applyRateControl() {
        await this.controllerSwitch();
        const active = this.controllers[this.activeControllerIndex];
        await active.controller.applyRateControl();
    }

    /**
     * Notify the rate controller about the end of the round.
     * @async
     */
    async end() {
        // deactivate the TX stats collector of the last controller
        this.controllers[this.activeControllerIndex].txStatSubCollector.deactivate();
        await this.controllers[this.activeControllerIndex].controller.end();
    }
}

/**
 * Factory for creating a new rate controller instance.
 * @param {TestMessage} testMessage start test message
 * @param {TransactionStatisticsCollector} stats The TX stats collector instance.
 * @param {number} workerIndex The 0-based index of the worker node.
 * @param {number} roundIndex The 0-based index of the current round.
 * @param {number} numberOfWorkers The total number of worker nodes.
 * @param {object} roundConfig The round configuration object.
 *
 * @return {RateInterface} The new rate controller instance.
 */
function createRateController(testMessage, stats, workerIndex) {
    return new CompositeRateController(testMessage, stats, workerIndex);
}

module.exports.createRateController = createRateController;
