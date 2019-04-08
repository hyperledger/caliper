---
layout: page
title:  "Fabric CCP Configuration"
categories: config
---

> The latest supported version of Hyperledger Fabric is v1.4

This page introduces the new Fabric adapter that utilizes the Common Connection Profile (CCP) feature of the Fabric SDK to provide compatibility and a unified programming model across different Fabric versions. 

The adapter exposes many SDK features directly to the user callback modules, making it possible to implement complex scenarios, like arbitrary load balancing across multiple peers and orderers and easy switching between different client and administrator identities when submitting a request.

> Some highlights of the provided features:
> * supporting multiple orderers
> * automatic load balancing between peers and orderers
> * supporting multiple channels and chaincodes
> * metadata and private collection support for chaincodes
> * support for TLS and mutual TLS communication
> * dynamic registration of users with custom affiliation and attributes
> * option to select the identity for submitting a request
> * transparent support for every version of Fabric since v1.0 (currently up to v1.4)
> * support of PSWG blockchain metrics (e.g., latency @ network threshold)

The page covers the following aspects of using the Fabric CCP adapter:
* how to [install the required dependencies](#installing-the-required-dependencies);
* how to [assemble a connection profile file](#assembling-the-network-configuration-file), a.k.a., the blockchain network configuration file;
* how to [configure some runtime options](#configuring-the-adapter) of the adapter;
* how to [use the adapter interface](#using-the-adapter-interface) from the user callback module;
* [transaction data gathered](#transaction-data-gathered-by-the-adapter) by the adapter;
* and a [complete example](#connection-profile-example) of a connection profile.


## Using Alternative Fabric Versions

If you wish to use a specific Fabric-SDK, it is necessary to modify the `fabric-client`, `fabric-ca-client` and (possibly) `fabric-network` version levels listed as dependancies in `packages/caliper-fabric-ccp/package.json`, , and then rebuild the Caliper project using the following commands issued at the root Caliper project location:

- `npm install`
- `npm run repoclean`
- `npm run bootstrap`
---

# Assembling the Network Configuration File

The YAML network configuration file of the adapter builds upon the CCP of the Fabric SDK while adding some Caliper-specific extensions. The definitive documentation for the base CCP is the [corresponding Fabric SDK documentation page](https://fabric-sdk-node.github.io/master/tutorial-network-config.html). However, this page also includes the description of different configuration elements to make this documentation as self-contained as possible. The Caliper-specific extensions will be noted.

The configuration file consists of the following top-level sections, that together describe the topology of the network (organizations and their nodes), the deployed artifacts (channels and chaincodes), and the different identities interacting with the network (clients, administrators and registrars):

* [Name](#name) of the configuration
* [Version](#version) of the schema
* [Mutual TLS](#mutual-tls) configuration
* [Information](#caliper) about the platform type for Caliper
* [Network information](#network-information) to include in the generated report
* The [certificate authority](#certificate-authorities) (CA) nodes in the network
* The [peer nodes](#peers) in the network
* The [orderer nodes](#orderers) in the network
* The [organizations](#organizations) in the network/consortium
* The [channels](#channels) in the network
* The [clients](#clients) in the network

The following sections detail each part separately. For a complete example, please refer to the [example section](#connection-profile-example) or one of the example files in the `network/fabric-v1.*` directories starting with `fabric-cpp-*`.

## Name

The configuration file can be given an arbitrary name by setting the top-level `name` attribute:

```yaml
name: Fabric
```

## Version

The top-level `version` attribute specifies the YAML schema version that the SDK will use to apply the parsing rules. The only supported version as of now is `1.0`:

```yaml
version: "1.0"
```

## Mutual TLS

_Caliper-specific._

The top-level `mutual-tls` attribute indicates whether to use client-side TLS in addition to server-side TLS. Note, that mutual TLS must be [configured](https://hyperledger-fabric.readthedocs.io/en/latest/enable_tls.html) also on the network side.

```yaml
mutual-tls: true
```

## Caliper

_Caliper-specific._ 

The top-level `caliper` attribute specifies the type of the blockchain platform, so Caliper can instantiate the appropriate adapter when it starts. To use this adapter, specify the `fabric-ccp` value for the `blockchain` attribute. 

Furthermore, it also contains two optional commands: a `start` command to execute once before the tests and an `end` command to execute once after the tests. Using these commands is an easy way, for example, to automatically start and stop a test network. When connecting to an already deployed network, you can omit these commands.

```yaml
caliper:
  blockchain: fabric-ccp
  command:
    start: docker-compose -f network/fabric-v1.0/2org1peercouchdb/docker-compose-tls.yaml up -d;sleep 3s
    end: docker-compose -f network/fabric-v1.0/2org1peercouchdb/docker-compose-tls.yaml down;docker rm $(docker ps -aq);docker rmi $(docker images dev* -q)
```

## Network Information

The top-level `info` attribute specifies custom key-value pairs that will be included as-is in the generated report. For example:

```yaml
info:
  Version: 1.1.0
  Size: 2 Orgs with 2 Peers
  Orderer: Solo
  Distribution: Single Host
  StateDB: CouchDB
```

## Certificate Authorities

The adapter supports the Fabric-CA integration to manage users dynamically at startup. Other CA implementations are currently not supported. If you don't need to register or enroll users using Caliper, you can omit this section.

The top-level `certificateAuthorities` section contains one or more CA names as keys (matching the `ca.name` or `FABRIC_CA_SERVER_CA_NAME` setting of the CA), and each key has a corresponding object (sub-keys) that describes the properties of that CA. The names will be used in other sections to reference a CA.

```yaml
certificateAuthorities:
  ca.org1.example.com:
    # properties of CA
  ca.org2.example.com:
    # properties of CA
``` 

A CA can have the following properties:
* `url`: the endpoint of the CA, like `http://localhost:7054`
* `httpOptions`: the properties specified under this object are passed to the `http` client verbatim when sending the request to the Fabric-CA server. For example:

  ```yaml
  httpOptions:
    verify: false
  ```
  
* `tlsCACerts`: contains either the path to the TLS certificate of the CA or directly the PEM content of the certificate. Only necessary for TLS, in which case the protocol in `url` must be `https`. For example (the preferred way):

  ```yaml
  tlsCACerts:
    path: network/config/crypto-config/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem
  ```
  
  or
  
  ```yaml
  tlsCACerts:
    pem: |
      -----BEGIN CERTIFICATE-----
      MIICSDCCAe+gAwIBAgIQfpGy5OOXBYpKZxg89x75hDAKBggqhkjOPQQDAjB2MQsw
      CQYDVQQGEwJVUzETMBEGA1UECBMKQ2FsaWZvcm5pYTEWMBQGA1UEBxMNU2FuIEZy
      YW5jaXNjbzEZMBcGA1UEChMQb3JnMS5leGFtcGxlLmNvbTEfMB0GA1UEAxMWdGxz
      Y2Eub3JnMS5leGFtcGxlLmNvbTAeFw0xODA5MjExNzU3NTVaFw0yODA5MTgxNzU3
      NTVaMHYxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpDYWxpZm9ybmlhMRYwFAYDVQQH
      Ew1TYW4gRnJhbmNpc2NvMRkwFwYDVQQKExBvcmcxLmV4YW1wbGUuY29tMR8wHQYD
      VQQDExZ0bHNjYS5vcmcxLmV4YW1wbGUuY29tMFkwEwYHKoZIzj0CAQYIKoZIzj0D
      AQcDQgAED4FM1+iq04cjveIDyn4uj90lJlO6rASeOIzm/Oc2KQOjpRRlB3H+mVnp
      rXN6FacjOp0/6OKeEiW392dcdCMvRqNfMF0wDgYDVR0PAQH/BAQDAgGmMA8GA1Ud
      JQQIMAYGBFUdJQAwDwYDVR0TAQH/BAUwAwEB/zApBgNVHQ4EIgQgPQRWjQR5EUJ7
      xkV+zbfY618IzOYGIpfLaV8hdlZfWVIwCgYIKoZIzj0EAwIDRwAwRAIgYzk8553v
      fWAOZLxiDuMN9RiHve1o5aAQad+uD+eLpxMCIBmv8CtXf1C60h/0zyG1D6tTTnrB
      H8Zua3x+ZQn/kqVv
      -----END CERTIFICATE-----
  ```
  
* `registrar`: a collection of registrar IDs and secrets. Fabric-CA supports dynamic user enrollment via REST APIs. A "root" user, i.e., a registrar is needed to register and enroll new users. Note, that currently __only one registrar per CA__ is supported (regardless of the YAML list notation).
  
  ```yaml
  registrar:
  - enrollId: admin
    enrollSecret: adminpw
  ```

## Peers

The top-level `peers` section contains one or more, arbitrary but unique peer names as keys, and each key has a corresponding object (sub-keys) that describes the properties of that peer. The names will be used in other sections to reference a peer.

```yaml
peers:
  peer0.org1.example.com:
    # properties of peer
  peer0.org2.example.com:
    # properties of peer
``` 

A peer can have the following properties:
* `url`: the endpoint of the peer to send the requests to. For example, `grpc://localhost:7051`.
* `eventUrl`: _Caliper-specific._ The endpoint of the event service __for Fabric v1.0__ networks. __DO NOT__ provide this attribute for newer versions of Fabric, as from v1.1 the event service is a channel-level service and not a peer-level one.
* `grpcOptions`: the properties specified under this object set the gRPC settings used on connections to the Hyperledger Fabric network. For example:

  ```yaml
  grpcOptions:
    ssl-target-name-override: peer0.org1.example.com
    grpc.keepalive_time_ms: 600000
  ```
  
  See the available options in the [gRPC settings tutorial](https://fabric-sdk-node.github.io/master/tutorial-grpc-settings.html) of the Fabric SDK.
* `tlsCACerts`: contains either the path to the TLS certificate of the peer or directly the PEM content of the certificate. Only necessary for TLS, in which case the protocol in `url` must be `grpcs`.

## Orderers

The top-level `orderers` section contains one or more, arbitrary but unique orderer names as keys, and each key has a corresponding object (sub-keys) that describes the properties of the orderer. The names will be used in other sections to reference an orderer.

```yaml
orderers:
  orderer.org1.example.com:
    # properties of orderer
  orderer.org2.example.com:
    # properties of orderer
``` 

An orderer can have the following properties:
* `url`: the endpoint of the orderer to send requests to. For example, `grpc://localhost:7050`.
* `grpcOptions`: the properties specified under this object set the gRPC settings used on connections to the Hyperledger Fabric network. For example:

  ```yaml
  grpcOptions:
    ssl-target-name-override: orderer.org1.example.com
    grpc.keepalive_time_ms: 600000
  ```
  
  See the available options in the [gRPC settings tutorial](https://fabric-sdk-node.github.io/master/tutorial-grpc-settings.html) of the Fabric SDK.
* `tlsCACerts`: contains either the path to the TLS certificate of the orderer or directly the PEM content of the certificate. Only necessary for TLS, in which case the protocol in `url` must be `grpcs`.

## Organizations

The top-level `organizations` section contains one or more, arbitrary but unique organization names as keys, and each key has a corresponding object (sub-keys) that describes the properties of the organization. The names will be used in other sections to reference an organization.

Note, that unlike traditional Fabric clients, Caliper needs crypto materials for multiple organizations to manage the network artifacts, like creating channels. 

```yaml
organizations:
  Org1:
    # properties of the organization
  Org2:
    # properties of the organization
``` 

An organization can have the following properties:
* `mspid`: the MSP ID of the organization. For example:

  ```yaml
  mspid: Org1MSP
  ```
  
* `peers`: the list of peer names (from the top-level `peers` section) that are managed by the organization. For example:
  
  ```yaml
  peers:
  - peer0.org1.example.com
  - peer1.org1.example.com
  ```

* `certificateAuthorities`: the list of Fabric CAs (from the top-level `certificateAuthorities` section) belonging to the organization. Note, that currently __only one CA__ is supported. For example: 
  
  ```yaml
  certificateAuthorities:
  - ca.org1.example.com
    ```
* `adminPrivateKey`: the path to the private key of the organization's admin identity, or directly the PEM content of the key.
* `signedCert`: the path to the certificate of the organization's admin identity, or directly the PEM content of the certificate.

## Channels

The top-level `channels` section contains one or more unique channel names as keys, and each key has a corresponding object (sub-keys) that describes the properties of the channel.

```yaml
channels:
  mychannel:
    # properties of the channel
  yourchannel:
    # properties of the channel
``` 

A channel can have the following properties:
* `orderers`: a list of orderer node names (from the top-level `orderers` section) that participate in the channel.
* `peers`: contains peer node names (from the top-level `peers` section) as keys. Every key has the following optional properties that determine the roles of the peer, so the SDK can choose targets automatically if not provided.
  * `endorsingPeer`: indicates whether the peer is capable of endorsing transactions, i.e., has the necessary chaincodes installed. Defaults to `true`.
  * `chaincodeQuery`: indicates whether the peer is capable of executing chaincode queries, i.e., it has the necessary chaincodes installed. Defaults to `true`.
  * `ledgerQuery`: indicates whether the peer is capable of executing ledger-related queries. Defaults to `true`.
  * `eventSource`: indicates whether the SDK should use the peer as an event source. Defaults to `true`.
  
  ```yaml
  peers:
    peer0.org1.example.com:
      endorsingPeer: true
      chaincodeQuery: true
      ledgerQuery: true
      eventSource: true
    peer0.org2.example.com:
    peer0.org3.example.com:
  ```

* `created`: _Caliper-specific._ Indicates whether the channel already exists or not. If `true`, then the adapter will not try to create the channel again (which would fail). Defaults to `false`.
* `configBinary`: _Caliper-specific._ If a channel doesn't exist yet, the adapter will create it based on the provided path of a channel configuration binary (which is typically the output of the [configtxgen](https://hyperledger-fabric.readthedocs.io/en/latest/commands/configtxgen.html) tool). If set, this property takes precedence over the `configtxlatorPath` and `configUpdateObject` properties (see below).
* `configUpdateObject`: _Caliper-specific._ Another way to specify a channel configuration is to embed it into the network configuration in its decoded form. To see how a decoded channel configuration looks like, you can inspect/decode a binary configuration with the following command (the [configtxlator](https://hyperledger-fabric.readthedocs.io/en/latest/commands/configtxlator.html) tool is required):

  `configtxlator proto_decode --type=common.ConfigUpdate --input=mychannel.tx --output=out.json`
  
  The top level of such a configuration object looks like the following (due to the deep hierarchy, using JSON syntax is recommended):
  
  ```yaml
  configUpdateObject:
    {
      "channel_id": "mychannel",
      "read_set": {...},
      "write_set": {...},
      "type": 0
    }
  ```
  
  If the `configUpdateObject` property is specified (and the `configBinary` property is omitted), then the following `configtxlatorPath` property must also be specified.
* `configtxlatorPath`: the path of the [configtxlator](https://hyperledger-fabric.readthedocs.io/en/latest/commands/configtxlator.html) tool used to encode the channel configuration object.

* `chaincodes`: _Caliper-specific._ List of items that each describes an instantiated chaincode on the channel.
  
  ```yaml
  chaincodes:
  - # chaincodeA properties
  - # chaincodeB properties
  ```
  
  A chaincode can have the following properties:
  * `id`: the ID/name of the chaincode.
  * `version`: the version string of the chaincode.
  * `contractID`: the unique ID (across the configuration file) of the chaincode for easy reference from user test modules. If omitted, the `id` attribute will be used.
  * `language`: the type/language of the chaincode (`golang`, `node` or `java`).
  * `path`: The path to the chaincode directory. For golang chaincode, it is the fully qualified package name (relative to the `GOPATH/src` directory).
  * `metadataPath`: The relative or absolute path for additional metadata for the chaincode (like CouchDB indexes). Only supported since Fabric v1.1.
  * `init`: list of string arguments to pass to the `Init` function when instantiating a chaincode.
  * `function`: the function name to pass to the `Init` function when instantiating a chaincode.
  * `initTransientMap`: the transient key-value map to pass to the `Init` function when instantiating a chaincode. The adapter encodes the values as byte arrays before sending them:
    ```yaml
    initTransientMap:
      pemContent: |
        -----BEGIN PRIVATE KEY-----
        MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgQDk37WuVcnQUjE3U
        NTW7PpPfcp54q/KBKNrtFXjAtUChRANCAAQ0xnSUxoocDsb2YIrmtFIKZ4XAiwqu
        V0BCfsl+ByVKUUdXypNrluQfm28AxX7sEDQLKtHVmuMi/BGaKahZ6Snk
        -----END PRIVATE KEY-----
      stringArg: this is also passed as a byte array
    ```
  * `collections-config`: list of private collection definitions for the chaincode or a path to the JSON file containing the definitions. For details about the content of such definitions, refer to the [SDK page](https://fabric-sdk-node.github.io/release-1.4/tutorial-private-data.html).
  
    ```yaml
    collections-config:
    - name: twoOrgCollection
      policy: OR('Org1MSP.member', 'Org2MSP.member')
      requiredPeerCount: 1
      maxPeerCount: 1
      blockToLive: 0
    ```
  
  * `endorsement-policy`: the endorsement policy of the chaincode as required by the Fabric Node.js SDK. If omitted, then a default N-of-N policy is used based on the target peers (thus organizations) of the chaincode.
  
    ```yaml
    endorsement-policy:
      identities:
      - role:
          name: member
          mspId: Org1MSP
      - role:
          name: member
          mspId: Org2MSP
      policy:
        2-of:
        - signed-by: 0
        - signed-by: 1
    ```
    
  * `targetPeers`: specifies custom target peers (from the top-level `peers` section) for chaincode installation/instantiation. Overrides the peer role-based channel-level targets.
    
    ```yaml
    targetPeers:
    - peer0.org1.example.com
    - peer1.org1.example.com
    - peer0.org2.example.com
    - peer1.org2.example.com
    ```

## Clients

_Caliper-specific._

The top-level `clients` section contains one or more arbitrary, but unique client names as keys, and each key has a corresponding object (sub-keys) that describes the properties of that client. These client names can be referenced from the user callback modules when submitting a transaction to set the identity of the invoker.

```yaml
clients:
  client0.org1.example.com:
    # properties of the client
  client0.org2.example.com:
    # properties of the client
```

For every client name, there is a single property, called `client` ( to match the expected format of the SDK), which will contain the actual properties of the client. So the `clients` section will look like the following:

```yaml
clients:
  client0.org1.example.com:
    client:
      # properties of the client
  client0.org2.example.com:
    client:
      # properties of the client
```

A client can have the following properties (some of it originating from the SDK's CCP):
* `organization`: the name of the organization (from the top-level `organizations` section) of the client.
* `credentialStore`: the implementation-specific properties of the key-value store. A `FileKeyValueStore`, for example, has the following properties:
  * `path`: the absolute path of the directory where the SDK should store the credentials.
  * `cryptoStore`: the implementation-specific properties of the underlying crypto key store. A software-based implementation, for example, requires a store path:
    * `path`: the absolute path of the crypto key store directory.
* `affiliation`: _Caliper-specific._ If you dynamically register a user through a Fabric-CA, you can provide an affiliation string. The adapter will create the necessary affiliation hierarchy, but you must provide a registrar for the CA that is capable of registering the given affiliation (hierarchy).
* `attributes`: _Caliper-specific._ If you dynamically register a user through a Fabric-CA, you can provide a collection of key-value attributes to assign to the user. Each attribute has the following properties:
  * `name`: the key used to reference the attribute.
  * `value`: the string value of the attribute.
  * `ecert`: _Optional._ A value of `true` indicates that this attribute should be included in an enrollment certificate by default.
  
  ```yaml
  attributes:
  - name: departmentId
    value: department6
    ecert: true
  - name: accessLevel
    value: top
    ecert: false
  ```
  
* `enrollmentSecret`: _Caliper-specific._ For registered (but not enrolled) users you can provide the enrollment secret, and the adapter will enroll the user and retrieve the necessary crypto materials. However, this is a rare (transient) scenario. 
* `clientPrivateKey`: _Caliper-specific._ Specifies the path or pem content of the private key to use for enrolled users (through the `path` and `pem` sub-properties, respectively).
* `clientSignedCert`: _Caliper-specific._ Specifies the path or pem content of the certificate to use for enrolled users (through the `path` and `pem` sub-properties, respectively).

> For a completely assembled configuration, see the [example section](#connection-profile-example).

---

# Configuring the Adapter

Some runtime properties of the adapter can be configured through the `fabricCcp` section of the `config/default.yaml` configuration file:

```yaml
fabricCcp:
  sleepAfter:
    createChannel: 5000
    joinChannel: 3000
    instantiateChaincode: 5000
  verify:
    proposalResponse: false
    readWriteSets: true
  timeout:
    chaincodeInstantiate: 300000
    chaincodeInstantiateEvent: 100000
    invokeOrQuery: 60000
  loadBalancing: client
  overwriteGopath: true
  latencyThreshold: 1.0
  countQueryAsLoad: true
``` 

* The `sleepAfter` section contains the durations in milliseconds the adapter should sleep after an operation:
  * `createChannel`: the duration in milliseconds to sleep after creating the channels.
  * `joinChannel`: the duration in milliseconds to sleep after the peers join the channels. 
  * `instantiateChaincode`: the duration in milliseconds to sleep after instantiating the chaincodes.

* The `verify` section contains switches that turn on/off some verification-related part of the transaction life-cycle:
  * `proposalResponse`:  indicates whether to verify the identity of the endorsers and their signatures for each proposal response after endorsing a transaction. Note, that this is a CPU intensive step, use it with caution.
  * `readWriteSets`: indicates whether to verify that the read-write sets returned by the endorsers match.

* The `timeout` section contains timeouts related to the initialization part of the adapter. Note, that these are client-side timeouts. Make sure that you also properly configured the corresponding peer-side timeouts:
  * `chaincodeInstantiate`: timeout in milliseconds for the endorsement part of a chaincode instantiation (i.e., executing the chaincode's `Init` function and receiving the result).
  * `chaincodeInstantiateEvent`: timeout in milliseconds for receiving the event about the result of a chaincode instantiation (i.e., the final/committing part of the instantiation).
  * `invokeOrQuery`: the default timeout in milliseconds to use for invoking or querying transactions (applied for the entire life-cycle).

* The `loadBalancing` value determines how automatic load balancing is applied if the client callback module doesn't provide explicit targets:
  * use the value `client` to perform client-based load balancing, meaning that each client process (that generates the actual workload) will have fix target peers and target orderer. 
  * use the value `tx` to perform transaction-based load balancing, meaning that the peer and orderer targets change for every submitted transaction or query.

* The `overwriteGopath` value indicates whether to temporarily set the `GOPATH` environment variable to the Caliper root directory. The example networks and chaincodes assume that this property is `true`. If you want to deploy chaincodes from a custom location, set it to `false` and make sure `GOPATH` is [configured properly](https://github.com/golang/go/wiki/GOPATH).

* The `latencyThreshold` value determines the reported commit time of a transaction. The _Blockchain Performance Metrics_ [whitepaper](https://www.hyperledger.org/resources/publications/blockchain-performance-metrics) by the _Performance and Scale Working Group_ defines the transaction latency metric (on page 9) with respect to a network threshold. For example, the latency of a transaction at a network threshold of 90% is the time it takes to commit the transaction at 90% of the nodes in the network. 

  The `latencyThreshold` value corresponds to this percentage (0 meaning 0% and 1 meaning 100%). Note, that the latencies are based on the times the commit events arrive from the peers. So only the peers marked as event sources in the [channels](#channels) configuration section contribute to the latency. If you would like an accurate latency value, mark every peer in the channel as an event source and set `latencyThreshold` to 1. 

* The `countQueryAsLoad` value indicates whether to count queries as workload, i.e., whether the generated report should include them. Note, that the [per-query options](#querying-a-chaincode) take precedence if provided.

---

# Using the Adapter Interface

The [user callback modules]({{ site.baseurl }}{% link docs/2_Architecture.md %}#user-defined-test-module) interact with the adapter at two phases of the tests: during the initialization of the user module (the `init` callback), and when submitting invoke or query transactions (the `run` callback).

## The _init_ Callback

The first argument of the `init` callback is a `blockchain` object. We will discuss it in the next section for the `run` callback.

The second argument of the `init` callback is a `context`, which is a platform-specific object provided by the backend blockchain's adapter. The context object provided by this adapter is the following:

```mson
{
  networkInfo: FabricNetwork
}
```

The `networkInfo` property is a `FabricNetwork` instance that provides simple string-based "queries" and results about the network topology, so the callback doesn't have to rely on the structure of the network configuration file. For the details of the API, refer to the `src/adapters/fabric-ccp/fabricNetwork.js` file.


## The _run_ Callback

The `blockchain` object received (and saved) in the `init` callback is of type `src/comm/Blockchain.js`, and it wraps the adapter object. The `blockchain.bcType` property has the `fabric-ccp` string value.

> __Due to the diverging adapter interfaces for queries, you need to access the underlying adapter object to use this adapter's query feature. The adapter object is accessible through the `blockchain.bcObj` property, which is of type `src/adapters/fabric-ccp/fabric.js`.__

The two main functions of the adapter are `invokeSmartContract` and `querySmartContract`, sharing a similar API.

### Invoking a chaincode

To submit a transaction, call the `blockchain.invokeSmartContract` function. It takes five parameters: the previously saved `context` object, the `contractID` of the chaincode, an unused chaincode version, an `invokeSettings` object and a `timeout` value in seconds.

The `invokeSettings` object has the following structure:
* `chaincodeFunction`: _string. Required._ The name of the function to call in the chaincode.
* `chaincodeArguments`: _string[]. Optional._ The list of string arguments to pass to the chaincode.
* `transientMap`: _Map<string, byte[]>. Optional._ The transient map to pass to the chaincode.
* `invokerIdentity`: _string. Optional._ The name of the user who should invoke the chaincode. If an admin is needed, use the organization name prefixed with a `#` symbol (e.g., `#Org2`). Defaults to the first client in the network configuration file.
* `targetPeers`: _string[]. Optional._ An array of endorsing peer names as the targets of the transaction proposal. If omitted, the target list will include endorsing peers selected according to the specified load balancing method. 
* `orderer`: _string. Optional._ The name of the target orderer for the transaction broadcast. If omitted, then an orderer node of the channel will be used, according to the specified load balancing method.

So invoking a chaincode looks like the following (with automatic load balancing between endorsing peers and orderers):

```js
let settings = {
    chaincodeFunction: 'initMarble',
    chaincodeArguments: ['MARBLE#1', 'Red', '100', 'Attila'],
    invokerIdentity: 'client0.org2.example.com'
};

return blockchain.invokeSmartContract(context, 'marbles', '', settings, 60);
```

`invokeSmartContract` also accepts an array of `invokeSettings` as the second arguments. However, Fabric doesn't support submitting an atomic batch of transactions, so there is no guarantee that the order of these transactions will remain the same, or whether they will reside in the same block. 

Using "batches" also increases the expected workload of the system, since the rate controller mechanism of Caliper cannot account for these "extra" transactions. However, the resulting report will accurately reflect the additional load.

### Querying a chaincode

To query the world state, call the `blockchain.bcObj.querySmartContract` function. It takes five parameters: the previously saved `context` object, the `contractID` of the chaincode, an unused chaincode version, a `querySettings` object and a `timeout` value in seconds.

The `querySettings` object has the following structure:
* `chaincodeFunction`: _string. Required._ The name of the function to call in the chaincode.
* `chaincodeArguments`: _string[]. Optional._ The list of string arguments passed to the chaincode.
* `transientMap`: _Map<string, byte[]>. Optional._ The transient map passed to the chaincode.
* `invokerIdentity`: _string. Optional._ The name of the user who should invoke the chaincode. If an admin is needed, use the organization name prefixed with a `#` symbol (e.g., `#Org2`). Defaults to the first client in the network configuration file.
* `targetPeers`: _string[]. Optional._ An array of endorsing peer names as the targets of the query. If omitted, the target list will include endorsing peers selected according to the specified load balancing method. 
* `countAsLoad`: _boolean. Optional._ Indicates whether the query should be counted as workload and reflected in the generated report. If specified, overrides the adapter-level `countQueryAsLoad` setting.
  
  > Not counting a query in the workload is useful when occasionally retrieving information from the ledger to use as a parameter in a transaction (might skew the latency results). However, count the queries into the workload if the test round specifically targets the query execution capabilities of the chaincode. 

So querying a chaincode looks like the following (with automatic load balancing between endorsing peers):

```js
let settings = {
    chaincodeFunction: 'readMarble',
    chaincodeArguments: ['MARBLE#1'],
    invokerIdentity: 'client0.org2.example.com'
};

return blockchain.bcObj.querySmartContract(context, 'marbles', '', settings, 60);
```

`querySmartContract` also accepts an array of `querySettings` as the second arguments. However, Fabric doesn't support submitting an atomic batch of queries, so there is no guarantee that their order will remain the same. 

Using "batches" also increases the expected workload of the system, since the rate controller mechanism of Caliper cannot account for these extra queries. However, the resulting report will accurately reflect the additional load.

---

# Transaction Data Gathered by the Adapter

The previously discussed  `invokeSmartContract` and `querySmartContract` functions return an array whose elements correspond to the result of the submitted request(s) with the type of [TxStatus](https://github.com/hyperledger/caliper/blob/master/src/comm/transaction.js). The class provides some standard and platform-specific information about its corresponding transaction.

The standard information provided by the type are the following:
* `GetID():string` returns the transaction ID.
* `GetStatus():string` returns the final status of the transaction, either `success` or `failed`.
* `GetTimeCreate():number` returns the epoch when the transaction was submitted.
* `GetTimeFinal():number` return the epoch when the transaction was finished.
* `IsVerified():boolean` indicates whether we are sure about the final status of the transaction. Unverified (considered failed) transactions could occur, for example, if the adapter loses the connection with every Fabric event service, missing the final status of the transaction.
* `GetResult():Buffer` returns one of the endorsement results returned by the chaincode as a `Buffer`. It is the responsibility of the user to decode it accordingly to the chaincode-side encoding.

The adapter also gathers the following platform-specific data (if observed) about each transaction. The placeholders `<PEER_NAME>` and `<ORDERER_NAME>` are node names taking their values from the top-level [peers](#peers) and [orderers](#orderers) sections from the network configuration file (e.g., `endorsement_result_peer0.org1.example.com`). The `Get(key:string):any` function returns the value of the observation corresponding to the given key. Alternatively, the `GetCustomData():Map<string,any>` returns the entire collection of gathered data as a `Map`.

* `request_type`: _string_. Either the `transaction` or `query` string value for traditional transactions or queries, respectively.
* `time_endorse`: _number_. The Unix epoch when the adapter received the proposal responses from the endorsers. Saved even in the case of endorsement errors.
* `proposal_error`: _string_. The error message in case an error occurred during sending/waiting for the proposal responses from the endorsers.
* `proposal_response_error_<PEER_NAME>`: _string_. The error message in case the endorser peer `<PEER_NAME>` returned an error as endorsement result.
* `endorsement_result_<PEER_NAME>`: _Buffer_. The encoded chaincode invocation result returned by the endorser peer `<PEER_NAME>`. It is the client's responsibility to decode the result.
* `endorsement_verify_error_<PEER_NAME>`: _string_. Has the value of `'INVALID'` if the signature and identity of the endorser peer `<PEER_NAME>` couldn't be verified. This verification step can be switched on/off through the [runtime configuration options](#configuring-the-adapter).
* `endorsement_result_error<PEER_NAME>`: _string_. If the transaction proposal or query execution at the endorser peer `<PEER_NAME>` results in an error, this field contains the error message.
* `read_write_set_error`: _string_. Has the value of `'MISMATCH'` if the sent transaction proposals resulted in different read/write sets.
* `time_orderer_ack`: _number_. The Unix epoch when the adapter received the confirmation from the orderer that it successfully received the transaction. Note, that this isn't the actual ordering time of the transaction.
* `broadcast_error_<ORDERER_NAME>`: _string_. The warning message in case the adapter did not receive a successful confirmation from the orderer node `<ORDERER_NAME>`. Note, that this does not mean, that the transaction failed (e.g., a timeout occurred while waiting for the answer due to some transient network delay/error).
* `broadcast_response_error_<ORDERER_NAME>`: _string_. The error message in case the adapter received an explicit unsuccessful response from the orderer node `<ORDERER_NAME>`.
* `unexpected_error`: _string_. The error message in case some unexpected error occurred during the life-cycle of a transaction.
* `commit_timeout_<PEER_NAME>`: _string_. Has the value of `'TIMEOUT'` in case the event notification about the transaction did not arrive in time from the peer node `<PEER_NAME>`.
* `commit_error_<PEER_NAME>`: _string_. Contains the error code in case the transaction validation fails at the end of its life-cycle on peer node `<PEER_NAME>`.
* `commit_success_<PEER_NAME>`: _number_. The Unix epoch when the adapter received a successful commit event from the peer node `<PEER_NAME>`. Note, that transactions committed in the same block have nearly identical commit times, since the SDK receives them block-wise, i.e., at the same time.
* `event_hub_error_<PEER_NAME>`: _string_. The error message in case some event hub connection-related error occurs with peer node `<PEER_NAME>`.

---

# Connection Profile Example

The following example is a Fabric v1.1 network configuration for the following network topology and artifacts:
* two organizations;
* each organization has two peers and a CA;
* the first organization has one user/client, the second has two (and the second user is dynamically registered and enrolled);
* one orderer;
* one channel named `mychannel` that is created by Caliper;
* `marbles@v0` chaincode installed and instantiated in `mychannel` on every peer;
* the nodes of the network use TLS communication, but not mutual TLS;
* the local network is deployed and cleaned up automatically by Caliper.


```yaml
name: Fabric
version: "1.0"

mutual-tls: false

caliper:
  blockchain: fabric-ccp
  command:
    start: docker-compose -f network/fabric-v1.1/2org2peergoleveldb/docker-compose-tls.yaml up -d;sleep 3s
    end: docker-compose -f network/fabric-v1.1/2org2peergoleveldb/docker-compose-tls.yaml down;docker rm $(docker ps -aq);docker rmi $(docker images dev* -q)

info:
  Version: 1.1.0
  Size: 2 Orgs with 2 Peers
  Orderer: Solo
  Distribution: Single Host
  StateDB: GoLevelDB

clients:
  client0.org1.example.com:
    client:
      organization: Org1
      credentialStore:
        path: "/tmp/hfc-kvs/org1"
        cryptoStore:
          path: "/tmp/hfc-cvs/org1"
      clientPrivateKey:
        path: network/fabric-v1.1/config/crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/keystore/key.pem
      clientSignedCert:
        path: network/fabric-v1.1/config/crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/signcerts/User1@org1.example.com-cert.pem
  client0.org2.example.com:
    client:
      organization: Org2
      credentialStore:
        path: "/tmp/hfc-kvs/org2"
        cryptoStore:
          path: "/tmp/hfc-cvs/org2"
      clientPrivateKey:
        path: network/fabric-v1.1/config/crypto-config/peerOrganizations/org2.example.com/users/User1@org2.example.com/msp/keystore/key.pem
      clientSignedCert:
        path: network/fabric-v1.1/config/crypto-config/peerOrganizations/org2.example.com/users/User1@org2.example.com/msp/signcerts/User1@org2.example.com-cert.pem
  client1.org2.example.com:
    client:
      organization: Org2
      affiliation: org2.department1
      role: client
      credentialStore:
        path: "/tmp/hfc-kvs/org2"
        cryptoStore:
          path: "/tmp/hfc-cvs/org2"

channels:
  mychannel:
    configBinary: network/fabric-v1.1/config/mychannel.tx
    created: false
    orderers:
    - orderer.example.com
    peers:
      peer0.org1.example.com:
        endorsingPeer: true
        chaincodeQuery: true
        ledgerQuery: true
        eventSource: true
      peer1.org1.example.com:
        endorsingPeer: true
        chaincodeQuery: true
        ledgerQuery: true
        eventSource: true
      peer0.org2.example.com:
        endorsingPeer: true
        chaincodeQuery: true
        ledgerQuery: true
        eventSource: true
      peer1.org2.example.com:
        endorsingPeer: true
        chaincodeQuery: true
        ledgerQuery: true
        eventSource: true

    chaincodes:
    - id: marbles
      version: v0
      targetPeers:
      - peer0.org1.example.com
      - peer1.org1.example.com
      - peer0.org2.example.com
      - peer1.org2.example.com
      language: node
      path: src/marbles/node
      metadataPath: src/marbles/node/metadata
      init: []
      function: init
      
      initTransientMap:
        pemContent: |
          -----BEGIN PRIVATE KEY-----
          MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgQDk37WuVcnQUjE3U
          NTW7PpPfcp54q/KBKNrtFXjAtUChRANCAAQ0xnSUxoocDsb2YIrmtFIKZ4XAiwqu
          V0BCfsl+ByVKUUdXypNrluQfm28AxX7sEDQLKtHVmuMi/BGaKahZ6Snk
          -----END PRIVATE KEY-----
        stringArg: this is also passed as a byte array
        
      endorsement-policy:
        identities:
        - role:
            name: member
            mspId: Org1MSP
        - role:
            name: member
            mspId: Org2MSP
        policy:
          2-of:
          - signed-by: 0
          - signed-by: 1

organizations:
  Org1:
    mspid: Org1MSP
    peers:
    - peer0.org1.example.com
    - peer1.org1.example.com
    certificateAuthorities:
    - ca.org1.example.com
    adminPrivateKey:
      path: network/fabric-v1.1/config/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore/key.pem
    signedCert:
      path: network/fabric-v1.1/config/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/Admin@org1.example.com-cert.pem

  Org2:
    mspid: Org2MSP
    peers:
    - peer0.org2.example.com
    - peer1.org2.example.com
    certificateAuthorities:
    - ca.org2.example.com
    adminPrivateKey:
      path: network/fabric-v1.1/config/crypto-config/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp/keystore/key.pem
    signedCert:
      path: network/fabric-v1.1/config/crypto-config/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp/signcerts/Admin@org2.example.com-cert.pem

orderers:
  orderer.example.com:
    url: grpcs://localhost:7050
    grpcOptions:
      ssl-target-name-override: orderer.example.com
      grpc-max-send-message-length: 15
    tlsCACerts:
      path: network/fabric-v1.1/config/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

peers:
  peer0.org1.example.com:
    url: grpcs://localhost:7051
    grpcOptions:
      ssl-target-name-override: peer0.org1.example.com
      grpc.keepalive_time_ms: 600000
    tlsCACerts:
      path: network/fabric-v1.1/config/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/msp/tlscacerts/tlsca.org1.example.com-cert.pem

  peer1.org1.example.com:
    url: grpcs://localhost:7057
    grpcOptions:
      ssl-target-name-override: peer1.org1.example.com
      grpc.keepalive_time_ms: 600000
    tlsCACerts:
      path: network/fabric-v1.1/config/crypto-config/peerOrganizations/org1.example.com/peers/peer1.org1.example.com/msp/tlscacerts/tlsca.org1.example.com-cert.pem

  peer0.org2.example.com:
    url: grpcs://localhost:8051
    grpcOptions:
      ssl-target-name-override: peer0.org2.example.com
      grpc.keepalive_time_ms: 600000
    tlsCACerts:
      path: network/fabric-v1.1/config/crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/msp/tlscacerts/tlsca.org2.example.com-cert.pem

  peer1.org2.example.com:
    url: grpcs://localhost:8057
    grpcOptions:
      ssl-target-name-override: peer1.org2.example.com
      grpc.keepalive_time_ms: 600000
    tlsCACerts:
      path: network/fabric-v1.1/config/crypto-config/peerOrganizations/org2.example.com/peers/peer1.org2.example.com/msp/tlscacerts/tlsca.org2.example.com-cert.pem

certificateAuthorities:
  ca.org1.example.com:
    url: https://localhost:7054
    httpOptions:
      verify: false
    tlsCACerts:
      path: network/fabric-v1.1/config/crypto-config/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem
    registrar:
    - enrollId: admin
      enrollSecret: adminpw

  ca.org2.example.com:
    url: https://localhost:8054
    httpOptions:
      verify: false
    tlsCACerts:
      path: network/fabric-v1.1/config/crypto-config/peerOrganizations/org2.example.com/tlsca/tlsca.org2.example.com-cert.pem
    registrar:
    - enrollId: admin
      enrollSecret: adminpw
```