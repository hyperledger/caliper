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

module.exports.info = "creating accounts";

let accounts = [];
let txnPerBatch;
let bc, contx;

module.exports.init = function(blockchain, context, args) {
    if (!args.hasOwnProperty("txnPerBatch")) {
        args.txnPerBatch = 1;
    }
    txnPerBatch = args.txnPerBatch;
    bc = blockchain;
    contx = context;

    return Promise.resolve();
};

// generate random name, [a-z]
let seed = "abcdefghijklmnopqrstuvwxyz";

/**
 * Generate unique account name for the transaction
 * @returns {String} account name
 */
const generateName = function() {
    let name = "";
    for (let i = 0; i < 8; i++) {
        name += seed.charAt(Math.floor(Math.random() * seed.length));
    }
    if (accounts.indexOf(name) < 0) {
        return name;
    } else {
        return generateName();
    }
};

/**
 * Generates simple workload
 * @returns {Object} array of json objects
 */
function generateWorkload() {
    let workload = [];
    for (let i = 0; i < txnPerBatch; i++) {
        let acc_name = generateName();
        accounts.push(acc_name);

        workload.push({
            verb: "create",
            account: acc_name
        });
    }
    return workload;
}

module.exports.run = function() {
    let args = generateWorkload();
    let resp = bc.invokeSmartContract(contx, "simple", "v0", args, 50);
    return resp;
};

module.exports.end = function() {
    return Promise.resolve();
};

module.exports.accounts = accounts;
