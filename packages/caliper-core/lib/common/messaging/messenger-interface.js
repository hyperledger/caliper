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

const Logger = require('../utils/caliper-utils').getLogger('messenger-base');


/**
 * Interface of messenger. Messenger implementations must follow a naming convention that is <type>-observer.js so
 * that they may be dynamically loaded in the WorkerOrchestrator and WorkerAdaptor
 */
class MessengerInterface {

    /**
     * Set configuration details
     * @param {object} configuration configuration details for the messenger
     */
    constructor(configuration) {
        this.configuration = configuration;
    }

    /**
     * Initialize the Messenger
     * @async
     */
    async initialize() {
        this._throwNotImplementedError('initialize');
    }

    /**
     * Configure the Messenger for use
     * @async
     */
    async configure() {
        this._throwNotImplementedError('configure');
    }

    /**
     * Send a message using the messenger
     */
    send() {
        this._throwNotImplementedError('send');
    }

    /**
     * Get the UUID for the messenger
     */
    getUUID() {
        this._throwNotImplementedError('getUUID');
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
