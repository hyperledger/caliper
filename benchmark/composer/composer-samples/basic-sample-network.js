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
*  Basic Sample Network
*  Updates the value of an Asset through a Transaction.
*  - Example test round (txn <= testAssets)
*      {
*        "label" : "basic-sample-network",
*        "txNumber" : [50],
*        "trim" : 0,
*        "rateControl" : [{"type": "fixed-rate", "opts": {"tps" : 10}}],
*        "arguments": {"testAssets": 50},
*        "callback" : "benchmark/composer/composer-samples/basic-sample-network.js"
*      }
*  - Init:
*    - Single Participant created (PARTICIPANT_0)
*    - Test specified number of Assets created, belonging to a PARTICIPANT_0
*  - Run:
*    - Transactions run against all created assets to update their values
*
*/

'use strict';

module.exports.info  = 'Basic Sample Network Performance Test';

const composerUtils = require('../../../src/composer/composer_utils');
const removeExisting = require('../composer-test-utils').clearAll;
const logger = require('../../../src/comm/util').getLogger('basic-sample-network.js');
const os = require('os');

const namespace = 'org.example.basic';
const busNetName = 'basic-sample-network';
const uuid = os.hostname() + process.pid; // UUID for client within test

let bc;                 // The blockchain main (Composer)
let busNetConnections;  // Global map of all business network connections to be used
let testAssetNum;       // Number of test assets to create
let factory;            // Global Factory

module.exports.init = async function(blockchain, context, args) {
    // Create Participants and Assets to use in main test
    bc = blockchain;
    busNetConnections = new Map();
    busNetConnections.set('admin', context);
    testAssetNum = args.testAssets;

    let participantRegistry = await busNetConnections.get('admin').getParticipantRegistry(namespace + '.SampleParticipant');
    let assetRegistry = await busNetConnections.get('admin').getAssetRegistry(namespace + '.SampleAsset');
    let assets = Array();

    try {
        factory = busNetConnections.get('admin').getBusinessNetwork().getFactory();

        let exists = await participantRegistry.exists('PARTICIPANT_' + uuid);
        if (exists) {
            // Example for creating multiple participants for test use
            // Create & add participant
            let participant = factory.newResource(namespace, 'SampleParticipant', 'PARTICIPANT_' + uuid);
            participant.firstName = 'penguin';
            participant.lastName = 'wombat';
            await participantRegistry.add(participant);

            logger.debug('About to create new participant card');
            let userName = 'User1_' + uuid;
            let newConnection = await composerUtils.obtainConnectionForParticipant(busNetConnections.get('admin'), busNetName, participant, userName);
            busNetConnections.set(userName, newConnection);
        }

        // Create Test Assets
        for (let i=0; i<testAssetNum; i++) {
            let asset = factory.newResource(namespace, 'SampleAsset', 'ASSET_' + uuid + '_' + i);
            asset.owner = factory.newRelationship(namespace, 'SampleParticipant', 'PARTICIPANT_' + uuid);
            asset.value = 'priceless';
            assets.push(asset);
        }

        // Conditionally add/update Test Assets
        let populated = await assetRegistry.exists(assets[0].getIdentifier());
        if (!populated) {
            logger.debug('Adding test assets ...');
            await assetRegistry.addAll(assets);
            logger.debug('Asset addition complete ...');
        } else {
            logger.debug('Updating test assets ...');
            await removeExisting(assetRegistry, 'ASSET_' + uuid);
            await assetRegistry.addAll(assets);
            logger.debug('Asset update complete ...');
        }
    } catch (error) {
        logger.error('error in test init(): ', error);
        return Promise.reject(error);
    }
};

module.exports.run = function() {
    let transaction = factory.newTransaction(namespace, 'SampleTransaction');
    transaction.newValue = 'worthless';
    transaction.asset = factory.newRelationship(namespace, 'SampleAsset', 'ASSET_' + uuid + '_' + --testAssetNum);

    return bc.bcObj.submitTransaction(busNetConnections.get('admin'), transaction);
};

module.exports.end = function() {
    return Promise.resolve(true);
};