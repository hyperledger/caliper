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

module.exports.info = 'transfering money';

let bc, contx;
let account_array;
let initmoney;

module.exports.init = function (blockchain, context, args) {
    const open = require('./open.js');
    if (!args.hasOwnProperty('money')) {
        return Promise.reject(new Error('account.transfer - \'money\' is missed in the arguments'));
    }
    bc = blockchain;
    contx = context;
    initmoney = args.money;
    account_array = open.account_array;

    return Promise.resolve();
};

module.exports.run = function () {
    const account1 = account_array[Math.floor(Math.random() * (account_array.length))];
    const account2 = account_array[Math.floor(Math.random() * (account_array.length))];
    let args;

    if (bc.bcType === 'fabric-ccp') {
        args = {
            chaincodeFunction: 'transfer',
            chaincodeArguments: [account1, account2, initmoney.toString()],
        };
    } else {
        args = {
            'verb': 'transfer',
            'account1': account1,
            'account2': account2,
            'money': initmoney.toString()
        };
    }

    return bc.invokeSmartContract(contx, 'simple', 'v0', args, 10);

};

module.exports.end = function () {
    // do nothing
    return Promise.resolve();
};
