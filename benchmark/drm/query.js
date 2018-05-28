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
    return Promise.resolve();
};

module.exports.run = function() {
    const id  = itemIDs[Math.floor(Math.random()*(itemIDs.length))];
    return bc.queryState(contx, 'drm', 'v0', id);
};

module.exports.end = function(results) {
    return Promise.resolve();
};
