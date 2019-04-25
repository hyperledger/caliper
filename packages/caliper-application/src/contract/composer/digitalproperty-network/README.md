# Digital Property Network

> This Defines a business network where house sellers can list their properties for sale.

This business network defines:

**Participant**
`Person`

**Assets**
`LandTitle` `SalesAgreement`

**Transaction**
`RegisterPropertyForSale`

A `Person` is responsible for a `LandTitle`. By creating a `SalesAgreement` between two `Person` participants you are then able to submit a `RegisterPropertyForSale` transaction.

To test this Business Network Definition in the **Test** tab:

Create two `Person` participants:

```
{
  "$class": "net.biz.digitalPropertyNetwork.Person",
  "personId": "personId:Billy",
  "firstName": "Billy",
  "lastName": "Thompson"
}
```

```
{
  "$class": "net.biz.digitalPropertyNetwork.Person",
  "personId": "personId:Jenny",
  "firstName": "Jenny",
  "lastName": "Jones"
}
```

Create a `LandTitle` asset:

```
{
  "$class": "net.biz.digitalPropertyNetwork.LandTitle",
  "titleId": "titleId:ABCD",
  "owner": "resource:net.biz.digitalPropertyNetwork.Person#personId:Billy",
  "information": "Detached House"
}
```

Create a `SalesAgreement` asset:

```
{
  "$class": "net.biz.digitalPropertyNetwork.SalesAgreement",
  "salesId": "salesId:1234",
  "buyer": "resource:net.biz.digitalPropertyNetwork.Person#personId:Jenny",
  "seller": "resource:net.biz.digitalPropertyNetwork.Person#personId:Billy",
  "title": "resource:net.biz.digitalPropertyNetwork.LandTitle#titleId:ABCD"
}
```

Submit a `RegisterPropertyForSale` transaction:

```
{
  "$class": "net.biz.digitalPropertyNetwork.RegisterPropertyForSale",
  "seller": "resource:net.biz.digitalPropertyNetwork.Person#personId:Billy",
  "title": "resource:net.biz.digitalPropertyNetwork.LandTitle#titleId:ABCD"
}
```

This `RegisterPropertyForSale` transaction will update `titleId:ABCD` `LandTitle` asset to `forSale`.

Congratulations!
