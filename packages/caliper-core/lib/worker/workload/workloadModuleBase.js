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

const WorkloadModuleInterface = require('./workloadModuleInterface');
const Logger = require('./../../common/utils/caliper-utils').getLogger('workload-module-base');

/**
 * Utility base class for the user-implemented workload modules used for assembling TXs for the SUT.
 */
class WorkloadModuleBase extends WorkloadModuleInterface {
    /**
     * Initialize an instance of the WorkloadModuleBase class.
     */
    constructor() {
        super();

        Logger.debug('Constructing workload module');

        /**
         * The 0-based index of the worker instantiating the workload module.
         * @type {number}
         */
        this.workerIndex = -1;

        /**
         * The total number of workers participating in the round.
         * @type {number}
         */
        this.totalWorkers = -1;

        /**
         * The 0-based index of the currently executing round.
         * @type {number}
         */
        this.roundIndex = -1;

        /**
         * The user-provided arguments for the round from the benchmark configuration file.
         * @type {Object}
         */
        this.roundArguments = undefined;

        /**
         * The adapter of the underlying SUT.
         * @type {ConnectorBase}
         */
        this.sutAdapter = undefined;

        /**
         * The custom context object provided by the SUT adapter.
         * @type {Object}
         */
        this.sutContext = undefined;
    }

    /**
     * Initialize the workload module with the given parameters.
     * @param {number} workerIndex The 0-based index of the worker instantiating the workload module.
     * @param {number} totalWorkers The total number of workers participating in the round.
     * @param {number} roundIndex The 0-based index of the currently executing round.
     * @param {Object} roundArguments The user-provided arguments for the round from the benchmark configuration file.
     * @param {ConnectorBase} sutAdapter The adapter of the underlying SUT.
     * @param {Object} sutContext The custom context object provided by the SUT adapter.
     * @async
     */
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        Logger.debug(`Workload module initialized with: workerIndex=${workerIndex}, totalWorkers=${totalWorkers}, roundIndex=${roundIndex}, roundArguments=${JSON.stringify(roundArguments)}`);
        this.workerIndex = workerIndex;
        this.totalWorkers = totalWorkers;
        this.roundIndex = roundIndex;
        this.roundArguments = roundArguments;
        this.sutAdapter = sutAdapter;
        this.sutContext = sutContext;
    }

    /**
     * Clean up the workload module at the end of the round.
     * @async
     */
    async cleanupWorkloadModule() {
        // NOOP by default
        Logger.debug('Cleaning up workload module: NOOP');
    }
}


module.exports = WorkloadModuleBase;
