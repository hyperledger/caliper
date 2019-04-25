/**
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
*
*/

'use strict';

const e2eUtils = require('./e2eUtils.js');
const testUtil = require('./util.js');
const CaliperUtils = require('caliper-core').CaliperUtils;
const commLogger = CaliperUtils.getLogger('install-chaincode.js');

/**
 * Install the chaincode listed within config
 * @param {*} config_path The path to the Fabric network configuration file.
 * @async
 */
async function run(config_path) {
    const fabricSettings = CaliperUtils.parseYaml(config_path).fabric;
    let chaincodes = fabricSettings.chaincodes;
    if(typeof chaincodes === 'undefined' || chaincodes.length === 0) {
        return;
    }

    testUtil.setupChaincodeDeploy();

    try {
        commLogger.info('installing all chaincodes......');

        for (const chaincode of chaincodes){
            let channel  = testUtil.getChannel(chaincode.channel);
            if(channel === null) {
                throw new Error('could not find channel in config');
            }

            for(let orgIndex in channel.organizations) {
                // NOTE: changed execution to sequential for easier debugging (this is a one-time task, performance doesn't matter)
                commLogger.info(`Installing chaincode ${chaincode.id}...`);
                await e2eUtils.installChaincode(channel.organizations[orgIndex], chaincode);
            }

            commLogger.info(`Installed chaincode ${chaincode.id} successfully in all peers`);

        }
    } catch (err) {
        commLogger.error(`Failed to install chaincodes: ${(err.stack ? err.stack : err)}`);
        throw err;
    }
}

module.exports.run = run;
