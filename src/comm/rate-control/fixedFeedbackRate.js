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
const util = require('../util');

/**
 * This controller will send transactions at a specified fixed interval,
 * but when too many transactions are unfinished, it will sleep a period
 * of time.
 */
class FixedFeedbackRateController extends RateInterface{
    /**
     * Constructor
     * @param {Object} blockchain the blockchain under test
     * @param {JSON} opts the configuration options
     */
    constructor(blockchain, opts) {
        super(blockchain, opts);
    }

    /**
     * Initialise the rate controller with a passed msg object
     * - Only require the desired TPS from the standard msg options
     * @param {JSON} msg the initialisation message
     */
    init(msg) {
        const tps = this.options.tps;
        const tpsPerClient = msg.totalClients ? (tps / msg.totalClients) : tps;
        this.sleepTime = (tpsPerClient > 0) ? 1000/tpsPerClient : 0;

        this.sleep_time = this.options.sleep_time ? this.options.sleep_time : 100;
        this.unfinished_per_client = this.options.unfinished_per_client ? this.options.unfinished_per_client : 7000;
        this.zero_succ_count = 0;

        this.total_sleep_time = 0;
    }

    /**
    * Perform the rate control action based on knowledge of the start time, current index, and current results.Sleep a suitable time
    * @param {number} start, generation time of the first test transaction
    * @param {number} idx, sequence number of the current test transaction
    * @param {Array} currentResults, current result set
    * @param {Array} resultStats, result status set
    * @return {promise} the return promise
    */
    async applyRateControl(start, idx, currentResults, resultStats) {
        if(this.sleepTime === 0 || idx < this.unfinished_per_client) {
            return;
        }

        let diff = (this.sleepTime * idx - ((Date.now() - this.total_sleep_time) - start));
        if( diff > 5) {
            return await util.sleep(diff);
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
                    return await util.sleep(i * this.sleep_time);
                }
            }
        }
        this.zero_succ_count = 0;

        // Determines the sleep time according to the current number of
        // unfinished transactions with the configure one.
        for(let i = 10; i > 0; --i) {
            if(unfinished >= i * this.unfinished_per_client) {
                this.total_sleep_time += i * this.sleep_time;
                return await util.sleep(i * this.sleep_time);
            }
        }
        return;
    }
}

module.exports = FixedFeedbackRateController;
