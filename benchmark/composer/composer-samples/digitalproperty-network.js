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
*
*  Digital Property Network
*  Registers a Property for sale through a Transaction.
*  - Example test round
*      {
*        "label" : "digitalproperty-network",
*        "txNumber" : [10],
*        "trim" : 0,
*        "rateControl" : [{"type": "fixed-rate", "opts": {"tps" : 10}}],
*        "arguments": {"testAssets": 10},
*        "callback" : "benchmark/composer/composer-samples/digitalproperty-network.js"
*      }
*  - Init:
*    - Single Participant (Person) created
*    - Test specified number of Assets (LandTitle) created, belonging to a Participant
*  - Run:
*    - Transactions run against all created Assets to register them for sale
*
*/

'use strict';

const removeExisting = require('../composer-test-utils').clearAll;
const Log = require('../../../src/comm/util').log;
const os = require('os');
const uuid = os.hostname() + process.pid; // UUID for client within test

module.exports.info  = 'Digital Property Network Performance Test';

const namespace = 'net.biz.digitalPropertyNetwork';

let bc;
let busNetConnection;
let factory;

let testAssetNum;
let assetId;

module.exports.init = async function(blockchain, context, args) {
    // Create Participants and Assets to use in main test
    bc = blockchain;
    busNetConnection = context;
    testAssetNum = args.testAssets;
    factory = busNetConnection.getBusinessNetwork().getFactory();

    let participantRegistry = await busNetConnection.getParticipantRegistry(namespace + '.Person');
    let assetRegistry = await busNetConnection.getAssetRegistry(namespace + '.LandTitle');
    let assets   = Array();
    assetId = 0;

    try {
        // Add test participant
        let participant = factory.newResource(namespace, 'Person', 'PERSON_' + uuid);
        participant.firstName = 'penguin';
        participant.lastName = 'wombat';

        // Add test assets
        for (let i = 0; i < testAssetNum; i ++) {
            let testAsset = factory.newResource(namespace, 'LandTitle', 'TITLE_' + uuid + i);
            testAsset.owner = factory.newRelationship(namespace, 'Person', 'PERSON_' + uuid);
            testAsset.information = 'Random information';
            assets.push(testAsset);
        }

        // Conditionally add/update Test Assets
        let populated = await assetRegistry.exists(assets[0].getIdentifier());
        if (!populated) {
            Log('Adding test assets ...');
            await participantRegistry.addAll([participant]);
            await assetRegistry.addAll(assets);
            Log('Asset addition complete ...');
        } else {
            Log('Updating test assets ...');
            await removeExisting(assetRegistry, 'TITLE_' + uuid);
            await assetRegistry.updateAll(assets);
            Log('Asset update complete ...');
        }
    } catch (error) {
        Log('error in test init(): ', error);
        return Promise.reject(error);
    }
};

module.exports.run = function() {
    let transaction = factory.newTransaction(namespace, 'RegisterPropertyForSale');
    transaction.seller = factory.newRelationship(namespace, 'Person', 'myId');
    transaction.title = factory.newRelationship(namespace, 'LandTitle', 'TITLE_' + uuid + assetId++);
    return bc.bcObj.submitTransaction(busNetConnection, transaction);
};

module.exports.end = function() {
    return Promise.resolve(true);
};