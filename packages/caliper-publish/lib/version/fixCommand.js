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

const Fix = require('./impl/fix');

module.exports.command = 'fix';
module.exports.describe = 'Restore the Caliper package versions to the root version';
module.exports.builder = yargs => {
    yargs.help();
    yargs.usage('Example usage:\n./publish.js version fix');
    return yargs;
};

module.exports.handler = argv => {
    argv.thePromise = Fix.handler();
};
