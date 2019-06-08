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

/* global getFactory getAssetRegistry emit */

/**
 * Place an order for a vehicle
 * @param {org.acme.vehicle.lifecycle.manufacturer.PlaceOrder} placeOrder - the PlaceOrder transaction
 * @transaction
 */
async function placeOrder(placeOrder) { // eslint-disable-line no-unused-vars
    console.log('placeOrder'); // eslint-disable-line no-console

    const factory = getFactory();
    const NS_M = 'org.acme.vehicle.lifecycle.manufacturer';
    const NS = 'org.acme.vehicle.lifecycle';

    const order = factory.newResource(NS_M, 'Order', placeOrder.orderId);
    order.vehicleDetails = placeOrder.vehicleDetails;
    order.orderStatus = 'PLACED';
    order.manufacturer = placeOrder.manufacturer;
    order.orderer = factory.newRelationship(NS, 'PrivateOwner', placeOrder.orderer.getIdentifier());

    // save the order
    const registry = await getAssetRegistry(order.getFullyQualifiedType());
    await registry.add(order);
    const placeOrderEvent = factory.newEvent(NS_M, 'PlaceOrderEvent');
    placeOrderEvent.orderId = order.orderId;
    placeOrderEvent.vehicleDetails = order.vehicleDetails;
    emit(placeOrderEvent);
}

/**
 * Update the status of an order
 * @param {org.acme.vehicle.lifecycle.manufacturer.UpdateOrderStatus} updateOrderStatus - the UpdateOrderStatus transaction
 * @transaction
 */
async function updateOrderStatus(updateOrderStatus) { // eslint-disable-line no-unused-vars
    console.log('updateOrderStatus'); // eslint-disable-line no-console

    const factory = getFactory();
    const NS_M = 'org.acme.vehicle.lifecycle.manufacturer';
    const NS = 'org.acme.vehicle.lifecycle';
    const NS_D = 'org.vda';

    // save the new status of the order
    updateOrderStatus.order.orderStatus = updateOrderStatus.orderStatus;

    // get vehicle registry
    const registry = await getAssetRegistry(NS_D + '.Vehicle');
    if (updateOrderStatus.orderStatus === 'VIN_ASSIGNED') {
        const vehicle = factory.newResource(NS_D, 'Vehicle', updateOrderStatus.vin);
        vehicle.vehicleDetails = updateOrderStatus.order.vehicleDetails;
        vehicle.vehicleDetails.vin = updateOrderStatus.vin;
        vehicle.vehicleStatus = 'OFF_THE_ROAD';
        await registry.add(vehicle);
    } else if (updateOrderStatus.orderStatus === 'OWNER_ASSIGNED') {
        if (!updateOrderStatus.order.orderer.vehicles) {
            updateOrderStatus.order.orderer.vehicles = [];
        }

        const vehicle = await registry.get(updateOrderStatus.vin);
        vehicle.vehicleStatus = 'ACTIVE';
        vehicle.owner = factory.newRelationship('org.acme.vehicle.lifecycle', 'PrivateOwner', updateOrderStatus.order.orderer.email);
        vehicle.numberPlate = updateOrderStatus.numberPlate || '';
        vehicle.vehicleDetails.numberPlate = updateOrderStatus.numberPlate || '';
        vehicle.vehicleDetails.v5c = updateOrderStatus.v5c || '';
        if (!vehicle.logEntries) {
            vehicle.logEntries = [];
        }
        const logEntry = factory.newConcept(NS_D, 'VehicleTransferLogEntry');
        logEntry.vehicle = factory.newRelationship(NS_D, 'Vehicle', updateOrderStatus.vin);
        logEntry.buyer = factory.newRelationship(NS, 'PrivateOwner', updateOrderStatus.order.orderer.email);
        logEntry.timestamp = updateOrderStatus.timestamp;
        vehicle.logEntries.push(logEntry);
        await registry.update(vehicle);
    }

    // get order registry
    const orderRegistry = await getAssetRegistry(updateOrderStatus.order.getFullyQualifiedType());
    // update order status
    updateOrderStatus.order.vehicleDetails.vin = updateOrderStatus.vin || '';

    if (!updateOrderStatus.order.statusUpdates) {
        updateOrderStatus.order.statusUpdates = [];
    }

    updateOrderStatus.order.statusUpdates.push(updateOrderStatus);

    await orderRegistry.update(updateOrderStatus.order);
    const updateOrderStatusEvent = factory.newEvent(NS_M, 'UpdateOrderStatusEvent');
    updateOrderStatusEvent.orderStatus = updateOrderStatus.order.orderStatus;
    updateOrderStatusEvent.order = updateOrderStatus.order;
    emit(updateOrderStatusEvent);
}
