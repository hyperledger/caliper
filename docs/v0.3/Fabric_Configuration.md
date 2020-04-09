---
layout: v0.3
title:  "Fabric Configuration"
categories: config
permalink: /v0.3/fabric-config/
---

## Table of contents
{:.no_toc}

- TOC
{:toc}

## Overview

This page introduces the Fabric adapter that utilizes the Common Connection Profile (CCP) feature of the Fabric SDK to provide compatibility and a unified programming model across different Fabric versions. 

> The latest supported version of Hyperledger Fabric is v1.4.X

The adapter exposes many SDK features directly to the user callback modules, making it possible to implement complex scenarios.

> Some highlights of the provided features:
> * supporting multiple orderers
> * automatic load balancing between peers and orderers
> * supporting multiple channels and chaincodes
> * metadata and private collection support for chaincodes
> * support for TLS and mutual TLS communication
> * dynamic registration of users with custom affiliations and attributes
> * option to select the identity for submitting a TX/query
> * transparent support for every version of Fabric since v1.0 (currently up to v1.4.X)
> * detailed execution data for every TX

## Installing dependencies

To install the Fabric SDK dependencies of the adapter, configure the binding command as follows:
* Set the `caliper-bind-sut` setting key to `fabric`
* Set the `caliper-bind-sdk` setting key to a [supported SDK binding](./Installing_Caliper.md#the-bind-command).

You can set the above keys either from the command line:
```console
user@ubuntu:~/caliper-benchmarks$ npx caliper bind --caliper-bind-sut fabric --caliper-bind-sdk 1.4.0
```
or from environment variables:
```console
user@ubuntu:~/caliper-benchmarks$ export CALIPER_BIND_SUT=fabric
user@ubuntu:~/caliper-benchmarks$ export CALIPER_BIND_SDK=1.4.0
user@ubuntu:~/caliper-benchmarks$ npx caliper bind
```
or from various [other sources](./Runtime_Configuration.md).

## Runtime settings

### Common settings

Some runtime properties of the adapter can be set through Caliper's [runtime configuration mechanism](./Runtime_Configuration.md). For the available settings, see the `caliper.fabric` section of the [default configuration file](https://github.com/hyperledger/caliper/blob/master/packages/caliper-core/lib/common/config/default.yaml) and its embedded documentation.

The above settings are processed when starting Caliper. Modifying them during testing will have no effect. However, you can override the default values _before Caliper starts_ from the usual configuration sources.

> __Note:__ An object hierarchy in a configuration file generates a setting entry for every leaf property. Consider the following configuration file:
> ```yaml
> caliper:
>   fabric:
>     gateway:
>       usegateway: true
>       discovery: true
> ```
> After naming the [project settings](./Runtime_Configuration.md#project-level) file `caliper.yaml` and placing it in the root of your workspace directory, it will override the following two setting keys with the following values:
> * Setting `caliper-fabric-gateway-usegateway` is set to `true`
> * Setting `caliper-fabric-gateway-discovery` is set to `true`
>
> __The other settings remain unchanged.__

### Skip channel creation

Additionally, the adapter provides a dynamic setting (family) for skipping the creation of a channel. The setting key format is `caliper-fabric-skipcreatechannel-<channel_name>`. Substitute the name of the channel you want to skip creating into `<channel_name>`, for example:

```console
user@ubuntu:~/caliper-benchmarks$ export CALIPER_FABRIC_SKIPCREATECHANNEL_MYCHANNEL=true
```

> __Note:__ This settings is intended for easily skipping the creation of a channel that is specified in the network configuration file as "not created". However, if you know that the channel always will be created during benchmarking, then it is recommended to denote this explicitly in the network configuration file.

Naturally, you can specify the above setting multiple ways (e.g., command line argument, configuration file entry). 

## The adapter API

The [user callback modules](./Architecture.md#user-defined-test-module) interact with the adapter at two phases of the tests: during the initialization of the user module (in the `init` callback), and when submitting invoke or query transactions (in the `run` callback).

### The `init` callback

The first argument of the `init` callback is a `blockchain` object. We will discuss it in the next section for the `run` callback.

The second argument of the `init` callback is a `context`, which is a platform-specific object provided by the backend blockchain's adapter. The context object provided by this adapter exposes the following properties:
* The `context.networkInfo` property is a `FabricNetwork` instance that provides simple string-based "queries" and results about the network topology, so user callbacks can be implemented in a more general way. For the current details/documentation of the API, refer to the [source code](https://github.com/hyperledger/caliper/blob/master/packages/caliper-fabric/lib/fabricNetwork.js).

### The `run` callback

The `blockchain` object received (and saved) in the `init` callback is of type [Blockchain](https://github.com/hyperledger/caliper/blob/master/packages/caliper-core/lib/blockchain.js) and it wraps the adapter instance of type [Fabric](https://github.com/hyperledger/caliper/blob/master/packages/caliper-fabric/lib/fabric.js). The `blockchain.bcType` property has the `fabric` string value.

The two main functions of the adapter are `invokeSmartContract` and `querySmartContract`, sharing a similar API.

#### Invoking a chaincode

To submit a transaction, call the `blockchain.invokeSmartContract` function. It takes five parameters:
1. `context`: the same `context` object saved in the `init` callback.
2. `contractID`: the unique (Caliper-level) ID of the chaincode.
3. `version`: the chaincode version. __Unused.__
4. `invokeSettings`:  an object containing different TX-related settings
5. `timeout`: the timeout value for the transaction __in seconds__.

The `invokeSettings` object has the following structure:
* `chaincodeFunction`: _string. Required._ The name of the function to call in the chaincode.
* `chaincodeArguments`: _string[]. Optional._ The list of __string__ arguments to pass to the chaincode.
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

return blockchain.invokeSmartContract(context, 'marbles', '', settings, 10);
```

`invokeSmartContract` also accepts an array of `invokeSettings` as the second arguments. However, Fabric does not support submitting an atomic batch of transactions like Sawtooth, so there is no guarantee that the order of these transactions will remain the same, or whether they will reside in the same block. 

Using "batches" also increases the expected workload of the system, since the rate controller mechanism of Caliper cannot account for these "extra" transactions. However, the resulting report will accurately reflect the additional load.

#### Querying a chaincode

To query the world state, call the `blockchain.bcObj.querySmartContract` function. It takes five parameters: 
1. `context`: the same `context` object saved in the `init` callback.
2. `contractID`: the unique (Caliper-level) ID of the chaincode.
3. `version`: the chaincode version. __Unused.__
4. `querySettings`:  an object containing different query-related settings
5. `timeout`: the timeout value for the transaction __in seconds__.

The `querySettings` object has the following structure:
* `chaincodeFunction`: _string. Required._ The name of the function to call in the chaincode.
* `chaincodeArguments`: _string[]. Optional._ The list of __string__ arguments passed to the chaincode.
* `transientMap`: _Map<string, byte[]>. Optional._ The transient map passed to the chaincode.
* `invokerIdentity`: _string. Optional._ The name of the user who should invoke the chaincode. If an admin is needed, use the organization name prefixed with a `#` symbol (e.g., `#Org2`). Defaults to the first client in the network configuration file.
* `targetPeers`: _string[]. Optional._ An array of endorsing peer names as the targets of the query. If omitted, the target list will include endorsing peers selected according to the specified load balancing method. 
* `countAsLoad`: _boolean. Optional._ Indicates whether the query should be counted as workload and reflected in the generated report. If specified, overrides the adapter-level `caliper-fabric-countqueryasload` setting.
  
  > Not counting a query in the workload is useful when _occasionally_ retrieving information from the ledger to use as a parameter in a transaction (might skew the latency results). However, count the queries into the workload if the test round specifically targets the query execution capabilities of the chaincode. 

So querying a chaincode looks like the following (with automatic load balancing between endorsing peers):

```js
let settings = {
    chaincodeFunction: 'readMarble',
    chaincodeArguments: ['MARBLE#1'],
    invokerIdentity: 'client0.org2.example.com'
};

return blockchain.querySmartContract(context, 'marbles', '', settings, 3);
```

`querySmartContract` also accepts an array of `querySettings` as the second arguments. However, Fabric does not support submitting an atomic batch of queries, so there is no guarantee that their execution order will remain the same (although it's highly probably, since queries have shorter life-cycles than transactions). 

Using "batches" also increases the expected workload of the system, since the rate controller mechanism of Caliper cannot account for these extra queries. However, the resulting report will accurately reflect the additional load.

## Gathered TX data

The previously discussed  `invokeSmartContract` and `querySmartContract` functions return an array whose elements correspond to the result of the submitted request(s) with the type of [TxStatus](https://github.com/hyperledger/caliper/blob/master/packages/caliper-core/lib/transaction-status.js). The class provides some standard and platform-specific information about its corresponding transaction.

The standard data provided are the following:
* `GetID():string` returns the transaction ID.
* `GetStatus():string` returns the final status of the transaction, either `success` or `failed`.
* `GetTimeCreate():number` returns the epoch when the transaction was submitted.
* `GetTimeFinal():number` return the epoch when the transaction was finished.
* `IsVerified():boolean` indicates whether we are sure about the final status of the transaction. Unverified (considered failed) transactions could occur, for example, if the adapter loses the connection with every Fabric event hub, missing the final status of the transaction.
* `GetResult():Buffer` returns one of the endorsement results returned by the chaincode as a `Buffer`. It is the responsibility of the user callback to decode it accordingly to the chaincode-side encoding.

The adapter also gathers the following platform-specific data (if observed) about each transaction, each exposed through a specific key name. The placeholders `<P>` and `<O>` in the key names are node names taking their values from the top-level [peers](#peers) and [orderers](#orderers) sections from the network configuration file (e.g., `endorsement_result_peer0.org1.example.com`). The `Get(key:string):any` function returns the value of the observation corresponding to the given key. Alternatively, the `GetCustomData():Map<string,any>` returns the entire collection of gathered data as a `Map`.

The adapter-specific data keys are the following:

|            Key name            | Data type | Description                                                                                                                                                                                                                                                                  |
|:------------------------------:|:---------:|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|         `request_type`         |  string   | Either the `transaction` or `query` string value for traditional transactions or queries, respectively.                                                                                                                                                                      |
|         `time_endorse`         |  number   | The Unix epoch when the adapter received the proposal responses from the endorsers. Saved even in the case of endorsement errors.                                                                                                                                            |
|        `proposal_error`        |  string   | The error message in case an error occurred during sending/waiting for the proposal responses from the endorsers.                                                                                                                                                            |
| `proposal_response_error_<P>`  |  string   | The error message in case the endorser peer `<P>` returned an error as endorsement result.                                                                                                                                                                                   |
|    `endorsement_result_<P>`    |  Buffer   | The encoded chaincode invocation result returned by the endorser peer `<P>`. It is the user callback's responsibility to decode the result.                                                                                                                                  |
| `endorsement_verify_error_<P>` |  string   | Has the value of `'INVALID'` if the signature and identity of the endorser peer `<P>` couldn't be verified. This verification step can be switched on/off through the [runtime configuration options](#runtime-settings).                                                    |
| `endorsement_result_error<P>`  |  string   | If the transaction proposal or query execution at the endorser peer `<P>` results in an error, this field contains the error message.                                                                                                                                        |
|     `read_write_set_error`     |  string   | Has the value of `'MISMATCH'` if the sent transaction proposals resulted in different read/write sets.                                                                                                                                                                       |
|       `time_orderer_ack`       |  number   | The Unix epoch when the adapter received the confirmation from the orderer that it successfully received the transaction. Note, that this isn't the actual ordering time of the transaction.                                                                                 |
|     `broadcast_error_<O>`      |  string   | The warning message in case the adapter did not receive a successful confirmation from the orderer node `<O>`. Note, that this does not mean, that the transaction failed (e.g., a timeout occurred while waiting for the answer due to some transient network delay/error). |
| `broadcast_response_error_<O>` |  string   | The error message in case the adapter received an explicit unsuccessful response from the orderer node `<O>`.                                                                                                                                                                |
|       `unexpected_error`       |  string   | The error message in case some unexpected error occurred during the life-cycle of a transaction.                                                                                                                                                                             |
|      `commit_timeout_<P>`      |  string   | Has the value of `'TIMEOUT'` in case the event notification about the transaction did not arrive in time from the peer node `<P>`.                                                                                                                                           |
|       `commit_error_<P>`       |  string   | Contains the error code in case the transaction validation fails at the end of its life-cycle on peer node `<P>`.                                                                                                                                                            |
|      `commit_success_<P>`      |  number   | The Unix epoch when the adapter received a successful commit event from the peer node `<P>`. Note, that transactions committed in the same block have nearly identical commit times, since the SDK receives them block-wise, i.e., at the same time.                         |
|     `event_hub_error_<P>`      |  string   | The error message in case some event hub connection-related error occurs with peer node `<P>`.                                                                                                                                                                               |

You can access these data in your user callback after calling `invokeSmartContract` or `querySmartContract`:

```js
let settings = {
    chaincodeFunction: 'initMarble',
    chaincodeArguments: ['MARBLE#1', 'Red', '100', 'Attila'],
    invokerIdentity: 'client0.org2.example.com'
};

// "results" is of type TxStatus[] 
// DO NOT FORGET "await"!!
let results = await blockchain.invokeSmartContract(context, 'marbles', '', settings, 10);

// do something with the data
for (let result of results) {
    let shortID = result.GetID().substring(8);
    let executionTime = result.GetTimeFinal() - result.GetTimeCreate();
    console.log(`TX [${shortID}] took ${executionTime}ms to execute. Result: ${result.GetStatus()}`);
}

// DO NOT FORGET THIS!!
return results;
```

> __Note:__ Do not forget to return the result array at the end of the `run` function!

## Network configuration file reference

The YAML network configuration file of the adapter builds upon the CCP of the Fabric SDK while adding some Caliper-specific extensions. The definitive documentation for the base CCP is the [corresponding Fabric SDK documentation page](https://fabric-sdk-node.github.io/master/tutorial-network-config.html). However, this page also includes the description of different configuration elements to make this documentation as self-contained as possible.

The following sections detail each part separately. For a complete example, please refer to the [example section](#connection-profile-example) or one of the files in the [Caliper benchmarks](https://github.com/hyperledger/caliper-benchmarks/tree/master/networks/fabric) repository. Look for files in the `fabric-v*` directories that start with `fabric-*`.

> __Note:__ Unknown keys are not allowed anywhere in the configuration. The only exception is the `info` property and when network artifact names serve as keys (peer names, channel names, etc.).


<details><summary markdown="span">__name__
</summary>
_Required. Non-empty string._ <br> 
The name of the configuration file.

```yaml
name: Fabric
```
</details>

<details><summary markdown="span">__version__
</summary>
_Required. Non-empty string._ <br> 
Specifies the YAML schema version that the Fabric SDK will use. Only the `'1.0'` string is allowed.

```yaml
version: '1.0'
```
</details>

<details><summary markdown="span">__mutual-tls__
</summary>
_Optional. Boolean._ <br>
Indicates whether to use client-side TLS in addition to server-side TLS. Cannot be set to `true` without using server-side TLS. Defaults to `false`.

```yaml
mutual-tls: true
```
</details>

<details><summary markdown="span">__caliper__
</summary>
_Required. Non-empty object._ <br>
Contains runtime information for Caliper. Can contain the following keys.

*  <details><summary markdown="span">__blockchain__
   </summary>
   _Required. Non-empty string._ <br>
   Only the `"fabric"` string is allowed for this adapter.
   
   ```yaml
   caliper:
     blockchain: fabric
   ```
   </details>
   
*  <details><summary markdown="span">__command__
   </summary>
   _Optional. Non-empty object._ <br>
   Specifies the start and end scripts. <br>
   > Must contain __at least one__ of the following keys.
   
   *  <details><summary markdown="span">__start__
      </summary>
      _Optional. Non-empty string._ <br>
      Contains the command to execute at startup time. The current working directory for the commands is set to the workspace.
      
      ```yaml
      caliper:
        command:
          start: my-startup-script.sh
      ```
      </details>
      
   *  <details><summary markdown="span">__end__
      </summary>
      _Optional. Non-empty string._ <br>
      Contains the command to execute at exit time. The current working directory for the commands is set to the workspace.
      
      ```yaml
      caliper:
        command:
          end: my-cleanup-script.sh
      ```
      </details>
   </details>
</details>

<details><summary markdown="span">__info__
</summary>
_Optional. Object._ <br>
 Specifies custom key-value pairs that will be included as-is in the generated report. The key-value pairs have no influence on the runtime behavior.

```yaml
info:
  Version: 1.1.0
  Size: 2 Orgs with 2 Peers
  Orderer: Solo
  Distribution: Single Host
  StateDB: CouchDB
```
</details>

<details><summary markdown="span">__wallet__
</summary>
_Optional. Non-empty string._ <br>
Specifies the path to an exported `FileSystemWallet`. If specified, all interactions will be based on the identities stored in the wallet, and any listed client keys within the `clients` section *must* correspond to an existing identity within the wallet.

```yaml
wallet: path/to/myFileWallet
```
</details>

<details><summary markdown="span">__certificateAuthorities__
</summary>
_Optional. Non-empty object._ <br>
The adapter supports the Fabric-CA integration to manage users dynamically at startup. Other CA implementations are currently not supported. If you don't need to register or enroll users using Caliper, you can omit this section.

The top-level `certificateAuthorities` section contains one or more CA names as keys (matching the `ca.name` or `FABRIC_CA_SERVER_CA_NAME` setting of the CA), and each key has a corresponding object (sub-keys) that describes the properties of that CA. The names will be used in other sections to reference a CA.

```yaml
certificateAuthorities:
  ca.org1.example.com:
    # properties of CA
  ca.org2.example.com:
    # properties of CA
``` 

*  <details><summary markdown="span">__url__
   </summary>
   _Required. Non-empty URI string._ <br>
   The endpoint of the CA. The protocol must be either `http://` or `https://`. Must be `https://` when using TLS.
   
   ```yaml
   certificateAuthorities:
     ca.org1.example.com:
       url: https://localhost:7054
   ```
   </details>

*  <details><summary markdown="span">__httpOptions__
   </summary>
   _Optional. Object._ <br>
   The properties specified under this object are passed to the `http` client verbatim when sending the request to the Fabric-CA server.
   
   ```yaml
   certificateAuthorities:
     ca.org1.example.com:
       httpOptions:
         verify: false
   ```
   </details>
   
*  <details><summary markdown="span">__tlsCACerts__
   </summary>
   _Required for TLS. Object._ <br>
   Specifies the TLS certificate of the CA for TLS communication. Forbidden to set for non-TLS communication. <br> 
   > Must contain __at most one__ of the following keys.
   
   *  <details><summary markdown="span">__path__
      </summary>
      _Optional. Non-empty string._ <br>
      The path of the file containing the TLS certificate.

      ```yaml
      certificateAuthorities:
        ca.org1.example.com:
          tlsCACerts:
            path: path/to/cert.pem
      ```
      </details>
      
   *  <details><summary markdown="span">__pem__
      </summary>
      _Optional. Non-empty string._ <br>
      The content of the TLS certificate file.

      ```yaml
      certificateAuthorities:
        ca.org1.example.com:
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
      </details>
   </details>

*  <details><summary markdown="span">__registrar__
   </summary>
   _Required. Non-empty, non-spares array._<br>
   A collection of registrar IDs and secrets. Fabric-CA supports dynamic user enrollment via REST APIs. A "root" user, i.e., a registrar is needed to register and enroll new users. Note, that currently __only one registrar per CA__ is supported (regardless of the YAML list notation).

   ```yaml
   certificateAuthorities:
     ca.org1.example.com:
       registrar:
       - enrollId: admin
         enrollSecret: adminpw
   ```
   
   *  <details><summary markdown="span">__[item].enrollId__
      </summary>
      _Required. Non-empty string._ <br>
      The enrollment ID of the registrar. Must be unique on the collection level.
      </details>

   *  <details><summary markdown="span">__[item].enrollSecret__
      </summary>
      _Required. Non-empty string._ <br>
      The enrollment secret of the registrar.
      </details>
   </details>
</details>

<details><summary markdown="span">__peers__
</summary>
_Required. Non-empty object._ <br>
Contains one or more, arbitrary but unique peer names as keys, and each key has a corresponding object (sub-keys) that describes the properties of that peer. The names will be used in other sections to reference a peer. 

Can be omitted if only the start/end scripts are executed during benchmarking.

```yaml
peers:
  peer0.org1.example.com:
    # properties of peer
  peer0.org2.example.com:
    # properties of peer
``` 

A peer object (e.g., `peer0.org1.example.com`) can contain the following properties.
*  <details><summary markdown="span">__url__
   </summary>
   _Required. Non-empty URI string._ <br>
   The (local or remote) endpoint of the peer to send the requests to. If TLS is configured, the protocol must be `grpcs://`, otherwise it must be `grpc://`.
    
   ```yaml
   peers:
     peer0.org1.example.com:
       url: grpcs://localhost:7051   
   ``` 
   </details>

*  <details><summary markdown="span">__eventUrl__
   </summary>
   _Optional. Non-empty URI string._ <br>
   The (local or remote) endpoint of the peer event service used by the event hub connections. If TLS is configured, the protocol must be `grpcs://`, otherwise it must be `grpc://`. Either all peers must contain this setting, or none of them.

   ```yaml
   peers:
     peer0.org1.example.com:
       eventUrl: grpcs://localhost:7053
   ``` 
   </details>

*  <details><summary markdown="span">__grpcOptions__
   </summary>
   _Optional. Object._ <br>
   The properties specified under this object set the gRPC settings used on connections to the Fabric network. See the available options in the [gRPC settings tutorial](https://fabric-sdk-node.github.io/master/tutorial-grpc-settings.html) of the Fabric SDK.
   
   ```yaml
   peers:
     peer0.org1.example.com:
       grpcOptions:
         ssl-target-name-override: peer0.org1.example.com
         grpc.keepalive_time_ms: 600000
   ``` 
   </details>

*  <details><summary markdown="span">__tlsCACerts__
   </summary>
   _Required for TLS. Object._ <br>
   Specifies the TLS certificate of the peer for TLS communication. Forbidden to set for non-TLS communication. <br> 
   > Must contain __at most one__ of the following keys.
   
   *  <details><summary markdown="span">__path__
      </summary>
      _Optional. Non-empty string._ <br>
      The path of the file containing the TLS certificate.

      ```yaml
      peers:
        peer0.org1.example.com:
          tlsCACerts:
            path: path/to/cert.pem
      ```
      </details>
      
   *  <details><summary markdown="span">__pem__
      </summary>
      _Optional. Non-empty string._ <br>
      The content of the TLS certificate file.

      ```yaml
      peers:
        peer0.org1.example.com:
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
      </details>
   </details>
</details>

<details><summary markdown="span">__orderers__
</summary>
_Required. Non-empty object._ <br>
Contains one or more, arbitrary but unique orderer names as keys, and each key has a corresponding object (sub-keys) that describes the properties of that orderer. The names will be used in other sections to reference an orderer. 

Can be omitted if only the start/end scripts are executed during benchmarking, or if discovery is enabled.

```yaml
orderers:
  orderer1.example.com:
    # properties of orderer
  orderer2.example.com:
    # properties of orderer
``` 

An orderer object (e.g., `orderer1.example.com`) can contain the following properties.
*  <details><summary markdown="span">__url__
   </summary>
   _Required. Non-empty URI string._ <br>
   The (local or remote) endpoint of the orderer to send the requests to. If TLS is configured, the protocol must be `grpcs://`, otherwise it must be `grpc://`.
    
   ```yaml
   orderers:
     orderer1.example.com:
       url: grpcs://localhost:7050   
   ``` 
   </details>

*  <details><summary markdown="span">__grpcOptions__
   </summary>
   _Optional. Object._ <br>
   The properties specified under this object set the gRPC settings used on connections to the Fabric network. See the available options in the [gRPC settings tutorial](https://fabric-sdk-node.github.io/master/tutorial-grpc-settings.html) of the Fabric SDK.
   
   ```yaml
   orderers:
     orderer1.example.com:
       grpcOptions:
         ssl-target-name-override: orderer1.example.com
         grpc.keepalive_time_ms: 600000
   ``` 
   </details>

*  <details><summary markdown="span">__tlsCACerts__
   </summary>
   _Required for TLS. Object._ <br>
   Specifies the TLS certificate of the orderer for TLS communication. Forbidden to set for non-TLS communication. <br> 
   > Must contain __at most one__ of the following keys.
   
   *  <details><summary markdown="span">__path__
      </summary>
      _Optional. Non-empty string._ <br>
      The path of the file containing the TLS certificate.

      ```yaml
      orderers:
        orderer1.example.com:
          tlsCACerts:
            path: path/to/cert.pem
      ```
      </details>
      
   *  <details><summary markdown="span">__pem__
      </summary>
      _Optional. Non-empty string._ <br>
      The content of the TLS certificate file.

      ```yaml
      orderers:
        orderer1.example.com:
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
      </details>
   </details>
</details>

<details><summary markdown="span">__organizations__
</summary>
 _Required. Non-empty object._ <br>
Contains one or more, arbitrary but unique organization names as keys, and each key has a corresponding object (sub-keys) that describes the properties of the organization. The names will be used in other sections to reference an organization.

Can be omitted if only the start/end scripts are executed during benchmarking.

```yaml
organizations:
  Org1:
    # properties of the organization
  Org2:
    # properties of the organization
```

An organization object (e.g., `Org1`) can contain the following properties.

*  <details><summary markdown="span">__mspid__
   </summary>
   _Required. Non-empty string._ <br>
   The unique MSP ID of the organization.

   ```yaml
   organizations:
     Org1:
       mspid: Org1MSP
   ```
   </details>

*  <details><summary markdown="span">__peers__
   </summary>
   _Optional. Non-empty, non-sparse array of strings._ <br>
   The list of peer names (from the top-level `peers` section) that are managed by the organization. Cannot contain duplicate or invalid peer entries.

   ```yaml
   organizations:
     Org1:
       peers:
       - peer0.org1.example.com
       - peer1.org1.example.com
   ```
   </details>

*  <details><summary markdown="span">__certificateAuthorities__
   </summary>
   _Optional. Non-empty, non-sparse array of strings._ <br>
   The list of CA names (from the top-level `certificateAuthorities` section) that are managed by the organization. Cannot contain duplicate or invalid CA entries. Note, that currently __only one CA__ is supported.

   ```yaml
   organizations:
     Org1:
       certificateAuthorities:
       - ca.org1.example.com
   ```
   </details>

*  <details><summary markdown="span">__adminPrivateKey__
   </summary>
   _Optional. Object._ <br>
   Specifies the admin private key for the organization. Required, if an initialization step requires admin signing capabilities (e.g., creating channels, installing/instantiating chaincodes, etc.). <br> 
   > Must contain __at most one__ of the following keys.
   
   *  <details><summary markdown="span">__path__
      </summary>
      _Optional. Non-empty string._ <br>
      The path of the file containing the private key.

      ```yaml
      organizations:
        Org1:
          adminPrivateKey:
            path: path/to/cert.pem
      ```
      </details>
      
   *  <details><summary markdown="span">__pem__
      </summary>
      _Optional. Non-empty string._ <br>
      The content of the private key file.

      ```yaml
      organizations:
        Org1:
          adminPrivateKey:
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
      </details>
   </details>

*  <details><summary markdown="span">__signedCert__
   </summary>
   _Optional. Object._ <br>
   Specifies the admin certificate for the organization. Required, if an initialization step requires admin signing capabilities (e.g., creating channels, installing/instantiating chaincodes, etc.). <br> 
   > Must contain __at most one__ of the following keys.
   
   *  <details><summary markdown="span">__path__
      </summary>
      _Optional. Non-empty string._ <br>
      The path of the file containing the certificate.

      ```yaml
      organizations:
        Org1:
          signedCert:
            path: path/to/cert.pem
      ```
      </details>
      
   *  <details><summary markdown="span">__pem__
      </summary>
      _Optional. Non-empty string._ <br>
      The content of the certificate.

      ```yaml
      organizations:
        Org1:
          signedCert:
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
      </details>
   </details>

</details>

<details><summary markdown="span">__clients__
</summary>
_Required. Non-empty object._ <br>
Contains one or more unique client names as keys, and each key has a corresponding object (sub-keys) that describes the properties of that client. These client names can be referenced from the user callback modules when submitting a transaction to set the identity of the invoker.

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

The `client` property of a client object (e.g., `client0.org1.example.com`) can contain the following properties. The list of required/forbidden properties depend on whether a wallet is configured or note. <br>
> __Note:__ the following constraints apply when __a file wallet is configured__:
> * The `credentialStore`, `clientPrivateKey`, `clientSignedCert`, `affiliation`, `attributes` and `enrollmentSecret` properties are forbidden.
> * Each client name __must__ correspond to one of the identities within the provided wallet. If you wish to specify an `Admin Client` then the naming convention is that of `admin.<orgname>`. If no explicit admin client is provided for an organisation, it is assumed that the first listed client for that organisation is associated with an administrative identity.

> __Note:__ the following constraints apply when __a file wallet is not configured__:
> * `credentialStore` is required. 
> * The following set of properties are mutually exclusive:
>   * `clientPrivateKey`/`clientSignedCert` (if one is set, then the other must be set too)
>   * `affiliation`/`attributes` (if `attributes` is set, then `affiliation` must be set too)
>   * `enrollmentSecret`

*  <details><summary markdown="span">__organization__
   </summary>
   _Required. Non-empty string._ <br>
   The name of the organization (from the top-level `organizations` section) of the client.

   ```yaml
   clients:
     client0.org1.example.com:
       client:
         organization: Org1
   ```
   </details>

*  <details><summary markdown="span">__credentialStore__
   </summary>
   _Required without file wallet. Non-empty object._ <br>
   The implementation-specific properties of the key-value store. A `FileKeyValueStore`, for example, has the following properties.

   *  <details><summary markdown="span">__path__
      </summary>
      _Required. Non-empty string._ <br>
      Path of the directory where the SDK should store the credentials.

      ```yaml
      clients:
        client0.org1.example.com:
          client:
            credentialStore:
              path: path/to/store
      ```
      </details>
    
   *  <details><summary markdown="span">__cryptoStore__
      </summary>
      _Required. Non-empty object._ <br>
      The implementation-specific properties of the underlying crypto key store. A software-based implementation, for example, requires a store path.

      *  <details><summary markdown="span">__path__
         </summary>
         _Required. Non-empty string._ <br>
         The path of the crypto key store directory.

         ```yaml
         clients:
           client0.org1.example.com:
             client:
               credentialStore:
                 cryptoStore:
                   path: path/to/crypto/store
         ```
         </details>
      </details>
   </details>

*  <details><summary markdown="span">__clientPrivateKey__
   </summary>
   _Optional. Object._ <br>
   Specifies the private key for the client identity. <br> 
   > Must contain __at most one__ of the following keys.
   
   *  <details><summary markdown="span">__path__
      </summary>
      _Optional. Non-empty string._ <br>
      The path of the file containing the private key.

      ```yaml
      clients:
        client0.org1.example.com:
          client:
            clientPrivateKey:
              path: path/to/cert.pem
      ```
      </details>
      
   *  <details><summary markdown="span">__pem__
      </summary>
      _Optional. Non-empty string._ <br>
      The content of the private key file.

      ```yaml
      clients:
        client0.org1.example.com:
          client:
            clientPrivateKey:
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
      </details>
   </details>

*  <details><summary markdown="span">__clientSignedCert__
   </summary>
   _Optional. Object._ <br>
   Specifies the certificate for the client identity. <br> 
   > Must contain __at most one__ of the following keys.
   
   *  <details><summary markdown="span">__path__
      </summary>
      _Optional. Non-empty string._ <br>
      The path of the file containing the certificate.

      ```yaml
      clients:
        client0.org1.example.com:
          client:
            clientSignedCert:
              path: path/to/cert.pem
      ```
      </details>
      
   *  <details><summary markdown="span">__pem__
      </summary>
      _Optional. Non-empty string._ <br>
      The content of the certificate file.

      ```yaml
      clients:
        client0.org1.example.com:
          client:
            clientSignedCert:
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
      </details>
   </details>

*  <details><summary markdown="span">__affiliation__
   </summary>
   _Optional. Non-empty string._ <br>
   If you dynamically register a user through a Fabric-CA, you can provide an affiliation string. The adapter will create the necessary affiliation hierarchy, but you must provide a registrar for the CA that is capable of registering the given affiliation (hierarchy).

   ```yaml
   clients:
     client0.org1.example.com:
       client:
         affiliation: org3.sales
   ```
   </details>

*  <details><summary markdown="span">__attributes__
   </summary>
   _Optional. Non-empty, non-spare array of objects._ <br>
   If you dynamically register a user through a Fabric-CA, you can provide a collection of key-value attributes to assign to the user.

   ```yaml
   clients:
     client0.org1.example.com:
       client:
         attributes:
         - name: departmentId
           value: sales
           ecert: true
   ```

   Each attribute has the following properties.
   
   *  <details><summary markdown="span">__[item].name__
      </summary>
      _Required. Non-empty string._ <br>
      The unique name of the attribute in the collection.
      </details>
   
   *  <details><summary markdown="span">__[item].value__
      </summary>
      _Required. String._ <br>
      The string value of the attribute.
      </details>

   *  <details><summary markdown="span">__[item].ecert__
      </summary>
      _Optional. Boolean._ <br>
      A value of `true` indicates that this attribute should be included in an enrollment certificate by default.
      </details>
   </details>

*  <details><summary markdown="span">__enrollmentSecret__
   </summary>
   _Optional. Non-empty string._ <br>
   For registered (but not enrolled) users you can provide the enrollment secret, and the adapter will enroll the user and retrieve the necessary crypto materials. However, this is a rare scenario.

   ```yaml
   clients:
     client0.org1.example.com:
       client:
         enrollmentSecret: secretString
   ```
   </details>

*  <details><summary markdown="span">__connection__
   </summary>
   _Optional. Non-empty object._ <br>
   Specifies connection details for the client. Currently, it includes timeout values for different node services. Must contain the following key.
   
   *  <details><summary markdown="span">__timeout__
      </summary>
      _Required. Non-empty object._ <br>
      Specifies timeout values for different node services. <br>
      > __Note:__ must contain __at least one__ of the followign keys.

      *  <details><summary markdown="span">__peer__
         </summary>
         _Optional. Non-empty object._ <br>
         Specifies timeout values for peer services. <br>
         > __Note:__ must contain __at least one__ of the following keys.

         *  <details><summary markdown="span">__endorser__
            </summary>
            _Optional. Positive integer._ <br>
            Timeout value in _seconds_ to use for peer requests. 
            
            ```yaml
            clients:
              client0.org1.example.com:
                client:
                  connection:
                    peer:
                      endorser: 120
            ```
            </details>
         
         *  <details><summary markdown="span">__eventhub__
            </summary>
            _Optional. Positive integer._ <br>
            Timeout value in _seconds_ to use for waiting for registered events to occur. 
            
            ```yaml
            clients:
              client0.org1.example.com:
                client:
                  connection:
                    peer:
                      eventHub: 120
            ```
            </details>
          
         *  <details><summary markdown="span">__eventReg__
            </summary>
            _Optional. Positive integer._ <br>
            Timeout value in _seconds_ to use when connecting to an event hub. 
            
            ```yaml
            clients:
              client0.org1.example.com:
                client:
                  connection:
                    peer:
                      eventReg: 120
            ```
            </details>
         </details>

      *  <details><summary markdown="span">__orderer__
         </summary>
         _Optional. Positive integer._ <br>
         Timeout value in _seconds_ to use for orderer requests.

         ```yaml
         clients:
           client0.org1.example.com:
             client:
               connection:
                 orderer: 30
         ```
         </details>
      </details>
   </details>
</details>

<details><summary markdown="span">__channels__
</summary>
_Required. Non-empty object._ <br>
Contains one or more unique channel names as keys, and each key has a corresponding object (sub-keys) that describes the properties of the channel.

Can be omitted if only the start/end scripts are executed during benchmarking.

```yaml
channels:
  mychannel:
    # properties of the channel
  yourchannel:
    # properties of the channel
``` 

A channel object (e.g., `mychannel`) can contain the following properties.

*  <details><summary markdown="span">__created__
   </summary>
   _Optional. Boolean._ <br>
   Indicates whether the channel already exists or not. If `true`, then the adapter will not try to create the channel again (which would fail). Defaults to `false`.
   
   > __Note:__ when a channel needs to be created, either `configBinary` or `definition` must be set!
   
   ```yaml
   channels:
     mychannel:
       created: false
   ```
   </details>

*  <details><summary markdown="span">__configBinary__
   </summary>
   _Optional. Non-empty string._ <br>
   If a channel doesn't exist yet, the adapter will create it based on the provided path of a channel configuration binary (which is typically the output of the [configtxgen](https://hyperledger-fabric.readthedocs.io/en/latest/commands/configtxgen.html) tool).
   
   > __Note:__ if `created` is false, and the `definition` property is provided, then this property is forbidden.
   
   ```yaml
   channels:
     mychannel:
       configBinary: my/path/to/binary.tx
   ```
   </details>

*  <details><summary markdown="span">__definition__
   </summary>
   _Optional. Object._ <br>
   If a channel doesn't exist yet, the adapter will create it based on the provided channel definition, consisting of multiple properties.
   
   ```yaml
   channels:
     mychannel:
       definition:
         capabilities: []
         consortium: SampleConsortium
         msps: ['Org1MSP', 'Org2MSP']
         version: 0
   ``` 
   
   *  <details><summary markdown="span">__capabilities__
      </summary>
      _Required. Non-sparse array of strings._ <br>
      List of channel capabilities to include in the configuration transaction.
      </details>
   
   *  <details><summary markdown="span">__consortium__
      </summary>
      _Required. Non-empty string._ <br>
      The name of the consortium.
      </details>
   
   *  <details><summary markdown="span">__msps__
      </summary>
      _Required. Non-sparse array of unique strings._ <br>
      The MSP IDs of the organizations in the channel.
      </details>
   
   *  <details><summary markdown="span">__version__
      </summary>
      _Required. Non-negative integer._ <br>
      The version number of the configuration.
      </details>
   </details>

*  <details><summary markdown="span">__orderers__
   </summary>
   _Optional. Non-spares array of unique strings._ <br>
   a list of orderer node names (from the top-level `orderers` section) that participate in the channel.
   
   > __Note:__ if discovery is disabled, then this property is required!
   
   ```yaml
   channels:
     mychannel:
       orderers: ['orderer1.example.com', 'orderer2.example.com']
   ``` 
   </details>

*  <details><summary markdown="span">__peers__
   </summary>
   _Required. Object._ <br>
   Contains the peer node names as _properties_ (from the top-level `peers` section) that participate in the channel.
   
   ```yaml
   channels:
     mychannel:
       peers:
         peer0.org1.example.com:
           # use default values when object is empty
         peer0.org2.example.com:
           endorsingPeer: true
           chaincodeQuery: true
           ledgerQuery: false
           eventSource: true
   ```
   
   Each key is an object that can have the following properties.
   
   *  <details><summary markdown="span">__endorsingPeer__
      </summary>
      _Optional. Boolean._ <br>
      Indicates whether the peer will be sent transaction proposals for endorsement. The peer must have the chaincode installed. Caliper can also use this property to decide which peers to send the chaincode install request. Default: true
      </details>
    
   *  <details><summary markdown="span">__chaincodeQuery__
      </summary>
      _Optional. Boolean._ <br>
      Indicates whether the peer will be sent query proposals. The peer must have the chaincode installed. Caliper can also use this property to decide which peers to send the chaincode install request. Default: true
      </details>

   *  <details><summary markdown="span">__ledgerQuery__
      </summary>
      _Optional. Boolean._ <br>
      Indicates whether the peer will be sent query proposals that do not require chaincodes, like `queryBlock()`, `queryTransaction()`, etc. Currently unused. Default: true
      </details>

   *  <details><summary markdown="span">__eventSource__
      </summary>
      _Optional. Boolean._ <br>
      Indicates whether the peer will be the target of an event listener registration. All peers can produce events but Caliper typically only needs to connect to one to listen to events. Default: true
      </details>
   </details>

*  <details><summary markdown="span">__chaincodes__
   </summary>
   _Required. Non-sparse array of objects._ <br>
   Each array element contains information about a chaincode in the channel. 

   > __Note:__ the `contractID` value of __every__ chaincode in __every__ channel must be unique on the configuration file level! If `contractID` is not specified for a chaincode then its default value is the `id` of the chaincode.
   
   ```yaml
   channels:
     mychannel:
       chaincodes:
       - id: simple
         # other properties of simple CC
       - id: smallbank
         # other properties of smallbank CC
   ```
   Some prorperties are required depending on whether a chaincode needs to be deployed. The following constraints apply:
   > __Note:__ 
   >
   > Constraints for installing chaincodes:
   > * if `metadataPath` is provided, `path` is also required
   > * if `path` is provided, `language` is also required
   >
   > Constraints for instantiating chaincodes:
   > * if any of the following properties are provided, `language` is also needed: `init`, `function`, `initTransientMap`, `collections-config`, `endorsement-policy`
   Each element can contain the following properties.
   
   *  <details><summary markdown="span">__[item].id__
      </summary>
      _Required. Non-empty string._ <br>
      The ID of the chaincode.

      ```yaml
      channels:
        mychannel:
          chaincodes:
          - id: simple
            # other properties
      ```
      </details>

   *  <details><summary markdown="span">__[item].version__
      </summary>
      _Required. Non-empty string._ <br>
      The version string of the chaincode.
      
      ```yaml
      channels:
        mychannel:
          chaincodes:
          - version: v1.0
            # other properties
      ```
      </details>

   *  <details><summary markdown="span">__[item].contractID__
      </summary>
      _Optional. Non-empty string._ <br>
      The Caliper-level unique ID of the chaincode. This ID will be referenced from the user callback modules. Can be an arbitrary name, it won't effect the chaincode properties on the Fabric side.

      If omitted, it defaults to the `id` property value.

      ```yaml
      channels:
        mychannel:
          chaincodes:
          - contractID: simpleContract
            # other properties
      ```
      </details>
   
   *  <details><summary markdown="span">__[item].language__
      </summary>
      _Optional. Non-empty string._ <br>
      Denotes the language of the chaincode. Currently supported values: `golang`, `node` and `java`.
      
      ```yaml
      channels:
        mychannel:
          chaincodes:
          - language: node
            # other properties
      ```
      </details>

   *  <details><summary markdown="span">__[item].path__
      </summary>
      _Optional. Non-empty string._ <br>
      The path to the chaincode directory. For golang chaincodes, it is the fully qualified package name (relative to the `GOPATH/src` directory). Note, that `GOPATH` is temporarily set to the workspace directory by default. To disable this behavior, set the `caliper-fabric-overwritegopath` setting key to `false`.

      ```yaml
      channels:
        mychannel:
          chaincodes:
          - path: contracts/mycontract
            # other properties
      ```
      </details>

   *  <details><summary markdown="span">__[item].metadataPath__
      </summary>
      _Optional. Non-empty string._ <br>
      The directory path for additional metadata for the chaincode (like CouchDB indexes). Only supported since Fabric v1.1.

      ```yaml
      channels:
        mychannel:
          chaincodes:
          - metadataPath: contracts/mycontract/metadata
            # other properties
      ```
      </details>

   *  <details><summary markdown="span">__[item].init__
      </summary>
      _Optional. Non-sparse array of strings._ <br>
      The list of string arguments to pass to the chaincode's `Init` function during instantiation.

      ```yaml
      channels:
        mychannel:
          chaincodes:
          - init: ['arg1', 'arg2']
            # other properties
      ```
      </details>

   *  <details><summary markdown="span">__[item].function__
      </summary>
      _Optional. String._ <br>
      The function name to pass to the chaincode's `Init` function during instantiation.

      ```yaml
      channels:
        mychannel:
          chaincodes:
          - function: 'init'
            # other properties
      ```
      </details>

   *  <details><summary markdown="span">__[item].initTransientMap__
      </summary>
      _Optional. Object containing string keys associated with string values._ <br>
      The transient key-value map to pass to the `Init` function when instantiating a chaincode. The adapter encodes the values as byte arrays before sending them.

      ```yaml
      channels:
        mychannel:
          chaincodes:
          - initTransientMap:
              pemContent: |
                -----BEGIN PRIVATE KEY-----
                MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgQDk37WuVcnQUjE3U
                NTW7PpPfcp54q/KBKNrtFXjAtUChRANCAAQ0xnSUxoocDsb2YIrmtFIKZ4XAiwqu
                V0BCfsl+ByVKUUdXypNrluQfm28AxX7sEDQLKtHVmuMi/BGaKahZ6Snk
                -----END PRIVATE KEY-----
              stringArg: this is also passed as a byte array
            # other properties
      ```
      </details>

   *  <details><summary markdown="span">__[item].collections-config__
      </summary>
      _Optional. Non-empty, non-sparse array of objects._ <br>
      List of private collection definitions for the chaincode or a path to the JSON file containing the definitions. For details about the content of such definitions, refer to the [SDK page](https://fabric-sdk-node.github.io/release-1.4/tutorial-private-data.html).
      
      ```yaml
      channels:
        mychannel:
          chaincodes:
          - collections-config:
            - name: twoOrgCollection
              policy:
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
              requiredPeerCount: 1
              maxPeerCount: 1
              blockToLive: 0
            # other properties
      ```
      </details>

   *  <details><summary markdown="span">__[item].endorsement-policy__
      </summary>
      _Optional. Object._ <br>
      The endorsement policy of the chaincode as required by the Fabric Node.js SDK. If omitted, then a default N-of-N policy is used based on the target peers (thus organizations) of the chaincode.

      ```yaml
      channels:
        mychannel:
          chaincodes:
          - endorsement-policy:
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
            # other properties
      ```
      </details>

   *  <details><summary markdown="span">__[item].targetPeers__
      </summary>
      _Optional. Non-empty, non-sparse array of strings._ <br>
      Specifies custom target peers (from the top-level `peers` section) for chaincode installation/instantiation. Overrides the peer role-based channel-level targets.

      ```yaml
      channels:
        mychannel:
          chaincodes:
          - targetPeers:
            - peer0.org1.example.com
            - peer1.org1.example.com
            - peer0.org2.example.com
            - peer1.org2.example.com
            # other properties
      ```
      </details>
   </details>
</details>

## Connection Profile Example

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
  blockchain: fabric
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
      peer0.org2.example.com:
      peer1.org2.example.com:

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

## License
The Caliper codebase is released under the [Apache 2.0 license](./LICENSE.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.
