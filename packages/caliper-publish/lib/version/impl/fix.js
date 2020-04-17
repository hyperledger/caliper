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

// impl => version => lib => caliper-publish => packages => root
const repoRoot = path.join(__dirname, '..', '..', '..', '..', '..');

/**
 * Utility function for overwriting the common Caliper version in the package.json files.
 * @param {string} packageJsonPath The path of the package.json file.
 * @param {string} customVersion The new version to use.
 */
function injectCustomVersion(packageJsonPath, customVersion) {
    const packageObject = require(packageJsonPath);

    if (packageObject.version !== customVersion) {
        console.log(`Setting package version in "${packageJsonPath}" to "${customVersion}"`);
        // overwrite the current version
        packageObject.version = customVersion;

        // overwrite every dependency to other Caliper packages if any (to keep unstable builds in sync)
        for (const dep of Object.keys(packageObject.dependencies)) {
            if (dep.startsWith('@hyperledger/caliper-')) {
                console.log(`\tSetting dependency version for "${dep}" to "${customVersion}"`);
                packageObject.dependencies[dep] = customVersion;
            }
        }

        // serialize new content
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageObject, null, 4));
    }
}

/**
 * Implements the version fix command logic.
 */
class Fix {
    /**
     * Handler for the version fix invocation.
     * @async
     */
    static async handler() {
        const lernaJsonPath = path.join(repoRoot, 'lerna.json');
        const lernaObject = require(lernaJsonPath);
        const lernaVersion = lernaObject.version;
        const packages = Array.from(lernaObject.packages);
        // add the root "package"
        packages.push('./');

        console.log('Fixing package versions...');

        for (const pkg of packages) {
            injectCustomVersion(path.join(repoRoot, pkg, 'package.json'), lernaVersion);
        }
    }
}

module.exports = Fix;
