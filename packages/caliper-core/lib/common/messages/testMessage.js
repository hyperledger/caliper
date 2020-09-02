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

const Message = require('./message');
const MessageTypes = require('./../utils/constants').Messages.Types;

/**
 * Class for the "test" message.
 */
class TestMessage extends Message {
    /**
     * Constructor for an "test" message instance.
     * @param {string} sender The sender of the message.
     * @param {string[]} recipients The recipients of the message.
     * @param {object} content The contents of the message.
     * @param {string} date The date string of the message.
     * @param {string} error The potential error associated with the message.
     */
    constructor(sender, recipients, content, date = undefined, error = undefined) {
        super(sender, recipients, MessageTypes.Test, content, date, error);

    }

    /**
     * Gets the arguments intended for the worker.
     * @return {object} The worker arguments.
     */
    getWorkerArguments() {
        return this.content.workerArgs;
    }

    /**
     * Gets the number of workers in the current round.
     * @return {number} The number of workers.
     */
    getWorkersNumber() {
        return this.content.totalWorkers;
    }

    /**
     * Gets the label of the round.
     * @return {string} The label of the round.
     */
    getRoundLabel() {
        return this.content.label;
    }

    /**
     * Gets the rate control specification for the round.
     * @return {object} The rate control specification.
     */
    getRateControlSpec() {
        return this.content.rateControl;
    }

    /**
     * Gets the trim length for the round.
     * @return {number} The trim length.
     */
    getTrimLength() {
        return this.content.trim;
    }

    /**
     * Gets the workload specification for the round.
     * @return {object} The workload specification.
     */
    getWorkloadSpec() {
        return this.content.workload;
    }

    /**
     * Gets the zero-based index of the round.
     * @return {number} The index of the round.
     */
    getRoundIndex() {
        return this.content.testRound;
    }

    /**
     * Gets the URL for the Prometheus push gateway.
     * @return {string} The URL of the gateway.
     */
    getPrometheusPushGatewayUrl() {
        return this.content.pushUrl;
    }

    /**
     * Gets the number of TXs to perform in the round.
     * @return {number} The number of TXs.
     */
    getNumberOfTxs() {
        return this.content.numb;
    }

    /**
     * Gets the target duration for the round in seconds.
     * @return {number} The duration of the round in seconds.
     */
    getRoundDuration() {
        return this.content.txDuration;
    }
}

module.exports = TestMessage;
