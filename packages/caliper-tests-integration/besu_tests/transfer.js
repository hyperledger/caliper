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

const Dictionary = 'abcdefghijklmnopqrstuvwxyz';

/**
 * Workload module for transferring money between accounts.
 */
class SimpleTransferWorkload extends WorkloadModuleBase {

    /**
     * Initializes the parameters of the workload.
     */
    constructor() {
        super();
        this.accountPrefix = '';
        this.numberOfAccountsPerWorker = -1;

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
        // choose a random TX/account index based on the existing range, and restore the account name from the fragments
        return this.roundArguments.accountPhasePrefix + this.accountPrefix + SimpleTransferWorkload._get26Num(Math.floor(Math.random() * this.numberOfAccountsPerWorker) + 1);
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

        if(!this.roundArguments.money) {
            throw new Error('simple.transfer - the "money" argument is missing');
        }

        if(!this.roundArguments.numberOfAccounts) {
            throw new Error('simple.transfer - the "numberOfAccounts" argument is missing');
        }

        if(!this.roundArguments.accountPhasePrefix) {
            throw new Error('simple.open - the "accountPhasePrefix" argument is missing');
        }

        this.accountPrefix = SimpleTransferWorkload._get26Num(workerIndex);
        this.numberOfAccountsPerWorker = this.roundArguments.numberOfAccounts / this.totalWorkers;
    }

    /**
     * Assemble TXs for transferring money.
     */
    async submitTransaction() {
        const args = {
            contract: 'simple',
            verb: 'transfer',
            args: [this._generateAccount(), this._generateAccount(), this.roundArguments.money.toString()],
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
    return new SimpleTransferWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
