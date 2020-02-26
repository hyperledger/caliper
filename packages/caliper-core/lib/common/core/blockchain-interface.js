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
 * Interface of blockchain adapters
 */
class BlockchainInterface {

    /**
     * Retrieve the blockchain type the implementation relates to
     */
    getType() {
        throw new Error('getType is not implemented for this blockchain system');
    }

    /**
     * Initialise test environment
     * @param {boolean} workerInit Indicates whether the initialization happens in the worker process.
     */
    async init(workerInit) {
        throw new Error('init is not implemented for this blockchain system');
    }

    /**
     * Install smart contract(s)
     */
    async installSmartContract() {
        throw new Error('installSmartContract is not implemented for this blockchain system');
    }

    /**
     * Retrieve required arguments for test workers, e.g. retrieve information from the adaptor that is generated during an admin phase such as contract installation.
     * Information returned here is passed to the worker through the messaging protocol on test.
     * @param {Number} number total count of test workers
     * @return {Promise} array of obtained material for each test worker
     * @async
     */
    async prepareWorkerArguments(number) {
        let result = [];
        for(let i = 0 ; i< number ; i++) {
            result[i] = {}; // as default, return an empty object for each client
        }
        return result;
    }

    /**
     * Get a context for subsequent operations
     * 'engine' attribute of returned context object must be reserved for benchmark engine to extend the context
     *  engine = {
     *   submitCallback: callback which must be called once new transaction(s) is submitted, it receives a number argument which tells how many transactions are submitted
     * }
     * @param {String} name name of the context
     * @param {Object} args adapter specific arguments
     */
    async getContext(name, args) {
        throw new Error('getContext is not implemented for this blockchain system');
    }

    /**
     * Release a context as well as related resources
     * @param {Object} context adapter specific object
     */
    async releaseContext(context) {
        throw new Error('releaseContext is not implemented for this blockchain system');
    }

    /**
     * Invoke a smart contract
     * @param {Object} context context object
     * @param {String} contractID identity of the contract
     * @param {String} contractVer version of the contract
     * @param {Array} args array of JSON formatted arguments for multiple transactions
     * @param {Number} timeout request timeout, in seconds
     */
    async invokeSmartContract(context, contractID, contractVer, args, timeout) {
        throw new Error('invokeSmartContract is not implemented for this blockchain system');
    }

    /**
     * Query state from the ledger using a smart contract
     * @param {Object} context context object
     * @param {String} contractID identity of the contract
     * @param {String} contractVer version of the contract
     * @param {Array} args array of JSON formatted arguments
     * @param {Number} timeout request timeout, in seconds
     */
    async querySmartContract(context, contractID, contractVer, args, timeout) {
        throw new Error('querySmartContract is not implemented for this blockchain system');
    }

    /**
     * Query state from the ledger
     * @param {Object} context context object from getContext
     * @param {String} contractID identity of the contract
     * @param {String} contractVer version of the contract
     * @param {String} key lookup key
     * @param {String=} [fcn] The chaincode query function name
     */
    async queryState(context, contractID, contractVer, key, fcn) {
        throw new Error('queryState is not implemented for this blockchain system');
    }

    /**
     * Get adapter specific transaction statistics
     * @param {JSON} stats txStatistics object
     * @param {Array} results array of txStatus objects
     */
    getDefaultTxStats(stats, results) {
        throw new Error('getDefaultTxStats is not implemented for this blockchain system');
    }
}

module.exports = BlockchainInterface;
