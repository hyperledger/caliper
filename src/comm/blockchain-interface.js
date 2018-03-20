/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file, definition of the interface class for all blockchain
*/

'use strict'

class BlockchainInterface {
    constructor(config_path) {
        this.configPath = config_path;
    }

    init() {
        throw new Error('init is not implemented for this blockchain system');
    }

    installSmartContract() {
        throw new Error('installSmartContract is not implemented for this blockchain system');
    }

    prepareClients (number) {
        var result = [];
        for(let i = 0 ; i< number ; i++) {
            result[i] = {}; // as default, return an empty object for each client
        }
        return Promise.resolve(result);
    }

    getContext(name, args) {
        throw new Error('getContext is not implemented for this blockchain system');
    }

    releaseContext(context) {
        throw new Error('releaseContext is not implemented for this blockchain system');
    }

    invokeSmartContract(context, contractID, contractVer, args, timeout) {
        throw new Error('invokeSmartContract is not implemented for this blockchain system');
    }

    queryState(context, contractID, contractVer, key) {
        throw new Error('queryState is not implemented for this blockchain system');
    }

    getDefaultTxStats(stats, results) {
        throw new Error('getDefaultTxStats is not implemented for this blockchain system');
    }
}

module.exports = BlockchainInterface;