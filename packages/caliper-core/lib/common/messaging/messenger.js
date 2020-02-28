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

const path = require('path');

const CaliperUtils = require('./../utils/caliper-utils');
const Logger = CaliperUtils.getLogger('messenger.js');

const builtInMessengers = new Map([
    ['mqtt-master', path.join(__dirname, './mqtt-master.js')],
    ['mqtt-worker', path.join(__dirname, './mqtt-worker.js')],
    ['process-master', path.join(__dirname, './process-master.js')],
    ['process-worker', path.join(__dirname, './process-worker.js')]
]);

const Messenger = class {

    /**
     * Instantiates the proxy messenger and creates the configured messenger behind it.
     * @param {object} configuration The messenger configuration object.
     */
    constructor(configuration) {
        this.configuration = configuration;

        Logger.info(`Creating messenger of type "${configuration.type}" ${configuration.sut ? ` for SUT ${configuration.sut}` : ''}`);

        // resolve the type to a module's factory function
        let factoryFunction = CaliperUtils.loadModuleFunction(builtInMessengers, configuration.type, 'createMessenger');
        this.messenger = factoryFunction(configuration);
    }

    /**
     * Initialize the Messenger
     * @async
     */
    async initialize() {
        await this.messenger.initialize();
    }

    /**
     * Configure the Messenger for use
     * @param {object} configurationObject configuration object
     * @async
     */
    async configure(configurationObject) {
        await this.messenger.configure(configurationObject);
    }

    /**
     * Get the UUID for the messenger
     * @returns {string} the UUID of the messenger
     */
    getUUID() {
        return this.messenger.getUUID();
    }

    /**
     * Clean up any resources associated with the messenger.
     */
    async dispose() {
        await this.messenger.dispose();
    }

    /**
     * Method used to publish message to worker clients
     * @param {string[]} to string array of workers that the update is intended for
     * @param {*} type the string type of the update
     * @param {*} data data pertinent to the update type
     */
    send(to, type, data) {
        // Create Date object for timestamp
        const date = new Date();

        // Augment data object with type
        data.type = type;

        // Create complete message
        const message = {
            to,
            from: this.messenger.getUUID(),
            timestamp: date.toISOString(),
            data
        };

        this.messenger.send(message);
    }

};

module.exports = Messenger;
