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

"use strict";

const { WorkloadModuleBase, CaliperUtils } = require('@hyperledger/caliper-core');
const Logger = CaliperUtils.getLogger('simple-workload-open');

const Dictionary = 'abcdefghijklmnopqrstuvwxyz';

/**
 * Workload module for initializing the SUT with various accounts.
 */
class SimpleCreateWorkload extends WorkloadModuleBase {

    /**
     * Initializes the parameters of the workload.
     */
    constructor() {
        super();
        this.accountPrefix = '';
        this.txIndex = -1;
    }

    /**
     * Generate string by picking characters from the dictionary variable.
     * @param {number} number Character to select.
     * @returns {string} string Generated string based on the input number.
     * @private
     */
    static _get26Num(number){
        let result = '';

        while(number > 0) {
            result += Dictionary.charAt(number % Dictionary.length);
            number = parseInt(number / Dictionary.length);
        }

        return result;
    }

    /**
     * Generate unique account key for the transaction.
     * @returns {string} The account key.
     * @private
     */
    _generateAccount() {
        return this.accountPrefix + SimpleCreateWorkload._get26Num(this.txIndex + 1);
    }

    /**
     * Generates simple workload.
     * @returns {{verb: String, args: Object[]}[]} Array of workload argument objects.
     */
    _generateWorkload() {
        let workload = [];
        for(let i= 0; i < this.roundArguments.txnPerBatch; i++) {
            this.txIndex++;

            let accountId = this._generateAccount();

            workload.push({
                verb: 'create',
                account: accountId
            });
        }
        return workload;
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

        if(!this.roundArguments.txnPerBatch) {
            this.roundArguments.txnPerBatch = 1;
        }

        this.accountPrefix = SimpleCreateWorkload._get26Num(workerIndex);
    }

    /**
     * Assemble TXs for opening new accounts.
     * @return {Promise<TxStatus[]>}
     */
    async submitTransaction() {
        let args = this._generateWorkload();
        Logger.debug(`Worker ${this.workerIndex} for TX ${this.txIndex}: ${JSON.stringify(args)}`);
        await this.sutAdapter.invokeSmartContract('simple', 'v0', args, 100);
    }
}

/**
 * Create a new instance of the workload module.
 * @return {WorkloadModuleInterface}
 */
function createWorkloadModule() {
    return new SimpleCreateWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
