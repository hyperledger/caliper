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

const childProcess = require('child_process');
const path = require('path');

/**
 * Class used to spawn fabric client workers
 */
class FabricClientFactory {

    /**
     * Spawn the worker and perform required init
     * @returns {Object} the child process
     */
    spawnWorker() {
        const child = childProcess.fork(path.join(__dirname, './fabricClientWorker.js'), process.argv.slice(2), { env: process.env});

        const msg = {
            type: 'init'
        };
        child.send(msg);

        return child;
    }
}

module.exports = FabricClientFactory;
