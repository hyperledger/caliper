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

'use strict'

class RateInterface {
    constructor(blockchain, opts) {
        this.blockchain = blockchain;
        this.options = opts;
    }

    /**
     * Initialise the rate controller with a passed msg object
     * @param {*} msg 
     */
    init(msg) {
        throw new Error('init is not implemented for this blockchain system');
    }    

    /**
     * Perform the rate control action based on knowledge of the start time, current index, and current results.
     * @param {*} start 
     * @param {*} idx 
     * @param {*} results 
     */
    applyRateControl(start, idx, results) {
        throw new Error('applyRateControl is not implemented for this blockchain system');
    }
}

module.exports = RateInterface;