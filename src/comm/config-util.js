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

//
//Internal method to add additional configuration file to override default file configuration settings
//
module.exports.addConfigFile = (path) => {
    const config = exports.getConfig();
    config.file(path);
};

//
//Internal method to set an override setting to the configuration settings
//
module.exports.setConfigSetting = (name, value) => {
    const config = exports.getConfig();
    config.set(name, value);
};

//
//Internal method to get an override setting to the configuration settings
//
exports.getConfigSetting = (name, default_value) => {
    const config = exports.getConfig();
    return config.get(name, default_value);
};

//
// Internal method to get the configuration settings singleton
//
exports.getConfig = () => {
    if (global.config) {
        return global.config;
    }
    const config = new Config();
    global.config = config;
    return config;
};
