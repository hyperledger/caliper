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
const Util = require('../utils/caliper-utils');

/**
 * Rate controller for pausing load generation for a given time.
 *
 * Can only be applied for duration-based rounds!
 *
 * @property {object} options The user-supplied options for the controller.
 */
class NoRateController extends RateInterface{
    /**
     * Creates a new instance of the {NoRateController} class.
     * @constructor
     * @param {object} opts Options for the rate controller.
     */
    constructor(opts) {
        super(opts);
        this.sleepTime = 0;
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
        if (msg.numb) {
            throw new Error('The no-rate controller can only be applied for duration-based rounds');
        }

        this.sleepTime = msg.txDuration * 1000;
    }

    /**
     * Perform the rate control by sleeping through the round.
     * @param {number} start The epoch time at the start of the round (ms precision).
     * @param {number} idx Sequence number of the current transaction.
     * @param {object[]} recentResults The list of results of recent transactions.
     * @param {object[]} resultStats The aggregated stats of previous results.
     * @async
     */
    async applyRateControl(start, idx, recentResults, resultStats) {
        await Util.sleep(this.sleepTime);
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
    return new NoRateController(opts);
}

module.exports.createRateController = createRateController;
