/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file, definition of the Fabric class, which implements the caliper's NBI for hyperledger fabric
*/


'use strict'

var irohaType = require('../../../iroha/type.js');
var simple = function(version, context, args) {
    try{
        switch(args.verb) {
        case 'open':
            return open(context, args.account, args.money);
        case 'query':
            return query(context, args.key)
        default:
            throw new Error("Unknown verb for 'simple' contract");
        }
    }
    catch(err){
        console.log(err);
        return [];
    }
}

module.exports.contracts = {
    simple : simple
};


function open(context, domain, money) {
    return [
        {
            tx: irohaType.txType['CREATE_DOMAIN'],
            args: [domain, 'user']
        },
        {
            tx: irohaType.txType['CREATE_ASSET'],
            args: ['rmb', domain, 0]
        },
        {
            tx: irohaType.txType['ADD_ASSET_QUANTITY'],
            args: [context.id, 'rmb#'+domain, money]
        }
    ];
}

function query(context, key) {
    return [
        {
            tx: irohaType.txType['GET_ASSET_INFO'],
            args: ['rmb#'+key]
        }
    ]
}

