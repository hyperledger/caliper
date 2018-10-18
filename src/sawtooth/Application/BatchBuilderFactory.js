/**
 * Copyright 2017 HUAWEI All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * @file, Factory class for generating batch builder instances based the txn family name and version.
 */

'use strict';

const Util = require('../../comm/util.js');

/**
 * @abstract class has static method getBatchBuilder()
 * @returns {object} with specific builder instance.
 */
class BatchBuilderFactory {

    /**
     * static factory method which will return batch builder instance based on family name and
     * family version. This is dependent upon your configuration.
     * @param {string} familyName transaction family name
     * @param {string} familyVersion transaction family version
     * @param {object} config the configuration
     * @returns {object} with specific builder instance.
     */
    static getBatchBuilder(familyName, familyVersion, config) {
        if (familyVersion === 'v0') {
            familyVersion = '1.0';
        }
        if (!config.sawtooth.batchBuilders) {
            throw new Error('There are no batch builders defined in the configuration');
        }
        if (!config.sawtooth.batchBuilders[familyName]) {
            throw new Error('There is no batch builder for ' + familyName);
        }
        if (!config.sawtooth.batchBuilders[familyName][familyVersion]) {
            throw new Error('There is no batch builder for ' + familyName + '[' + familyVersion + ']');
        }
        const handlerPath = config.sawtooth.batchBuilders[familyName][familyVersion];
        try {
            const handler = require(Util.resolvePath(handlerPath));
            return new handler(familyName, familyVersion);
        } catch (err) {
            throw new Error('Unable to load batch builder for ' + familyName + '[' + familyVersion +
                '] at ' + handlerPath + '::' + err.message);
        }
    }
}

module.exports = BatchBuilderFactory;
