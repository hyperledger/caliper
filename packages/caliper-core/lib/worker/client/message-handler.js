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

const ConfigUtil = require('../../common/config/config-util.js');
const CaliperUtils = require('../../common/utils/caliper-utils.js');
const CaliperLocalClient = require('../../worker/client/caliper-local-client');

const logger = CaliperUtils.getLogger('message-handler');

/**
 * Base class for handling IPC messages in worker processes.
 */
class MessageHandler {
    /**
     * Initializes the BaseMessageHandler instance.
     * @param {object} handlers Object of message handler functions.
     * @param {Messenger} messenger the Messenger to use for communication with the orchestrator
     */
    constructor(handlers, messenger) {

        if (!handlers.init) {
            let msg = 'Handler for "init" is not specified';
            logger.error(msg);
            throw new Error(msg);
        }

        if (!messenger) {
            let msg = '"messenger" is not specified';
            logger.error(msg);
            throw new Error(msg);
        }

        this.messenger = messenger;

        this.beforeInitHandler = handlers.beforeInit || MessageHandler.beforeInit;
        this.afterInitHandler = handlers.afterInit || MessageHandler.afterInit;
        this.initHandler = handlers.init;

        this.beforePrepareHandler = handlers.beforePrepare || MessageHandler.beforePrepare;
        this.afterPrepareHandler = handlers.afterPrepare || MessageHandler.afterPrepare;
        this.prepareHandler = handlers.prepare || MessageHandler.prepare;

        this.beforeTestHandler = handlers.beforeTest || MessageHandler.beforeTest;
        this.afterTestHandler = handlers.afterTest || MessageHandler.afterTest;
        this.testHandler = handlers.test || MessageHandler.test;

        // context/this fields
        this.workspacePath = ConfigUtil.get(ConfigUtil.keys.Workspace);
        this.networkConfigPath = ConfigUtil.get(ConfigUtil.keys.NetworkConfig);
        this.networkConfigPath = CaliperUtils.resolvePath(this.networkConfigPath);
        this.adapter = undefined;      // The adaptor to use when creating a CaliperLocalClient
        this.workerClient = undefined; // An instantiated CaliperLocalClient
        this.workerId = undefined;     // The Caliper client index (zero based)
        this.testResult = undefined;   // The result of running a test

    }

    /**
     * Called before processing the "init" message.
     * @param {object} context The context/state of the message handler.
     * @param {object} message The message object.
     */
    static async beforeInit(context, message) {
        logger.info('Handling "init" message');
        logger.debug('Message content', message);
    }

    /**
     * Called after processing the "init" message.
     * @param {object} context The context/state of the message handler.
     * @param {object} message The message object.
     * @param {object} error Possible error object
     */
    static async afterInit(context, message, error) {
        const type = 'ready';
        if (error) {
            // send(to, type, data)
            context.messenger.send(['orchestrator'], type, {error: error.toString()});
            logger.error(`Handled unsuccessful "init" message for worker ${context.workerId}, with error: ${error.stack}`);
        } else {
            context.workerClient = new CaliperLocalClient(context.adapter, context.workerId, context.messenger);
            context.messenger.send(['orchestrator'], type, {});
            logger.info(`Handled successful "init" message for worker ${context.workerId}`);
        }
    }

    /**
     * Called before processing the "prepare" message.
     * @param {object} context The context/state of the message handler.
     * @param {object} message The message object.
     */
    static async beforePrepare(context, message) {
        logger.info('Handling "prepare" message');
        logger.debug('Message content', message);
    }

    /**
     * Called after processing the "prepare" message.
     * @param {object} context The context/state of the message handler.
     * @param {object} message The message object.
     * @param {object} error An error conditioning message
     */
    static async afterPrepare(context, message, error) {
        const type = 'prepared';
        if (error) {
            // send(to, type, data)
            context.messenger.send(['orchestrator'], type, {error: error.toString()});
            logger.error(`Handled unsuccessful "prepare" message for worker ${context.workerId} and test round ${message.testRound} with error ${error.stack}`);
        } else {
            context.messenger.send(['orchestrator'], type, {});
            logger.info(`Handled successful "prepare" message for worker ${context.workerId} and test round ${message.testRound}`);
        }

    }

    /**
     * Called before processing the "test" message.
     * @param {object} context The context/state of the message handler.
     * @param {object} message The message object.
     */
    static async beforeTest(context, message) {
        logger.info('Handling "test" message');
        logger.debug('Message content', message);
    }

    /**
     * Called after processing the "test" message.
     * @param {object} context The context/state of the message handler.
     * @param {object} message The message object.
     * @param {object} error An error conditioning message
     */
    static async afterTest(context, message, error) {
        const type = 'testResult';

        if (error) {
            // send(to, type, data)
            context.messenger.send(['orchestrator'], type, {error: error.toString()});
            logger.error(`Handled unsuccessful "test" message for worker ${context.workerId} and test round ${message.testRound} with error ${error.stack}`);
        } else {
            context.messenger.send(['orchestrator'], type, context.testResult);
            logger.info(`Handled successful "test" message for worker ${context.workerId} and test round ${message.testRound}`);
        }
    }

    /**
     * Called for processing the "prepare" message.
     * @param {object} context The context/state of the message handler.
     * @param {object} message The message object.
     * @return {Promise<object>} The result object.
     */
    static async prepare(context, message) {
        await context.workerClient.prepareTest(message);
    }

    /**
     * Called for processing the "test" message.
     * @param {object} context The context/state of the message handler.
     * @param {object} message The message object.
     * @return {Promise<object>} The result object.
     */
    static async test(context, message) {
        return context.workerClient.doTest(message);
    }

    /**
     * Handles the IPC message.
     * @param {object} context The context/state of the message handler.
     * @param {object} message The message object.
     */
    static async handle(context, message) {
        if (!message.hasOwnProperty('type')) {
            let msg = 'Message type is missing';
            logger.error(msg, message);
            context.messenger.send(['orchestrator'], 'error', {error: msg});
            return;
        }

        try {
            switch (message.type) {
            case 'register':
                if (!context.registered) {
                    // Register availability with orchestrator
                    context.messenger.send(['orchestrator'], 'connected', {});
                    context.registered = true;
                }
                break;
            case 'assignId':
                context.workerId = message.workerId;
                context.messenger.send(['orchestrator'], 'assigned', {});
                break;
            case 'initialize': {
                try {
                    await context.beforeInitHandler(context, message);
                    context.adapter = await context.initHandler(context.workerId);
                    await context.afterInitHandler(context, message, undefined);
                } catch (error) {
                    await context.afterInitHandler(context, message, error);
                }

                break;
            }
            case 'prepare': {
                try {
                    await context.beforePrepareHandler(context, message);
                    await context.prepareHandler(context, message);
                    await context.afterPrepareHandler(context, message, undefined);
                } catch (error) {
                    await context.afterPrepareHandler(context, message, error);
                }

                break;
            }
            case 'test': {
                try {
                    await context.beforeTestHandler(context, message);
                    context.testResult = await context.testHandler(context, message);
                    await context.afterTestHandler(context, message, undefined);
                } catch (err) {
                    await context.afterTestHandler(context, message, err);
                }

                break;
            }
            case 'exit': {
                logger.info('Handling "exit" message');
                await context.messenger.dispose();
                logger.info(`Handled "exit" message for worker ${context.workerId}, exiting process`);
                process.exit(0);
                break;
            }
            default: {
                let msg = `Unknown message type "${message.type}"`;
                logger.error(msg, message);
                context.messenger.send(['orchestrator'], 'error', {error: msg});
            }
            }
        }
        catch (err) {
            logger.error(`Error while handling "${message.type}" message: ${err.stack || err}`);
            context.messenger.send(['orchestrator'], 'error', {error: err.toString()});
        }
    }
}

module.exports = MessageHandler;
