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
const fs = require('fs');
const os = require('os');
const path = require('path');


/**
 * Class to generate a test configuration file
 */
class GenerateTestConfiguration {

    /**
     *
     * @param {string} [baseConfigurationPath] a path to an base configuration to be modified
     */
    constructor(baseConfigurationPath) {
        this.baseConfiguration = {};

        if (baseConfigurationPath) {
            this.baseConfiguration = CaliperUtils.parseYaml(baseConfigurationPath);
        }

        const tmpDir = os.tmpdir();
        const { sep } = require('path');
        this.temporaryDirectory = fs.mkdtempSync(`${tmpDir}${sep}`);
    }

    /**
     * override the base configuration, currently only allows overriding at the root of the object
     *
     * @param {*} overrideBaseConfiguration object which is applied to the base configuration to override
     * @returns {string} A Path to the new configuration file
     */
    generateConfigurationFileWithSpecifics(overrideBaseConfiguration) {
        const clonedConfiguration = this._deepCloneObject(this.baseConfiguration);
        Object.assign(clonedConfiguration, overrideBaseConfiguration);
        const newConfigurationFilePath = path.join(this.temporaryDirectory, 'TestConfig.json');
        fs.writeFileSync(newConfigurationFilePath, JSON.stringify(clonedConfiguration));

        return newConfigurationFilePath;
    }

    /**
     *
     * @param {*} propertyName b
     * @param {*} replacementValue b
     * @returns {string} A Path to the new configuration file
     */
    generateConfigurationFileReplacingProperties(propertyName, replacementValue) {
        const clonedConfiguration = this._deepCloneObject(this.baseConfiguration);
        this._searchAndReplaceProperty(clonedConfiguration, propertyName, replacementValue);
        const newConfigurationFilePath = path.join(this.temporaryDirectory, 'TestConfig.json');
        fs.writeFileSync(newConfigurationFilePath, JSON.stringify(clonedConfiguration));

        return newConfigurationFilePath;
    }

    /**
     * simple utility to clone an object
     * @param {*} object input object
     * @returns {object} cloned output object
     */
    _deepCloneObject(object) {
        return JSON.parse(JSON.stringify(object));
    }

    /**
     *
     * @param {*} object b
     * @param {*} propertyName b
     * @param {*} replacementValue  b
     */
    _searchAndReplaceProperty(object, propertyName, replacementValue) {
        for (const objectKey in object) {
            if (objectKey === propertyName) {
                object[objectKey] = replacementValue;
            } else {
                if (typeof object[objectKey] === 'object') {
                    this._searchAndReplaceProperty(object[objectKey], propertyName, replacementValue);
                }
            }
        }
    }
}
module.exports = GenerateTestConfiguration;
