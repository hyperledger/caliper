/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/

'use strict';

module.exports.info  = 'querying accounts';


let bc, contx;
let account_array;

module.exports.init = function(blockchain, context, args) {
    const open = require('./open.js');
    bc       = blockchain;
    contx    = context;
    account_array = open.account_array;

    return Promise.resolve();
};

module.exports.run = function() {
    const acc  = account_array[Math.floor(Math.random()*(account_array.length))];

    if (bc.bcType === 'fabric-ccp') {
        let args = {
            chaincodeFunction: 'query',
            chaincodeArguments: [acc],
        };

        return bc.bcObj.querySmartContract(contx, 'simple', 'v0', args, 10);
    } else {
        // NOTE: the query API is not consistent with the invoke API
        return bc.queryState(contx, 'simple', 'v0', acc);
    }
};

module.exports.end = function() {
    // do nothing
    return Promise.resolve();
};
