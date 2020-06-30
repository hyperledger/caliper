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

process.env.SUPPRESS_NO_CONFIG_WARNING = true;
const { CaliperUtils } = require('@hyperledger/caliper-core');
const Logger = CaliperUtils.getLogger('cli');
const yargs = require('yargs');
const version = 'v' + require('./package.json').version;

let results = yargs
    .commandDir('./lib')
    .completion()
    .recommendCommands()
    .help()
    .demandCommand(1, 1, 'Please specify a command to continue')
    .example('caliper bind\ncaliper unbind\ncaliper launch manager\ncaliper launch worker')
    .wrap(null)
    .epilogue('For more information on Hyperledger Caliper: https://hyperledger.github.io/caliper/')
    .alias('version', 'v')
    .alias('help', 'h')
    .version(version)
    .describe('version', 'Show version information')
    .describe('help', 'Show usage information')
    .strict(false)
    .argv;

results.thePromise.then( () => {
    // DO NOT EXIT THE PROCESS HERE
    // The event loops of the workers are still running at this point
    // The default exit code is 0 anyway
}).catch((error) => {
    Logger.error(`Error during command execution: ${error}`);
    process.exit(1);
});
