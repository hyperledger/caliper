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

const WorkloadModuleBase = require('../workloadModuleBase');
const Contract = require('./contract');
const UniformRandomListItemValueProvider = require('./value-providers/uniform-random-list-item-value-provider');
const Logger = require('../../../common/utils/caliper-utils').getLogger('workload-module-base');
const ValueProviderFactory = require('./value-providers/value-provider-factory');

/**
 * Utility base class for the built workload modules used for assembling TXs for the SUT.
 */
class DeclarativeWorkloadModuleBase extends WorkloadModuleBase {
    /**
     * Initialize an instance of the DeclarativeWorkloadModuleBase class.
     */
    constructor() {
        super();
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
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.variables = {
            'workerIndex': workerIndex,
            'totalWorkers': totalWorkers,
            'roundIndex': roundIndex,
        };

        this.parameters = {};
        for(const key of Object.keys(roundArguments)) {
            if(key !== 'behavior') {
                this.parameters[key] = roundArguments[key];
            }
        }

        const behavior = roundArguments.behavior;
        const valueProviderFactory = new ValueProviderFactory(this.variables, this.parameters);
        this.contracts = {};
        for(const contractObject of behavior.contracts) {
            this.contracts[contractObject.name] = new Contract(contractObject, valueProviderFactory);
        }
        this.contractSelector = new UniformRandomListItemValueProvider(Object.keys(this.contracts));
    }

    /**
     * Submit the TX through the SUT adapter
     * @param {any} generatedArguments selected arguments sent in by submitTransaction()
     * @async
     */
    async submitWithArguments(generatedArguments) {
        throw new Error('DeclarativeWorkloadModuleBase.submitWithArguments() must be implemented in derived class');
    }

    /**
     * Assemble the next TX content(s) and submit it to the SUT adapter.
     * @async
     */
    async submitTransaction() {
        return await this.submitWithArguments(this.contracts[this.contractSelector.generateValue()].generateCallArguments());
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


module.exports = DeclarativeWorkloadModuleBase;
