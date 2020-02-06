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

const Start = require('./impl/start');

module.exports.command = 'start [options]';
module.exports.describe = 'Start a local verdaccio server.';
module.exports.builder = yargs => {
    yargs.options({
        bind: {
            alias: 'b',
            demand: false,
            default: 'localhost:4873',
            type: 'string',
            describe: 'The binding endpoint for the Verdaccio process.'
        }
    });
    yargs.help();
    yargs.usage('Example usage:\n./publish.js verdaccio start --bind localhost:4873');
    return yargs;
};

module.exports.handler = argv => {
    argv.thePromise = Start.handler(argv.bind);
};
