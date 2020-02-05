#!/usr/bin/env node
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

const yargs = require('yargs');

const version = 'v' + require('./package.json').version;

let results = yargs
    .commandDir('./lib')
    .completion()
    .recommendCommands()
    .help()
    .demandCommand(1, 1, 'Please specify a command to continue')
    .wrap(null)
    .strict()
    .alias('version', 'v')
    .alias('help', 'h')
    .version(version)
    .describe('version', 'Show version information')
    .describe('help', 'Show usage information')
    .argv;

results.thePromise.then( () => {
    console.log('Publish command successful');
    process.exit(0);
}).catch((error) => {
    console.error(`ERROR: Publish command failed: ${error.message}`);
    process.exit(1);
});
