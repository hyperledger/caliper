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

const { EventEmitter } = require('events');
const Logger = require('../utils/caliper-utils').getLogger('messenger-base');


/**
 * Interface for messenger implementations. Derived classes must override every function of this class.
 */
class MessengerInterface extends EventEmitter {

    /**
     * Constructor for the messenger class.
     * @param {object} configuration User-provided configuration details for the messenger.
     */
    constructor(configuration) {
        super();
        this.configuration = configuration;
    }

    /**
     * Call the listeners registered for the given message type.
     * @param {Message} message The message object.
     */
    onMessage(message) {
        this.emit(message.getType(), message);
    }

    /**
     * Initialize the messenger instance.
     * @async
     */
    async initialize() {
        this._throwNotImplementedError('initialize');
    }

    /**
     * Configure the messenger instance with the related processes.
     * @param {Process[]} processes The process instances this process can communicate with.
     */
    async configureProcessInstances(processes) {
        this._throwNotImplementedError('configure');
    }

    /**
     * Send a message using the messenger.
     * @param {Message} message The message object.
     */
    send(message) {
        this._throwNotImplementedError('send');
    }

    /**
     * Get the UUID for the messenger instance to use as sender or recipient address.
     * @return {string} The UUID of the messenger.
     */
    getUUID() {
        this._throwNotImplementedError('getUUID');
        return '';
    }

    /**
     * Clean up any resources associated with the messenger.
     */
    async dispose() {
        // require an explicit noop dispose implementation from child classes
        this._throwNotImplementedError('dispose');
    }

    /**
     * Logs and throws a "not implemented" error for the given function.
     * @param {string} functionName The name of the function.
     * @private
     */
    _throwNotImplementedError(functionName) {
        let msg = `The function "${functionName}" is not implemented for this messenger`;
        Logger.error(msg);
        throw new Error(msg);
    }

}

module.exports = MessengerInterface;
