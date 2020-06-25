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
 * Rate controller for driving at a maximum TPS.
 */
class MaxRate extends RateInterface {
    /**
     * Creates a new instance of the MaxRate class.
     * @constructor
     * @param {object} opts Options for the rate controller.
     */
    constructor(opts) {
        super(opts);

        // Default sleep
        this.sleepTime = 100;

        // Map for TPS observations
        this.observedTPS = {
            previous: 0,
            current: 0
        };

        // Map for TPS settings
        this.tpsSettings = {
            previous: 0,
            current: 0
        };

        // MPS for observed stats
        this.statistics = {
            previous: [],
            current: [],
            sampleStart: 0
        };

        // Minimum sample interval (default 10s)
        this.sampleInterval = opts.sampleInterval ? opts.sampleInterval : 10;

        // Include failed transactions in TPS
        this.includeFailed = opts.includeFailed ? opts.includeFailed : true;
    }

    /**
     * Initialise the rate controller with a passed msg object
     * @param {object} msg Client options with adjusted per-client load settings.
     * @param {string} msg.type The type of the message. Currently always 'test'
     * @param {string} msg.label The label of the round.
     * @param {object} msg.rateControl The rate control to use for the round.
     * @param {number} msg.trim The number/seconds of transactions to trim from the results.
     * @param {object} msg.args The user supplied arguments for the round.
     * @param {string} msg.cb The path of the user's callback module.
     * @param {string} msg.config The path of the network's configuration file.
     * @param {number} msg.numb The number of transactions to generate during the round.
     * @param {number} msg.txDuration The length of the round in SECONDS.
     * @param {number} msg.totalClients The number of clients executing the round.
     * @param {number} msg.clients The number of clients executing the round.
     * @param {object} msg.clientArgs Arguments for the client.
     * @param {number} msg.clientIdx The 0-based index of the current client.
     * @param {number} msg.roundIdx The 1-based index of the current round.
     *
     * @async
     */
    async init(msg) {


        // Client TPS
        const startTps = this.options.tps ? this.options.tps : 5;
        const startTpsPerClient = msg.totalClients ? (startTps / msg.totalClients) : startTps;
        // - Store these
        this.tpsSettings.previous = startTpsPerClient;
        this.tpsSettings.current = startTpsPerClient;

        // Client TPS Step
        const tpsStep = this.options.step ? this.options.step : 5;
        this.step = msg.totalClients ? (tpsStep / msg.totalClients) : tpsStep;
    }

    /**
    * Perform the rate control action based on knowledge of the start time, current index, and current results.Sleep a suitable time
    * @param {number} start, generation time of the first test transaction (unused)
    * @param {number} idx, sequence number of the current test transaction
    * @param {Array} currentResults, current result set not yet reset by txUpdate() callback
    * @param {Array} resultStats, result status set formed in txUpdate() callback
    * @async
    */
    async applyRateControl(start, idx, currentResults, resultStats) {

        // Waiting until successful transactions occur.
        if (resultStats.length < 2 || !resultStats[0].succ || !resultStats[0].create || !resultStats[0].final) {
            await this.applySleepInterval();
            return;
        } else {
            // txUpdate intervals are the only places we can detect changes. This is refreshed, and at that point
            // minCreate will increase as we will be dealing with more recent submissions

            // First entry
            if (this.statistics.current.length === 0) {
                this.statistics.previous = resultStats[1];
                this.statistics.current = resultStats[1];
                this.statistics.sampleStart = resultStats[1].create.min;

                const achievedTPS = this.retrieveIntervalTPS(resultStats);
                this.observedTPS.current = achievedTPS;
            }

            // Only modify when result stats has been updated
            if (this.updateOccurred(resultStats)) {

                // Have we waited the required sample interval?
                if (this.exceededSampleInterval(resultStats)) {
                    this.statistics.current = resultStats[1];
                    this.statistics.sampleStart = resultStats[1].final.last;
                    const achievedTPS = this.retrieveIntervalTPS(resultStats);

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
                }
            }
        }

        // Continue at fixed TPS within this update interval
        await this.applySleepInterval();
    }

    /**
     * Check if a txUpdate has occurred
     * @param {object} resultStats the result statistics
     * @returns {boolean} update boolean
     */
    updateOccurred(resultStats) {
        return this.statistics.current.create.min !== resultStats[1].create.min;
    }

    /**
     * Check if required sample time has been reached
     * @param {object} resultStats the result statistics
     * @returns {boolean} boolean flag
     */
    exceededSampleInterval(resultStats) {
        return resultStats[1].final.last - this.statistics.sampleStart >= this.sampleInterval;
    }

    /**
     * TPS from the previous txUpdate interval statistics
     * @param {object} resultStats the passed stats object
     * @return {number} the TPS within the interval
     */
    retrieveIntervalTPS(resultStats) {
        const resultStatistics = resultStats[1];
        if (this.includeFailed) {
            return (resultStatistics.succ + resultStatistics.fail) / (resultStatistics.final.last - resultStatistics.create.min);
        } else {
            return resultStatistics.succ / (resultStatistics.final.last - resultStatistics.create.min);
        }
    }

    /**
     * Apply the client TPS
     */
    async applySleepInterval() {
        const sleepTime = 1000 / this.tpsSettings.current;
        await Sleep(sleepTime);
    }

    /**
     * Notify the rate controller about the end of the round.
     * @async
     */
    async end() { }
}


/**
 * Creates a new rate controller instance.
 * @param {object} opts The rate controller options.
 * @param {number} clientIdx The 0-based index of the client who instantiates the controller.
 * @param {number} roundIdx The 1-based index of the round the controller is instantiated in.
 * @return {RateInterface} The rate controller instance.
 */
function createRateController(opts, clientIdx, roundIdx) {
    return new MaxRate(opts);
}

module.exports.createRateController = createRateController;
