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
*  Perishable Goods Network
*  Performs a contractual payout for a shipment through a Transaction.
*  - Example test round
*      {
*        "label" : "perishable-network",
*        "txNumber" : [10],
*        "trim" : 0,
*        "rateControl" : [{"type": "fixed-rate", "opts": {"tps" : 10}}],
*        "arguments": {"testAssets": 10},
*        "callback" : "benchmark/composer/composer-samples/perishable-network.js"
*      }
*  - Init:
*    - Test specified number of (Importer/Grower) Participants created
*    - Test specified number of (Shipment) Assets created, belonging to a Grower Participants
*  - Run:
*    - Transactions run to perform payout upon shipment receipt
*
*/

'use strict';

const removeExisting = require('../composer-test-utils').clearAll;
const Log = require('../../../src/comm/util').log;
const os = require('os');
const uuid = os.hostname() + process.pid; // UUID for client within test

module.exports.info  = 'Perishable Network Performance Test';

let bc;
let busNetConnection;
let testAssetNum;
let factory;
let assetId;
const namespace = 'org.acme.shipping.perishable';

module.exports.init = async function(blockchain, context, args) {
    // Create Participants and Assets to use in main test
    bc = blockchain;
    busNetConnection = context;
    testAssetNum = args.testAssets;
    assetId = 0;

    factory = busNetConnection.getBusinessNetwork().getFactory();

    let growerRegistry = await busNetConnection.getParticipantRegistry(namespace + '.Grower');
    let importerRegistry = await busNetConnection.getParticipantRegistry(namespace + '.Importer');
    let shipperRegistry = await busNetConnection.getParticipantRegistry(namespace + '.Shipper');
    let contractRegistry = await busNetConnection.getAssetRegistry(namespace + '.Contract');
    let shipmentRegistry = await busNetConnection.getAssetRegistry(namespace + '.Shipment');

    let shipments = new Array();
    let importers = new Array();
    let growers = new Array();
    let contracts = new Array();
    let shipper;

    // Test specified number of Importers
    for (let i=0; i<testAssetNum; i++) {
        let importer = factory.newResource(namespace, 'Importer', 'Importer_' + uuid + '_' + i);
        let importerAddress = factory.newConcept(namespace, 'Address');
        importerAddress.country = 'UK';
        importer.address = importerAddress;
        importer.accountBalance = 1000;
        importers.push(importer);
    }

    // Test specified number of Growers
    for (let i=0; i<testAssetNum; i++) {
        let grower = factory.newResource(namespace, 'Grower', 'Grower_' + uuid + '_' + i);
        let growerAddress = factory.newConcept(namespace, 'Address');
        growerAddress.country = 'USA';
        grower.address = growerAddress;
        grower.accountBalance = 0;
        growers.push(grower);
    }

    // A Shipper
    shipper = factory.newResource(namespace, 'Shipper', uuid + '@email.com');
    let shipperAddress = factory.newConcept(namespace, 'Address');
    shipperAddress.country = 'Panama';
    shipper.address = shipperAddress;
    shipper.accountBalance = 0;

    // The Contract(s)
    for (let i=0; i<testAssetNum; i++) {
        let contract = factory.newResource(namespace, 'Contract', 'CON_' + uuid + '_'  + i);
        contract.grower = factory.newRelationship(namespace, 'Grower', 'Grower_' + uuid + '_' + i);
        contract.importer = factory.newRelationship(namespace, 'Importer', 'Importer_' + uuid + '_' + i);
        contract.shipper = factory.newRelationship(namespace, 'Shipper', uuid + '@email.com');
        let tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        contract.arrivalDateTime = tomorrow; // the shipment has to arrive tomorrow
        contract.unitPrice = 0.5; // pay 50 cents per unit
        contract.minTemperature = 2; // min temperature for the cargo
        contract.maxTemperature = 10; // max temperature for the cargo
        contract.minPenaltyFactor = 0.2;
        contract.maxPenaltyFactor = 0.2;
        contracts.push(contract);
    }

    // Test specified number of Shipment(s)
    for (let i=0; i<testAssetNum; i++) {
        let shipment = factory.newResource(namespace, 'Shipment', 'SHIP_' + uuid + '_' + i);
        shipment.type = 'BANANAS';
        shipment.status = 'IN_TRANSIT';
        shipment.unitCount = 5000;
        shipment.contract = factory.newRelationship(namespace, 'Contract', 'CON_' + uuid + '_' + i);
        let lowTemp = factory.newTransaction(namespace, 'TemperatureReading');
        lowTemp.centigrade = -2.0;
        lowTemp.shipment = factory.newRelationship(namespace, 'Shipment', 'SHIP_' + uuid + '_' + i);
        let highTemp = factory.newTransaction(namespace, 'TemperatureReading');
        highTemp.centigrade = 20;
        highTemp.shipment = factory.newRelationship(namespace, 'Shipment', 'SHIP_' + uuid + '_' + i);
        shipment.temperatureReadings = [lowTemp, highTemp];
        shipments.push(shipment);
    }

    try {
        // Conditionally add/update registries
        let populated = await growerRegistry.exists(growers[0].getIdentifier());
        if (!populated) {
            Log('Adding test assets ...');
            await growerRegistry.addAll(growers);
            await importerRegistry.addAll(importers);
            await shipperRegistry.addAll([shipper]);
            await contractRegistry.addAll(contracts);
            await shipmentRegistry.addAll(shipments);
            Log('Asset addition complete ...');
        } else {
            Log('Updating test assets ...');
            await removeExisting(growerRegistry, 'Grower_' + uuid);
            await removeExisting(importerRegistry, 'Importer_' + uuid);
            await removeExisting(shipmentRegistry, 'SHIP_' + uuid);
            await growerRegistry.addAll(growers);
            await importerRegistry.addAll(importers);
            await shipmentRegistry.addAll(shipments);
            Log('Asset update complete ...');
        }
    } catch (error) {
        Log('error in test init(): ', error);
        return Promise.reject(error);
    }
};

module.exports.run = function() {
    let transaction = factory.newTransaction(namespace, 'ShipmentReceived');
    transaction.shipment = factory.newRelationship(namespace, 'Shipment', 'SHIP_' + uuid + '_' +  assetId++);
    return bc.bcObj.submitTransaction(busNetConnection, transaction);
};

module.exports.end = function() {
    return Promise.resolve(true);
};