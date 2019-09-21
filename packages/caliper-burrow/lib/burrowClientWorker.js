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

const { CaliperLocalClient, CaliperUtils } = require('caliper-core');
const BurrowClient = require('./burrow');

let caliperClient;
/**
 * Message handler
 */
process.on('message', async (message) => {

    if (!message.hasOwnProperty('type')) {
        process.send({ type: 'error', data: 'unknown message type' });
        return;
    }

    try {
        switch (message.type) {
        case 'init': {
            const blockchain = new BurrowClient(message.absNetworkFile, message.networkRoot);
            caliperClient = new CaliperLocalClient(blockchain);
            process.send({ type: 'ready', data: { pid: process.pid, complete: true } });
            break;
        }
        case 'test': {
            let result = await caliperClient.doTest(message);

            await CaliperUtils.sleep(200);
            process.send({ type: 'testResult', data: result });
            break;
        }
        default: {
            process.send({ type: 'error', data: 'unknown message type [' + message.type + ']' });
        }
        }
    }
    catch (err) {
        process.send({ type: 'error', data: err.toString() });
    }
});
