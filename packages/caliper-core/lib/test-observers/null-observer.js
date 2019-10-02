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

const TestObserverInterface = require('./observer-interface');
const Utils = require('../utils/caliper-utils');
const Logger = Utils.getLogger('null-observer');

/**
 * NullObserver class used to omit test statistics observation
 */
class NullObserver extends TestObserverInterface {

    /**
     * Constructor
     * @param {String} configPath path of the configuration file
     */
    constructor(configPath) {
        super(configPath);
        Logger.info('Configured observer');
    }

    /**
     * Perform an update
     */
    async update() {
        // No action
        Logger.debug('No action taken by NullObserver on update');
    }

    /**
     * Start observing the test output
     * @param {ClientOrchestrator} clientOrchestrator  the client orchestrator
     */
    startWatch(clientOrchestrator) {
        Logger.debug('No action taken by NullObserver on startWatch');
    }

    /**
     * Stop watching the test output
     * @async
     */
    async stopWatch() {
        Logger.debug('No action taken by NullObserver on stopWatch');
    }

    /**
     * Set the test name to be reported
     * @param {String} name the benchmark name
     */
    setBenchmark(name) {
        Logger.debug('No action taken by NullObserver on setBenchmark');
    }
    /**
     * Set the test round for the watcher
     * @param{*} roundIdx the round index
     */
    setRound(roundIdx) {
        Logger.debug('No action taken by NullObserver on setRound');
    }

}

/**
 * Creates a new rate controller instance.
 * @param {String} absConfigFile The absolute path to the benchmark config file
 * @return {ObserverInterface} The rate controller instance.
 */
function createTestObserver(absConfigFile) {
    return new NullObserver(absConfigFile);
}

module.exports.createTestObserver = createTestObserver;
