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

const { MessageHandler } = require('@hyperledger/caliper-core');
const EthereumClient = require('./ethereum');

/**
 * Handles the init message. Constructs the Ethereum adapter.
 * @param {object} context The context of the message handler object.
 * @param {object} message The message object.
 * @return {Promise<EthereumClient>} The initialized adapter instance.
 * @async
 */
async function initHandler(context, message) {
    return new EthereumClient(context.networkConfigPath, context.workspacePath);
}

const handlerContext = new MessageHandler({
    init: initHandler
});

/**
 * Message handler
 */
process.on('message', async (message) => {
    await MessageHandler.handle(handlerContext, message);
});
