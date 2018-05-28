/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file, definition of the Fabric class, which implements the caliper's NBI for hyperledger fabric
*/


'use strict';

const txType =  {
    // commands
    ADD_ASSET_QUANTITY : {type:'command', fn:'addAssetQuantity', argslen: 3},
    ADD_PEER : {type:'command', fn:'addPeer', argslen: 2},
    ADD_SIGNATORY : {type:'command', fn:'addSignatory', argslen: 2},
    APPEND_ROLE : {type:'command', fn:'appendRole', argslen: 2},
    CREATE_ACCOUNT : {type:'command', fn:'createAccount', argslen: 3},
    CREATE_ASSET : {type:'command', fn:'createAsset', argslen: 3},
    CREATE_DOMAIN : {type:'command', fn:'createDomain', argslen: 2},
    CREATE_ROLE : {type:'command', fn:'createRole', argslen: 2},
    DETACH_ROLE : {type:'command', fn:'detachRole', argslen: 2},
    GRANT_PERMISSION : {type:'command', fn:'grantPermission', argslen: 2},
    REMOVE_SIGNATORY : {type:'command', fn:'removeSignatory', argslen: 2},
    REVOKE_PERMISSION : {type:'command', fn:'revokePermission', argslen: 2},
    SET_ACCOUNT_DETAIL : {type:'command', fn:'setAccountDetail', argslen: 3},
    SET_ACCOUNT_QUORUM : {type:'command', fn:'setAccountQuorum', argslen: 2},
    SUBTRACT_ASSET_QUANTITY : {type:'command', fn:'subtractAssetQuantity', argslen: 3},
    TRANSFER_ASSET : {type:'command', fn:'transferAsset', argslen: 5},
    // query, started from 100
    GET_ACCOUNT : {type:'query', fn:'getAccount', argslen: 1},
    GET_SIGNATORIES : {type:'query', fn:'getSignatories', argslen: 1},
    GET_ACCOUNT_TRANSACTIONS : {type:'query', fn:'getAccountTransactions', argslen: 1},
    GET_ACCOUNT_ASSERT_TRANSACTIONS : {type:'query', fn:'getAccountAssetTransactions', argslen: 2},
    GET_TRANSACTIONS : {type:'query', fn:'getTransactions', argslen: 1},
    GET_ACCOUNT_ASSETS : {type:'query', fn:'getAccountAssets', argslen: 2},
    GET_ASSET_INFO : {type:'query', fn:'getAssetInfo', argslen: 1},
    GET_ROLES : {type:'query', fn:'getRoles ', argslen: 0},
    GET_ROLE_PERMISSIONS : {type:'query', fn:'GetRolePermissions  ', argslen: 1}
};
module.exports.txType = txType;

/**
 * Judge whether the type is a command type or query type.
 * @param {*} tx transaction or query object
 * @return {Number}, 0: command; 1: query
 */
module.exports.commandOrQuery = function (tx) {
    if(tx.type === 'command') {
        return 0;
    }
    else {
        return 1;
    }
};
