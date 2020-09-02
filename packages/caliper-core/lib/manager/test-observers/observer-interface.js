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

const logger = require('../../common/utils/caliper-utils').getLogger('observer-base');

/**
 * Interface of test observer. Test observer implementations must follow a naming convention that is <type>-observer.js so
 * that they may be dynamically loaded in the RoundOrchestrator
 */
class TestObserverInterface {

    /**
     * Constructor
     */
    constructor() {
    }

    /**
     * Logs and throws a "not implemented" error for the given function.
     * @param {string} functionName The name of the function.
     * @private
     */
    _throwNotImplementedError(functionName) {
        let msg = `The function "${functionName}" is not implemented for this test observer`;
        logger.error(msg);
        throw new Error(msg);
    }

    /**
     * Perform an update
     * @async
     */
    async update() {
        this._throwNotImplementedError('update');
    }

    /**
     * Start watching the test output from the orchestrator
     * @param {WorkerOrchestrator} workerOrchestrator  the worker orchestrator
     */
    startWatch(workerOrchestrator) {
        this._throwNotImplementedError('startWatch');
    }

    /**
     * Stop watching the test output from the orchestrator
     * @async
     */
    async stopWatch() {
        this._throwNotImplementedError('stopWatch');
    }

    /**
     * Set the test name to be reported
     * @param {String} name the benchmark name
     */
    setBenchmark(name) {
        this._throwNotImplementedError('setBenchmark');
    }

    /**
     * Set the test round for the observer
     * @param{*} roundIdx the round index
     */
    setRound(roundIdx) {
        this._throwNotImplementedError('setRound');
    }

    /**
     * Called when new TX stats are available.
     * @param {TransactionStatisticsCollector} stats The TX stats collector instance.
     */
    txUpdateArrived(stats) {
        this._throwNotImplementedError('txUpdateArrived');
    }

}

module.exports = TestObserverInterface;
