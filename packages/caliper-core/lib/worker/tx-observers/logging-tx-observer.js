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

const TxObserverInterface = require('./tx-observer-interface');
const CaliperUtils = require('../../common/utils/caliper-utils');

/**
 * TX observer used to log every TX result to stdout in JSON format.
 *
 * @property {function} logFunction The configured logging function.
 */
class LoggingTxObserver extends TxObserverInterface{
    /**
     * Initializes the observer instance.
     * @param {object} options The log observer configuration object.
     * @param {MessengerInterface} messenger The worker messenger instance. Not used.
     * @param {number} workerIndex The 0-based index of the worker node.
     */
    constructor(options, messenger, workerIndex) {
        super(messenger, workerIndex);
        let logger = CaliperUtils.getLogger(options.loggerModuleName || 'txInfo');
        this.logFunction = logger[options.messageLevel || 'info'];
    }

    /**
     * Called when TXs are submitted. The observer ignores this event
     * @param {number} count The number of submitted TXs. Can be greater than one for a batch of TXs.
     */
    txSubmitted(count) { }

    /**
     * Called when TXs are finished. The observer logs the results in a stateless way (i.e., does not process them further).
     * @param {TxStatus | TxStatus[]} results The result information of the finished TXs. Can be a collection of results for a batch of TXs.
     */
    txFinished(results) {
        // TODO: appending metadata should be done by the dispatch
        if (Array.isArray(results)) {
            for (let result of results) {
                // add extra metadata
                result.workerIndex = this.workerIndex;
                result.roundIndex = this.roundIndex;

                // TODO: use fast-json-stringify
                this.logFunction(JSON.stringify(result));
            }
        } else {
            // add extra metadata
            results.workerIndex = this.workerIndex;
            results.roundIndex = this.roundIndex;

            // TODO: use fast-json-stringify
            this.logFunction(JSON.stringify(results));
        }
    }
}

/**
 * Factory function for creating a LoggingTxObserver instance.
 * @param {object} options The logging observer configuration object.
 * @param {MessengerInterface} messenger The worker messenger instance. Not used.
 * @param {number} workerIndex The 0-based index of the worker node.
 * @return {TxObserverInterface} The observer instance.
 */
function createTxObserver(options, messenger, workerIndex) {
    return new LoggingTxObserver(options, messenger, workerIndex);
}

module.exports.createTxObserver = createTxObserver;
