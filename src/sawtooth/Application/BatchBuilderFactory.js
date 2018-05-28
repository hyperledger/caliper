/**
 * Copyright 2017 HUAWEI All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * @file, Factory class for generating batch builder instances based the txn family name and version.
 */

'use strict';

let SimpleBatchBuilder = require('./SimpleBatchBuilder.js');
let SmallBankBatchBuilder = require('./SmallBankBatchBuilder.js');

/**
 * @abstract class has static method getBatchBuilder()
 * @returns {object} with specific builder instance.
 */
class BatchBuilderFactory {

/**
 * static factory method which will return batch builder instance based on family name and
 * family version
 * @param {string} familyName transaction family name
 * @param {string} familyVersion transaction family version
 * @returns {object} with specific builder instance.
 */
    static getBatchBuilder(familyName, familyVersion) {
        let sawtoothContractVersion = '1.0';
        if (familyVersion === 'v0') {
            sawtoothContractVersion = '1.0';
        }

        if(familyName === 'simple') {
            return new SimpleBatchBuilder(familyName, sawtoothContractVersion);
        }
        else if(familyName === 'smallbank') {
            return new SmallBankBatchBuilder(familyName, sawtoothContractVersion);
        }
        else {
            throw new Error('There is no batch builder for '+ familyName +' and '+ familyVersion);
        }
    }
}

module.exports = BatchBuilderFactory;
