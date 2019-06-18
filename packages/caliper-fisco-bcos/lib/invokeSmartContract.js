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

const {
    CaliperUtils,
    TxStatus
} = require('caliper-core');
const isArray = require('isarray');
const fiscoBcosApi = require('./fiscoBcosApi');
const fs = require('fs-extra');
const path = require('path');
const { TxErrorEnum, Color } = require('./constant');
const commLogger = CaliperUtils.getLogger('invokeSmartContract.js');

module.exports.run = async function (context, fiscoBcosSettings, contractID, fcn, args, workspaceRoot, readOnly = false) {
    let smartContracts = fiscoBcosSettings.smartContracts;
    if (!isArray(smartContracts)) {
        return;
    }

    let smartContract = smartContracts.find((smartContract) => {
        return smartContract.id === contractID;
    });

    if (smartContract === undefined) {
        commLogger.error(Color.error(`Smart contract ${contractID} undefined`));
        return;
    }

    let contractType = smartContract.language;
    let address = null;
    if (contractType === 'solidity') {
        let contractPath = path.join(workspaceRoot, smartContract.path);
        let contractName = path.basename(contractPath, '.sol');

        try {
            address = fs.readFileSync(path.join(path.dirname(contractPath), `${contractName}.address`)).toString();
        } catch (error) {
            if (error.code === 'ENOENT') {
                commLogger.error(Color.error(`Address of smart contract ${smartContract.id} can't be determinied, please install it first!`));
            }
            throw error;
        }
    } else if (contractType === 'precompiled') {
        address = smartContract.address;
    } else {
        commLogger.error(Color.error(`Smart contract of ${contractType} is not supported yet`));
        throw new Error('Smart contract type not supported');
    }

    const networkConfig = fiscoBcosSettings.network;
    const account = fiscoBcosSettings.config.account;

    let invokeStatus = new TxStatus(account);
    invokeStatus.SetFlag(TxErrorEnum.NoError);
    let receipt = null;

    try {
        if (context && context.engine) {
            context.engine.submitCallback(1);
        }

        if (readOnly) {
            receipt = await fiscoBcosApi.call(networkConfig, account, address, fcn, args);
        } else {
            const privateKey = fiscoBcosSettings.config.privateKey;
            receipt = await fiscoBcosApi.sendRawTransaction(networkConfig, account, privateKey, address, fcn, args);
        }

        invokeStatus.SetID(receipt.result);
        invokeStatus.SetResult(receipt);
        invokeStatus.SetVerification(true);
        if (receipt.error === undefined && (receipt.status === '0x0' || (receipt.result && receipt.result.status === '0x0'))) {
            invokeStatus.SetStatusSuccess();
        } else {
            commLogger.error(Color.failure('Failed to invoke smart contract: ' + JSON.stringify(receipt)));
            invokeStatus.SetStatusFail();
        }
    } catch (error) {
        commLogger.error(Color.failure(`Failed to invoke smart contract ${smartContract.id}`));

        invokeStatus.SetStatusFail();
        invokeStatus.SetVerification(true);
        throw error;
    }

    return invokeStatus;
};
