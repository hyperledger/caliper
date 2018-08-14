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
*  Bond Network
*  Issues/Pubishes Bonds from an 'issuer' through a Transaction
*  - Example test round
*      {
*        "label" : "bond-network",
*        "txNumber" : [50],
*        "trim" : 0,
*        "rateControl" : [{"type": "fixed-rate", "opts": {"tps" : 10}}],
*        "callback" : "benchmark/composer/composer-samples/bond-network.js"
*      }
*  - Init:
*    - Creates a single Participant (Issuer)
*  - Run:
*    - Defines and publishes a bond linked to the issuer.
*
*/

'use strict';

const removeExisting = require('../composer-test-utils').clearAll;
const Log = require('../../../src/comm/util').log;
const os = require('os');
const uuid = os.hostname() + process.pid; // UUID for client within test

module.exports.info  = 'Bond Network Performance Test';

let bc;
let busNetConnection;
let factory;
let assetId;
const namespace = 'org.acme.bond';

module.exports.init = async function(blockchain, context, args) {
    // Create Participants to use in main test
    bc = blockchain;
    busNetConnection = context;
    factory = busNetConnection.getBusinessNetwork().getFactory();
    assetId = 0;

    try {
        let participantRegistry = await busNetConnection.getParticipantRegistry(namespace + '.Issuer');
        let participant = factory.newResource(namespace, 'Issuer', 'ISSUER_' + uuid);
        participant.name = 'penguin';
        let populated = await participantRegistry.exists(participant.getIdentifier());
        if (!populated) {
            Log('Adding test assets ...');
            await participantRegistry.add(participant);
            Log('Asset addition complete ...');
        } else {
            Log('Updating test assets ...');
            // remove all previously created items form test run
            let assetRegistry = await busNetConnection.getAssetRegistry(namespace + '.BondAsset');
            await removeExisting(assetRegistry, 'ISIN_' + uuid);
            Log('Asset update complete ...');
        }
    } catch (error) {
        Log('error in test init(): ', error);
        return Promise.reject(error);
    }
};

module.exports.run = function() {
    let transaction = factory.newTransaction(namespace, 'PublishBond');
    transaction.ISINCode = 'ISIN_' + uuid + assetId++;
    let bond = factory.newConcept(namespace, 'Bond');
    bond.instrumentId = [];
    bond.exchangeId = [];
    bond.maturity = new Date();
    bond.parValue = 0;
    bond.faceAmount = 0;
    bond.dayCountFraction = '';
    let paymentFrequency = factory.newConcept(namespace, 'PaymentFrequency');
    paymentFrequency.periodMultiplier = 0;
    paymentFrequency.period = 'DAY';
    bond.paymentFrequency = paymentFrequency;
    bond.issuer = factory.newRelationship(namespace, 'Issuer', 'ISSUER_' + uuid);
    transaction.bond = bond;

    return bc.bcObj.submitTransaction(busNetConnection, transaction);
};

module.exports.end = function() {
    return Promise.resolve(true);
};