/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/

'use strict';

module.exports.info  = 'querying accounts';


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
    const acc  = accounts[Math.floor(Math.random()*(accounts.length))];

    return bc.queryState(contx, 'simple', 'v0', acc);
};

module.exports.end = function() {
    // do nothing
    return Promise.resolve();
};
