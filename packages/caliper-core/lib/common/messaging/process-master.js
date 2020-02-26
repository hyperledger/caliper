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
const Logger = require('../utils/caliper-utils').getLogger('process-master-messenger');


/**
 * Messenger that is based on an process implementation
 */
class ProcessMasterMessenger extends MessengerInterface {

    /**
     * Constructor for process Master
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
     * Configure the Messenger with the worker orchestrator
     * @param {WorkerOrchestrator} orchestrator the worker orchestrator
     */
    configure(orchestrator) {
        this.workerProcesses = orchestrator.workerObjects;
        for (const workerProcess of this.workerProcesses) {
            workerProcess.on('message', function(message) {
                Logger.debug(`Processing worker message: ${message}`);
                orchestrator.processWorkerUpdate(JSON.parse(message));
            });
        }
    }

    /**
     * Get the client UUID
     * @returns {string} the UUID of the process
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
     * Send a message using the messenger
     * @param {object} message the message to send
     */
    send(message) {
        // Convert to string and send
        const msg = JSON.stringify(message);
        for (const workerProcess of this.workerProcesses) {
            workerProcess.send(msg);
            Logger.debug(`Sent message: ${msg}`);
        }
    }

}

/**
 * Creates a new ProcessMasterMessenger instance.
 * @param {object} messengerConfig the messenger configuration
 * @return {ProcessMasterMessenger} The ProcessMasterMessenger instance.
 */
function createMessenger(messengerConfig) {
    return new ProcessMasterMessenger(messengerConfig);
}

module.exports.createMessenger = createMessenger;
