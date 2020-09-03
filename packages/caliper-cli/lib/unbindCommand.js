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

const { CaliperUtils } = require('@hyperledger/caliper-core');

const BindCommon = require('./lib/bindCommon');

// enforces singletons
const checkFn = (argv) => {
    const uniqueArgs = ['caliper-bind-sut', 'caliper-bind-args', 'caliper-bind-cwd', 'caliper-bind-file'];
    return CaliperUtils.checkSingleton(argv, uniqueArgs);
};

module.exports._checkFn = checkFn;
module.exports.command = 'unbind [options]';
module.exports.describe = 'Unbind Caliper from a previously bound SUT and its SDK version';
module.exports.builder = function (yargs){

    yargs.options({
        'caliper-bind-sut' : {describe: 'The name and version of the platform and its SDK to unbind', type: 'string' },
        'caliper-bind-cwd'  : {describe: 'The working directory for performing the SDK removal', type: 'string' },
        'caliper-bind-args'  : {describe: 'Additional arguments to pass to "npm remove". Use the "=" notation when setting this parameter', type: 'string' },
        'caliper-bind-file'  : {describe: 'Yaml file to override default (supported) package versions when unbinding an SDK', type: 'string' }
    });
    yargs.usage('Usage:\n  caliper unbind --caliper-bind-sut fabric:1.4 --caliper-bind-cwd ./ --caliper-bind-args="-g"');
    // enforce the option after these options
    yargs.requiresArg(['caliper-bind-sut', 'caliper-bind-args', 'caliper-bind-cwd']);

    // enforce singletons
    yargs.check(checkFn);

    return yargs;
};

module.exports.handler = (argv) => {
    return argv.thePromise = BindCommon.handler(argv, false);
};
