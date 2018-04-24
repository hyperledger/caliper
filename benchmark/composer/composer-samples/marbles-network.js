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

const Util = require('../../../src/comm/util');

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

    try {
        // Add test participant
        let participantRegistry = await busNetConnection.getParticipantRegistry(namespace + '.Player');
        let players = new Array();
        for (let i=0; i<2; i++) {
            let player = factory.newResource(namespace, 'Player', 'PLAYER_' + i);
            player.firstName = 'penguin';
            player.lastName = 'wombat';
            players.push(player);
        }
        Util.log('Adding test participant');
        await participantRegistry.addAll(players);
        Util.log('Participant addition complete');

        // Add test assets
        let assetRegistry = await busNetConnection.getAssetRegistry(namespace + '.Marble');
        let marbles = Array();
        for (let i=0; i<testAssetNum; i++) {
            let marble = factory.newResource(namespace, 'Marble', 'MARBLE_' + i);
            marble.size = 'SMALL';
            marble.color = 'RED';
            marble.owner = factory.newRelationship(namespace, 'Player', 'PLAYER_0');
            marbles.push(marble);
        }
        Util.log('Adding ' + marbles.length + ' Assets......');
        await assetRegistry.addAll(marbles);
        Util.log('Asset addition complete');
    } catch (error) {
        Util.log('error in test init: ', error);
        return Promise.reject(error);
    }
};

module.exports.run = function() {
    let transaction = factory.newTransaction(namespace, 'TradeMarble');
    transaction.marble = factory.newRelationship(namespace, 'Marble', 'MARBLE_' + --testAssetNum);
    transaction.newOwner = factory.newRelationship(namespace, 'Player', 'PLAYER_1');
    return bc.bcObj.submitTransaction(busNetConnection, transaction);
};

module.exports.end = function(results) {
    return Promise.resolve(true);
};