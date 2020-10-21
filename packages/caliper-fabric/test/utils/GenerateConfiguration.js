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
     * Generate a configuration overriding (replacing or adding) part of the root configuration
     *
     * @param {*} overrideBaseConfiguration object which is applied to the base configuration to override
     * @returns {string} A Path to the new configuration file
     */
    generateConfigurationFileWithSpecifics(overrideBaseConfiguration) {
        const clonedConfiguration = JSON.parse(JSON.stringify(this.baseConfiguration));
        Object.assign(clonedConfiguration, overrideBaseConfiguration);
        const newConfigurationFilePath = path.join(this.temporaryDirectory, 'TestConfig.json');
        fs.writeFileSync(newConfigurationFilePath, JSON.stringify(clonedConfiguration));

        return newConfigurationFilePath;
    }

    /**
     * Generate a configuration from an existing configuration by replacing a specific
     * property's value. If the property is repeated more than once it replaces all those
     * instances
     *
     * @param {string} propertyName a property name in the configuration
     * @param {*} replacementValue a replacement value for the property in the configuration
     * @param {string} [owningPropertyName] optional owning property name for any properties to be replaced
     * @returns {string} A Path to the new configuration file
     */
    generateConfigurationFileReplacingProperties(propertyName, replacementValue, owningPropertyName) {
        const clonedConfiguration = JSON.parse(JSON.stringify(this.baseConfiguration));
        this._searchAndReplaceProperty('root', clonedConfiguration, propertyName, replacementValue, owningPropertyName);
        const newConfigurationFilePath = path.join(this.temporaryDirectory, 'TestConfig.json');
        fs.writeFileSync(newConfigurationFilePath, JSON.stringify(clonedConfiguration));

        return newConfigurationFilePath;
    }

    /**
     * Search for a property name and replace it's value if found
     *
     * @param {*} currentPropertyName the object to search and update
     * @param {*} currentPropertyValue the object to search and update
     * @param {string} propertyNameToFind a property name in the configuration
     * @param {*} replacementValue a replacement value for the property in the configuration
     * @param {string} [requiredCurrentPropertyName] owning property name must match
     */
    _searchAndReplaceProperty(currentPropertyName, currentPropertyValue, propertyNameToFind, replacementValue, requiredCurrentPropertyName) {
        for (const propertyNameInCurrentPropertyValue in currentPropertyValue) {
            if (propertyNameInCurrentPropertyValue === propertyNameToFind) {
                if (!requiredCurrentPropertyName || requiredCurrentPropertyName === currentPropertyName) {
                    currentPropertyValue[propertyNameInCurrentPropertyValue] = replacementValue;
                }
            } else {
                if (typeof currentPropertyValue[propertyNameInCurrentPropertyValue] === 'object') {
                    this._searchAndReplaceProperty(propertyNameInCurrentPropertyValue, currentPropertyValue[propertyNameInCurrentPropertyValue], propertyNameToFind, replacementValue, requiredCurrentPropertyName);
                }
            }
        }
    }
}
module.exports = GenerateTestConfiguration;
