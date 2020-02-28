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

const MessengerInterface = require('./messenger-interface');
const Logger = require('../utils/caliper-utils').getLogger('mqtt-worker-messenger');
const MessageHandler = require('../../worker/client/message-handler');

/**
 * Messenger that is based on a process
 */
class ProcessWorkerMessenger extends MessengerInterface {

    /**
     * Constructor for process Worker
     * @param {object} configuration configuration details
     */
    constructor(configuration) {
        super(configuration);
    }

    /**
     * Initialize the Messenger
     * @async
     */
    async initialize() {
        return Promise.resolve();
    }

    /**
     * Get the client UUID
     * @returns {string} the UUID of the process
     */
    getUUID() {
        return process.pid.toString();
    }

    /**
     * Send a message using the messenger
     * @param {object} message the message to send
     */
    send(message) {
        // Convert to string and send
        const msg = JSON.stringify(message);
        process.send(msg);
        Logger.debug(`${this.configuration.sut} worker sent message: ${msg}`);
    }

    /**
     * Clean up any resources associated with the messenger.
     */
    async dispose() {
        // NOOP
    }

    /**
     * Configure the Messenger for use
     * @param {MessageHandler} handlerContext a configured message handler
     */
    configure(handlerContext) {

        const uuid = this.getUUID();
        const sut = this.configuration.sut;
        process.on('message', async function(message) {
            Logger.debug(`${sut} worker processing orchestrator message: ${message}`);
            const msg = JSON.parse(message);
            // Only action if intended for this client
            if (msg.to.includes(uuid) || msg.to.includes('all')) {
                await MessageHandler.handle(handlerContext, msg.data);
            }
        });
    }

}

/**
 * Creates a new ProcessWorkerMessenger instance.
 * @param {object} messengerConfig the messenger configuration
 * @return {MqttMessenger} The ProcessWorkerMessenger instance.
 */
function createMessenger(messengerConfig) {
    return new ProcessWorkerMessenger(messengerConfig);
}

module.exports.createMessenger = createMessenger;
