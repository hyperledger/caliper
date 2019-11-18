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

const NPM_RETRIES = 1;

const args = process.argv.slice(2);
// address of the registry to publish to, or undefined for the public NPM registry
const registry = args[0];

const packages = [
    'caliper-core',
    'caliper-burrow',
    'caliper-ethereum',
    'caliper-fabric',
    'caliper-iroha',
    'caliper-sawtooth',
    'caliper-fisco-bcos',
    'caliper-cli'
];

if (registry) {
    utils.log(`[PUBLISH] Performing every action against the following registry: ${registry}`);
}

(async function () {

    for (let pkg of packages) {
        let packageJsonPath = path.join(__dirname, `../../${pkg}/package.json`);
        utils.log(`[PUBLISH] Loading ${packageJsonPath}`);
        let pkgVersion = require(packageJsonPath).version;

        try {
            try {
                utils.log(`[PUBLISH] Checking whether package @hyperledger/${pkg}@${pkgVersion} exists...`);
                let npmInfoArgs = [ 'info' ];
                if (registry) {
                    npmInfoArgs = npmInfoArgs.concat(['--registry', registry]);
                }
                npmInfoArgs = npmInfoArgs.concat([`@hyperledger/${pkg}@${pkgVersion}`]);

                utils.log(`[PUBLISH] Calling npm with: ${npmInfoArgs.join(' ')}`);
                let output = await utils.getCommandOutput('npm', npmInfoArgs);
                if (output.trim() === '') {
                    utils.log(`[PUBLISH] Package version @hyperledger/${pkg}@${pkgVersion} is not published yet`);
                } else {
                    utils.log(`[PUBLISH] Package version @hyperledger/${pkg}@${pkgVersion} already published, skipping it.`);
                    continue;
                }
            } catch (e) {
                // the command failed, meaning the package is not published at all
                utils.log(`[PUBLISH] ${e}`);
                utils.log(`[PUBLISH] Package @hyperledger/${pkg} is not published at all`);
            }

            let published = false;
            for (let i = 0; i < NPM_RETRIES; i++) {
                utils.log(`[PUBLISH] Publishing @hyperledger/${pkg}@${pkgVersion}. Attempt ${i+1}/${NPM_RETRIES}:`);
                try {
                    let publishArgs = ['publish', '--access', 'public'];
                    if (registry) {
                        publishArgs = publishArgs.concat(['--registry', registry]);
                    }

                    publishArgs = publishArgs.concat([`../${pkg}`]);

                    utils.log(`[PUBLISH] Calling npm with: ${publishArgs.join(' ')}`);
                    await utils.invokeCommand('npm', publishArgs);
                    utils.log(`[PUBLISH] Published package @hyperledger/${pkg}@${pkgVersion}\n`);
                    published = true;
                    break;
                } catch (error) {
                    utils.log(`[PUBLISH] Failed to publish package @hyperledger/${pkg}@${pkgVersion} (attempt ${i+1}/${NPM_RETRIES})`);
                    utils.log(error);
                }
            }

            if (!published) {
                utils.log(`[PUBLISH] Aborting, could not publish package @hyperledger/${pkg}@${pkgVersion}`);
                process.exit(1);
            }
        } catch (err) {
            utils.log(`[PUBLISH] Aborting, could not publish package @hyperledger/${pkg}@${pkgVersion}`);
            utils.log(err);
            process.exit(1);
        }
    }
})();
