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

const ProcessMessenger = require('./process-messenger');

/**
 * Creates a new ProcessMessenger instance.
 * @param {object} messengerConfig the messenger configuration
 * @return {MessengerInterface} The messenger instance.
 */
function createProcessMessenger(messengerConfig) {
    return new ProcessMessenger(messengerConfig);
}

module.exports.createManagerMessenger = createProcessMessenger;
module.exports.createWorkerMessenger = createProcessMessenger;
