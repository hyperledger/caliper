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

module.exports.info = ' setting name';

let bc, contx;
let txnPerBatch;

module.exports.init = function (blockchain, context, args) {
    txnPerBatch = 1;
    bc = blockchain;
    contx = context;
    return Promise.resolve();
};

/**
 * Generates simple workload
 * @return {Object} array of json objects
 */
function generateWorkload() {
    let workload = [];
    for (let i = 0; i < txnPerBatch; i++) {
        let w = {
            'transaction_type': 'set(string)',
            'name': 'hello! - from ' + process.pid.toString(),
        };
        workload.push(w);
    }
    return workload;
}

module.exports.run = function () {
    let args = generateWorkload();
    return bc.invokeSmartContract(contx, 'helloworld', 'v0', args, null);
};

module.exports.end = function () {
    // Do nothing
    return Promise.resolve();
};
