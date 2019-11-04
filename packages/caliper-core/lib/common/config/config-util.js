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

const Config = require('./Config.js');

/**
 * Gets the singleton Config instance, creates it if necessary.
 * @return {Config} The singleton Config instance.
 * @private
 */
function _getConfigInstance() {
    if (!global.caliper) {
        global.caliper = {};
    }

    if (!global.caliper.config) {
        global.caliper.config = new Config();
    }

    return global.caliper.config;
}

/**
 * Utility function for setting a value for a key in the configuration store.
 * @param {string} name The key of the configuration to set.
 * @param {any} value The value to set.
 */
function set(name, value) {
    _getConfigInstance().set(name, value);
}

/**
 * Utility function for retrieving a value from the configuration store.
 * @param {string} name The key of the configuration to retrieve.
 * @param {any} defaultValue The value to return in case the key is not found.
 * @return {any} The value of the configuration or the defaultValue parameter if not found.
 */
function get(name, defaultValue = undefined) {
    return _getConfigInstance().get(name, defaultValue);
}

module.exports.get = get;
module.exports.set = set;
module.exports.keys = Config.keys;
