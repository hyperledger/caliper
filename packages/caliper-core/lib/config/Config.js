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

const fs = require('fs');
const path = require('path');
const nconf = require('nconf');

nconf.formats.yaml = require('nconf-yaml');

/**
 * Normalizes the key of the given setting.
 * @param {{key: string, value: any}} kvPair The setting as a key-value pair.
 * @return {{key: string, value: any}} The setting with the modified key.
 */
function normalizeSettingKey(kvPair) {
    let newKey = kvPair.key.toLowerCase().replace(/[_]/g, '-');
    // only change the command line argument or environment variable name for Caliper settings
    if (newKey.startsWith('caliper-')) {
        kvPair.key = newKey;
    }

    return kvPair;
}

/**
 * Returns the settings for parsing a configuration file.
 * @param {string} filename The path of the configuration file.
 * @return {{file: string, logicalSeparator: string, format: object}} The parsing options.
 */
function getFileParsingOptions(filename) {
    return { file: filename, logicalSeparator: '-', format: nconf.formats.yaml };
}

/**
 * The class encapsulating the hierarchy of runtime configurations.
 * @type {Config}
 */
class Config {
    /**
     * Constructor
     */
    constructor() {
        // create own instance in case other dependencies also use nconf
        this._config = new nconf.Provider();

        ///////////////////////////////////////////////////////////////////////////////
        // the priority is the following:                                            //
        // memory > commandline args > environment variables > project config file > //
        // > user config file > machine config file > default config file            //
        ///////////////////////////////////////////////////////////////////////////////

        this._config.use('memory');

        // normalize the argument names to be more robust
        this._config.argv({ parseValues: true, transform: normalizeSettingKey });

        // normalize the argument names to be more robust
        this._config.env({ parseValues: true, transform: normalizeSettingKey });

        // TODO: resolve the paths according to the workspace, once it's set through the config API

        // if "caliper-projectconfig" is set at this point, include that file
        let projectConf = this.get('caliper-projectconfig', undefined);
        if (projectConf && (typeof projectConf === 'string')) {
            this._config.file('project', getFileParsingOptions(projectConf));
        } else if (fs.existsSync('caliper.yaml')) {
            // check whether caliper.yaml is present in the current working directory for convenience
            this._config.file('project', getFileParsingOptions('caliper.yaml'));
        }

        // if "caliper-userconfig" is set at this point, include that file
        let userConfig = this.get('caliper-userconfig', undefined);
        if (userConfig && (typeof userConfig === 'string')) {
            this._config.file('user', getFileParsingOptions(userConfig));
        }

        // if "caliper-machineconfig" is set at this point, include that file
        let machineConfig = this.get('caliper-machineconfig', undefined);
        if (machineConfig) {
            this._config.file('machine', getFileParsingOptions(machineConfig));
        }

        // as fallback, always include the default config packaged with Caliper
        const defaultConfig = path.join(__dirname, 'default.yaml');
        this._config.file('default', getFileParsingOptions(defaultConfig));
    }

    /**
     * Get the config setting with name.
     * If the setting is not found, returns the provided default value.
     * @param {string} name Key/name of the setting.
     * @param {any} defaultValue The default value to return if the setting is not found.
     * @return {any} Value of the setting
     */
    get(name, defaultValue) {
        let value = null;

        try {
            value = this._config.get(name);
        }
        catch(err) {
            value = defaultValue;
        }

        // NOTE: can't use !value, since a falsey value could be a valid setting
        if(value === null || value === undefined) {
            value = defaultValue;
        }

        return value;
    }

    /**
     * Set a value into the 'memory' store of config settings.
     * This will override all other settings.
     * @param {string} name name of the setting
     * @param {any} value value of the setting
     */
    set(name, value) {
        this._config.set(name,value);
    }
}

module.exports = Config;

