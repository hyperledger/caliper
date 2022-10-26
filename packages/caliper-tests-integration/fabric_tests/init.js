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

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

/**
 * Workload module for initializing the SUT with various marbles.
 */
class MarblesInitWorkload extends WorkloadModuleBase {
    /**
     * Initializes the parameters of the marbles workload.
     */
    constructor() {
        super();
        this.txIndex = -1;
        this.colors = ['red', 'blue', 'green', 'black', 'white', 'pink', 'rainbow'];
        this.owners = ['Alice', 'Bob', 'Claire', 'David'];
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

        if (!this.roundArguments.marblePrefix) {
            throw new Error(`Argument "marblePrefix" is missing from benchmark configuration`);
        }
    }

    /**
     * Assemble TXs for creating new marbles.
     * @return {Promise<TxStatus[]>}
     */
    async submitTransaction() {
        this.txIndex++;

        const marbleName = `${this.roundArguments.marblePrefix}_${this.roundIndex}_${this.workerIndex}_${this.txIndex}`;
        let marbleColor = this.colors[this.txIndex % this.colors.length];
        let marbleSize = (((this.txIndex % 10) + 1) * 10).toString(); // [10, 100]
        let marbleOwner = this.owners[this.txIndex % this.owners.length];

        let args = {
            contractId: this.txIndex % 2 === 0 ? 'mymarbles' : 'yourmarbles',
            contractFunction: 'initMarble',
            contractArguments: [marbleName, marbleColor, marbleSize, marbleOwner],
            invokerIdentity: 'client0.org1.127-0-0-1.nip.io:8080',
            timeout: 5,
            readOnly: false
        };

        await this.sutAdapter.sendRequests(args);
    }
}

/**
 * Create a new instance of the workload module.
 * @return {WorkloadModuleInterface}
 */
function createWorkloadModule() {
    return new MarblesInitWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
