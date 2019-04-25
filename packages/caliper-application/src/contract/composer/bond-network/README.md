# Bond Network

> The Bond Network allows the issuer of a bond to update the bond information whilst other members of the business network can only read the bond data.

This business network defines:

**Participants**
`Issuer` `Member`

**Assets**
`BondAsset`

**Transactions**
`PublishBond`

The `PublishBond` transaction submitted by an `Issuer` participant will create a new `BondAsset`.

To test this Business Network Definition in the **Test** tab:

Create a `Issuer` participant:

```
{
  "$class": "org.acme.bond.Issuer",
  "memberId": "memberId:1",
  "name": "Billy Thompson"
}
```

Create a `Member` participant:

```
{
  "$class": "org.acme.bond.Member",
  "memberId": "memberId:1",
  "name": "Jenny Jones"
}
```

Submit a `PublishBond` transaction:

```
{
  "$class": "org.acme.bond.PublishBond",
  "ISINCode": "ISINCode:1234",
  "bond": {
    "$class": "org.acme.bond.Bond",
    "instrumentId": [],
    "exchangeId": [],
    "maturity": "2017-07-13T09:39:05.369Z",
    "parValue": 1000,
    "faceAmount": 1000,
    "paymentFrequency": {
      "$class": "org.acme.bond.PaymentFrequency",
      "periodMultiplier": 0,
      "period": "DAY"
    },
    "dayCountFraction": "",
    "issuer": "resource:org.acme.bond.Issuer#memberId:1"
  }
}
```

The `PublishBond` transaction will create a new `BondAsset` in the Asset Registry.

Congratulations!
