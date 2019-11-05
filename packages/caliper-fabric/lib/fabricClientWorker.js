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
const FabricClient = require('./fabric');

/**
 * Handles the init message. Constructs and initializes the Fabric adapter.
 * @param {object} context The context of the message handler object.
 * @param {object} message The message object.
 * @return {Promise<FabricClient>} The initialized adapter instance.
 * @async
 */
async function initHandler(context, message) {
    const blockchain = new FabricClient(context.networkConfigPath, context.workspacePath);

    // reload the profiles silently
    await blockchain._initializeRegistrars(false);
    await blockchain._initializeAdmins(false);
    await blockchain._initializeUsers(false);

    return blockchain;
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
