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

const chalk = require('chalk');
const fs = require('fs');

let accountList;
let file;
let transactions;
let bc, contx;
let txnPerBatch;

module.exports.info = ' transferring money';

module.exports.init = function (blockchain, context, args) {
    args = args || {};
    if (!args.hasOwnProperty('txnPerBatch')) {
        args.txnPerBatch = 1;
    }
    txnPerBatch = args.txnPerBatch;

    bc = blockchain;
    contx = context;

    const addUser = require('./addUser');
    accountList = addUser.accountList;

    const generate = require('./generate');
    file = generate.file;

    transactions = fs.readFileSync(file).toString().split('\n');
};

let index = 0;
/**
 * Generates simple workload
 * @return {Object} array of json objects
 */
function generateWorkload() {
    let workload = [];
    for (let i = 0; i < txnPerBatch; i++) {
        let transaction = transactions[index];
        workload.push(transaction);
        index++;
    }
    return workload;
}

module.exports.run = function () {
    let workload = generateWorkload();
    return bc.bcObj.sendRawTransaction(contx, workload);
};

module.exports.end = async function () {
    console.info(chalk.blue.bold('Start balance validation ...'));
    let correctAcccountNum = accountList.length;
    for (let i = 0; i < accountList.length; ++i) {
        let account = accountList[i];
        let accountID = account.accountID;
        let balance = account.balance;
        let state = await bc.queryState(contx, 'dagtransfer', 'v0', accountID, 'userBalance(string)');
        let remoteBalance = state.status.result.result.output;
        remoteBalance = parseInt(remoteBalance, 16);
        if (remoteBalance !== balance) {
            console.error(chalk.red.bold(`Abnormal account state: AccountID=${accountID}, LocalBalance=${balance}, RemoteBalance=${remoteBalance}`));
            correctAcccountNum--;
        }
    }

    fs.unlinkSync(file);

    if (correctAcccountNum === accountList.length) {
        console.info(chalk.green.bold('Balance validation succeeded'));
        return Promise.resolve();
    }
    else {
        console.error(chalk.red.bold(`Balance validation failed: success=${correctAcccountNum}, fail=${accountList.length - correctAcccountNum}`));
        return Promise.reject();
    }
};
