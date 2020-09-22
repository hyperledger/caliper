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
const fs = require('fs');
const utils = require('./../utils/cmdutils');

const packages = [
    'caliper-core',
    'caliper-ethereum',
    'caliper-fabric',
    'caliper-fisco-bcos',
    'caliper-cli',
    'generator-caliper'
];

// impl => lib => caliper-publish
const thisPackageRoot = path.join(__dirname, '..', '..');
const packagesRoot = path.join(thisPackageRoot, '..');
const repoRoot = path.join(packagesRoot, '..');
const scriptPath = path.join(thisPackageRoot, 'artifacts', 'npm-publish.sh');

/**
 * Logs an NPM publish-related message.
 * @param {string} msg The message.
 */
function log(msg) {
    utils.log(`[NPM PUBLISH] ${msg}`);
}

/**
 * Utility function for overwriting the common Caliper version in the package.json files.
 * @param {string} packageJsonPath The path of the package.json file.
 * @param {string} customVersion The new version to use.
 */
function injectCustomVersion(packageJsonPath, customVersion) {
    let packageObject = require(packageJsonPath);

    // overwrite the own version
    packageObject.version = customVersion;

    // overwrite every dependency to other Caliper packages (to keep unstable builds in sync)
    for (let dep of Object.keys(packageObject.dependencies)) {
        if (dep.startsWith('@hyperledger/caliper-')) {
            packageObject.dependencies[dep] = customVersion;
        }
    }

    // serialize new content
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageObject, null, 4));
}

/**
 * Implements the docker publish command logic.
 */
class NPM {
    /**
     * Handler for the docker command invocation.
     * @param {string} registry The NPM registry address to use for building the Docker image. Defaults to the public NPM registry.
     * @param {boolean} dryRun Indicates whether to perform only a dry run of the publishing.
     * @param {number} retries The number of times to retry the build in case of failures.
     * @async
     */
    static async handler(registry, dryRun, retries) {
        const rootPackageJsonPath = path.join(repoRoot, 'package.json');
        let packageVersion = require(rootPackageJsonPath).version;

        let tag = 'latest';
        if (packageVersion.endsWith('-unstable')) {
            let date = new Date().toISOString().replace(/-/g, '').replace('T', '').replace(/:/g, '');
            date = date.substring(0, date.indexOf('.'));
            packageVersion += `-${date}`;
            tag = 'unstable';

            log(`Using custom version number for unstable packages: ${packageVersion}`);
        }

        // this object will configure the publishing script
        let envs = {
            TAG: tag,
        };

        if (dryRun) {
            envs.DRY_RUN = '--dry-run';
        }

        if (registry !== '') {
            envs.NPM_REGISTRY = `--registry ${registry}`;
        }


        for (let pkg of packages) {
            const packageDir = path.join(packagesRoot, pkg);
            if (tag === 'unstable') {
                injectCustomVersion(path.join(packageDir, 'package.json'), packageVersion);
            }

            try {
                let published = false;
                for (let i = 0; i < retries; i++) {
                    log(`Publishing @hyperledger/${pkg}@${packageVersion} with tag "${tag}". Attempt ${i+1}/${retries}:`);
                    try {
                        await utils.invokeCommand(scriptPath, [], envs, packageDir);
                        log(`Published package @hyperledger/${pkg}@${packageVersion}\n`);
                        published = true;
                        break;
                    } catch (error) {
                        log(`Failed to publish package @hyperledger/${pkg}@${packageVersion} (attempt ${i+1}/${retries})`);
                        log(error);
                    }
                }

                if (!published) {
                    log(`Aborting, could not publish package @hyperledger/${pkg}@${packageVersion}`);
                    process.exit(1);
                }
            } catch (err) {
                log(`Aborting, could not publish package @hyperledger/${pkg}@${packageVersion}`);
                log(err);
                process.exit(1);
            }
        }
    }
}

module.exports = NPM;
