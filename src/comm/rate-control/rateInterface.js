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

/**
 * Rate interface for creating rate controllers
 */
class RateInterface {

    /**
     * Main consrtuctor
     * @param {Object} blockchain the blockchain under test
     * @param {JSON} opts confituration options
     */
    constructor(blockchain, opts) {
        this.blockchain = blockchain;
        this.options = opts;
    }

    /**
     * Initialise the rate controller with a passed msg object
     * @param {JSON} msg the JSON initilise message
     */
    init(msg) {
        throw new Error('init is not implemented for this blockchain system');
    }

    /**
     * Perform the rate control action based on knowledge of the start time, current index, and current results.
     * @param {Number} start the start time
     * @param {Number} idx current transaction index
     * @param {Object[]} results current array of results
     * @param {Array} resultStats, result status set
     */
    applyRateControl(start, idx, results, resultStats) {
        throw new Error('applyRateControl is not implemented for this blockchain system');
    }
}

module.exports = RateInterface;
