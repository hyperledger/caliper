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
*        "txNumbAndTps" : [[10,20]],
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

'use strict'

module.exports.info  = "Perishable Network Performance Test";

var bc;
var busNetConnection;
var testAssetNum;
var factory;
var assetId = 0;
const namespace = 'org.acme.shipping.perishable';

module.exports.init = function(blockchain, context, args) {
    // Create Participants and Assets to use in main test    
    bc = blockchain;
    busNetConnection = context;
    testAssetNum = args.testAssets;

    factory = busNetConnection.getBusinessNetwork().getFactory();

    // Test specified number of Importers
    var importers = new Array();
    for (let i=0; i<testAssetNum; i++){
        let importer = factory.newResource(namespace, 'Importer', 'Importer_' + i);
        var importerAddress = factory.newConcept(namespace, 'Address');
        importerAddress.country = 'UK';
        importer.address = importerAddress;
        importer.accountBalance = 1000;
        importers.push(importer);
    }

    // Test specified number of Growers
    var growers = new Array();
    for (let i=0; i<testAssetNum; i++){
        let grower = factory.newResource(namespace, 'Grower', 'Grower_' + i);
        var growerAddress = factory.newConcept(namespace, 'Address');
        growerAddress.country = 'USA';
        grower.address = growerAddress;
        grower.accountBalance = 0;
        growers.push(grower);
    }

    // A Shipper
    var shipper = factory.newResource(namespace, 'Shipper', 'shipper@email.com');
    var shipperAddress = factory.newConcept(namespace, 'Address');
    shipperAddress.country = 'Panama';
    shipper.address = shipperAddress;
    shipper.accountBalance = 0;

    // The Contract(s)
    var contracts = new Array();
    for (let i=0; i<testAssetNum; i++){
      var contract = factory.newResource(namespace, 'Contract', 'CON_' + i);
      contract.grower = factory.newRelationship(namespace, 'Grower', 'Grower_' + i);
      contract.importer = factory.newRelationship(namespace, 'Importer', 'Importer_' + i);
      contract.shipper = factory.newRelationship(namespace, 'Shipper', 'shipper@email.com');
      var tomorrow = new Date();
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
    var shipments = new Array();
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

    // Add to registries
    return busNetConnection.getParticipantRegistry(namespace + '.Grower')
    .then(function(growerRegistry) {
        return growerRegistry.addAll(growers);
    })
    .then(function() {
        return busNetConnection.getParticipantRegistry(namespace + '.Importer');
    })
    .then(function(importerRegistry) {        
        return importerRegistry.addAll(importers);
    })
    .then(function() {
        return busNetConnection.getParticipantRegistry(namespace + '.Shipper');
    })
    .then(function(shipperRegistry) { 
        return shipperRegistry.addAll([shipper]);
    })
    .then(function() {
        return busNetConnection.getAssetRegistry(namespace + '.Contract');
    })
    .then(function(contractRegistry) {        
        return contractRegistry.addAll(contracts);
    })
    .then(function() {
        return busNetConnection.getAssetRegistry(namespace + '.Shipment');
    })
    .then(function(shipmentRegistry) {        
        return shipmentRegistry.addAll(shipments);
    }) 
    .then((resp) => {
        console.log('Test init() complete');
        return Promise.resolve();
    })
    .catch(function (err) {
      console.log('error in test init(): ', err);
      return Promise.reject(err);
    }); 
}

module.exports.run = function() {
    let transaction = factory.newTransaction(namespace, 'ShipmentReceived');
    transaction.shipment = factory.newRelationship(namespace, 'Shipment', 'SHIP_' +  assetId++); 
    return bc.bcObj.submitTransaction(busNetConnection, transaction);
}

module.exports.end = function(results) {
    return Promise.resolve(true);
};