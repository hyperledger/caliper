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
const CaliperUtils = require('caliper-core').CaliperUtils;
const commLogger = CaliperUtils.getLogger('instantiate-chaincode.js');

/**
 * Install the chaincode listed within config
 * @param {*} config_path The path to the Fabric network configuration file.
 * @async
 */
async function run(config_path) {
    const config = CaliperUtils.parseYaml(config_path);
    const fabricSettings = config.fabric;
    const policy = fabricSettings['endorsement-policy'];  // TODO: support multiple policies
    let chaincodes = fabricSettings.chaincodes;
    if(typeof chaincodes === 'undefined' || chaincodes.length === 0) {
        return;
    }

    try {
        commLogger.info('Instantiating chaincodes...');
        for (let chaincode of chaincodes) {
            await e2eUtils.instantiateChaincode(chaincode, policy, false);
            commLogger.info(`Instantiated chaincode ${chaincode.id} successfully`);
        }

        commLogger.info('Sleeping 5s...');
        await CaliperUtils.sleep(5000);
    } catch (err) {
        commLogger.error(`Failed to instantiate chaincodes: ${(err.stack ? err.stack : err)}`);
        throw err;
    }
}

module.exports.run = run;
