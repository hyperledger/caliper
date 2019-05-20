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

/* global getFactory getParticipantRegistry getAssetRegistry */

'use strict';

/**
 * Setup the demo
 * @param {org.acme.vehicle.lifecycle.SetupDemo} setupDemo - the SetupDemo transaction
 * @transaction
 */
async function setupDemo(setupDemo) { // eslint-disable-line no-unused-vars
    console.log('setupDemo'); // eslint-disable-line no-console

    const factory = getFactory();
    const NS_M = 'org.acme.vehicle.lifecycle.manufacturer';
    const NS = 'org.acme.vehicle.lifecycle';
    const NS_D = 'org.vda';

    const names = ['dan', 'simon', 'jake', 'anastasia', 'matthew', 'mark', 'fenglian', 'sam', 'james', 'nick', 'caroline', 'rachel', 'john', 'rob', 'tom', 'paul', 'ed', 'dave', 'anthony', 'toby', 'ant', 'matt', 'anna'];
    const vehicles = {
        'Arium': {
            'Nova': [
                {
                    'vin': '156478954',
                    'colour': 'white',
                    'vehicleStatus': 'ACTIVE'
                }
            ],
            'Nebula': [
                {
                    'vin': '652345894',
                    'colour': 'blue',
                    'vehicleStatus': 'ACTIVE'
                }
            ]
        },
        'Morde': {
            'Putt': [
                {
                    'vin': '6437956437',
                    'colour': 'black',
                    'vehicleStatus': 'ACTIVE',
                    'suspiciousMessage': 'Mileage anomaly'
                },
                {
                    'vin': '857642213',
                    'colour': 'red',
                    'vehicleStatus': 'ACTIVE'
                },
                {
                    'vin': '542376495',
                    'colour': 'silver',
                    'vehicleStatus': 'ACTIVE'
                }
            ],
            'Pluto': [
                {
                    'vin': '976431649',
                    'colour': 'white',
                    'vehicleStatus': 'ACTIVE'
                },
                {
                    'vin': '564215468',
                    'colour': 'green',
                    'vehicleStatus': 'ACTIVE',
                    'suspiciousMessage': 'Insurance write-off but still active'
                },
                {
                    'vin': '784512464',
                    'colour': 'grey',
                    'vehicleStatus': 'ACTIVE'
                }
            ]
        },
        'Ridge': {
            'Cannon': [
                {
                    'vin': '457645764',
                    'colour': 'red',
                    'vehicleStatus': 'ACTIVE'
                },
                {
                    'vin': '312457645',
                    'colour': 'white',
                    'vehicleStatus': 'ACTIVE',
                    'suspiciousMessage': 'Suspicious ownership sequence'
                },
                {
                    'vin': '65235647',
                    'colour': 'silver',
                    'vehicleStatus': 'ACTIVE',
                    'suspiciousMessage': 'Untaxed vehicle'
                }
            ],
            'Rancher': [
                {
                    'vin': '85654575',
                    'colour': 'blue',
                    'vehicleStatus': 'ACTIVE'
                },
                {
                    'vin': '326548754',
                    'colour': 'white',
                    'vehicleStatus': 'ACTIVE',
                    'suspiciousMessage': 'Uninsured vehicle'
                }
            ]
        }
    };

    // register manufacturers
    const manufacturers = Object.keys(vehicles).map(name => {
        return factory.newResource(NS_M, 'Manufacturer', name);
    });
    const manufacturerRegistry = await getParticipantRegistry(NS_M + '.Manufacturer');
    await manufacturerRegistry.addAll(manufacturers);

    // register private owners
    const privateOwners = names.map(name => {
        return factory.newResource(NS, 'PrivateOwner', name);
    });
    const privateOwnerRegistry = await getParticipantRegistry(NS + '.PrivateOwner');
    await privateOwnerRegistry.addAll(privateOwners);

    // register regulator
    const regulator = factory.newResource(NS, 'Regulator', 'regulator');
    const regulatorRegistry = await getParticipantRegistry(NS + '.Regulator');
    await regulatorRegistry.add(regulator);

    // register vehicles
    const vs = [];
    let carCount = 0;
    for (const mName in vehicles) {
        const manufacturer = vehicles[mName];
        for (const mModel in manufacturer) {
            const model = manufacturer[mModel];
            for (let i = 0; i < model.length; i++) {
                const vehicleTemplate = model[i];
                const vehicle = factory.newResource(NS_D, 'Vehicle', vehicleTemplate.vin);
                vehicle.owner = factory.newRelationship(NS, 'PrivateOwner', names[carCount]);
                vehicle.vehicleStatus = vehicleTemplate.vehicleStatus;
                vehicle.vehicleDetails = factory.newConcept(NS_D, 'VehicleDetails');
                vehicle.vehicleDetails.make = mName;
                vehicle.vehicleDetails.modelType = mModel;
                vehicle.vehicleDetails.colour = vehicleTemplate.colour;
                vehicle.vehicleDetails.vin = vehicleTemplate.vin;

                if (vehicleTemplate.suspiciousMessage) {
                    vehicle.suspiciousMessage = vehicleTemplate.suspiciousMessage;
                }

                if (!vehicle.logEntries) {
                    vehicle.logEntries = [];
                }

                const logEntry = factory.newConcept(NS_D, 'VehicleTransferLogEntry');
                logEntry.vehicle = factory.newRelationship(NS_D, 'Vehicle', vehicleTemplate.vin);
                logEntry.buyer = factory.newRelationship(NS, 'PrivateOwner', names[carCount]);
                logEntry.timestamp = setupDemo.timestamp;

                vehicle.logEntries.push(logEntry);

                vs.push(vehicle);
                carCount++;
            }
        }
    }
    const vehicleRegistry = await getAssetRegistry(NS_D + '.Vehicle');
    await vehicleRegistry.addAll(vs);
}