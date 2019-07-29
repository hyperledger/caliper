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

const Bind = require ('./bind/bind.js');

// enforces singletons
const checkFn = (argv, options) => {

    ['caliper-bind-sut','caliper-bind-sdk', 'caliper-bind-args', 'caliper-bind-cwd'].forEach((e)=>{
        if (Array.isArray(argv[e])){
            throw new Error(`Option ${e} can only be specified once`);
        }
    });

    return true;
};
module.exports._checkFn = checkFn;
module.exports.command = 'bind [options]';
module.exports.describe = 'Bind Caliper to a specific SUT and its SDK version';
module.exports.builder = function (yargs){

    yargs.options({
        'caliper-bind-sut' : {describe: 'The name of the platform to bind to', type: 'string' },
        'caliper-bind-sdk'  : {describe: 'Version of the platform SDK to bind to', type: 'string'},
        'caliper-bind-cwd'  : {describe: 'The working directory for performing the SDK install', type: 'string'},
        'caliper-bind-args'  : {describe: 'Additional arguments to pass to "npm install". Use the "=" notation when setting this parameter', type: 'string'}
    });
    yargs.usage('Usage:\n  caliper bind --caliper-bind-sut fabric --caliper-bind-sdk 1.4.1 --caliper-bind-cwd ./ --caliper-bind-args="-g"');

    // enforce the option after these options
    yargs.requiresArg(['caliper-bind-sut','caliper-bind-sdk','caliper-bind-args', 'caliper-bind-cwd']);

    // enforce singletons
    yargs.check(checkFn);

    return yargs;
};

module.exports.handler = (argv) => {
    return argv.thePromise = Bind.handler(argv);
};
