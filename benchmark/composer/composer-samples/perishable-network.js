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

const Util = require('../../../src/comm/util');

module.exports.info  = 'Perishable Network Performance Test';

let bc;
let busNetConnection;
let testAssetNum;
let factory;
let assetId = 0;
const namespace = 'org.acme.shipping.perishable';

module.exports.init = async function(blockchain, context, args) {
    // Create Participants and Assets to use in main test
    bc = blockchain;
    busNetConnection = context;
    testAssetNum = args.testAssets;

    factory = busNetConnection.getBusinessNetwork().getFactory();

    // Test specified number of Importers
    let importers = new Array();
    for (let i=0; i<testAssetNum; i++){
        let importer = factory.newResource(namespace, 'Importer', 'Importer_' + i);
        let importerAddress = factory.newConcept(namespace, 'Address');
        importerAddress.country = 'UK';
        importer.address = importerAddress;
        importer.accountBalance = 1000;
        importers.push(importer);
    }

    // Test specified number of Growers
    let growers = new Array();
    for (let i=0; i<testAssetNum; i++){
        let grower = factory.newResource(namespace, 'Grower', 'Grower_' + i);
        let growerAddress = factory.newConcept(namespace, 'Address');
        growerAddress.country = 'USA';
        grower.address = growerAddress;
        grower.accountBalance = 0;
        growers.push(grower);
    }

    // A Shipper
    let shipper = factory.newResource(namespace, 'Shipper', 'shipper@email.com');
    let shipperAddress = factory.newConcept(namespace, 'Address');
    shipperAddress.country = 'Panama';
    shipper.address = shipperAddress;
    shipper.accountBalance = 0;

    // The Contract(s)
    let contracts = new Array();
    for (let i=0; i<testAssetNum; i++){
        let contract = factory.newResource(namespace, 'Contract', 'CON_' + i);
        contract.grower = factory.newRelationship(namespace, 'Grower', 'Grower_' + i);
        contract.importer = factory.newRelationship(namespace, 'Importer', 'Importer_' + i);
        contract.shipper = factory.newRelationship(namespace, 'Shipper', 'shipper@email.com');
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
    let shipments = new Array();
    for (let i=0; i<testAssetNum; i++){
        let shipment = factory.newResource(namespace, 'Shipment', 'SHIP_' + i);
        shipment.type = 'BANANAS';
        shipment.status = 'IN_TRANSIT';
        shipment.unitCount = 5000;
        shipment.contract = factory.newRelationship(namespace, 'Contract', 'CON_' + i);
        let lowTemp = factory.newTransaction(namespace, 'TemperatureReading');
        lowTemp.centigrade = -2.0;
        lowTemp.shipment = factory.newRelationship(namespace, 'Shipment', 'SHIP_' + i);
        let highTemp = factory.newTransaction(namespace, 'TemperatureReading');
        highTemp.centigrade = 20;
        highTemp.shipment = factory.newRelationship(namespace, 'Shipment', 'SHIP_' + i);
        shipment.temperatureReadings = [lowTemp, highTemp];
        shipments.push(shipment);
    }

    try {
        // Add to registries
        let growerRegistry = await busNetConnection.getParticipantRegistry(namespace + '.Grower');
        await growerRegistry.addAll(growers);

        let importerRegistry = await busNetConnection.getParticipantRegistry(namespace + '.Importer');
        await importerRegistry.addAll(importers);

        let shipperRegistry = await busNetConnection.getParticipantRegistry(namespace + '.Shipper');
        await shipperRegistry.addAll([shipper]);

        let contractRegistry = await busNetConnection.getAssetRegistry(namespace + '.Contract');
        await contractRegistry.addAll(contracts);

        let shipmentRegistry = await busNetConnection.getAssetRegistry(namespace + '.Shipment');
        await shipmentRegistry.addAll(shipments);

        Util.log('Test init() complete');
    } catch (error) {
        Util.log('error in test init(): ', error);
        return Promise.reject(error);
    }
};

module.exports.run = function() {
    let transaction = factory.newTransaction(namespace, 'ShipmentReceived');
    transaction.shipment = factory.newRelationship(namespace, 'Shipment', 'SHIP_' +  assetId++);
    return bc.bcObj.submitTransaction(busNetConnection, transaction);
};

module.exports.end = function(results) {
    return Promise.resolve(true);
};