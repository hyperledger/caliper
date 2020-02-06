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

const NPM = require('./impl/npm');

module.exports.command = 'npm [options]';
module.exports.describe = 'Publish the Caliper packages to a local or the public NPM registry.';
module.exports.builder = yargs => {
    yargs.options({
        registry: {
            alias: 'r',
            demand: false,
            default: '',
            type: 'string',
            describe: 'The NPM registry address to use for publishing the packages. Defaults to the public NPM registry which requires NPM_TOKEN to be set.'
        },
        'dry-run': {
            alias: 'd',
            demand: false,
            default: false,
            type: 'boolean',
            describe: 'Indicates whether to perform only a dry run of the publishing.'
        },
        retries: {
            alias: 'n',
            demand: false,
            default: 5,
            type: 'number',
            describe: 'The number of times to retry the publishing in case of failures.'
        }
    });
    yargs.help();
    yargs.usage('Example usage:\n./publish.js npm -r "http://localhost:4873" --retries 2');
    return yargs;
};

module.exports.handler = argv => {
    argv.thePromise = NPM.handler(argv.registry, argv['dry-run'], argv.retries);
};
