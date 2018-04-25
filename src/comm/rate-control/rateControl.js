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

let RateControl = class {
    constructor(rateControl, blockchain) {
        console.log('*****', rateControl);
        switch (rateControl.type) {
            case 'fixed-rate':
                const interval = require('./fixedRate.js');
                this.controller = new interval(blockchain, rateControl.opts);
                break;
            case 'composite-rate':
                const CompositeRateController = require('./compositeRate.js');
                this.controller = new CompositeRateController(blockchain, rateControl.opts);
                break;
            case 'no-rate':
                const NoRateController = require('./noRate.js');
                this.controller = new NoRateController(blockchain, rateControl.opts);
                break;
            default:
                throw new Error('Unknown rate control type ' + rateControl.type);
        }
    }

    /**
     * Initialise the rate controller with a passed msg object
     * @param msg
     * @return {Promise}
     */
    init(msg) {
        return this.controller.init(msg);
    }

    /**
     * Perform the rate control action based on knowledge of the start time, current index, and current results.
     * @param {*} start
     * @param {*} idx
     * @param {*} results
     * @return Promise
     */
    applyRateControl(start, idx, results) {
        return this.controller.applyRateControl(start, idx, results);
    }

};

module.exports = RateControl;