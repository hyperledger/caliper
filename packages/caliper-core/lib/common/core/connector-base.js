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

const ConnectorInterface = require('./connector-interface');
const Events = require('./../utils/constants').Events.Connector;

/**
 * Optional base class for connectors.
 */
class ConnectorBase extends ConnectorInterface {

    /**
     * Constructor
     * @param {number} workerIndex The zero-based worker index.
     * @param {string} bcType The target SUT type.
     */
    constructor(workerIndex, bcType) {
        super();
        this.workerIndex = workerIndex;
        this.bcType = bcType;
    }

    /**
     * Retrieve the target SUT type.
     * @return {string} The target SUT type.
     */
    getType() {
        return this.bcType;
    }

    /**
     * Retrieve the worker index.
     * @return {number} The zero-based worker index.
     */
    getWorkerIndex() {
        return this.workerIndex;
    }

    /**
     * Return required arguments for reach workers process, e.g., return information generated during an admin phase, such as contract installation.
     * Information returned here is passed to the workers through the messaging protocol on test.
     * @param {Number} number The total number of worker processes.
     * @return {Promise<object[]>} Array of empty objects as default, one for each worker process.
     * @async
     */
    async prepareWorkerArguments(number) {
        let result = [];
        for(let i = 0 ; i< number ; i++) {
            result[i] = {}; // as default, return an empty object for each worker
        }
        return result;
    }

    /**
     * Send one or more requests to the backing SUT.
     * The default implementation handles batching and TX events,
     * and delegates to the {@link _sendSingleRequest} method.
     * @param {object|object[]} requests The object (or array of objects) containing the options of the request(s).
     * @return {Promise<TxStatus|TxStatus[]>} The result (or an array of them) of the executed request(s).
     * @async
     */
    async sendRequests(requests) {
        if (!Array.isArray(requests)) {
            this._onTxsSubmitted(1);
            const result = await this._sendSingleRequest(requests);
            this._onTxsFinished(result);
            return result;
        }

        const promises = [];
        for (let i = 0; i < requests.length; ++i) {
            this._onTxsSubmitted(1);
            promises.push(this._sendSingleRequest(requests[i]));
        }

        const results = await Promise.all(promises);
        this._onTxsFinished(results);
        return results;
    }

    /**
     * Raises the "txsSubmitted" event.
     * @param {number} count The number of TXs submitted. Passed to the raised event.
     * @private
     */
    _onTxsSubmitted(count) {
        this.emit(Events.TxsSubmitted, count);
    }

    /**
     * Raises the "txsFinished" event.
     * @param {TxStatus|TxStatus[]} txResults The (array of) TX result(s). Passed to the raised event.
     * @private
     */
    _onTxsFinished(txResults) {
        this.emit(Events.TxsFinished, txResults);
    }

    /**
     * Send a request to the backing SUT. Must be overridden by derived classes.
     * @param {object} request The object containing the options of the request.
     * @return {Promise<TxStatus>} The array of data about the executed requests.
     * @protected
     * @async
     */
    async _sendSingleRequest(request) {
        throw new Error('Method "_sendSingleRequest" is not implemented for this connector');
    }
}

module.exports = ConnectorBase;
