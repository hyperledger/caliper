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

const LaunchWorker = require('./lib/launchWorker');
const { CaliperUtils } = require('@hyperledger/caliper-core');

// enforces singletons
const checkFn = (argv) => {
    const uniqueArgs = ['caliper-bind-sut', 'caliper-bind-args', 'caliper-bind-cwd', 'caliper-bind-file'];
    return CaliperUtils.checkSingleton(argv, uniqueArgs);
};

module.exports._checkFn = checkFn;
module.exports.command = 'worker [options]';
module.exports.describe = 'Launch a Caliper worker process to generate the benchmark workload';
module.exports.builder = yargs => {

    yargs.options({
        'caliper-bind-sut' : {describe: 'The name and version of the platform to bind to', type: 'string' },
        'caliper-bind-cwd'  : {describe: 'The working directory for performing the SDK install', type: 'string' },
        'caliper-bind-args'  : {describe: 'Additional arguments to pass to "npm install". Use the "=" notation when setting this parameter', type: 'string' },
        'caliper-bind-file'  : {describe: 'Yaml file to override default (supported) package versions when binding an SDK', type: 'string' }
    });
    yargs.usage('Usage:\n caliper launch worker --caliper-bind-sut fabric:1.4 [other options]');

    // enforce singletons
    yargs.check(checkFn);

    return yargs;
};

module.exports.handler = (argv) => {
    return argv.thePromise = LaunchWorker.handler(argv);
};
