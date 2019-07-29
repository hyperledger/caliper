/*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

'use strict';

const CaliperUtils = require('@hyperledger/caliper-core').CaliperUtils;

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
     * @param {string} workspaceRoot the worksapce root
     * @returns {object} with specific builder instance.
     */
    static getBatchBuilder(familyName, familyVersion, config, workspaceRoot) {
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
            const handler = require(CaliperUtils.resolvePath(handlerPath, workspaceRoot));
            return new handler(familyName, familyVersion);
        } catch (err) {
            throw new Error('Unable to load batch builder for ' + familyName + '[' + familyVersion +
                '] at ' + handlerPath + '::' + err.message);
        }
    }
}

module.exports = BatchBuilderFactory;
