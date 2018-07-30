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
*  Marbles Network
*  Trades Marbles between two players through a Transaction
*  - Example test round
*      {
*        "label" : "marbles-network",
*        "txNumber" : [10],
*        "trim" : 0,
*        "rateControl" : [{"type": "fixed-rate", "opts": {"tps" : 10}}],
*        "arguments": {"testAssets": 10},
*        "callback" : "benchmark/composer/composer-samples/marbles-network.js"
*      }
*  - Init:
*    - Creates 2 Particpants
*    - Test specified number of Assets(Marbles) created, belonging to Participant1
*  - Run:
*   -  All Marbles traded to Participant2 through test
*
*/

'use strict';

const removeExisting = require('../composer-test-utils').clearAll;
const Log = require('../../../src/comm/util').log;
const os = require('os');
const uuid = os.hostname() + process.pid; // UUID for client within test

module.exports.info  = 'Marbles Network Performance Test';

let bc;
let busNetConnection;
let testAssetNum;
let factory;

const namespace = 'org.hyperledger_composer.marbles';

module.exports.init = async function(blockchain, context, args) {
    // Create Participants and Assets to use in main test
    bc = blockchain;
    busNetConnection = context;
    testAssetNum = args.testAssets;
    factory = busNetConnection.getBusinessNetwork().getFactory();

    let participantRegistry = await busNetConnection.getParticipantRegistry(namespace + '.Player');
    let assetRegistry = await busNetConnection.getAssetRegistry(namespace + '.Marble');
    let marbles = Array();

    try {
        // Add test participant
        let players = new Array();
        for (let i=0; i<2; i++) {
            let player = factory.newResource(namespace, 'Player', 'PLAYER_' + uuid + i);
            player.firstName = 'penguin';
            player.lastName = 'wombat';
            players.push(player);
        }

        // Add test assets
        for (let i=0; i<testAssetNum; i++) {
            let marble = factory.newResource(namespace, 'Marble', 'MARBLE_' + uuid + i);
            marble.size = 'SMALL';
            marble.color = 'RED';
            marble.owner = factory.newRelationship(namespace, 'Player', 'PLAYER_' + uuid + 0);
            marbles.push(marble);
        }

        // Conditionally add/update Test Assets
        let populated = await assetRegistry.exists(marbles[0].getIdentifier());
        if (!populated) {
            Log('Adding test assets ...');
            await participantRegistry.addAll(players);
            await assetRegistry.addAll(marbles);
            Log('Asset addition complete ...');
        } else {
            Log('Updating test assets ...');
            await removeExisting(assetRegistry, 'MARBLE_' + uuid);
            await assetRegistry.updateAll(marbles);
            Log('Asset update complete ...');
        }
    } catch (error) {
        Log('error in test init(): ', error);
        return Promise.reject(error);
    }
};

module.exports.run = function() {
    let transaction = factory.newTransaction(namespace, 'TradeMarble');
    transaction.marble = factory.newRelationship(namespace, 'Marble', 'MARBLE_' + uuid + --testAssetNum);
    transaction.newOwner = factory.newRelationship(namespace, 'Player', 'PLAYER_' + uuid + 1);
    return bc.bcObj.submitTransaction(busNetConnection, transaction);
};

module.exports.end = function() {
    return Promise.resolve(true);
};