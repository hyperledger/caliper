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

const Docker = require('./impl/docker');

module.exports.command = 'docker [options]';
module.exports.describe = 'Build and optionally publish the Caliper Docker image.';
module.exports.builder = yargs => {
    yargs.options({
        image: {
            alias: 'i',
            demand: false,
            default: 'hyperledger/caliper',
            type: 'string',
            describe: 'The name for the built image.'
        },
        tag: {
            alias: 't',
            demand: false,
            type: 'string',
            describe: 'Overrides the version-based tag for testing purposes'
        },
        registry: {
            alias: 'r',
            demand: false,
            default: '',
            type: 'string',
            describe: 'The NPM registry address to use for building the Docker image. Defaults to the public NPM registry.'
        },
        publish: {
            alias: 'p',
            demand: false,
            default: false,
            type: 'boolean',
            describe: 'Indicates whether to publish the built image. Requires that DOCKER_TOKEN and "user" argument is set.'
        },
        user : {
            alias: 'u',
            demand: false,
            type: 'string',
            describe: 'The user to use for publishing the built Docker image. Required when the "--publish" flag is set.'
        },
        retries: {
            alias: 'n',
            demand: false,
            default: 5,
            type: 'number',
            describe: 'The number of times to retry the build in case of failures.'
        }
    });
    yargs.help();
    yargs.usage('Example usage:\n./publish.js docker -r "http://localhost:4873" --retries 2');
    return yargs;
};

module.exports.handler = argv => {
    argv.thePromise = Docker.handler(argv.image, argv.registry, argv.publish, argv.user, argv.retries, argv.tag);
};
