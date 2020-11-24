---
layout: vNext
title:  "Fabric"
categories: config
permalink: /vNext/fabric-config/new/
order: 3
---

## Table of contents
{:.no_toc}

- TOC
{:toc}

## Introducing the new Fabric Connector

This page describes the new fabric connector implementation that replaces the deprecated legacy fabric connector

The differences between the 2 implementations are as follows

> * A more logical network configuration utilising provided connection profiles from a network provider
> * More robust implementation
> * Fixes and improvements will only be done on the new connector implementation
> * The new connector implementation has dropped some of the capability of the old connector
>> * Cannot specify targetPeers during install/instantiate of a contract
>> * storing or reading identities from node-sdk credential/cypto stores is not implemented
>> * Support for automatically registering and enroling identities through a Certificate Authority is not implemented
>> * Cannot specify to use an admin identity in a workload request using the `#ORG2` type notation

How you select which implementation you use is via the provided network configuration file and specifically the version you declare in that file

> * a version of 1.0 selects the legacy connector
> * a version of 2.0.0 selects the new connector

For example

```yaml
name: Fabric
version: "1.0"
```
would select the legacy connector and the file must conform to the old deprecated network configuration file format

```yaml
name: Fabric
version: "2.0.0"
```

would select the new connector and the file must conform to the new network configuration file format


## Overview

This page introduces the Fabric adapter that utilizes the Common Connection Profile (CCP) feature of the Fabric SDK to provide compatibility and a unified programming model across different Fabric versions.

> The latest supported version of Hyperledger Fabric is v2.x
> The ability to discover can only be used if you use the `gateway` option 

The adapter exposes many SDK features directly to the user callback modules, making it possible to implement complex scenarios.

> Some highlights of the provided features:
> * supporting multiple orderers
> * supporting multiple channels and contracts
> * metadata and private collection support for contracts
> * support for TLS and mutual TLS communication
> * option to select the identity for submitting a TX/query
> * detailed execution data for every TX

## Installing dependencies

You must bind Caliper to a specific Fabric SDK to target the corresponding (or compatible) SUT version. Refer to the [binding documentation](./Installing_Caliper.md#the-bind-command) for details. It is confirmed that a 1.4 Fabric SDK is compatible with a Fabric 2.1 and 2.2 SUT however any installation or instantiation of contracts (chaincode) will only work if you are still using the old lifecycle implementation.

### Binding with Fabric SDK 2.x
> Note that when using the binding target for the Fabric SDK 2.x there are capability restrictions:
> * The 2.x SDK does not facilitate administration actions. It it not possible to create/join channels, nor install/instantiate contract. Consequently the 2.x binding only facilitates operation with a `--caliper-flow-only-test` flag
> * The 2.x SDK only supports operation using a `gateway`. Consequently the 2.x binding requires a `--caliper-fabric-gateway-enabled` flag

### Using the Operational capabilities of the Adapters
The ability to create channels and perform install/instantiate of contracts (chaincode) remains in the new 1.x sdk based adapters, and nothing equivalent exists for the 2.x sdk based adapters. This capability remains mainly to support the Caliper integration tests and the use of these mechanisms to setup your channels and contracts is highly discouraged. This capability is considered legacy and will not be maintained. You should look into alternative methods for setting up your network prior to running Caliper to benchmark it.

## Runtime settings

### Common settings

Some runtime properties of the adapter can be set through Caliper's [runtime configuration mechanism](./Runtime_Configuration.md). For the available settings, see the `caliper.fabric` section of the [default configuration file](https://github.com/hyperledger/caliper/blob/master/packages/caliper-core/lib/common/config/default.yaml) and its embedded documentation.

The above settings are processed when starting Caliper. Modifying them during testing will have no effect. However, you can override the default values _before Caliper starts_ from the usual configuration sources.

> __Note:__ An object hierarchy in a configuration file generates a setting entry for every leaf property. Consider the following configuration file:
> ```yaml
> caliper:
>   fabric:
>     gateway:
>       localHost: false
>       enabled: true
> ```
> After naming the [project settings](./Runtime_Configuration.md#project-level) file `caliper.yaml` and placing it in the root of your workspace directory, it will override the following two setting keys with the following values:
> * Setting `caliper-fabric-gateway-enabled` is set to `true`
> * Setting `caliper-fabric-gateway-localhost` is set to `false`
>
> __The other settings remain unchanged.__

The setting `caliper-fabric-gateway-discovery` is not supported in these new connectors and should be defined within the configuration file but remains available only to support the legacy fabric connectors.

### Skip channel creation

Additionally, the adapter provides a dynamic setting (family) for skipping the creation of a channel. The setting key format is `caliper-fabric-skipcreatechannel-<channel_name>`. Substitute the name of the channel you want to skip creating into `<channel_name>`, for example:

```console
user@ubuntu:~/caliper-benchmarks$ export CALIPER_FABRIC_SKIPCREATECHANNEL_MYCHANNEL=true
```

> __Note:__ This settings is intended for easily skipping the creation of a channel that is specified in the network configuration file as "not created". However, if you know that the channel always will be created during benchmarking, then it is recommended to denote this explicitly in the network configuration file.

Naturally, you can specify the above setting multiple ways (e.g., command line argument, configuration file entry).

## The connector API

The [workload modules](./Workload_Module.md) interact with the adapter at three phases of the tests: during the initialization of the user module (in the `initializeWorkloadModule` callback), when submitting invoke or query transactions (in the `submitTransaction` callback), and at the optional cleanup of the user module (in the `cleanupWorkloadModule` callback).

### The `initializeWorkloadModule` function

See the [corresponding documentation](./Workload_Module.md#initializeworkloadmodule) of the function for the description of its parameters.

The last argument of the function is a `sutContext` object, which is a platform-specific object provided by the backend blockchain's connector. The context object provided by this connector is a `FabricNetwork` instance that provides simple string-based "queries" and results about the network topology, so user callbacks can be implemented in a more general way.

For the current details/documentation of the API, refer to the [source code](https://github.com/hyperledger/caliper/blob/master/packages/caliper-fabric/lib/fabricNetwork.js).

### The `submitTransaction` function

The `sutAdapter` object received (and saved) in the `initializeWorkloadModule` function is of type [`ConnectorInterface`](https://github.com/hyperledger/caliper/blob/master/packages/caliper-core/lib/common/core/connector-interface.js). Its `getType()` function returns the `fabric` string value.

The `sendRequests` method of the connector API allows the workload module to submit requests to the SUT. It takes a single parameter: an object or array of objects containing the settings of the requests.

The settings object has the following structure:
* `contractId`: _string. Required._ The ID of the contract to call.
* `contractFunction`: _string. Required._ The name of the function to call in the contract.
* `contractArguments`: _string[]. Optional._ The list of __string__ arguments to pass to the contract.
* `readOnly`: _boolean. Optional._ Indicates whether the request is a TX or a query. Defaults to `false`.
* `timeout`: _number. Optional._ The timeout in seconds to use for this request. This setting is not applicable when gateway use is enabled.
* `transientMap`: _Map<string, byte[]>. Optional._ The transient map to pass to the contract.
* `invokerIdentity`: _string. Optional._ The name of the user who should invoke the contract. If not provided a user will be selected from the organization defined by `invokerMspId` or the first organization in the network configuration file if that property is not provided
* `invokerMspId`: _string. Optional._ The mspid of the user organization who should invoke the contract. Defaults to the first organization in the network configuration file.
* `targetPeers`: _string[]. Optional._ An array of endorsing peer names as the targets of the transaction proposal. If omitted, the target list will be chosen for you. If discovery is used then the node sdk uses discovery to determine the correct peers.
* `targetOrganizations`: _string[]. Optional._ An array of endorsing organizations as the targets of the invoke. If both targetPeers and 
are specified then targetPeers will take precedence
* `orderer`: _string. Optional._ The name of the target orderer for the transaction broadcast. If omitted, then an orderer node of the channel will be automatically selected.
* `channel`: _string. Optional._ The name of the channel on which the contract to call resides.

So invoking a contract looks like the following:

```js
let requestSettings = {
    contractId: 'marbles',
    contractFunction: 'initMarble',
    contractArguments: ['MARBLE#1', 'Red', '100', 'Attila'],
    invokerIdentity: 'client0.org2.example.com',
    timeout: 10
};

await this.sutAdapter.sendRequests(requestSettings);
```

> __Note:__ `sendRequests` also accepts an array of request settings. However, Fabric does not support submitting an atomic batch of transactions like Sawtooth, so there is no guarantee that the order of these transactions will remain the same, or whether they will reside in the same block.


## Gathered TX data

The previously discussed  `sendRequests` function returns the result (or an array of results) for the submitted request(s) with the type of [TxStatus](https://github.com/hyperledger/caliper/blob/master/packages/caliper-core/lib/transaction-status.js). The class provides some standard and platform-specific information about its corresponding transaction.

The standard data provided are the following:
* `GetID():string` returns the transaction ID.
* `GetStatus():string` returns the final status of the transaction, either `success` or `failed`.
* `GetTimeCreate():number` returns the epoch when the transaction was submitted.
* `GetTimeFinal():number` return the epoch when the transaction was finished.
* `IsVerified():boolean` indicates whether we are sure about the final status of the transaction. Unverified (considered failed) transactions could occur, for example, if the adapter loses the connection with every Fabric event hub, missing the final status of the transaction.
* `GetResult():Buffer` returns one of the endorsement results returned by the contract as a `Buffer`. It is the responsibility of the user callback to decode it accordingly to the contract-side encoding.

The adapter also gathers the following platform-specific data (if observed) about each transaction, each exposed through a specific key name. The placeholders `<P>` and `<O>` in the key names are node names taking their values from the top-level peers and orderers sections from the network configuration file (e.g., `endorsement_result_peer0.org1.example.com`). The `Get(key:string):any` function returns the value of the observation corresponding to the given key. Alternatively, the `GetCustomData():Map<string,any>` returns the entire collection of gathered data as a `Map`.

The adapter-specific data keys are that are common across both the gateway and non gateway adapters are :

|            Key name            | Data type | Description                                                                                                                                                                                                                                                                  |
|:------------------------------:|:---------:|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|         `request_type`         |  string   | Either the `transaction` or `query` string value for traditional transactions or queries, respectively. |


The adapter-specific data keys that only the v1.x non gateway adapter makes available are :


|            Key name            | Data type | Description                                                                                                                                                                                                                                                           |
|:------------------------------:|:---------:|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|         `time_endorse`         |  number   | The Unix epoch when the adapter received the proposal responses from the endorsers. Saved even in the case of endorsement errors.                                                                                                                                   |
|        `proposal_error`        |  string   | The error message in case an error occurred during sending/waiting for the proposal responses from the endorsers.                                                                                                                                                            |
| `proposal_response_error_<P>`  |  string   | The error message in case the endorser peer `<P>` returned an error as endorsement result.                                                                                                                                                                                   |
|    `endorsement_result_<P>`    |  Buffer   | The encoded contract invocation result returned by the endorser peer `<P>`. It is the user callback's responsibility to decode the result.                                                                                                                                  |
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

You can access these data in your workload module after calling `sendRequests`:

```js
let requestSettings = {
    contractId: 'marbles',
    contractVersion: '0.1.0',
    contractFunction: 'initMarble',
    contractArguments: ['MARBLE#1', 'Red', '100', 'Attila'],
    invokerIdentity: 'client0.org2.example.com',
    timeout: 10
};

// single argument, single return value
const result = await this.sutAdapter.sendRequests(requestSettings);

let shortID = result.GetID().substring(8);
let executionTime = result.GetTimeFinal() - result.GetTimeCreate();
console.log(`TX [${shortID}] took ${executionTime}ms to execute. Result: ${result.GetStatus()}`);
```

### The cleanupWorkloadModule function
The `cleanupWorkloadModule` function is called at the end of the round, and can be used to perform any resource cleanup required by your workload implementation.

## Network configuration file reference

The YAML network configuration file of the adapter mainly describes the organizations and the identities associated with those organizations, It also provides explicit information about the channels in your fabric network and the contracts (chaincode) deployed to those channels. It will reference Common Connection Profiles for each organization (as common connection profiles are specific to a single organization). These are the same connection profiles that would be consumed by the node-sdk. Whoever creates the fabric network and channels would be able to provide appropriate profiles for each organization.

The following sections detail each part separately. For a complete example, please refer to the [example section](#network-configuration-example) or one of the files in the [Caliper repository](https://github.com/hyperledger/caliper), such as the caliper-fabric test folder

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
Specifies the YAML schema version that the Fabric SDK will use. Only the `'2.0.0'` string should be specified.

```yaml
version: '2.0.0'
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

*  <details><summary markdown="span">__sutOptions__
   </summary>
   _Optional. Non-empty object._ <br>
   These are sut specific options block, the following are specific to the fabric implementation

   *  <details><summary markdown="span">__mutualTls__
      </summary>
       _Optional. Boolean._ <br>
       Indicates whether to use client-side TLS in addition to server-side TLS. Cannot be set to `true` without using server-side TLS. Defaults to `false`.

       ```yaml
       caliper:
         blockchain: fabric
         sutOptions:
           mutualTls: true
       ```
      </details>   
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

<details><summary markdown="span">__organizations__
</summary>
 _Required. Non-empty object._ <br>
Contains information about 1 or more organizations that will be used when running a workload. Even in a multi-organization fabric network, workloads would usually only be run from a single organization so it would be common to only see 1 organization defined. However it does support defining multiple organizations for which a workload can explicitly declare which organization to use. The first Organization in the network configuration will be the default organization if no explicit organization is requested.

```yaml
organizations:
  - mspid: Org1MSP
    identities:
      wallet:
        path: './org1wallet'
        adminNames:
        - admin
      certificates:
      - name: 'User1'
        clientPrivateKey:
          pem: |-
            -----BEGIN PRIVATE KEY-----
            ...
            -----END PRIVATE KEY-----
        clientSignedCert:
          pem: |-
            -----BEGIN CERTIFICATE-----
            ...
            -----END CERTIFICATE-----
    connectionProfile:
      path: './Org1ConnectionProfile.yaml'
      discover: true
  - mspid: Org2MSP
    connectionProfile:
      path: './Org2ConnectionProfile.yaml'
      discover: false
    identities:
      wallet:
        path: './org2wallet'
        adminNames:
        - admin

```

Each organization must have `mspid`, `connectionProfle` and `identities` provided and at least 1 cerficate or wallet definition in the identities section so that at least 1 identity is defined
*  <details><summary markdown="span">__mspid__
   </summary>
   _Required. Non-empty string._ <br>
   The unique MSP ID of the organization.

   ```yaml
   organizations:
     - mspid: Org1MSP
   ```
   </details>

*  <details><summary markdown="span">__connectionProfile__
   </summary>
   _Required. Non-empty object._ <br>
   Reference to a fabric network Common Connection Profile. These profiles are the same profiles that the fabric SDKs would consume in order to interact with a fabric network. A Common Connection Profile is organization specific so you need to ensure you point to a Common Connection Profile that is representive of the organization it is being included under. Connection Profiles also can be in 2 forms. A static connection profile will contain a complete description of the fabric network, ie all the peers and orderers as well as all the channels that the organization is part of. A dynamic connection profile will contain a minimal amount of information usually just a list of 1 or more peers belonging to the organization (or is allowed to access) in order to discover the fabric network nodes and channels.

   ```yaml
   organizations:
     - mspid: Org1MSP
     connectionProfile:
      path: './test/sample-configs/Org1ConnectionProfile.yaml'
      discover: true     
   ```
   *  <details><summary markdown="span">__path__
      </summary>
      _Required. Non-empty string._ <br>
      The path to the connection profile file

      ```yaml
      organizations:
        - mspid: Org1MSP
        connectionProfile:
          path: './test/sample-configs/Org1ConnectionProfile.yaml'
      ```
      </details>
   *  <details><summary markdown="span">__discover__
      </summary>
      _Optional. Boolean._ <br>
      A value of `true` indicates that the connection profile is a dynamic connection profile and discovery should be used. If not specified then it defaults to false. You can only set this value to true if you plan to use the `gateway` option

      ```yaml
      organizations:
        - mspid: Org1MSP
        connectionProfile:
          path: './test/sample-configs/Org1ConnectionProfile.yaml'
          discover: true
      ```
      </details>
   </details>

*  <details><summary markdown="span">__identities__
   </summary>
   _Required. Non-empty object._ <br>
   Defines the location of 1 or more identities available for use. Currently only supports explicit identities by providing a certificate and private key as PEM or an SDK wallet that contains 1 or more identities on the file system. At least 1 identity must be provided via one of the child properties of identity.

   ```yaml
   identities:
      wallet:
        path: './wallets/org1wallet'
        adminNames:
        - admin
      certificates:
      - name: 'User1'
        clientPrivateKey:
          pem: |-
            -----BEGIN PRIVATE KEY-----
            ...
            -----END PRIVATE KEY-----
        clientSignedCert:
          pem: |-
            -----BEGIN CERTIFICATE-----
            ...
            -----END CERTIFICATE-----
    ```
    *  <details><summary markdown="span">certificates
       </summary>
       _Optional. A List of non-empty objects._ <br>
       Defines 1 or more identities by providing the PEM information for the client certificate and client private key as either an embedded PEM, a base64 encoded string of the PEM file contents or a path to individual PEM files

       ```yaml
       certificates:
       - name: 'User1'
         clientPrivateKey:
            path: path/to/privateKey.pem
         clientSignedCert:
            path: path/to/cert.pem
       - name: 'Admin'
         admin: true
         clientPrivateKey:
          pem: |-
            -----BEGIN PRIVATE KEY-----
            MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgIRZo3SAPXAJnGVOe
            jRALBJ208m+ojeCYCkmJQV2aBqahRANCAARnoGOEw1k+MtjHH4y2rTxRjtOaKWXn
            FGpsALLXfBkKZvxIhbr+mPOFZVZ8ztihIsZBaCuCIHjw1Tx65szJADcO
            -----END PRIVATE KEY-----
         clientSignedCert:
          pem: |-
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
       - name: 'User3'
         clientPrivateKey:
          pem: LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JR0hBZ0VBTUJNR0J5cUdTTTQ5QWdFR0NDcUdTTTQ5QXdFSEJHMHdhd0lCQVFRZ0lSWm8zU0FQWEFKbkdWT2UKalJBTEJKMjA4bStvamVDWUNrbUpRVjJhQnFhaFJBTkNBQVJub0dPRXcxaytNdGpISDR5MnJUeFJqdE9hS1dYbgpGR3BzQUxMWGZCa0tadnhJaGJyK21QT0ZaVlo4enRpaElzWkJhQ3VDSUhqdzFUeDY1c3pKQURjTwotLS0tLUVORCBQUklWQVRFIEtFWS0tLS0tCg==
         clientSignedCert:
          pem: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUNXRENDQWY2Z0F3SUJBZ0lSQU1wU2dXRmpESE9vaFhhMFI2ZTlUSGd3Q2dZSUtvWkl6ajBFQXdJd2RqRUwKTUFrR0ExVUVCaE1DVlZNeEV6QVJCZ05WQkFnVENrTmhiR2xtYjNKdWFXRXhGakFVQmdOVkJBY1REVk5oYmlCRwpjbUZ1WTJselkyOHhHVEFYQmdOVkJBb1RFRzl5WnpFdVpYaGhiWEJzWlM1amIyMHhIekFkQmdOVkJBTVRGblJzCmMyTmhMbTl5WnpFdVpYaGhiWEJzWlM1amIyMHdIaGNOTWpBd09UQTNNVEUwTWpBd1doY05NekF3T1RBMU1URTAKTWpBd1dqQjJNUXN3Q1FZRFZRUUdFd0pWVXpFVE1CRUdBMVVFQ0JNS1EyRnNhV1p2Y201cFlURVdNQlFHQTFVRQpCeE1OVTJGdUlFWnlZVzVqYVhOamJ6RVpNQmNHQTFVRUNoTVFiM0puTVM1bGVHRnRjR3hsTG1OdmJURWZNQjBHCkExVUVBeE1XZEd4elkyRXViM0puTVM1bGVHRnRjR3hsTG1OdmJUQlpNQk1HQnlxR1NNNDlBZ0VHQ0NxR1NNNDkKQXdFSEEwSUFCTWRMdlNVRElqV1l1Qnc0WVZ2SkVXNmlmRkx5bU9BWDdHS1k2YnRWUERsa2RlSjh2WkVyWExNegpKV2ppdnIvTDVWMlluWnF2ME9XUE1NZlB2K3pIK1JHamJUQnJNQTRHQTFVZER3RUIvd1FFQXdJQnBqQWRCZ05WCiBIU1VFRmpBVUJnZ3JCZ0VGQlFjREFnWUlLd1lCQlFVSEF3RXdEd1lEVlIwVEFRSC9CQVV3QXdFQi96QXBCZ05WCkhRNEVJZ1FnNWZPaHl6d2FMS20zdDU0L0g0YjBhVGU3L25HUHlKWk5oOUlGUks2ZkRhQXdDZ1lJS29aSXpqMEUKQXdJRFNBQXdSUUloQUtFbnkvL0pZN0dYWi9USHNRSXZVVFltWHNqUC9iTFRJL1Z1TFg3VHpjZWZBaUJZb1N5WQp5OTByZHBySTZNcDZSUGlxalZmMDJQNVpDODZVa1AwVnc0cGZpUT09Ci0tLS0tRU5EIENFUlRJRklDQVRFLS0tLS0K
       ```

       *  <details><summary markdown="span">__name__
          </summary>
          _Required. Non-empty string._ <br>  
          Specifies a name to associate with this identity. This name doesn't have to match anything within the certificate itself but must be unique  

          ```yaml
          certificates:
            - name: 'User1'
          ```

       *  <details><summary markdown="span">__admin__
          </summary>
          _Optional. Boolean._ <br> 
          Indicates if this identity can be considered an admin identity for the organization. Defaults to false if not provided 
          This only needs to be provided if you plan to create channels and/or install and instantiate contracts (chaincode)

          ```yaml
          certificates:
            - name: 'User2'
              admin: true
          ```

       *  <details><summary markdown="span">__clientPrivateKey__
          </summary>
          _Required. Non-empty object._ <br>
          Specifies the identity's private key for the organization. 
          > Must contain __at most one__ of the following keys.

          *  <details><summary markdown="span">__path__
              </summary>
              _Optional. Non-empty string._ <br>
              The path of the file containing the private key.

              ```yaml
              clientPrivateKey:
                path: path/to/cert.pem
              ```
             </details>

          *  <details><summary markdown="span">__pem__
              </summary>
              _Optional. Non-empty string._ <br>
              The content of the private key file either in exact PEM format (which must split into multiple lines for yaml, or contain newline characters for JSON), or it could be a base 64 encoded version of the PEM (which will also encode the required newlines) as a single string. This single string format makes it much easier to embed into the network configuration file especially for a JSON based file

              ```yaml
              clientPrivateKey:
                pem: |
                  -----BEGIN PRIVATE KEY-----
                   MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgIRZo3SAPXAJnGVOe
                   jRALBJ208m+ojeCYCkmJQV2aBqahRANCAARnoGOEw1k+MtjHH4y2rTxRjtOaKWXn
                   FGpsALLXfBkKZvxIhbr+mPOFZVZ8ztihIsZBaCuCIHjw1Tx65szJADcO
                   -----END PRIVATE KEY-----
              ```
             </details>
          </details>

       *  <details><summary markdown="span">__clientSignedCert__
          </summary>
          _Required. Non-empty object._ <br>
          Specifies the identity's certificate for the organization. 
          > Must contain __at most one__ of the following keys.

          *  <details><summary markdown="span">__path__
             </summary>
             _Optional. Non-empty string._ <br>
             The path of the file containing the certificate.

             ```yaml
             clientSignedCert:
               path: path/to/cert.pem
             ```
             </details>

          *  <details><summary markdown="span">__pem__
             </summary>
             _Optional. Non-empty string._ <br>
              The content of the certificate file either in exact PEM format (which must split into multiple lines for yaml, or contain newline characters for JSON), or it could be a base 64 encoded version of the PEM (which will also encode the required newlines) as a single string. This single string format makes it much easier to embed into the network configuration file especially for a JSON based file

             ```yaml
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
       </details>
   
    *  <details><summary markdown="span">wallet
       </summary>
       _Optional. Non-empty object_ <br>
       Provide the path to a file system wallet. Be aware that the persistence format used between v1.x and v2.x of the node sdks changed so make sure you provide a wallet created in the appropriate format for the version of SUT you bind to.

       *  <details><summary markdown="span">__path__
          </summary>
          _Required. Non-empty string._ <br>
          The path to the file system wallet 

          ```yaml
          identities:
            wallet:
              path: './wallets/org1wallet'
          ```
          </details>
       
       *  <details><summary markdown="span">__adminNames__
          </summary>
          _Oprional. List of strings._ <br>
          1 or more names in the wallet that are identitied as organization administrators.
          This only needs to be provided if you plan to create channels and/or install and instantiate contracts (chaincode)

          ```yaml
          identities:
            wallet:
              path: './wallets/org1wallet'
              adminNames:
              - admin
              - another_admin          
          ```
          </details>
       
       </details>
   </details>
</details>

<details><summary markdown="span">__channels__
</summary>
_Required. A list of objects._ <br>
Contains one or more unique channels with associated information about the contracts (chaincode) that will be available on the channel

```yaml
channels:
  - channelName: mychannel
    create:
      buildTransaction:
        capabilities: []
        consortium: 'SampleConsortium2'
        msps: ['Org1MSP', 'Org2MSP']
        version: 0
    contracts:
    - id: marbles
      contractID: myMarbles
      install:
        version: v0
        language: golang
        path: marbles/go
        metadataPath: src/marbles/go/metadata
      instantiate:
        initFunction: init
        initArguments: []
        initTransientMap:
          key1: value1
          key2: value2
        endorsementPolicy: ''
        collectionsConfig: ''

  - channelName: somechannel
    create:
      prebuiltTransaction: 'channel.tx'
```

*  <details><summary markdown="span">__channelName__
   </summary>
   _Required. Non-empty String._ <br>
   The name of the channel.

   ```yaml
   channels:
     - channelName: mychannel
   ```

*  <details><summary markdown="span">__create__
   </summary>
   _Optional. Non-empty object._  <br>
   Indicates That a channel should be created and the child properties will define how the channel will be created either by building a channel transaction or by using a prebuilt one

   ```yaml
   channels:
   - channelName: mychannel
     create:
       buildTransaction:
         capabilities: []
         consortium: 'SampleConsortium2'
         msps: ['Org1MSP', 'Org2MSP']
         version: 0
   ...
   - channelName: somechannel
     create:
       prebuiltTransaction: 'channel.tx'   
   ...
   ```
   > Must contain __at most one__ of the following keys.

   *  <details><summary markdown="span">__prebuiltTransaction__
      </summary>
      _Optional. Non-empty string._ <br>
      If a channel doesn't exist yet, the adapter will create it based on the provided path of a channel configuration binary (which is typically the output of the [configtxgen](https://hyperledger-fabric.readthedocs.io/en/latest/commands/configtxgen.html) tool).

      ```yaml
      channels:
      - channelName: somechannel
        create:
          prebuiltTransaction: 'channel.tx'   
      ```
      </details>

   *  <details><summary markdown="span">__buildTransaction__
      </summary>
      _Optional. Object._ <br>
      If a channel doesn't exist yet, the adapter will create it based on the provided information on how to build a transaction that will create a channel, consisting of multiple properties.

      ```yaml
      channels:
        - channelName: somechannel
          create:
            buildTransaction:
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

    </details>


*  <details><summary markdown="span">__contracts__
   </summary>
   _Required. Non-sparse array of objects._ <br>
   Each array element contains information about a contract in the channel.

   > __Note:__ the `contractID` value of __every__ contract in __every__ channel must be unique on the configuration file level! If `contractID` is not specified for a contract then its default value is the `id` of the contract.

   ```yaml
   channels:
     mychannel:
       contracts:
       - id: simple
         # other properties of simple CC
       - id: smallbank
         # other properties of smallbank CC
   ```
   Some prorperties are required depending on whether a contract needs to be deployed. The following constraints apply:
   > __Note:__
   >
   > Constraints for installing contracts:
   > * if `metadataPath` is provided, `path` is also required
   > * if `path` is provided, `language` is also required
   >
   > Constraints for instantiating contracts:
   > * if any of the following properties are provided, `language` is also needed: `initArguments`, `initFunction`, `initTransientMap`, `collectionsConfig`, `endorsementPolicy`
   Each element can contain the following properties.

   *  <details><summary markdown="span">__id__
      </summary>
      _Required. Non-empty string._ <br>
      The ID of the contract.

      ```yaml
      channels:
        mychannel:
          contracts:
          - id: simple
            # other properties
      ```
      </details>


   *  <details><summary markdown="span">__contractID__
      </summary>
      _Optional. Non-empty string._ <br>
      The Caliper-level unique ID of the contract. This ID will be referenced from the user callback modules. Can be an arbitrary name, it won't effect the contract properties on the Fabric side.

      If omitted, it defaults to the `id` property value.

      ```yaml
      channels:
        mychannel:
          contracts:
          - contractID: simpleContract
            # other properties
      ```
      </details>

   *  <details><summary markdown="span">__install__
      </summary>
      _Optional. Non-empty object_ <br>
      Defines the requirement that the contract (chaincode) will be installed and instantiated. The sub properties provided will define the information about the contract (chaincode) to be installed. This can only be used with a 1.4 SUT and can only be used against a Fabric 2.x network if the new lifecycle has not been enabled.

      ```yaml
      contracts:
      - id: marbles
        contractID: myMarbles
        install:
          version: v0
          language: golang
          path: marbles/go
          metadataPath: src/marbles/go/metadata
      ```
      *  <details><summary markdown="span">__version__
         </summary>
         _Required. Non-empty string._ <br>
         The version string of the contract.
 
         ```yaml
         channels:
           mychannel:
             contracts:
               install:
                 version: v1.0
                 # other properties
         ```
         </details>

      *  <details><summary markdown="span">__language__
         </summary>
         _Optional. Non-empty string._ <br>
         Denotes the language of the contract. Currently supported values: `golang`, `node` and `java`.

         ```yaml
         channels:
           mychannel:
             contracts:
               install:
                 language: node
                 # other properties
         ```
         </details>

      *  <details><summary markdown="span">__path__
         </summary>
         _Optional. Non-empty string._ <br>
         The path to the contract directory. For golang contracts, it is the fully qualified package name (relative to the `GOPATH/src` directory). Note, that `GOPATH` is temporarily set to the workspace directory by default. To disable this behavior, set the `caliper-fabric-overwritegopath` setting key to `false`.

         ```yaml
         channels:
           mychannel:
             contracts:
               install:
                 path: contracts/mycontract
                 # other properties
         ```
         </details>

      *  <details><summary markdown="span">__metadataPath__
         </summary>
         _Optional. Non-empty string._ <br>
         The directory path for additional metadata for the contract (like CouchDB indexes). Only supported since Fabric v1.1.

         ```yaml
         channels:
           mychannel:
             contracts:
               install:
                 metadataPath: contracts/mycontract/metadata
                 # other properties
         ```
         </details>
      </details>

   *  <details><summary markdown="span">__instantiate__
      </summary>
      _Optional. Non-empty object._ <br>
      Defines the optional parameters to provided during the instantiate phase. This section does not control whether the contact (chaincode) is instantiated or not it just provides the capability to provide optional instantiation parameters. This can only be used with a 1.4 SUT and can only be used against a Fabric 2.x network if the new lifecycle has not been enabled.

      ```yaml
      contracts:
        - id: marbles
          contractID: myMarbles
          # define the install requirements to install chaincode if chaincode is to be installed
          install:
            version: v0
            language: golang
            path: marbles/go
            metadataPath: src/marbles/go/metadata
          # define the instantiate requirements to instantiate chaincode all of this section is optional depending on chaincode requirements
          instantiate:
            initFunction: init
            initArguments: []
            initTransientMap:
              key1: value1
              key2: value2
            endorsementPolicy: ''
            collectionsConfig: ''      
      ```
      *  <details><summary markdown="span">__initArguments__
         </summary>
         _Optional. Non-sparse array of strings._ <br>
         The list of string arguments to pass to the contract's `Init` function during instantiation. Defaults to an empty array if not specified

         ```yaml
         instantiate:
           initArguments: ['arg1', 'arg2']
           # other properties
         ```
         </details>

      *  <details><summary markdown="span">__initFunction__
         </summary>
         _Optional. String._ <br>
         The function name to pass to the contract's `Init` function during instantiation. Defaults to `init` if not specified

         ```yaml
         instantiate:
           initFunction: 'bootstrap'
           # other properties
         ```
         </details>

      *  <details><summary markdown="span">__initTransientMap__
         </summary>
         _Optional. Object containing string keys associated with string values._ <br>
         The transient key-value map to pass to the `Init` function when instantiating a contract. The adapter encodes the values as byte arrays before sending them.

         ```yaml
         instantiate:
           initTransientMap:
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

      *  <details><summary markdown="span">__collectionsConfig__
         </summary>
         _Optional. Non-empty, non-sparse array of objects._ <br>
         List of private collection definitions for the contract or a path to the JSON file containing the definitions. For details about the content of such definitions, refer to the [SDK page](https://fabric-sdk-node.github.io/release-1.4/tutorial-private-data.html).

         ```yaml
         instantiate:
           collectionsConfig:
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

      *  <details><summary markdown="span">__endorsementPolicy__
         </summary>
         _Optional. Object._ <br>
         The endorsement policy of the contract as required by the Fabric Node.js SDK. If omitted, then a default N-of-N policy is used based on the target peers (thus organizations) of the contract.

         ```yaml
         instantiate:
           endorsementPolicy:
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
      </details>
   </details>
</details>

## Network Configuration Example

The following example is a Fabric network configuration for the following network topology and artifacts:
* two organizations `Org1MSP` and `Org2MSP`
* one channel named `mychannel` 
* `marbles@v0` contract installed and instantiated in `mychannel` on every peer;
* the nodes of the network use TLS communication, but not mutual TLS;
* the local network is deployed and cleaned up automatically by Caliper.

```yaml
name: Fabric
version: "2.0.0"

caliper:
  blockchain: fabric
  sutOptions:
    mutualTls: false
  command:
    start: docker-compose -f network/fabric-v1.1/2org2peergoleveldb/docker-compose-tls.yaml up -d;sleep 3s
    end: docker-compose -f network/fabric-v1.1/2org2peergoleveldb/docker-compose-tls.yaml down;docker rm $(docker ps -aq);docker rmi $(docker images dev* -q)

info:
  Version: 1.1.0
  Size: 2 Orgs
  Orderer: Raft
  Distribution: Single Host
  StateDB: GoLevelDB

channels:
  - channelName: mychannel
    create:
      buildTransaction:
        capabilities: []
        consortium: 'SampleConsortium'
        msps: ['Org1MSP', 'Org2MSP']
        version: 0
    # Array of contracts to be installed/instantiated on the named channel and available for use by the workload module
    contracts:
    - id: marbles
      contractID: myMarbles
      install:
        version: v0
        language: golang
        path: marbles/go
        metadataPath: src/marbles/go/metadata
      instantiate:
        initFunction: init
        initArguments: []
        endorsementPolicy:
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
  - mspid: Org1MSP
    identities:
      certificates:
      - name: 'admin.org1.example.com'
        admin: true
        clientPrivateKey:
          pem: |-
            -----BEGIN PRIVATE KEY-----
            ...
            -----END PRIVATE KEY-----
        clientSignedCert:
          pem: |-
            -----BEGIN CERTIFICATE-----
            ...
            -----END CERTIFICATE-----
    connectionProfile:
      path: './Org1ConnectionProfile.yaml'
      discover: true
  - mspid: Org2MSP
    connectionProfile:
    identities:
      certificates:
      - name: 'admin.org2.example.com'
        admin: true      
        clientPrivateKey:
          pem: |-
            -----BEGIN PRIVATE KEY-----
            ...
            -----END PRIVATE KEY-----
        clientSignedCert:
          pem: |-
            -----BEGIN CERTIFICATE-----
            ...
            -----END CERTIFICATE-----
      path: './Org2ConnectionProfile.json'
      discover: true

```

## License
The Caliper codebase is released under the [Apache 2.0 license](./LICENSE.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.
