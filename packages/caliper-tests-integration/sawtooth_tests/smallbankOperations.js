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
const Logger = CaliperUtils.getLogger('smallbank-workload');

const InitialBalance = 1000000;
const OperationTypes = ['transact_savings', 'deposit_checking', 'send_payment', 'write_check', 'amalgamate'];
const Characters = 'ABCDEFGHIJKL MNOPQRSTUVWXYZ abcdefghij klmnopqrstuvwxyz';

/**
 * Workload module for the smallbank workload.
 */
class SmallbankWorkload extends WorkloadModuleBase {

    /**
     * Initializes the parameters of the workload.
     */
    constructor() {
        super();
        this.accountsCreated = 0;
        this.prefix = -1;
    }

    /**
     * Generates random string.
     * @returns {string} random string from possible characters
     **/
    static _randomString() {
        let text = '';
        for (let i = 0; i < 12; i++) {
            text += Characters.charAt(Math.floor(Math.random() * Characters.length));
        }
        return text;
    }

    /**
     * Get existing account.
     * @return {Number} account key
     */
    _getAccount() {
        return parseInt(`${this.prefix}${Math.ceil(Math.random() * this.accountsCreated)}`);
    }

    /**
     * Generate unique account key for the transaction
     * @returns {Number} account key
     **/
    _generateAccount() {
        this.accountsCreated++;
        return parseInt(`${this.prefix}${this.accountsCreated}`);
    }

    /**
     * Generates small bank workload with specified number of accounts
     * and operations.
     * @returns {Object} array of json objects and each denotes
     * one operations
     **/
    _generateWorkload() {
        let workload = [];
        for(let i= 0; (i < this.roundArguments.txnPerBatch && this.accountsCreated < this.roundArguments.accounts); i++) {
            let accountKey = this._generateAccount();
            let acc = {
                'customer_id': accountKey,
                'customer_name': SmallbankWorkload._randomString(),
                'initial_checking_balance': InitialBalance,
                'initial_savings_balance': InitialBalance,
                'transaction_type': 'create_account'
            };
            workload.push(acc);
        }
        for(let j = workload.length; j < this.roundArguments.txnPerBatch; j++) {
            let op_index =  Math.floor(Math.random() * OperationTypes.length);
            let random_op = OperationTypes[op_index];
            let random_acc = this._getAccount();
            let amount = Math.floor(Math.random() * 200);
            let op_payload;
            switch(random_op) {
                case 'transact_savings': {
                    op_payload = {
                        'amount': amount,
                        'customer_id': random_acc,
                        'transaction_type':random_op
                    };
                    break;
                }
                case 'deposit_checking': {
                    op_payload = {
                        'amount': amount,
                        'customer_id': random_acc,
                        'transaction_type':random_op
                    };
                    break;
                }
                case 'send_payment': {
                    op_payload = {
                        'amount': amount,
                        'dest_customer_id': this._getAccount(),
                        'source_customer_id': this._getAccount(),
                        'transaction_type': random_op
                    };
                    break;
                }
                case 'write_check': {
                    op_payload = {
                        'amount': amount,
                        'customer_id': random_acc,
                        'transaction_type':random_op
                    };
                    break;
                }
                case 'amalgamate': {
                    op_payload = {
                        'dest_customer_id': this._getAccount(),
                        'source_customer_id': this._getAccount(),
                        'transaction_type': random_op
                    };
                    break;
                }
                default: {
                    throw new Error('Invalid operation!!!');
                }
            }
            workload.push(op_payload);
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

        if (!this.roundArguments.accounts) {
            throw new Error('smallbank.operations - \'accounts\' argument missing');
        }

        if (!this.roundArguments.txnPerBatch) {
            throw new Error('smallbank.operations - \'txnPerBatch\' argument missing');
        }

        if(this.roundArguments.accounts <= 3) {
            throw new Error('smallbank.operations - number accounts should be more than 3');
        }

        this.prefix = workerIndex + 1;
    }

    /**
     * Assemble TXs for opening new accounts.
     * @return {Promise<TxStatus[]>}
     */
    async submitTransaction() {
        let args = this._generateWorkload();
        Logger.debug(`Worker ${this.workerIndex} TX args: ${JSON.stringify(args)}`);
        await this.sutAdapter.invokeSmartContract('smallbank', '1.0', args, 30);
    }
}

/**
 * Create a new instance of the workload module.
 * @return {WorkloadModuleInterface}
 */
function createWorkloadModule() {
    return new SmallbankWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
