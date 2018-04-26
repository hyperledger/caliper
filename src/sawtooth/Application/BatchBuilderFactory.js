/**
 * Copyright 2017 HUAWEI All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * @file, Factory class for generating batch builder instances based the txn family name and version.
 */

'use strict'

var SimpleBatchBuilder = require('./SimpleBatchBuilder.js')

class BatchBuilderFactory {
    static getBatchBuilder(familyName, familyVersion) {
        let sawtoothContractVersion = '1.0'
        if (familyVersion === 'v0') {
            sawtoothContractVersion = '1.0'
        }

        if(familyName === 'simple') {
            return new SimpleBatchBuilder(familyName, sawtoothContractVersion);
        }
        else {
            throw new Error('There is no batch builder for '+ familyName +' and '+ familyVersion);
        }
   } 
}

module.exports = BatchBuilderFactory;
