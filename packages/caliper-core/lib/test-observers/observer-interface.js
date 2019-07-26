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

const Util = require('../utils/caliper-utils');

/**
 * Interface of test observer. Test observer implementations must follow a naming convention that is <type>-observer.js so
 * that they may be dynamically loaded within Caliper flow
 */
class TestObserverInterface {

    /**
     * Constructor
     * @param {string} configPath the config file path
     */
    constructor(configPath) {
        this.config = Util.parseYaml(configPath);
    }

    /**
     * Perform an update
     * @async
     */
    async update() {
        throw new Error('update is not implemented for this test observer');
    }

    /**
     * Start watching the test output from the orchestrator
     * @param {ClientOrchestrator} clientOrchestrator  the client orchestrator
     */
    startWatch(clientOrchestrator) {
        throw new Error('startWatch is not implemented for this test observer');
    }

    /**
     * Stop watching the test output from the orchestrator
     * @async
     */
    async stopWatch() {
        throw new Error('stopWatch is not implemented for this test observer');
    }

    /**
     * Set the test name to be reported
     * @param {String} name the benchmark name
     */
    setBenchmark(name) {
        throw new Error('setBenchmark is not implemented for this test observer');
    }

    /**
     * Set the test round for the observer
     * @param{*} roundIdx the round index
     */
    setRound(roundIdx) {
        throw new Error('setRound is not implemented for this test observer');
    }

}

module.exports = TestObserverInterface;
