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
const Logger = require('../../common/utils/caliper-utils').getLogger('fixedBacklog.js');

/**
 * Rate controller for driving at a target loading (backlog transactions). This controller will aim to maintain a defined backlog
 * of unfinished transactions by modifying the driven TPS.
 */
class FixedBacklog extends RateInterface {
    /**
     * Creates a new instance of the FixedBacklog class.
     * @constructor
     * @param {object} opts Options for the rate controller.
     */
    constructor(opts) {
        super(opts);
    }

    /**
     * Initialise the rate controller with a passed msg object
     * - Only requires the desired cnumber of unfinished transactions per client
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
        let tps;
        if (this.options.startingTps) {
            tps = this.options.startingTps;
        } else {
            tps = 1;
        }
        const tpsPerClient = msg.totalClients ? (tps / msg.totalClients) : tps;
        this.sleepTime = 1000/tpsPerClient;
        this.unfinished_per_client = this.options.unfinished_per_client ? parseInt(this.options.unfinished_per_client) : 10;
    }

    /**
    * Perform the rate control action based on knowledge of the start time, current index, and current results.Sleep a suitable time
    * @param {number} start, generation time of the first test transaction
    * @param {number} idx, sequence number of the current test transaction
    * @param {Array} currentResults, current result set not yet reset by txUpdate() callback
    * @param {Array} resultStats, result status set formed in txUpdate() callback
    * @async
    */
    async applyRateControl(start, idx, currentResults, resultStats) {

        // Waiting until successful transactions occur.
        if(resultStats.length < 2 || !resultStats[0].succ || !resultStats[0].delay)  {
            await Sleep(this.sleepTime);
            return;
        }

        // Get transaction details
        const completeTransactions = resultStats[0].length + currentResults.length; // work from all processed results: resultStats[0]=all processed result stats
        let unfinished = idx - completeTransactions;

        // Shortcut if we are below the target threshold
        if(unfinished < this.unfinished_per_client) {
            return;
        }

        // Determines the sleep time according to the current number of
        // unfinished transactions with that in the config file
        const delay = resultStats[0].delay;
        const avDelay = ((delay.sum)/completeTransactions)*1000;
        const error = unfinished - this.unfinished_per_client;

        // Sleep for a count of the load error and the current average delay
        Logger.debug('Difference between current and desired transaction backlog: ' + error);
        await Sleep(error * avDelay);
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
    return new FixedBacklog(opts);
}

module.exports.createRateController = createRateController;
