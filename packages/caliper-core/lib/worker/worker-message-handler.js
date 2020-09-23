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

const CaliperWorker = require('./caliper-worker');
const MessageTypes = require('../common/utils/constants').Messages.Types;

const ConnectedMessage = require('../common/messages/connectedMessage');
const AssignedMessage = require('../common/messages/assignedMessage');
const ReadyMessage = require('../common/messages/readyMessage');
const PreparedMessage = require('../common/messages/preparedMessage');
const TestResultMessage = require('../common/messages/testResultMessage');

const logger = require('../common/utils/caliper-utils.js').getLogger('worker-message-handler');

/**
 * Class for handling messages in worker processes.
 *
 * @property {MessengerInterface} messenger The messenger instance.
 * @property {function} connectorFactory The SUT connector factory function.
 * @property {string} managerUuid The UUID of the manager messenger.
 * @property {number} workerIndex The zero-based index of the worker process.
 * @property {CaliperWorker} The worker round executor.
 * @property {ConnectorBase} The SUT connector instance.
 * @property {{resolve, reject}} exitPromiseFunctions The resolve/reject Promise functions to handle the async exit message later.
 */
class WorkerMessageHandler {
    /**
     * Initializes the message handler instance.
     * @param {MessengerInterface} messenger The messenger to use for communication with the manager.
     * @param {function} connectorFactory Factory function for creating the connector instance.
     */
    constructor(messenger, connectorFactory) {
        if (!messenger) {
            let msg = 'Messenger instance is undefined';
            logger.error(msg);
            throw new Error(msg);
        }

        if (!connectorFactory || typeof connectorFactory !== 'function') {
            let msg = 'Connector factory is undefined or not a function';
            logger.error(msg);
            throw new Error(msg);
        }

        this.messenger = messenger;
        this.connectorFactory = connectorFactory;
        this.managerUuid = undefined;
        this.workerIndex = undefined;
        this.worker = undefined;
        this.connector = undefined;
        this.exitPromiseFunctions = undefined;

        this.exitPromise = new Promise((resolve, reject) => {
            this.exitPromiseFunctions = {
                resolve: resolve,
                reject: reject
            };
        });

        // to regain the context of the message handler
        // "this" would point to the messenger instance
        const self = this;
        this.messenger.on(MessageTypes.Register, async (message) => {
            await self._handleRegisterMessage(message);
        });

        this.messenger.on(MessageTypes.AssignId, async (message) => {
            await self._handleAssignIdMessage(message);
        });

        this.messenger.on(MessageTypes.Initialize, async (message) => {
            await self._handleInitializeMessage(message);
        });

        this.messenger.on(MessageTypes.Prepare, async (message) => {
            await self._handlePrepareMessage(message);
        });

        this.messenger.on(MessageTypes.Test, async (message) => {
            await self._handleTestMessage(message);
        });

        this.messenger.on(MessageTypes.Exit, async (message) => {
            await self._handleExitMessage(message);
        });
    }

    /**
     * Logs that a message is being handled.
     * @param {Message} message The message being handled.
     * @private
     */
    _logHandling(message) {
        const workerID = this.workerIndex
            ? `Worker#${this.workerIndex} (${this.messenger.getUUID()})`
            : `Worker (${this.messenger.getUUID()})`;

        logger.debug(`Handling "${message.getType()}" message for ${workerID}: ${message.stringify()}`);
    }

    /**
     * Logs that a message was handled, either successfully or unsuccessfully.
     * @param {Message} message The message that was handled.
     * @param {Error} error The error instance if an error occurred.
     * @private
     */
    _logHandled(message, error = undefined) {
        const workerID = this.workerIndex
            ? `Worker#${this.workerIndex} (${this.messenger.getUUID()})`
            : `Worker (${this.messenger.getUUID()})`;

        if (error) {
            logger.error(`Error while handling "${message.getType()}" message for ${workerID}: ${error.stack}`);
        } else {
            logger.debug(`Handled "${message.getType()}" message for ${workerID}`);
        }
    }

    /**
     * Handles the "register" message.
     * @param {RegisterMessage} message The message object.
     * @private
     * @async
     */
    async _handleRegisterMessage(message) {
        this._logHandling(message);

        const sender = message.getSender();
        const workerID = this.workerIndex
            ? `Worker#${this.workerIndex} (${this.messenger.getUUID()})`
            : `Worker (${this.messenger.getUUID()})`;

        if (!this.managerUuid) {
            // Register availability with manager
            this.managerUuid = sender;
            logger.debug(`Registering ${workerID} with manager "${this.managerUuid}"`);
            const msg = new ConnectedMessage(this.messenger.getUUID(), [this.managerUuid]);
            this.messenger.send(msg);
        }

        this._logHandled(message);
    }

    /**
     * Handles the "assignId" message.
     * @param {AssignIdMessage} message The message object.
     * @private
     * @async
     */
    async _handleAssignIdMessage(message) {
        this._logHandling(message);

        this.workerIndex = message.getWorkerIndex();
        const msg = new AssignedMessage(this.messenger.getUUID(), [this.managerUuid]);
        this.messenger.send(msg);

        this._logHandled(message);
    }

    /**
     * Handles the "initialize" message.
     * @param {InitializeMessage} message The message object.
     * @private
     * @async
     */
    async _handleInitializeMessage(message) {
        this._logHandling(message);
        logger.info(`Initializing Worker#${this.workerIndex}...`);

        let err;
        try {
            this.connector = await this.connectorFactory(this.workerIndex);
            this.worker = new CaliperWorker(this.connector, this.workerIndex, this.messenger, this.managerUuid);
            logger.info(`Worker#${this.workerIndex} initialized`);
        } catch (error) {
            err = error;
        }

        const msg = new ReadyMessage(this.messenger.getUUID(), [this.managerUuid]);
        this.messenger.send(msg);

        this._logHandled(message, err);
    }

    /**
     * Handles the "prepare" message.
     * @param {PrepareMessage} message The message object.
     * @private
     * @async
     */
    async _handlePrepareMessage(message) {
        this._logHandling(message);
        logger.info(`Preparing Worker#${this.workerIndex} for Round#${message.getRoundIndex()}`);

        let err;
        try {
            await this.worker.prepareTest(message);
            logger.info(`Worker#${this.workerIndex} prepared for Round#${message.getRoundIndex()}`);
        } catch (error) {
            err = error;
        }

        const msg = new PreparedMessage(this.messenger.getUUID(), [this.managerUuid], undefined, err ? err.toString() : undefined);
        this.messenger.send(msg);

        this._logHandled(message, err);
    }

    /**
     * Handles the "test" message.
     * @param {TestMessage} message The message object.
     * @private
     * @async
     */
    async _handleTestMessage(message) {
        this._logHandling(message);
        logger.info(`Worker#${this.workerIndex} is starting Round#${message.getRoundIndex()}`);

        let err;
        let result;
        try {
            result = await this.worker.executeRound(message);
            logger.info(`Worker#${this.workerIndex} finished Round#${message.getRoundIndex()}`);
        } catch (error) {
            err = error;
        }

        const msg = new TestResultMessage(this.messenger.getUUID(), [this.managerUuid], result || {}, undefined, err ? err.toString() : undefined);
        this.messenger.send(msg);
        this._logHandled(message, err);
    }

    /**
     * Handles the "exit" message.
     * @param {ExitMessage} message The message object.
     * @private
     * @async
     */
    async _handleExitMessage(message) {
        this._logHandling(message);

        logger.info(`Worker#${this.workerIndex} is exiting`);
        this.exitPromiseFunctions.resolve();

        this._logHandled(message);
    }

    /**
     * Gets a promise that will resolve when the message handler receives an exit message.
     */
    async waitForExit() {
        await this.exitPromise;
    }
}

module.exports = WorkerMessageHandler;
