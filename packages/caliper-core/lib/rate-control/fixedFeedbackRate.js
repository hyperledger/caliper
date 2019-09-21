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
const util = require('../utils/caliper-utils');

/**
 * This controller will send transactions at a specified fixed interval,
 * but when too many transactions are unfinished, it will sleep a period
 * of time.
 */
class FixedFeedbackRateController extends RateInterface{
    /**
     * Creates a new instance of the FixedFeedbackRateController class.
     * @constructor
     * @param {object} opts Options for the rate controller.
     */
    constructor(opts) {
        super(opts);
    }

    /**
     * Initializes the rate controller.
     * Only requires the desired TPS from the options.
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
     *
     * @async
     */
    async init(msg) {
        const tps = this.options.tps;
        const tpsPerClient = msg.totalClients ? (tps / msg.totalClients) : tps;
        this.sleepTime = (tpsPerClient > 0) ? 1000/tpsPerClient : 0;

        this.sleep_time = this.options.sleep_time ? this.options.sleep_time : 100;
        this.unfinished_per_client = this.options.unfinished_per_client ? this.options.unfinished_per_client : 7000;
        this.zero_succ_count = 0;

        this.total_sleep_time = 0;
    }

    /**
    * Perform the rate control action based on knowledge of the start time, current index, and current results. Sleeps a suitable time.
     * @param {number} start The epoch time at the start of the round (ms precision).
     * @param {number} idx Sequence number of the current transaction.
     * @param {object[]} recentResults The list of results of recent transactions.
     * @param {object[]} resultStats The aggregated stats of previous results.
     * @async
    */
    async applyRateControl(start, idx, recentResults, resultStats) {
        if(this.sleepTime === 0 || idx < this.unfinished_per_client) {
            return;
        }

        let diff = (this.sleepTime * idx - ((Date.now() - this.total_sleep_time) - start));
        if( diff > 5) {
            await util.sleep(diff);
            return;
        }

        if(resultStats.length === 0) {
            return;
        }

        let stats = resultStats[0];
        let unfinished = idx - (stats.succ + stats.fail);

        if(unfinished < this.unfinished_per_client / 2) {
            return;
        }
        // Determines the sleep time for waiting until
        // successful transactions occure.
        if(resultStats.length > 1 && resultStats[1].succ === 0) {
            this.zero_succ_count++;
            for(let i = 30; i > 0; --i) {
                if(this.zero_succ_count >= i) {
                    this.total_sleep_time += i * this.sleep_time;
                    await util.sleep(i * this.sleep_time);
                    return;
                }
            }
        }
        this.zero_succ_count = 0;

        // Determines the sleep time according to the current number of
        // unfinished transactions with the configure one.
        for(let i = 10; i > 0; --i) {
            if(unfinished >= i * this.unfinished_per_client) {
                this.total_sleep_time += i * this.sleep_time;
                await util.sleep(i * this.sleep_time);
                return;
            }
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
 * @param {object} opts The rate controller options.
 * @param {number} clientIdx The 0-based index of the client who instantiates the controller.
 * @param {number} roundIdx The 1-based index of the round the controller is instantiated in.
 * @return {RateInterface} The rate controller instance.
 */
function createRateController(opts, clientIdx, roundIdx) {
    return new FixedFeedbackRateController(opts);
}

module.exports.createRateController = createRateController;
