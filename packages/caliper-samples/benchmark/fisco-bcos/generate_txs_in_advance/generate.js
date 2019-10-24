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

const path = require('path');
const uuid = require('uuid/v4');

let accountList, bc, contx;
let file = path.join(__dirname, `.${uuid()}.transactions`);

module.exports.info = ' generate transactions';

module.exports.init = function (blockchain, context) {
    bc = blockchain;
    contx = context;

    const addUser = require('./addUser');
    accountList = addUser.accountList;
};

let index = 0;

/**
 * Generates simple workload
 * @return {Object} array of json objects
 */
function generateWorkload() {
    let fromIndex = index % accountList.length;
    let toIndex = (index + Math.floor(accountList.length / 2)) % accountList.length;
    let value = Math.floor(Math.random() * 100);
    let args = {
        'transaction_type': 'userTransfer(string,string,uint256)',
        'from': accountList[fromIndex].accountID,
        'to': accountList[toIndex].accountID,
        'num': value
    };

    index++;
    accountList[fromIndex].balance -= value;
    accountList[toIndex].balance += value;
    return args;
}

module.exports.run = function () {
    let workload = generateWorkload();
    return bc.bcObj.generateRawTransaction(contx, 'dagtransfer', workload, file);
};

module.exports.end = function () {
    return Promise.resolve();
};

module.exports.file = file;

