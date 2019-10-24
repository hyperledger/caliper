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

const uuidv4 = require('uuid/v4');

module.exports.info = ' adding users';

let accountList = [];
let initMoney = 100000000;
let prefix;
let bc, contx;

module.exports.init = function (blockchain, context, args) {
    prefix = uuidv4();

    bc = blockchain;
    contx = context;

    let workload = [{
        'transaction_type': 'enableParallel()'
    }];

    // Enable parallel transacion executor first, this transaction should *NOT* be recorded by context
    return bc.invokeSmartContract(null, 'parallelok', 'v0', workload, null);
};

/**
 * Generate unique account key for the transaction
 * @param {Number} index account index
 * @returns {String} account key
 */
function generateAccount(index) {
    return prefix + index;
}

/**
 * Generates simple workload
 * @returns {Object} array of json objects
 */
function generateWorkload() {
    let workload = [];
    let index = accountList.length;
    let accountID = generateAccount(index);
    accountList.push({
        'accountID': accountID,
        'balance': initMoney
    });

    workload.push({
        'transaction_type': 'set(string,uint256)',
        'name': accountID,
        'num': initMoney
    });
    return workload;
}

module.exports.run = function () {
    let args = generateWorkload();
    return bc.invokeSmartContract(contx, 'parallelok', 'v0', args, null);
};

module.exports.end = function () {
    return Promise.resolve();
};

module.exports.accountList = accountList;
