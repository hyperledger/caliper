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
*  Vehicle Lifecycle Network
*  Moves Vehicles through a lifecycle via Transaction(s)
*  - Example test round(s)
*      {
*        "label" : "vehicle-lifecycle-network",
*        "txNumber" : [50],
*        "trim" : 0,
*        "rateControl" : [{"type": "fixed-rate", "opts": {"tps" : 10}}],
*        "arguments": {"testAssets": 50, "transaction": "placeOrder"},
*        "callback" : "benchmark/composer/composer-samples/vehicle-lifecycle-network.js"
*      }
*      {
*        "label" : "vehicle-lifecycle-network",
*        "txNumber" : [50],
*        "trim" : 0,
*        "rateControl" : [{"type": "fixed-rate", "opts": {"tps" : 10}}],
*        "arguments": {"testAssets": 50, "transaction": "updateOrderStatus"},
*        "callback" : "benchmark/composer/composer-samples/vehicle-lifecycle-network.js"
*      }
*      {
*        "label" : "vehicle-lifecycle-network",
*        "txNumber" : [50],
*        "trim" : 0,
*        "rateControl" : [{"type": "fixed-rate", "opts": {"tps" : 10}}],
*        "arguments": {"testAssets": 50, "transaction": "scrapVehicle"},
*        "callback" : "benchmark/composer/composer-samples/vehicle-lifecycle-network.js"
*      }
*  - Supported Transactions:
*    - placeOrder
*    - updateOrderStatus
*    - scrapVehicle
*  - Init:
*    - Varies based on Transaction called
*  - Run:
*    - Specified Transaction runs
*
*/
'use strict';

const removeExisting = require('../composer-test-utils').clearAll;
const Log = require('../../../src/comm/util').log;
const os = require('os');
const uuid = os.hostname() + process.pid; // UUID for client within test

module.exports.info  = 'Vehicle Lifecycle Network Performance Test';

let bc;
let busNetConnection;
let testAssetNum;
let testTransaction;
let factory;
let assetId;
const base_ns = 'org.acme.vehicle.lifecycle';
const manuf_ns = 'org.acme.vehicle.lifecycle.manufacturer';
const vda_ns = 'org.vda';

module.exports.init = async function(blockchain, context, args) {
    // Create Participants and Assets to use in main test
    bc = blockchain;
    busNetConnection = context;
    testAssetNum = args.testAssets;
    testTransaction = args.transaction;

    assetId = 0;
    factory = busNetConnection.getBusinessNetwork().getFactory();

    let manufacturerRegistry = await busNetConnection.getParticipantRegistry(manuf_ns + '.Manufacturer');
    let ownerRegistry = await busNetConnection.getParticipantRegistry(base_ns + '.PrivateOwner');
    let orderRegistry = await busNetConnection.getAssetRegistry(manuf_ns + '.Order');
    let vehicleRegistry = await busNetConnection.getAssetRegistry(vda_ns + '.Vehicle');

    let manufacturers = new Array();
    let privateOwners = new Array();
    let orders = new Array();
    let vehicles = new Array();
    let populated;

    switch(testTransaction) {
    case 'placeOrder':
        // Require Manufacturer and number of Person(s) to order a vehicle from the company
        // - Single Manufacturer
        manufacturers.push(factory.newResource(manuf_ns, 'Manufacturer', 'MANUFACTURER_' + uuid + '_0'));
        // - Test specified number of 'Person(s)'
        for(let i = 0; i < testAssetNum; i ++){
            privateOwners.push(factory.newResource(base_ns, 'PrivateOwner', 'PRIVATEOWNER_' + uuid + '_' + i));
        }
        populated = await manufacturerRegistry.exists(manufacturers[0].getIdentifier());
        break;
    case 'updateOrderStatus':
        // Require Manufacturer, number of Person(s), and a number of Order(s)
        // - Single Manufacturer
        manufacturers.push(factory.newResource(manuf_ns, 'Manufacturer', 'MANUFACTURER_' + uuid + '_0'));
        // - Test specified number of 'Person(s)'
        for (let i = 0; i < testAssetNum; i ++) {
            privateOwners.push(factory.newResource(base_ns, 'PrivateOwner', 'PRIVATEOWNER_' + uuid + '_' + i));
        }
        // - Test specified number of 'Orders'
        for (let i = 0; i < testAssetNum; i ++) {
            let order = factory.newResource(manuf_ns, 'Order', 'ORDER_' + uuid + '_' + i);
            order.orderStatus = 'PLACED';
            order.manufacturer = factory.newRelationship(manuf_ns, 'Manufacturer', 'MANUFACTURER_' + uuid + '_0');
            order.orderer = factory.newRelationship(base_ns, 'PrivateOwner', 'PRIVATEOWNER_' + uuid + '_' + i);
            let vehicle = factory.newConcept(vda_ns, 'VehicleDetails');
            vehicle.make = 'testMake';
            vehicle.modelType = 'testModel';
            vehicle.colour = 'testColour';
            order.vehicleDetails = vehicle;
            orders.push(order);
        }
        populated = await manufacturerRegistry.exists(manufacturers[0].getIdentifier());
        break;
    case 'scrapVehicle':
        // Require Vehicles to scrap
        for (let i = 0; i < testAssetNum; i ++) {
            let vehicle = factory.newResource(vda_ns, 'Vehicle', 'VEHICLE_' + uuid + '_' + i);
            let details = factory.newConcept(vda_ns, 'VehicleDetails');
            details.make = 'testMake';
            details.modelType = 'testModel';
            details.colour = 'testColour';
            vehicle.vehicleDetails = details;
            vehicle.vehicleStatus = 'OFF_THE_ROAD';
            vehicles.push(vehicle);
        }
        populated = await vehicleRegistry.exists(vehicles[0].getIdentifier());
        break;
    default:
        throw new Error('No valid test Transaction specified');
    }

    try {
        if (!populated) {
            // First test pass, just add
            Log('Adding test assets ...');
            await manufacturerRegistry.addAll(manufacturers);
            await ownerRegistry.addAll(privateOwners);
            await vehicleRegistry.addAll(vehicles);
            await orderRegistry.addAll(orders);
            Log('Asset addition complete ...');
        } else {
            // Second test pass, update/remove
            Log('Updating test assets ...');
            await removeExisting(manufacturerRegistry, 'MANUFACTURER_' + uuid);
            await removeExisting(ownerRegistry, 'PRIVATEOWNER_' + uuid);
            await removeExisting(vehicleRegistry, 'VEHICLE_' + uuid);
            await removeExisting(orderRegistry, 'ORDER_' + uuid);
            await manufacturerRegistry.addAll(manufacturers);
            await ownerRegistry.addAll(privateOwners);
            await vehicleRegistry.addAll(vehicles);
            await orderRegistry.addAll(orders);
            Log('Asset update complete ...');
        }
    } catch (error) {
        Log('error in test init(): ', error);
        return Promise.reject(error);
    }
};

module.exports.run = function() {
    let transaction;
    switch (testTransaction) {
    case 'placeOrder': {
        transaction = factory.newTransaction(manuf_ns, 'PlaceOrder');
        transaction.orderId = 'ORDER_' + uuid + '_' + assetId;
        let vehicle = factory.newConcept(vda_ns, 'VehicleDetails');
        vehicle.make = 'testMake';
        vehicle.modelType = 'testModel';
        vehicle.colour = 'testColour';
        transaction.vehicleDetails = vehicle;
        transaction.manufacturer = factory.newRelationship(manuf_ns, 'Manufacturer', 'MANUFACTURER_' + uuid + '_');
        transaction.orderer = factory.newRelationship(base_ns, 'PrivateOwner', 'PRIVATEOWNER_' + uuid + '_' + assetId++);
        break;
    }
    case 'updateOrderStatus': {
        transaction = factory.newTransaction(manuf_ns, 'UpdateOrderStatus');
        transaction.order = factory.newRelationship(manuf_ns, 'Order', 'ORDER_' + uuid + '_' + assetId++);
        transaction.orderStatus = 'PLACED';
        break;
    }
    case 'scrapVehicle': {
        transaction = factory.newTransaction(vda_ns, 'ScrapVehicle');
        transaction.vehicle = factory.newRelationship(vda_ns, 'Vehicle', 'VEHICLE_' + uuid + '_' + assetId++);
        break;
    }
    default: {
        throw new Error('No valid test Transaction specified');
    }
    }
    return bc.bcObj.submitTransaction(busNetConnection, transaction);
};

module.exports.end = function() {
    return Promise.resolve(true);
};