/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/

'use strict';

module.exports.info  = 'transfering accounts';


let bc, contx;
let accounts;
module.exports.init = function(blockchain, context, args) {
    const open = require('./open.js');
    bc       = blockchain;
    contx    = context;
    accounts = open.accounts;
    return Promise.resolve();
};

module.exports.run = function() {
    const acc1  = accounts[Math.floor(Math.random()*(accounts.length))];
    const acc2  = accounts[Math.floor(Math.random()*(accounts.length))];
    return bc.invokeSmartContract(contx, 'simple', 'v0', {verb: 'transfer', accountFrom: acc1, accountTo: acc2, money: 1}, 30);
};

module.exports.end = function(results) {
    // do nothing
    return Promise.resolve();
};
