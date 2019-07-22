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

const exec = require('child_process').exec;

const NPM_RETRIES = 5;

/**
 * Invoke a promisified exec
 * @param {String} cmd - the command to be run
 * @returns {Promise} - a Promise that is resolved or rejected
 */
function invokeCmd(cmd) {
    return new Promise((resolve, reject) => {
        let proc = exec(cmd);
        // Log all output
        proc.stdout.on('data', function(data) {
            // eslint-disable-next-line no-console
            console.log(data);
        });
        // Log ony error output
        proc.stderr.on('data', function(data) {
            // eslint-disable-next-line no-console
            console.log(data);
        });
        // Capture Protactor return code
        proc.on('close', function(code) {
            if(code !== 0) {
                return reject(new Error(`Failed to execute "${cmd}" with return code ${code}`));
            }
            resolve();
        });
    });
}

// Required packages for serving
const packages = [
    'caliper-core',
    'caliper-burrow',
    'caliper-composer',
    'caliper-fabric-ccp',
    'caliper-iroha',
    'caliper-sawtooth',
    'caliper-cli'];

(async function () {

    try {

        // Set registry and publish
        for (const p of packages) {
            let published = false;
            for (let i = 0; i < NPM_RETRIES; i++) {
                console.log(`Publishing package ${p} to local npm server (attempt ${i+1}/${NPM_RETRIES})`);
                try {
                    await invokeCmd(`npm publish --registry http://localhost:4873 --force ../${p}`);
                    console.log(`Published package ${p} to local npm server (attempt ${i+1}/${NPM_RETRIES})`);
                    published = true;
                    break;
                } catch (error) {
                    console.error(`Failed to publish package ${p} to local npm server (attempt ${i+1}/${NPM_RETRIES})`);
                    console.error(error);
                }
            }
            if (!published) {
                console.error(`Aborting, could not publish package ${p} to local npm server`);
                process.exit(1);
            }
        }
    } catch (error) {
        console.error(error);
        process.exit(1);
    }

})();
