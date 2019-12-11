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

const path = require('path');
const utils = require('./utils/cmdutils.js');

const MAX_RETRIES = 1;
const BACKOFF_TIME = 10000; // sleep 10 seconds if NPM package is not available yet
const MAX_BACKOFF = 30; // Do this for max 5 minutes (30 times)

// registry setting for npm install in Dockerfile, e.g., "http://localhost:4873"
// undefined for the public npm registry
const registryArg = process.argv.slice(2)[0];

let tagAndVersion = require(path.join(__dirname, '../../caliper-cli/package.json')).version;

(async function () {
    let cliPackage = `@hyperledger/caliper-cli@${tagAndVersion}`;
    let packagePublished = false;
    for (let i = 1; i <= MAX_BACKOFF; i++) {
        try {
            utils.log(`[CHECK] Checking whether package ${cliPackage} exists...`);
            let npmInfoArgs = [ 'info' ];
            if (registryArg) {
                npmInfoArgs = npmInfoArgs.concat(['--registry', registryArg]);
            }
            npmInfoArgs.push(cliPackage);

            utils.log(`[CHECK] Calling npm with: ${npmInfoArgs.join(' ')}`);
            let output = await utils.getCommandOutput('npm', npmInfoArgs);
            if (output.trim() === '') {
                utils.log(`[CHECK] Package ${cliPackage} is not published yet, retrying in ${BACKOFF_TIME/1000} seconds...`);
                await utils.sleep(BACKOFF_TIME);
            } else {
                utils.log(`[CHECK] Package ${cliPackage} became available, proceeding with Docker build.`);
                packagePublished = true;
                break;
            }
        } catch (e) {
            // the command failed, meaning the package is not published at all
            utils.log(`[CHECK] ${e}`);
            utils.log(`[CHECK] Package ${cliPackage} is not published at all`);
        }
    }

    if (!packagePublished) {
        utils.log(`[CHECK] Package ${cliPackage} is still unavailable, aborting.`);
        process.exit(1);
    }

    let built = false;
    for (let i = 1; i <= MAX_RETRIES; i++) {
        utils.log(`[BUILD] Building Docker image "hyperledger/caliper:${tagAndVersion}". Attempt ${i}/${MAX_RETRIES}:`);
        try {
            let dockerArgs = ['build', '--network=host', '-t', `hyperledger/caliper:${tagAndVersion}`,
                '-f', 'caliper.Dockerfile', '--build-arg', `caliper_version=${tagAndVersion}`];
            if (registryArg) {
                dockerArgs = dockerArgs.concat(['--build-arg', `npm_registry=--registry=${registryArg}`, '.']);
            } else {
                dockerArgs = dockerArgs.concat(['--build-arg', 'npm_registry=', '.']);
            }

            // the command is executed from the caliper-tests-integration dir
            utils.log(`[BUILD] Invoking Docker with: ${dockerArgs.join(' ')}`);
            await utils.invokeCommand('docker', dockerArgs);
            utils.log(`[BUILD] Built Docker image "hyperledger/caliper:${tagAndVersion}"`);
            utils.log(`[BUILD] Pushing Docker image "hyperledger/caliper:${tagAndVersion}" to Docker Hub...`);
            await utils.invokeCommand('docker', ['push', `hyperledger/caliper:${tagAndVersion}`]);
            built = true;
            break;
        } catch (error) {
            utils.log(`[BUILD] Failed to build/push Docker image "hyperledger/caliper:${tagAndVersion}" (attempt ${i}/${MAX_RETRIES})`);
            utils.log(error);
        }
    }

    if (!built) {
        utils.log(`[BUILD] Aborting, could not build/push Docker image "hyperledger/caliper:${tagAndVersion}"`);
        process.exit(1);
    }
})();
