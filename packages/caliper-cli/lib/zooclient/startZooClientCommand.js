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

const Start = require ('./lib/startZooClient');

// enforces singletons
const checkFn = (argv, options) => {

    ['address','blockchainConfig','workspace'].forEach((e)=>{
        if (Array.isArray(argv[e])){
            throw new Error(`Option ${e} can only be specified once`);
        }
    });

    return true;
};
module.exports._checkFn = checkFn;
module.exports.command = 'start';
module.exports.describe = 'Start a zookeeper client on a provided host:port using provided blockchain configuration and a workspace location';
module.exports.builder = function (yargs){
    yargs.options({
        'address' : {alias: 'a', required: true, describe: 'zookeeper address', type: 'string' },
        'blockchainConfig'  : {alias: 'n', required: true, describe:'Path to the blockchain configuration file that contains information required to interact with the SUT', type: 'string'},
        'workspace'  : {alias: 'w', required: true, describe:'Workspace directory that contains all configuration information', type: 'string'}
    });
    yargs.usage('caliper zooclient start -w ~/myCaliperProject -a <host-address>:<port>  -n my-sut-config.yaml');

    // enforce the option after these options
    yargs.requiresArg(['address','blockchainConfig','workspace']);

    // enforce singletons
    yargs.check(checkFn);

    return yargs;
};

module.exports.handler = (argv) => {
    return argv.thePromise = Start.handler(argv);
};
