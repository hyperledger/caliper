/* eslint-disable valid-jsdoc */
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

/**
 * Mandatory interface for all connectors.
 * @extends EventEmitter to provide events about the status of SUT requests.
 */
class ConnectorInterface extends EventEmitter {

    /**
     * Retrieve the target SUT type.
     * @return {string} The target SUT type.
     */
    getType() {
        this._throwNotImplemented('getType');
    }

    /**
     * Retrieve the worker index.
     * @return {number} The zero-based worker index.
     */
    getWorkerIndex() {
        this._throwNotImplemented('getWorkerIndex');
    }

    /**
     * Initialize the connector and potentially the SUT.
     * @param {boolean} workerInit Indicates whether the initialization happens in the worker process.
     * @async
     */
    async init(workerInit) {
        this._throwNotImplemented('init');
    }

    /**
     * Deploy the configured smart contracts to the SUT if applicable.
     * @async
     */
    async installSmartContract() {
        this._throwNotImplemented('installSmartContract');
    }

    /**
     * Return required arguments for reach workers process, e.g., return information generated during an admin phase, such as contract installation.
     * Information returned here is passed to the workers through the messaging protocol on test.
     * @param {Number} number The total number of worker processes.
     * @return {Promise<object[]>} Array of data objects, one for each worker process.
     * @async
     */
    async prepareWorkerArguments(number) {
        this._throwNotImplemented('prepareWorkerArguments');
    }

    /**
     * Get a connector-specific context object for the workload module of the given round.
     * @param {number} roundIndex The zero-based round index of the test.
     * @param {object} args Arguments prepared by the connector's {@link prepareWorkerArguments} method in the manager process.
     * @return {Promise<object>} The prepared context object for the workload module.
     * @async
     */
    async getContext(roundIndex, args) {
        this._throwNotImplemented('getContext');
    }

    /**
     * Release the current context and related resources previously prepared by the {@link getContext} method.
     * @async
     */
    async releaseContext() {
        this._throwNotImplemented('releaseContext');
    }

    /**
     * Send one or more requests to the backing SUT.
     * @param {object|object[]} requests The object (or array of objects) containing the options of the request(s).
     * @return {Promise<TxStatus|TxStatus[]>} The result (or an array of them) of the executed request(s).
     * @async
     */
    async sendRequests(requests) {
        this._throwNotImplemented('sendRequests');
    }

    /**
     * Throws and error to signal a not implemented method.
     * @param {string} method The name of the method.
     * @private
     */
    _throwNotImplemented(method) {
        throw new Error(`Method "${method}" is not implemented for this connector`);
    }
}

module.exports = ConnectorInterface;
