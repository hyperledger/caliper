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
const utils = require('./../utils/cmdutils');

// impl => lib => caliper-publish
const thisPackageRoot = path.join(__dirname, '..', '..');
const packagesRoot = path.join(thisPackageRoot, '..');
const buildScriptPath = path.join(thisPackageRoot, 'artifacts', 'docker-build.sh');
const publishScriptPath = path.join(thisPackageRoot, 'artifacts', 'docker-publish.sh');

const BACKOFF_TIME = 10000; // sleep 10 seconds if NPM package is not available yet
const MAX_BACKOFF = 30; // Do this for max 5 minutes (30 times)

/**
 * Logs a Docker build-related message.
 * @param {string} msg The message.
 */
function log(msg) {
    utils.log(`[DOCKER BUILD] ${msg}`);
}

/**
 * Implements the docker publish command logic.
 */
class Docker {
    /**
     * Handler for the docker command invocation.
     * @param {string} image The name for the built image.
     * @param {string} registry The NPM registry address to use for building the Docker image. Defaults to the public NPM registry.
     * @param {boolean} publish Indicates whether to publish the built image. Requires that DOCKER_TOKEN and "user" argument is set.
     * @param {string} user The user to use for publishing the built Docker image. Required when "publish" is true.
     * @param {number} retries The number of times to retry the build in case of failures.
     * @param {string} tag Override for the version-based tag for testing purposes.
     * @async
     */
    static async handler(image, registry, publish, user, retries, tag) {
        const cliPackageJsonPath = path.join(packagesRoot, 'caliper-cli', 'package.json');
        const cliPackageVersion = require(cliPackageJsonPath).version;
        const cliPackageName = `@hyperledger/caliper-cli@${cliPackageVersion}`;

        let packagePublished = false;
        for (let i = 1; i <= MAX_BACKOFF; i++) {
            try {
                log(`Checking whether package ${cliPackageName} exists...`);
                let npmInfoArgs = [ 'info' ];
                if (registry !== '') {
                    npmInfoArgs = npmInfoArgs.concat(['--registry', registry]);
                }
                npmInfoArgs.push(cliPackageName);

                log(`Calling npm with: ${npmInfoArgs.join(' ')}`);
                let output = await utils.getCommandOutput('npm', npmInfoArgs, {}, './');
                if (output.trim() === '') {
                    log(`Package ${cliPackageName} is not published yet, retrying in ${BACKOFF_TIME/1000} seconds...`);
                    await utils.sleep(BACKOFF_TIME);
                } else {
                    log(`Package ${cliPackageVersion} became available, proceeding with Docker build.`);
                    packagePublished = true;
                    break;
                }
            } catch (e) {
                // the command failed, meaning the package is not published at all
                log(`Package ${cliPackageName} is not published at all`);
                log(e);
            }
        }

        if (!packagePublished) {
            log(`Package ${cliPackageName} is still unavailable, aborting.`);
            process.exit(1);
        }

        // this object will configure the build script
        let imageTag = tag || cliPackageVersion;
        let envs = {
            IMAGE: image,
            IMAGE_TAG: imageTag,
            CALIPER_TAG: cliPackageVersion
        };

        if (registry !== '') {
            envs.NPM_REGISTRY = `--registry ${registry}`;
        }

        try {
            let built = false;
            for (let i = 0; i < retries; i++) {
                log(`Building ${image}@${imageTag}. Attempt ${i+1}/${retries}:`);
                try {
                    await utils.invokeCommand(buildScriptPath, [], envs, thisPackageRoot);
                    log(`Built ${image}@${imageTag}\n`);
                    built = true;
                    break;
                } catch (error) {
                    log(`Failed to build ${image}@${imageTag} (attempt ${i+1}/${retries})`);
                    log(error);
                }
            }

            if (!built) {
                log(`Aborting, could not build ${image}@${imageTag}`);
                process.exit(1);
            }
        } catch (err) {
            log(`Aborting, could not build ${image}@${imageTag}`);
            log(err);
            process.exit(1);
        }

        if (!publish) {
            return;
        }

        let publishEnvs = {
            DOCKER_USER: user,
            IMAGE: image,
            TAG: imageTag
        };

        try {
            let published = false;
            for (let i = 0; i < retries; i++) {
                log(`Publishing ${image}@${imageTag}. Attempt ${i+1}/${retries}:`);
                try {
                    await utils.invokeCommand(publishScriptPath, [], publishEnvs, thisPackageRoot);
                    log(`Published ${image}@${imageTag}\n`);
                    published = true;
                    break;
                } catch (error) {
                    log(`Failed to publish ${image}@${imageTag} (attempt ${i+1}/${retries})`);
                    log(error);
                }
            }

            if (!published) {
                log(`Aborting, could not publish ${image}@${imageTag}`);
                process.exit(1);
            }
        } catch (err) {
            log(`Aborting, could not publish ${image}@${imageTag}`);
            log(err);
            process.exit(1);
        }
    }
}

module.exports = Docker;
