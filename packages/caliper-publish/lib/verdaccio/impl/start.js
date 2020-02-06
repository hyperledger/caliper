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

const path = require('path');
const util = require('./../../utils/cmdutils');

/**
 * Implements the verdaccio start command logic.
 */
class Start {
    /**
     * Handler for the verdaccio start invocation.
     * @param {string} bind The binding endpoint for the Verdaccio process.
     * @async
     */
    static async handler(bind) {
        const rootPath = path.join(__dirname, '..', '..', '..');
        return util.invokeCommand('./artifacts/start-verdaccio.sh', [], { BIND: bind }, rootPath);
    }
}

module.exports = Start;
