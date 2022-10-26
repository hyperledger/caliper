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
 * Workload module for querying the SUT for various marbles.
 */
class MarblesQueryByChannelWorkload extends WorkloadModuleBase {
    /**
     * Initializes the parameters of the marbles workload.
     */
    constructor() {
        super();
        this.txIndex = -1;
        this.owners = ['Alice', 'Bob', 'Claire', 'David'];
    }

    /**
     * Assemble TXs for querying existing marbles based on their owners.
     * @return {Promise<TxStatus[]>}
     */
    async submitTransaction() {
        this.txIndex++;
        let marbleOwner = this.owners[this.txIndex % this.owners.length];

        let args = {
            contractId: this.txIndex % 2 === 0 ? 'mymarbles' : 'yourmarbles',
            contractVersion: 'v0',
            channel: this.txIndex % 2 === 0 ? 'mychannel' : 'yourchannel',
            contractFunction: 'queryMarblesByOwner',
            contractArguments: [marbleOwner],
            invokerIdentity: 'client0.org1.127-0-0-1.nip.io:8080',
            timeout: 10
        };

        await this.sutAdapter.sendRequests(args);
    }
}

/**
 * Create a new instance of the workload module.
 * @return {WorkloadModuleInterface}
 */
function createWorkloadModule() {
    return new MarblesQueryByChannelWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
