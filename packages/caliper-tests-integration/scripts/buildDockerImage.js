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

const path = require('path');
const utils = require('./utils/cmdutils.js');

const DOCKER_RETRIES = 1;

const args = process.argv.slice(2);
if (args.length < 1) {
    utils.log('[BUILD] Missing arguments: image tag');
    process.exit(1);
}

let imageTag = args[0];
if (!['current', 'unstable'].includes(imageTag)) {
    utils.log('[BUILD] Invalid image tag, must be either "current" or "unstable"');
    process.exit(1);
}

// get the current version from the CLI package
if (imageTag === 'current') {
    imageTag = require(path.join(__dirname, '../../caliper-cli/package.json')).version;
}

// registry setting for npm install in Dockerfile, e.g., "http://localhost:4873"
// undefined for the public npm registry
const registryArg = args[1];

(async function () {
    let built = false;
    for (let i = 0; i < DOCKER_RETRIES; i++) {
        utils.log(`[BUILD] Building Docker image "hyperledger/caliper:${imageTag}". Attempt ${i+1}/${DOCKER_RETRIES}:`);
        try {
            let dockerArgs = ['build', '--network=host', '-t', `hyperledger/caliper:${imageTag}`,
                '-f', 'caliper.Dockerfile', '--build-arg', `caliper_version=${imageTag}`];
            if (registryArg) {
                dockerArgs = dockerArgs.concat(['--build-arg', `npm_registry=--registry=${registryArg}`, '.']);
            } else {
                dockerArgs = dockerArgs.concat(['--build-arg', 'npm_registry=', '.']);
            }

            // the command is executed from the caliper-tests-integration dir
            utils.log(`[BUILD] Invoking Docker with: ${dockerArgs.join(' ')}`);
            await utils.invokeCommand('docker', dockerArgs);
            utils.log(`[BUILD] Built Docker image "hyperledger/caliper:${imageTag}"`);
            built = true;
            break;
        } catch (error) {
            utils.log(`[BUILD] Failed to build Docker image "hyperledger/caliper:${imageTag}" (attempt ${i+1}/${DOCKER_RETRIES})`);
            utils.log(error);
        }
    }

    if (!built) {
        utils.log(`[BUILD] Aborting, could not build Docker image "hyperledger/caliper:${imageTag}"`);
        process.exit(1);
    }
})();
