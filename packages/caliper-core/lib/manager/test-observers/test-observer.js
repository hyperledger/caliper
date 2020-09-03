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

const CaliperUtils = require('../../common/utils/caliper-utils');
const ConfigUtil = require('../../common/config/config-util');
const Logger = CaliperUtils.getLogger('testObserver.js');

const builtInObservers = new Map([
    ['none', './null-observer'],
    ['default', './default-observer.js']
]);

const TestObserver = class {

    /**
     * Instantiates the proxy test observer and creates the configured observer behind it.
     */
    constructor() {
        // Test observer is dynamically loaded, based on progress reporting configuration
        const observerType = ConfigUtil.get(ConfigUtil.keys.Progress.Reporting.Enabled) ? 'default' : 'none';

        Logger.debug(`Creating test observer of type "${observerType}"`);

        // resolve the type to a module path
        let modulePath = builtInObservers.has(observerType)
            ? builtInObservers.get(observerType) : CaliperUtils.resolvePath(observerType); // TODO: what if it's an external module name?

        let factoryFunction = require(modulePath).createTestObserver;
        if (!factoryFunction) {
            throw new Error(`${observerType} does not export the mandatory factory function 'createTestObserver'`);
        }

        this.observer = factoryFunction();
    }

    /**
     * Perform an update
     * @async
     */
    async update() {
        await this.observer.update();
    }

    /**
     * Start watching the test output from the orchestrator
     * @param {WorkerOrchestrator} workerOrchestrator  the worker orchestrator
     */
    startWatch(workerOrchestrator) {
        this.observer.startWatch(workerOrchestrator);
    }

    /**
     * Stop watching the test output from the orchestrator
     * @async
     */
    async stopWatch() {
        await this.observer.stopWatch();
    }

    /**
     * Set the test name to be reported
     * @param {String} name the benchmark name
     */
    setBenchmark(name) {
        this.observer.setBenchmark(name);
    }

    /**
     * Set the test round for the observer
     * @param{*} roundIdx the round index
     */
    setRound(roundIdx) {
        this.observer.setRound(roundIdx);
    }

    /**
     * Called when new TX stats are available.
     * @param {TransactionStatisticsCollector} stats The TX stats collector instance.
     */
    txUpdateArrived(stats) {
        this.observer.txUpdateArrived(stats);
    }

};

module.exports = TestObserver;
