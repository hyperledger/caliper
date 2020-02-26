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

const SawtoothAdapter = require('./sawtooth');

/**
 * Constructs a Sawtooth adapter.
 * @param {number} workerIndex The zero-based index of the worker who wants to create an adapter instance. -1 for the master process.
 * @return {Promise<BlockchainInterface>} The initialized adapter instance.
 * @async
 */
async function adapterFactory(workerIndex) {
    return new SawtoothAdapter(workerIndex);
}

module.exports.adapterFactory = adapterFactory;
