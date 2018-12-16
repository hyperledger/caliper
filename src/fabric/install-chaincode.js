/**
 * Modifications Copyright 2017 HUAWEI
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

// This is an end-to-end test that focuses on exercising all parts of the fabric APIs
// in a happy-path scenario
'use strict';

const e2eUtils = require('./e2eUtils.js');
const testUtil = require('./util.js');
const commUtils = require('../comm/util');
const commLogger = commUtils.getLogger('install-chaincode.js');

module.exports.run = async function (config_path) {
    testUtil.setupChaincodeDeploy();
    const fabricSettings = commUtils.parseYaml(config_path).fabric;
    let chaincodes = fabricSettings.chaincodes;
    if(typeof chaincodes === 'undefined' || chaincodes.length === 0) {
        return;
    }

    commLogger.info('Installing chaincodes...');
    try {
        for (let chaincode of chaincodes) {
            let channel  = testUtil.getChannel(chaincode.channel);
            if(channel === null) {
                throw new Error('could not find channel in config');
            }

            for(let v in channel.organizations) {
                // NOTE: changed execution to sequential for easier debugging (this is a one-time task, performance doesn't matter)
                await e2eUtils.installChaincode(channel.organizations[v], chaincode);
            }

            commLogger.info(`Installed chaincode ${chaincode.id} successfully in all peers`);
        }
    } catch (err) {
        commLogger.error(`Failed to install chaincodes: ${(err.stack ? err.stack : err)}`);
        throw err;
    }
};
