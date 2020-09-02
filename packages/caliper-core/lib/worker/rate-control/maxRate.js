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
const Logger = require('../../common/utils/caliper-utils').getLogger('maxRate.js');

/**
 * Rate controller for driving at a maximum TPS. This controller will aim to steadily increase the driven TPS to the maximum
 * sustainable rate
 *
 * @property {number} sampleInterval The interval over which to assess if the driven TPS should be stepped up/down, in seconds
 * @property {boolean} includeFailed A flag to indicate if failed transactions should be considered when assessing the rate change, default true
 * @property {number} step The TPS step size used to increase/decrease TPS rate, default 5
 * @property {object} observedTPS Object used to record TPS measurements between the sampleInterval
 * @property {object} tpsSettings Object used to record TPS settings between the sampleInterval
 * @property {object} internalStats Object used to record TPS statistics between the sampleInterval
 *
 * @extends RateInterface
 */
class MaxRate extends RateInterface {

    /**
     * Initializes the rate controller instance.
     * @param {TestMessage} testMessage start test message
     * @param {TransactionStatisticsCollector} stats The TX stats collector instance.
     * @param {number} workerIndex The 0-based index of the worker node.
     */
    constructor(testMessage, stats, workerIndex) {
        super(testMessage, stats, workerIndex);

        // Minimum sample interval (default 10s)
        this.sampleInterval = this.options.sampleInterval ? parseInt(this.options.sampleInterval) * 1000 : 10000;

        // Include failed transactions in TPS
        this.includeFailed = this.options.includeFailed ? this.options.includeFailed : true;

        // Worker TPS
        const startTps = this.options.tps ? this.options.tps : 5;
        const startTpsPerWorker = startTps / this.numberOfWorkers;

        // Worker TPS Step
        const tpsStep = this.options.step ? this.options.step : 5;
        this.step = tpsStep / this.numberOfWorkers;

        // Object for TPS observations
        this.observedTPS = {
            previous: 0,
            current: 0
        };

        // Object for TPS settings
        this.tpsSettings = {
            previous: startTpsPerWorker,
            current: startTpsPerWorker
        };

        // Object for observed stats
        this.internalStats = {
            previousCompletedTotal: 0,
            currentCompletedTotal: 0,
            previousElapsedTime: 0,
            currentElapsedTime: 0,
            lastUpdate: 0
        };
    }

    /**
    * Perform the rate control action
    * @async
    */
    async applyRateControl() {

        // Waiting until transactions have completed.
        if (this.stats.getTotalFinishedTx() === 0) {
            await this.applySleepInterval();
            return;
        } else {
            // First entry
            if (this.internalStats.lastUpdate === 0) {
                this.internalStats.lastUpdate = Date.now();
            }

            // Have we waited the required sample interval?
            if (this.exceededSampleInterval()) {
                let currentCompletedTotal;
                if (this.includeFailed) {
                    currentCompletedTotal = this.stats.getTotalSuccessfulTx() + this.stats.getTotalFailedTx();
                } else {
                    currentCompletedTotal = this.stats.getTotalSuccessfulTx();
                }

                let currentElapsedTime;
                if (this.includeFailed) {
                    currentElapsedTime = this.stats.getTotalLatencyForSuccessful() + this.stats.getTotalLatencyForFailed();
                } else {
                    currentElapsedTime = this.stats.getTotalLatencyForSuccessful();
                }

                this.internalStats.currentCompletedTotal = currentCompletedTotal;
                this.internalStats.currentElapsedTime = currentElapsedTime;

                const achievedTPS = this.retrieveIntervalTPS();

                // New TPS results
                this.observedTPS.previous = this.observedTPS.current;
                this.observedTPS.current = achievedTPS;

                Logger.debug(`Observed current worker TPS ${this.observedTPS.current}`);
                Logger.debug(`Observed previous worker TPS ${this.observedTPS.previous}`);

                // Action based on transaction rate trajectory (+/-)
                const dTxn = this.observedTPS.current - this.observedTPS.previous;
                this.tpsSettings.previous = this.tpsSettings.current;
                if (dTxn > 0) {
                    // Keep ramping, try for the new max!
                    this.tpsSettings.current = this.tpsSettings.current + this.step;
                    Logger.debug(`Increased worker TPS to ${this.tpsSettings.current}`);
                } else {
                    // Too far, back off and try smaller step size. Need to ensure we drain the backlog too.
                    this.tpsSettings.current = this.tpsSettings.current - this.step;
                    this.step = this.step > 0.2 ? this.step / 2 : this.step;
                    Logger.debug(`Decreased worker TPS to ${this.tpsSettings.current} and step size to ${this.step}`);
                }

                // update internal stats
                this.internalStats.lastUpdate = Date.now();
                this.internalStats.previousCompletedTotal = currentCompletedTotal;
                this.internalStats.previousElapsedTime = currentElapsedTime;
            }

        }

        // Continue at fixed TPS within this update interval
        await this.applySleepInterval();
    }

    /**
     * Check if required sample time has been reached
     * @returns {boolean} boolean flag
     */
    exceededSampleInterval() {
        return Date.now() - this.internalStats.lastUpdate >= this.sampleInterval;
    }

    /**
     * TPS from the completed interval statistics
     * @return {number} the TPS within the interval
     */
    retrieveIntervalTPS() {
        const intervalCompleted = this.internalStats.currentCompletedTotal - this.internalStats.previousCompletedTotal;
        const intervalLatency = (this.internalStats.currentElapsedTime - this.internalStats.previousElapsedTime) / 1000;
        return intervalCompleted / intervalLatency;
    }

    /**
     * Apply the worker TPS
     */
    async applySleepInterval() {
        const sleepTime = 1000 / this.tpsSettings.current;
        await Sleep(sleepTime);
    }

    /**
     * Notify the rate controller about the end of the round.
     * @async
     */
    async end() {
        Logger.info(`End worker TPS ${this.tpsSettings.current}`);
    }
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
    return new MaxRate(testMessage, stats, workerIndex);
}

module.exports.createRateController = createRateController;
