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
const cmdUtil = require('./lib/utils/cmdutils');
const yargs = require('yargs');
const chalk = require('chalk');
const version = 'v' + require('./package.json').version;

let results = yargs
    .commandDir('./lib')
    .help()
    .example('caliper benchmark run\ncaliper zooclient start\ncaliper zooservice start  ')
    .demand(1)
    .wrap(null)
    .strict()
    .epilogue('For more information on Hyperledger Caliper: https://hyperledger.github.io/caliper/')
    .alias('v', 'version')
    .version(version)
    .describe('v', 'show version information')
    .argv;

results.thePromise.then( () => {
    if (!results.quiet) {
        cmdUtil.log(chalk.green('\nCommand succeeded\n'));
    }
    process.exit(0);
}).catch((error) => {
    cmdUtil.log(error+chalk.red('\nCommand failed\n'));
    process.exit(1);
});
