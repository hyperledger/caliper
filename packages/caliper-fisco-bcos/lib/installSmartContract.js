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

const CaliperUtils = require('@hyperledger/caliper-core').CaliperUtils;
const isArray = require('isarray');
const fs = require('fs-extra');
const path = require('path');
const fiscoBcosApi = require('./fiscoBcosApi');
const assert = require('assert');
const commLogger = CaliperUtils.getLogger('installSmartContract.js');

module.exports.run = async function (fiscoBcosSettings, workspaceRoot) {
    const fiscoBcosConfig = fiscoBcosSettings.config;
    const account = fiscoBcosConfig.account;
    const privateKey = fiscoBcosConfig.privateKey;

    const networkConfig = fiscoBcosSettings.network;
    const smartContracts = fiscoBcosSettings.smartContracts;

    if (!isArray(smartContracts)) {
        throw new Error('No available configuration for smart contracts');
    }

    commLogger.info('Deploying smart contracts ...');

    for (let smartContract of smartContracts) {
        commLogger.info(`Deploying ${smartContract.id} ...`);
        let contractType = smartContract.language;
        if (contractType === 'solidity') {
            let contractPath = path.join(workspaceRoot, smartContract.path);
            try {
                let deployPromise = fiscoBcosApi.deploy(networkConfig, account, privateKey, contractPath);

                deployPromise.then(function (body) {
                    let result = JSON.parse(JSON.stringify(body));
                    if (result.status && result.status === '0x0') {
                        let contractAddress = result.contractAddress;
                        assert(contractAddress !== undefined, JSON.stringify(result));

                        let contractName = path.basename(contractPath, '.sol');
                        fs.outputFileSync(path.join(path.dirname(contractPath), `${contractName}.address`), contractAddress);
                        commLogger.info(`Deployed smart contract ${smartContract.id}, path=${smartContract.path}, address=${contractAddress}`);
                    } else {
                        commLogger.error(`Deploy receipt status error: ${JSON.stringify(body)}`);
                    }
                }).catch((reason)=>{
                    commLogger.error(`Depolying error: ${reason}`);
                });

                await deployPromise;
            } catch (error) {
                commLogger.error(`Failed to install smart contract ${smartContract.id}, path=${contractPath}`);
                throw error;
            }
        } else if (contractType === 'precompiled') {
            commLogger.info(`Precompiled smart contract ${smartContract.id} appointed, address=${smartContract.address}`);
        } else {
            commLogger.error(`Smart contract of ${contractType} is not supported yet`);
            throw new Error('Smart contract type not supported');
        }
    }
};
