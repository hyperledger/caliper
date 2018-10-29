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
const Util = require('../util');
let logger = Util.getLogger('rateControl.js');

let RateControl = class {

    /**
     * Constructor for a modularisable rate control mechanism
     * @param {String} rateControl the rate control type to use
     * @param {Object} blockchain the blockcahin under test
     */
    constructor(rateControl, blockchain) {
        logger.debug('*****', rateControl);
        switch (rateControl.type) {
        case 'fixed-rate': {
            let interval = require('./fixedRate.js');
            this.controller = new interval(blockchain, rateControl.opts);
            break;
        }
        case 'pid-rate': {
            let interval = require('./pidRate.js');
            this.controller = new interval(blockchain, rateControl.opts);
            break;
        }
        case 'composite-rate': {
            const CompositeRateController = require('./compositeRate.js');
            this.controller = new CompositeRateController(blockchain, rateControl.opts);
            break;
        }
        case 'zero-rate': {
            const NoRateController = require('./noRate.js');
            this.controller = new NoRateController(blockchain, rateControl.opts);
            break;
        }
        case 'record-rate': {
            const RecordRateController = require('./recordRate.js');
            this.controller = new RecordRateController(blockchain, rateControl.opts);
            break;
        }
        case 'replay-rate': {
            const ReplayRateController = require('./replayRate.js');
            this.controller = new ReplayRateController(blockchain, rateControl.opts);
            break;
        }
        case 'linear-rate': {
            const LinearRateController = require('./linearRate.js');
            this.controller = new LinearRateController(blockchain, rateControl.opts);
            break;
        }
        case 'fixed-feedback-rate': {
            const FixedFeedbackRateController = require('./fixedFeedbackRate.js');
            this.controller = new FixedFeedbackRateController(blockchain, rateControl.opts);
            break;
        }
        default:
            throw new Error('Unknown rate control type ' + rateControl.type);
        }
    }

    /**
    * Initialise the rate controller with a passed msg object
    * @param {JSON} msg the JSON initialise message for the controller
    * @return {Promise} the return promise
    */
    init(msg) {
        return this.controller.init(msg);
    }

    /**
     * Perform the rate control action based on knowledge of the start time, current index, and current results.
     * @param {Number} start the start time
     * @param {Number} idx current transaction index
     * @param {Object[]} results current array of results
     * @param {Array} resultStats, result status set
     * @return {Promise} the return promise
     */
    applyRateControl(start, idx, results, resultStats) {
        return this.controller.applyRateControl(start, idx, results, resultStats);
    }

    /**
     * Notify the rate controller about the end of the round.
     *
     * @return {Promise} The return promise.
     */
    end() {
        if (typeof this.controller.end === 'function') {
            return this.controller.end();
        }
    }
};

module.exports = RateControl;
