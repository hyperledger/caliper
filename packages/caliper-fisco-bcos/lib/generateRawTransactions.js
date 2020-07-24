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

const fs = require('fs');
const { CaliperUtils, TxStatus } = require('@hyperledger/caliper-core');
const { TxErrorEnum, findContractAddress } = require('./common');
const uuid = require('uuid/v4');
const fiscoBcosApi = require('./fiscoBcosApi');
const commLogger = CaliperUtils.getLogger('generateRawTransactions.js');

module.exports.run = async function (fiscoBcosSettings, workspaceRoot, contractID, arg, file) {
    let smartContracts = fiscoBcosSettings.smartContracts;
    let address = findContractAddress(workspaceRoot, smartContracts, contractID);
    let account = fiscoBcosSettings.config.account;
    let privateKey = fiscoBcosSettings.config.privateKey;
    let network = fiscoBcosSettings.network;
    let invokeStatus = new TxStatus(uuid());

    try {
        let fcn = null;
        let fcArgs = [];

        for (let key in arg) {
            if (key === 'transaction_type') {
                fcn = arg[key].toString();
            } else {
                fcArgs.push(arg[key].toString());
            }
        }

        let tx = await fiscoBcosApi.generateRawTransaction(network,
            account,
            privateKey,
            address,
            fcn,
            fcArgs,
            workspaceRoot);

        fs.appendFileSync(file, tx + '\n');

        invokeStatus.SetFlag(TxErrorEnum.NoError);
        invokeStatus.SetResult(tx);
        invokeStatus.SetVerification(true);
        invokeStatus.SetStatusSuccess();
        return invokeStatus;
    } catch (error) {
        commLogger.error(`FISCO BCOS generate raw transaction failed: ${(error.stack ? error.stack : JSON.stringify(error))}`);
        throw error;
    }
};
