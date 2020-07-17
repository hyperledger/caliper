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

const { WorkloadModuleBase, CaliperUtils } = require('@hyperledger/caliper-core');
const Logger = CaliperUtils.getLogger('smallbank-query-workload');

/**
 * Workload module for the smallbank workload.
 */
class SmallbankQueryWorkload extends WorkloadModuleBase {

    /**
     * Initializes the parameters of the workload.
     */
    constructor() {
        super();
        this.prefix = -1;
    }

    /**
     * Get existing account.
     * @return {Number} account key
     */
    _getAccount() {
        return parseInt(`${this.prefix}${Math.ceil(Math.random() * this.roundArguments.accounts)}`);
    }

    /**
     * Initialize the workload module with the given parameters.
     * @param {number} workerIndex The 0-based index of the worker instantiating the workload module.
     * @param {number} totalWorkers The total number of workers participating in the round.
     * @param {number} roundIndex The 0-based index of the currently executing round.
     * @param {Object} roundArguments The user-provided arguments for the round from the benchmark configuration file.
     * @param {BlockchainConnector} sutAdapter The adapter of the underlying SUT.
     * @param {Object} sutContext The custom context object provided by the SUT adapter.
     * @async
     */
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        if (!this.roundArguments.accounts) {
            throw new Error('smallbank.query - \'accounts\' argument missing');
        }

        this.prefix = workerIndex + 1;
    }

    /**
     * Assemble TXs for opening new accounts.
     * @return {Promise<TxStatus[]>}
     */
    async submitTransaction() {
        const account  = this._getAccount();
        Logger.debug(`Worker ${this.workerIndex} TX args: ${account}`);
        // NOTE: the query API is inconsistent with the invoke API
        await this.sutAdapter.queryState('smallbank', '1.0', account);
    }
}

/**
 * Create a new instance of the workload module.
 * @return {WorkloadModuleInterface}
 */
function createWorkloadModule() {
    return new SmallbankQueryWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
