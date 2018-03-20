/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict'

var crypto = require('crypto');

module.exports.info  = "publishing digital items";

var bc, contx;
var itemBytes = 1024;   // default value
var ids = [];           // save the generated item ids

module.exports.ids = ids;

module.exports.init = function(blockchain, context, args) {
    if(args.hasOwnProperty('itemBytes') ) {
       itemBytes = args.itemBytes;
    }

    bc       = blockchain;
    contx    = context;
    return Promise.resolve();
}

module.exports.run = function() {
    var date   = new Date();
    var today  = (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
    var author = process.pid.toString();
    var buf    = crypto.randomBytes(itemBytes).toString('base64');
    var item = {
                    'author' : author,
                    'createtime' : today,
                    'info' : '',
                    'item' : buf
                };
    return bc.invokeSmartContract(contx, 'drm', 'v0', {verb : 'publish', item: JSON.stringify(item)}, 120);
}

module.exports.end = function(results) {
    for (let i in results){
        let stat = results[i];
        if(stat.status === 'success') {
            ids.push(stat.result.toString());
        }
    }
    return Promise.resolve();
}
/**********************
* save published items' identity
**********************/
/*var idfile = './tmp/ids.log'
var fs = require('fs');
module.exports.end = function(results) {
     for (let i in results){
        let stat = results[i];
        if(stat.status === 'success') {
            fs.appendFileSync(idfile, stat.result.toString() + '\n');
        }
    }
    return Promise.resolve();
}*/
