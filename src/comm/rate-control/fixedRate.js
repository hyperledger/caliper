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

var RateInterface = require('./rateInterface.js')

class FixedRate extends RateInterface {
    constructor(blockchain, opts) {
        super(blockchain, opts);
    }

    /**
     * Initialise the rate controller with a passed msg object
     * - Only require the desired TPS from the standard msg options
     * @param {*} msg 
     */
    init(msg) {
        const tps = this.options.tps;
        const tpsPerClient = msg.totalClients ? (tps / msg.totalClients) : tps;
        this.sleepTime = (tpsPerClient > 0) ? 1000/tpsPerClient : 0;
    }

    /**
    * Perform the rate control action based on knowledge of the start time, current index, and current results.
    * - Sleep a suitable time according to the required transaction generation time
    * @param start {number}, generation time of the first test transaction
    * @param txSeq {number}, sequence number of the current test transaction
    * @param currentResults {Array}, current result set
    * @return {promise}
    */
    applyRateControl(start, idx, currentResults) {
        if(this.sleepTime === 0) {
            return Promise.resolve();
        }
        var diff = (this.sleepTime * idx - (Date.now() - start));
        if( diff > 5) {
            return new Promise(resolve => setTimeout(resolve, diff));
        }
        else {
            return Promise.resolve();
        }
    }
}

module.exports = FixedRate;