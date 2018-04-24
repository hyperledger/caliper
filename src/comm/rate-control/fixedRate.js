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

let RateInterface = require('./rateInterface.js');
let Sleep = require('../util').sleep;

/**
 * This controller will send transactions at a specified fixed interval.
 *
 * The TPS rate must be specified within the options for the controller type:
 * "rateControl" : [{"type": "fixed-rate", "opts": {"tps" : 10}}]
 *
 */
class FixedRate extends RateInterface {

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
     * @param {JSON} msg the initialisation message
     */
    init(msg) {
        // Use the passed tps option
        const tps = this.options.tps;
        const tpsPerClient = msg.totalClients ? (tps / msg.totalClients) : tps;
        this.sleepTime = (tpsPerClient > 0) ? 1000/tpsPerClient : 0;
    }

    /**
    * Perform the rate control action based on knowledge of the start time, current index, and current results.
    * - Sleep a suitable time according to the required transaction generation time
    * @param {Number} start generation time of the first test transaction
    * @param {Number} idx sequence number of the current test transaction
    * @param {Object[]} currentResults current result set
    * @return {Promise} the return promise
    */
    applyRateControl(start, idx, currentResults) {
        if(this.sleepTime === 0) {
            return Promise.resolve();
        }
        let diff = (this.sleepTime * idx - (Date.now() - start));
        if( diff > 5) {
            return Sleep(diff);
        }
        else {
            return Promise.resolve();
        }
    }
}

module.exports = FixedRate;