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

const { CaliperUtils, TxStatus } = require('@hyperledger/caliper-core');
const { TxErrorEnum } = require('./common');
const uuid = require('uuid/v4');
const fiscoBcosApi = require('./fiscoBcosApi');
const commLogger = CaliperUtils.getLogger('generateRawTransactions.js');

module.exports.run = async function (fiscoBcosSettings, context, transactions) {
    let promises = [];
    let hasEngine =  context && context.engine;
    let network = fiscoBcosSettings.network;

    for (let transaction of transactions) {
        let invokeStatus = new TxStatus(uuid());

        if(hasEngine) {
            context.engine.submitCallback(1);
        }

        promises.push(fiscoBcosApi.sendRawTransaction(network, transaction).then(receipt => {
            invokeStatus.SetFlag(TxErrorEnum.NoError);
            invokeStatus.SetResult(receipt.result);
            invokeStatus.SetVerification(true);

            if (receipt.error === undefined && (receipt.status === '0x0' || (receipt.result && receipt.result.status === '0x0'))) {
                invokeStatus.SetStatusSuccess();
            } else {
                commLogger.error('Failed to invoke smart contract: ' + JSON.stringify(receipt));
                invokeStatus.SetStatusFail();
            }

            return invokeStatus;
        }));
    }
    return Promise.all(promises);
};
