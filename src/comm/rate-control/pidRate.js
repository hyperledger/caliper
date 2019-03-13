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
const Sleep = require('../util').sleep;
const Logger = require('../util').getLogger('pidRate.js');

/**
 * Basic PID Controller for driving at a target loading (backlog transactions). This controller will aim to maintain a defined backlog
 * of transactions by modifying the driven TPS.
 *
 * The target loading, initial TPS rate and gains for the controller must be specified within the options for the controller type:
 * "rateControl" : [{"type": "pid-rate", "opts": {"targetLoad": 5, "initialTPS": 2, "proportional": 0.2, "integral": 0.0001, "derrivative": 0.1}}]
 *
 * To view controller output to assist in modifying the controller gains, an additional 'showVars' option must be specified:
 * "rateControl" : [{"type": "pid-rate", "opts": {"targetLoad": 5, "initialTPS": 2, "proportional": 0.2, "integral": 0.0001, "derrivative": 0.1, "showVars": true}}]
 *
 */
class PidRate extends RateInterface {

    /**
     * Creates a new instance of the PidRate class.
     * @constructor
     * @param {object} opts Options for the rate controller.
     */
    constructor(opts) {
        super(opts);
    }

    /**
     * Initializes the rate controller.
     *
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
     * @param {object} msg.clientargs Arguments for the client.
     * @param {number} msg.clientIdx The 0-based index of the current client.
     * @param {number} msg.roundIdx The 1-based index of the current round.
     * @async
     */
    async init(msg) {
        // Required
        this.targetLoad = this.options.targetLoad;
        this.Kp = this.options.proportional;
        this.Ki = this.options.integral;
        this.Kd = this.options.derrivative;

        // Optional
        this.sleep = this.options.initialTPS ? 1000/this.options.initialTPS : 100;
        this.showVars = this.options.showVars ? this.options.showVars : false;

        // Internal variables
        this.previousError = this.targetLoad;
        this.integral = 0;
    }

    /**
    * Perform the rate control action based on knowledge of the start time, current index, and current results.
    * - Sleep based on targeting a specific working load through a basic PID controller
     * @param {number} start The epoch time at the start of the round (ms precision).
     * @param {number} idx Sequence number of the current transaction.
     * @param {object[]} recentResults The list of results of recent transactions.
     * @param {object[]} resultStats The aggregated stats of previous results.
     * @async
    */
    async applyRateControl(start, idx, recentResults, resultStats) {
        // We steer the load by increasing/decreasing the sleep time to adjust the TPS using a basic PID controller
        // We will only observe currentResults growth once the txn is complete and a result is available
        // -at this point the txn will either be in state success/fail

        // Update current transaction backlog error
        // error = what you want - what you have
        let error = this.targetLoad - recentResults.length;

        if (this.showVars) {
            Logger.debug('Current load error: ', error);
        }

        // Determine Controller Coeffients
        this.integral = this.integral + (error * this.sleep/1000);
        let P = this.Kp * error;
        let I = this.Ki * this.integral;
        let D = this.Kd * (error - this.previousError)/this.sleep;

        // Update error variable
        this.previousError = error;

        // Update the sleep time
        this.sleep = this.sleep - (P + I + D);

        if (this.showVars) {
            Logger.debug('Current P value: ', P);
            Logger.debug('Current I value: ', I);
            Logger.debug('Current D value: ', D);
            Logger.debug('New sleep time: ', this.sleep);
        }

        if (this.sleep > 5) {
            await Sleep(this.sleep);
        }
    }

    /**
     * Notify the rate controller about the end of the round.
     * @async
     */
    async end() { }
}

/**
 * Creates a new rate controller instance.
 * @constructor
 * @param {object} opts The rate controller options.
 * @param {number} clientIdx The 0-based index of the client who instantiates the controller.
 * @param {number} roundIdx The 1-based index of the round the controller is instantiated in.
 * @return {RateInterface} The rate controller instance.
 */
function createRateController(opts, clientIdx, roundIdx) {
    return new PidRate(opts);
}

module.exports.createRateController = createRateController;
