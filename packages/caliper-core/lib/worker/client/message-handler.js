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
     */
    constructor(handlers) {
        if (!handlers.init) {
            let msg = 'Handler for "init" is not specified';
            logger.error(msg);
            throw new Error(msg);
        }

        this.beforeInitHandler = handlers.beforeInit || MessageHandler.beforeInit;
        this.afterInitHandler = handlers.afterInit || MessageHandler.afterInit;
        this.initHandler = handlers.init;

        this.beforeTestHandler = handlers.beforeTest || MessageHandler.beforeTest;
        this.afterTestHandler = handlers.afterTest || MessageHandler.afterTest;
        this.testHandler = handlers.test || MessageHandler.test;

        // context/this fields
        this.workspacePath = ConfigUtil.get(ConfigUtil.keys.Workspace);
        this.networkConfigPath = ConfigUtil.get(ConfigUtil.keys.NetworkConfig);
        this.networkConfigPath = CaliperUtils.resolvePath(this.networkConfigPath);
        this.adapter = undefined;
        this.workerClient = undefined;
        this.testResult = undefined;
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
     */
    static async afterInit(context, message) {
        context.workerClient = new CaliperLocalClient(context.adapter);
        process.send({type: 'ready', data: {pid: process.pid, complete: true}});
        logger.info('Handled "init" message');
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
     */
    static async afterTest(context, message) {
        await CaliperUtils.sleep(200);
        process.send({type: 'testResult', data: context.testResult});
        logger.info('Handled "test" message');
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
            process.send({type: 'error', data: msg});
            return;
        }

        try {
            switch (message.type) {
            case 'init': {
                await context.beforeInitHandler(context, message);
                context.adapter = await context.initHandler(context, message);
                await context.afterInitHandler(context, message);

                break;
            }
            case 'test': {
                await context.beforeTestHandler(context, message);
                context.testResult = await context.testHandler(context, message);
                await context.afterTestHandler(context, message);

                break;
            }
            default: {
                let msg = `Unknown message type "${message.type}"`;
                logger.error(msg, message);
                process.send({type: 'error', data: msg});
            }
            }
        }
        catch (err) {
            logger.error(`Error while handling "${message.type}" message: ${err.stack || err}`);
            process.send({type: 'error', data: err.toString()});
        }
    }
}

module.exports = MessageHandler;
