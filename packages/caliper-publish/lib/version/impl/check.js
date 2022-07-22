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

// impl => version => lib => caliper-publish => packages => root
const repoRoot = path.join(__dirname, '..', '..', '..', '..', '..');

/**
 * Implements the version check command logic.
 */
class Check {
    /**
     * Handler for the version check invocation.
     * @async
     */
    static async handler() {
        const rootPackageJsonPath = path.join(repoRoot, 'package.json');
        const rootPackageObject = require(rootPackageJsonPath);
        const rootPackageVersion = rootPackageObject.version;
        const packages = Array.from(rootPackageObject.workspaces);
        // add the root "package"
        packages.push('./');

        let mismatch = false;
        console.log('Checking package versions...');

        for (const pkg of packages) {
            const packageJsonPath = path.join(repoRoot, pkg, 'package.json');
            const packageObject = require(packageJsonPath);

            if (packageObject.version !== rootPackageVersion) {
                mismatch = true;
                console.log(`ERROR: package "${pkg}" version "${packageObject.version}" does not match root package version "${rootPackageVersion}"`);
            }

            for (const dep of Object.keys(packageObject.dependencies)) {
                if (dep.startsWith('@hyperledger/caliper-') && packageObject.dependencies[dep] !== rootPackageVersion) {
                    mismatch = true;
                    console.log(`ERROR: package "${pkg}" dependency "${dep}" does not match root package version "${rootPackageVersion}"`);
                }
            }
        }

        if (mismatch) {
            throw new Error(`Some package versions do not match the root packageversion "${rootPackageVersion}"`);
        }

        console.log('Package versions are correct');
    }
}

module.exports = Check;
