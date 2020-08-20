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
 * Workload module for simple get operations.
 */
class HelloGetWorkload extends WorkloadModuleBase {
    /**
     * Assemble TXs for set operation.
     * @return {Promise<TxStatus[]>}
     */
    async submitTransaction() {
        const args = {
            contractId: 'helloworld',
            args: {
                transaction_type: 'get()'
            },
            readOnly: true
        };
        await this.sutAdapter.sendRequests(args);
    }
}

/**
 * Create a new instance of the workload module.
 * @return {WorkloadModuleInterface}
 */
function createWorkloadModule() {
    return new HelloGetWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
