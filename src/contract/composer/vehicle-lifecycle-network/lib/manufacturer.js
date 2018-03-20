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


/**
 * Place an order for a vehicle
 * @param {org.acme.vehicle.lifecycle.manufacturer.PlaceOrder} placeOrder - the PlaceOrder transaction
 * @transaction
 */
function placeOrder(placeOrder) {
    console.log('placeOrder');

    var factory = getFactory();
    var NS_M = 'org.acme.vehicle.lifecycle.manufacturer';
    var NS = 'org.acme.vehicle.lifecycle';
    var NS_D = 'org.vda';

    var order = factory.newResource(NS_M, 'Order', placeOrder.orderId);
    order.vehicleDetails = placeOrder.vehicleDetails;
    order.orderStatus = 'PLACED';
    order.manufacturer = placeOrder.manufacturer;
    order.orderer = factory.newRelationship(NS, 'PrivateOwner', placeOrder.orderer.getIdentifier());

    // save the order
    return getAssetRegistry(order.getFullyQualifiedType())
        .then(function (registry) {
            return registry.add(order);
        })
        .then(function(){
    		var placeOrderEvent = factory.newEvent(NS_M, 'PlaceOrderEvent');
      		placeOrderEvent.orderId = order.orderId;
      		placeOrderEvent.vehicleDetails = order.vehicleDetails;
    		emit(placeOrderEvent);
    	});
}

/**
 * Update the status of an order
 * @param {org.acme.vehicle.lifecycle.manufacturer.UpdateOrderStatus} updateOrderStatus - the UpdateOrderStatus transaction
 * @transaction
 */
function updateOrderStatus(updateOrderStatus) {
    console.log('updateOrderStatus');

    var factory = getFactory();
    var NS_M = 'org.acme.vehicle.lifecycle.manufacturer';
    var NS = 'org.acme.vehicle.lifecycle';
    var NS_D = 'org.vda';

    // save the new status of the order
    updateOrderStatus.order.orderStatus = updateOrderStatus.orderStatus;

  	// get vehicle registry
  	return getAssetRegistry(NS_D + '.Vehicle')
  		.then(function(registry) {
      		if (updateOrderStatus.orderStatus === 'VIN_ASSIGNED') {
            	var vehicle = factory.newResource(NS_D, 'Vehicle', updateOrderStatus.vin );
                vehicle.vehicleDetails = updateOrderStatus.order.vehicleDetails;
                vehicle.vehicleDetails.vin = updateOrderStatus.vin;
                vehicle.vehicleStatus = 'OFF_THE_ROAD';
                return registry.add(vehicle);
            } else if(updateOrderStatus.orderStatus === 'OWNER_ASSIGNED') {
                if (!updateOrderStatus.order.orderer.vehicles) {
                    updateOrderStatus.order.orderer.vehicles = [];
                }

            	return registry.get(updateOrderStatus.vin)
                    .then(function(vehicle) {
                        vehicle.vehicleStatus = 'ACTIVE';
                        vehicle.owner = factory.newRelationship('org.acme.vehicle.lifecycle', 'PrivateOwner', updateOrderStatus.order.orderer.email);
                        vehicle.numberPlate = updateOrderStatus.numberPlate || '';
                        vehicle.vehicleDetails.numberPlate = updateOrderStatus.numberPlate || '';
                        vehicle.vehicleDetails.v5c = updateOrderStatus.v5c || '';
                        if (!vehicle.logEntries) {
                            vehicle.logEntries = [];
                        }
                        var logEntry = factory.newConcept(NS_D, 'VehicleTransferLogEntry');
                        logEntry.vehicle = factory.newRelationship(NS_D, 'Vehicle', updateOrderStatus.vin);
                        logEntry.buyer = factory.newRelationship(NS, 'PrivateOwner', updateOrderStatus.order.orderer.email);
                        logEntry.timestamp = updateOrderStatus.timestamp;
                        vehicle.logEntries.push(logEntry);
                        return registry.update(vehicle);
                    });
            }
    	})
  		.then(function() {
      		// get order registry
    		return getAssetRegistry(updateOrderStatus.order.getFullyQualifiedType());
    	})
  		.then(function(registry) {
      		// update order status
            updateOrderStatus.order.vehicleDetails.vin = updateOrderStatus.vin || '';
            
            if (!updateOrderStatus.order.statusUpdates) {
                updateOrderStatus.order.statusUpdates = [];
            }

            updateOrderStatus.order.statusUpdates.push(updateOrderStatus);

      		return registry.update(updateOrderStatus.order);
    	})
        .then(function(){
    		var updateOrderStatusEvent = factory.newEvent(NS_M, 'UpdateOrderStatusEvent');
      		updateOrderStatusEvent.orderStatus = updateOrderStatus.order.orderStatus;
      		updateOrderStatusEvent.order = updateOrderStatus.order;
    		emit(updateOrderStatusEvent);
    	});
        
}
