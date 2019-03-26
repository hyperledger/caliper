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

/* global getFactory getAssetRegistry emit query */

/**
 * Transfer a vehicle to another private owner
 * @param {org.vda.PrivateVehicleTransfer} privateVehicleTransfer - the PrivateVehicleTransfer transaction
 * @transaction
 */
async function privateVehicleTransfer(privateVehicleTransfer) { // eslint-disable-line no-unused-vars
    console.log('privateVehicleTransfer'); // eslint-disable-line no-console

    const NS = 'org.acme.vehicle.lifecycle';
    const NS_D = 'org.vda';
    const factory = getFactory();

    const seller = privateVehicleTransfer.seller;
    const buyer = privateVehicleTransfer.buyer;
    const vehicle = privateVehicleTransfer.vehicle;

    //change vehicle owner
    vehicle.owner = buyer;

    //PrivateVehicleTransaction for log
    const vehicleTransferLogEntry = factory.newConcept(NS_D, 'VehicleTransferLogEntry');
    vehicleTransferLogEntry.vehicle = factory.newRelationship(NS_D, 'Vehicle', vehicle.getIdentifier());
    vehicleTransferLogEntry.seller = factory.newRelationship(NS, 'PrivateOwner', seller.getIdentifier());
    vehicleTransferLogEntry.buyer = factory.newRelationship(NS, 'PrivateOwner', buyer.getIdentifier());
    vehicleTransferLogEntry.timestamp = privateVehicleTransfer.timestamp;
    if (!vehicle.logEntries) {
        vehicle.logEntries = [];
    }

    vehicle.logEntries.push(vehicleTransferLogEntry);

    const assetRegistry = await getAssetRegistry(vehicle.getFullyQualifiedType());
    await assetRegistry.update(vehicle);
}

/**
 * Scrap a vehicle
 * @param {org.vda.ScrapVehicle} scrapVehicle - the ScrapVehicle transaction
 * @transaction
 */
async function scrapVehicle(scrapVehicle) { // eslint-disable-line no-unused-vars
    console.log('scrapVehicle'); // eslint-disable-line no-console

    const NS_D = 'org.vda';

    const assetRegistry = await getAssetRegistry(NS_D + '.Vehicle');
    const vehicle = await assetRegistry.get(scrapVehicle.vehicle.getIdentifier());
    vehicle.vehicleStatus = 'SCRAPPED';
    await assetRegistry.update(vehicle);
}

/**
 * Scrap a vehicle
 * @param {org.vda.ScrapAllVehiclesByColour} scrapAllVehicles - the ScrapAllVehicles transaction
 * @transaction
 */
async function scrapAllVehiclesByColour(scrapAllVehicles) { // eslint-disable-line no-unused-vars
    console.log('scrapAllVehiclesByColour'); // eslint-disable-line no-console

    const NS_D = 'org.vda';
    const assetRegistry = await getAssetRegistry(NS_D + '.Vehicle');
    const vehicles = await query('selectAllCarsByColour', {'colour': scrapAllVehicles.colour});
    if (vehicles.length >= 1) {
        const factory = getFactory();
        const vehiclesToScrap = vehicles.filter(function (vehicle) {
            return vehicle.vehicleStatus !== 'SCRAPPED';
        });
        for (let x = 0; x < vehiclesToScrap.length; x++) {
            vehiclesToScrap[x].vehicleStatus = 'SCRAPPED';
            const scrapVehicleEvent = factory.newEvent(NS_D, 'ScrapVehicleEvent');
            scrapVehicleEvent.vehicle = vehiclesToScrap[x];
            emit(scrapVehicleEvent);
        }
        await assetRegistry.updateAll(vehiclesToScrap);
    }
}
