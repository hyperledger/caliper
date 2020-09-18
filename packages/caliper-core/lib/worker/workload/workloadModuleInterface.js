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

/**
 * Interface for the user-implemented workload modules used for assembling TXs for the SUT.
 */
class WorkloadModuleInterface {
    /**
     * Initialize the workload module with the given parameters.
     * @param {number} workerIndex The 0-based index of the worker instantiating the workload module.
     * @param {number} totalWorkers The total number of workers participating in the round.
     * @param {number} roundIndex The 0-based index of the currently executing round.
     * @param {object} roundArguments The user-provided arguments for the round from the benchmark configuration file.
     * @param {ConnectorBase} sutAdapter The adapter of the underlying SUT.
     * @param {object} sutContext The custom context object provided by the SUT adapter.
     * @async
     */
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        throw new Error('WorkloadModuleInterface.initializeWorkloadModule() must be implemented in derived class');
    }

    /**
     * Assemble the next TX content(s) and submit it to the SUT adapter.
     * @async
     */
    async submitTransaction() {
        throw new Error('WorkloadModuleInterface.submitTransaction() must be implemented in derived class');
    }

    /**
     * Clean up the workload module at the end of the round.
     * @async
     */
    async cleanupWorkloadModule() {
        throw new Error('WorkloadModuleInterface.cleanupWorkloadModule() must be implemented in derived class');
    }
}


module.exports = WorkloadModuleInterface;
