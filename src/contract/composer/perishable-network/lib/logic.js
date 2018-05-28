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


/**
 * A shipment has been received by an importer
 * @param {org.acme.shipping.perishable.ShipmentReceived} shipmentReceived - the ShipmentReceived transaction
 * @transaction
 */
async function payOut(shipmentReceived) {  // eslint-disable-line no-unused-vars
    const contract = shipmentReceived.shipment.contract;
    const shipment = shipmentReceived.shipment;
    let payOut = contract.unitPrice * shipment.unitCount;

    console.log('Received at: ' + shipmentReceived.timestamp); // eslint-disable-line no-console
    console.log('Contract arrivalDateTime: ' + contract.arrivalDateTime); // eslint-disable-line no-console

    // set the status of the shipment
    shipment.status = 'ARRIVED';

    // if the shipment did not arrive on time the payout is zero
    if (shipmentReceived.timestamp > contract.arrivalDateTime) {
        payOut = 0;
        console.log('Late shipment'); // eslint-disable-line no-console
    } else {
        // find the lowest temperature reading
        if (shipment.temperatureReadings) {
            // sort the temperatureReadings by centigrade
            shipment.temperatureReadings.sort(function (a, b) {
                return (a.centigrade - b.centigrade);
            });
            const lowestReading = shipment.temperatureReadings[0];
            const highestReading = shipment.temperatureReadings[shipment.temperatureReadings.length - 1];
            let penalty = 0;
            console.log('Lowest temp reading: ' + lowestReading.centigrade); // eslint-disable-line no-console
            console.log('Highest temp reading: ' + highestReading.centigrade); // eslint-disable-line no-console

            // does the lowest temperature violate the contract?
            if (lowestReading.centigrade < contract.minTemperature) {
                penalty += (contract.minTemperature - lowestReading.centigrade) * contract.minPenaltyFactor;
                console.log('Min temp penalty: ' + penalty); // eslint-disable-line no-console
            }

            // does the highest temperature violate the contract?
            if (highestReading.centigrade > contract.maxTemperature) {
                penalty += (highestReading.centigrade - contract.maxTemperature) * contract.maxPenaltyFactor;
                console.log('Max temp penalty: ' + penalty); // eslint-disable-line no-console
            }

            // apply any penalities
            payOut -= (penalty * shipment.unitCount);

            if (payOut < 0) {
                payOut = 0;
            }
        }
    }

    console.log('Payout: ' + payOut); // eslint-disable-line no-console
    contract.grower.accountBalance += payOut;
    contract.importer.accountBalance -= payOut;

    console.log('Grower: ' + contract.grower.$identifier + ' new balance: ' + contract.grower.accountBalance); // eslint-disable-line no-console
    console.log('Importer: ' + contract.importer.$identifier + ' new balance: ' + contract.importer.accountBalance); // eslint-disable-line no-console

    // update the grower's balance
    const growerRegistry = await getParticipantRegistry('org.acme.shipping.perishable.Grower'); // eslint-disable-line no-undef
    await growerRegistry.update(contract.grower);

    // update the importer's balance
    const importerRegistry = await getParticipantRegistry('org.acme.shipping.perishable.Importer'); // eslint-disable-line no-undef
    await importerRegistry.update(contract.importer);

    // update the state of the shipment
    const shipmentRegistry = await getAssetRegistry('org.acme.shipping.perishable.Shipment'); // eslint-disable-line no-undef
    await shipmentRegistry.update(shipment);
}

/**
 * A temperature reading has been received for a shipment
 * @param {org.acme.shipping.perishable.TemperatureReading} temperatureReading - the TemperatureReading transaction
 * @transaction
 */
async function temperatureReading(temperatureReading) {  // eslint-disable-line no-unused-vars

    const shipment = temperatureReading.shipment;

    console.log('Adding temperature ' + temperatureReading.centigrade + ' to shipment ' + shipment.$identifier); // eslint-disable-line no-console

    if (shipment.temperatureReadings) {
        shipment.temperatureReadings.push(temperatureReading);
    } else {
        shipment.temperatureReadings = [temperatureReading];
    }

    // add the temp reading to the shipment
    const shipmentRegistry = await getAssetRegistry('org.acme.shipping.perishable.Shipment'); // eslint-disable-line no-undef
    await shipmentRegistry.update(shipment);
}

/**
 * Initialize some test assets and participants useful for running a demo.
 * @param {org.acme.shipping.perishable.SetupDemo} setupDemo - the SetupDemo transaction
 * @transaction
 */
async function setupDemo(setupDemo) {  // eslint-disable-line no-unused-vars

    const factory = getFactory(); // eslint-disable-line no-undef
    const NS = 'org.acme.shipping.perishable';

    // create the grower
    const grower = factory.newResource(NS, 'Grower', 'farmer@email.com');
    const growerAddress = factory.newConcept(NS, 'Address');
    growerAddress.country = 'USA';
    grower.address = growerAddress;
    grower.accountBalance = 0;

    // create the importer
    const importer = factory.newResource(NS, 'Importer', 'supermarket@email.com');
    const importerAddress = factory.newConcept(NS, 'Address');
    importerAddress.country = 'UK';
    importer.address = importerAddress;
    importer.accountBalance = 0;

    // create the shipper
    const shipper = factory.newResource(NS, 'Shipper', 'shipper@email.com');
    const shipperAddress = factory.newConcept(NS, 'Address');
    shipperAddress.country = 'Panama';
    shipper.address = shipperAddress;
    shipper.accountBalance = 0;

    // create the contract
    const contract = factory.newResource(NS, 'Contract', 'CON_001');
    contract.grower = factory.newRelationship(NS, 'Grower', 'farmer@email.com');
    contract.importer = factory.newRelationship(NS, 'Importer', 'supermarket@email.com');
    contract.shipper = factory.newRelationship(NS, 'Shipper', 'shipper@email.com');
    const tomorrow = setupDemo.timestamp;
    tomorrow.setDate(tomorrow.getDate() + 1);
    contract.arrivalDateTime = tomorrow; // the shipment has to arrive tomorrow
    contract.unitPrice = 0.5; // pay 50 cents per unit
    contract.minTemperature = 2; // min temperature for the cargo
    contract.maxTemperature = 10; // max temperature for the cargo
    contract.minPenaltyFactor = 0.2; // we reduce the price by 20 cents for every degree below the min temp
    contract.maxPenaltyFactor = 0.1; // we reduce the price by 10 cents for every degree above the max temp

    // create the shipment
    const shipment = factory.newResource(NS, 'Shipment', 'SHIP_001');
    shipment.type = 'BANANAS';
    shipment.status = 'IN_TRANSIT';
    shipment.unitCount = 5000;
    shipment.contract = factory.newRelationship(NS, 'Contract', 'CON_001');

    // add the growers
    const growerRegistry = await getParticipantRegistry(NS + '.Grower'); // eslint-disable-line no-undef
    await growerRegistry.addAll([grower]);

    // add the importers
    const importerRegistry = await getParticipantRegistry(NS + '.Importer'); // eslint-disable-line no-undef
    await importerRegistry.addAll([importer]);

    // add the shippers
    const shipperRegistry = await getParticipantRegistry(NS + '.Shipper'); // eslint-disable-line no-undef
    await shipperRegistry.addAll([shipper]);

    // add the contracts
    const contractRegistry = await getAssetRegistry(NS + '.Contract'); // eslint-disable-line no-undef
    await contractRegistry.addAll([contract]);

    // add the shipments
    const shipmentRegistry = await getAssetRegistry(NS + '.Shipment'); // eslint-disable-line no-undef
    await shipmentRegistry.addAll([shipment]);
}