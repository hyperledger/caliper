/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict';

module.exports.info  = 'querying digital items';

let bc, contx;
let itemIDs;

module.exports.init = function(blockchain, context, args) {
    const publish = require('./publish.js');
    bc      = blockchain;
    contx   = context;
    itemIDs = publish.ids;
    if (publish.ids.length === 0) {
        throw new Error('publish.ids.length is 0');
    }

    return Promise.resolve();
};

module.exports.run = function() {
    const id  = itemIDs[Math.floor(Math.random()*(itemIDs.length))];
    if (bc.bcType === 'fabric-ccp') {
        let args = {
            chaincodeFunction: 'query',
            chaincodeArguments: [id],
        };

        return bc.bcObj.querySmartContract(contx, args, 12 * 1000);
    } else {
        // NOTE: query API is not consistent with invoke API
        return bc.queryState(contx, 'drm', 'v0', id);
    }
};

module.exports.end = function() {
    return Promise.resolve();
};
