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

const MessengerInterface = require('./../messenger-interface');
const ParseMessage = require('./../../messages/parse');
const Logger = require('./../../utils/caliper-utils').getLogger('process-messenger');

/**
 * IPC-based messenger implementation.
 *
 * @property {Process[]} processes The process instances this messenger can communication with.
 */
class ProcessMessenger extends MessengerInterface {

    /**
     * Constructor for the messenger class.
     * @param {object} configuration User-provided configuration details for the messenger.
     */
    constructor(configuration) {
        super(configuration);
    }

    /**
     * Initialize the messenger instance.
     * @async
     */
    async initialize() {
        // NOOP
    }

    /**
     * Configure the Messenger with the related processes.
     * @param {Process[]} processes The process instances this process can communicate with.
     */
    async configureProcessInstances(processes) {
        this.processes = processes;
        const uuid = this.getUUID();
        const self = this;

        for (const workerProcess of this.processes) {
            workerProcess.on('message', (message) => {
                Logger.debug(`Process "${uuid}" handling message: ${message}`);
                const msg = ParseMessage(message);
                // Only action if intended for this process
                if (msg.forRecipient(uuid)) {
                    self.onMessage(msg);
                } else {
                    Logger.debug(`Messenger "${uuid}" ignored message: ${message}`);
                }
            });
        }
    }

    /**
     * Get the UUID for the messenger instance to use as sender or recipient address.
     * @return {string} The UUID of the messenger.
     */
    getUUID() {
        return process.pid.toString();
    }

    /**
     * Clean up any resources associated with the messenger.
     */
    async dispose() {
        // NOOP
    }

    /**
     * Send a message using the messenger.
     * @param {Message} message The message object.
     */
    send(message) {
        // Convert to string and send
        const msg = message.stringify();
        for (const proc of this.processes) {
            proc.send(msg);
            Logger.debug(`Process "${this.getUUID()}" sent message: ${msg}`);
        }
    }
}

module.exports = ProcessMessenger;
