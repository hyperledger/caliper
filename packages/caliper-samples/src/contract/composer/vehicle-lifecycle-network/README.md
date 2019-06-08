# Vehicle Lifecycle Network

> This network tracks the Lifecycle of Vehicles from manufacture to being scrapped involving private owners, manufacturers and scrap merchants. A regulator is able to provide oversight throughout this whole process.

This business network defines:

**Participants**
`AuctionHouse` `Company` `Manufacturer` `PrivateOwner` `Regulator` `ScrapMerchant`

**Assets**
`Order` `Vehicle`

**Transactions**
`PlaceOrder` `UpdateOrderStatus` `ApplicationForVehicleRegistrationCertificate` `PrivateVehicleTransfer` `ScrapVehicle` `UpdateSuspicious` `ScrapAllVehiclesByColour` `SetupDemo`

**Events**
`PlaceOrderEvent` `UpdateOrderStatusEvent` `ScrapVehicleEvent`

A `PriavteOwner` participant would submit a `PlaceOrder` transaction, through a Manufacturer's application. A `Manufacturer` would submit an `UpdateOrderStatus` transaction which would be the Vehicle being manufactured. They would apply for a registration certificate by submitting an `ApplicationForVehicleRegistrationCertificate` transaction. After the vehicle has been manufactured they would submit a `PrivateVehicleTransfer` transaction. A `Regulator` would be able perform oversight over this whole process and submit an `UpdateSuspicious` transaction to view any suspicious vehicles that may be out of compliance with regulations. A `ScrapMerchant` would be able to submit a `ScrapVehicle` or a `ScrapAllVehiclesByColour` transaction to complete the lifecycle of a vehicle.

To test this Business Network Definition in the **Test** tab:

Submit a `SetupDemo` transaction:

```
{
  "$class": "org.acme.vehicle.lifecycle.SetupDemo"
}
```

This transaction populates the Participant Registries with three `Manufacturer` participants, twenty-three `PrivateOwner` participants and a `Regulator` participant. The `Vehicle` Asset Registry will have thirteen `Vehicle` assets.

Submit a `PlaceOrder` transaction:

```
{
  "$class": "org.acme.vehicle.lifecycle.manufacturer.PlaceOrder",
  "orderId": "1234",
  "vehicleDetails": {
    "$class": "org.vda.VehicleDetails",
    "make": "Arium",
    "modelType": "Gamora",
    "colour": "Sunburst Orange"
  },
  "manufacturer": "resource:org.acme.vehicle.lifecycle.manufacturer.Manufacturer#Arium",
  "orderer": "resource:org.acme.vehicle.lifecycle.PrivateOwner#toby"
}
```

This `PlaceOrder` transaction creates a new order in the `Order` Asset Registry. It also emits a `PlaceOrderEvent` events.

Submit a `UpdateOrderStatus` transaction:

```
{
  "$class": "org.acme.vehicle.lifecycle.manufacturer.UpdateOrderStatus",
  "orderStatus": "SCHEDULED_FOR_MANUFACTURE",
  "order": "resource:org.acme.vehicle.lifecycle.manufacturer.Order#1234"
}
```

This `UpdateOrderStatus` transaction updates the order status of `orderId:1234` in the `Order` Asset Registry. It also emits a `UpdateOrderStatusEvent` event.

Congratulations!

This Business Network definition had been used to create demo applications for the `PrivateOwner`, `Manufacturer` and `Regulator`. Find more information here: https://github.com/hyperledger/composer-sample-applications/tree/master/packages/vehicle-lifecycle
