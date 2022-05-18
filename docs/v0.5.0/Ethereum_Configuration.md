---
layout: v0.5.0
title:  "Ethereum"
categories: config
permalink: /v0.5.0/ethereum-config/
order: 2
---

This page introduces the Ethereum adapter suitable for all the Ethereum clients that expose the web3 RPC interface over websockets.

> This adapter relies on web3js 1.2.x that is the stable version coming from 1.0.0-beta.37

> Hyperledger Besu and Geth are the current tested clients. The tests are driven via standard Ethereum JSON-RPC APIs so other clients should be compatible once docker configurations exist.

> Hyperledger Besu does not provide wallet services, so the `contractDeployerPassword` and `fromAddressPassword` options are not supported and the private key variants must be used.

> Some highlights of the provided features:
> * configurable confirmation blocks threshold

The page covers the following aspects of using the Ethereum adapter:
* how to [assemble a connection profile file](#assembling-the-network-configuration-file), a.k.a., the blockchain network configuration file;
* how to [use the adapter interface](#using-the-adapter-interface) from the user callback module;
* [transaction data gathered](#transaction-data-gathered-by-the-adapter) by the adapter;
* and a [complete example](#connection-profile-example) of a connection profile.

# Assembling the Network Configuration File

The JSON network configuration file of the adapter essentially defines which contract are expected to be on the network and which account the adapter should use to deploy the pointed contracts and which account use to invoke them. Contract necessary for the benchmark are automatically deployed at benchmark startup while the special `registry` contract needs to be already deployed on the network. ABI and bytecode of the registry contract are reported in the src/contract/ethereum/registry/registry.json.

## Connection profile example
We will provide an example of the configuration and then we'll in deep key by key

```json
{
    "caliper": {
        "blockchain": "ethereum",
        "command" : {
            "start": "docker-compose -f network/ethereum/1node-clique/docker-compose.yml up -d && sleep 3",
            "end" : "docker-compose -f network/ethereum/1node-clique/docker-compose.yml down"
          }
    },
    "ethereum": {
        "url": "ws://localhost:8545",
        "contractDeployerAddress": "0xc0A8e4D217eB85b812aeb1226fAb6F588943C2C2",
        "contractDeployerAddressPassword": "password",
        "fromAddress": "0xc0A8e4D217eB85b812aeb1226fAb6F588943C2C2",
        "fromAddressPassword": "password",
        "transactionConfirmationBlocks": 12,
        "contracts": {
            "simple": {
                "path": "src/contract/ethereum/simple/simple.json",
                "gas": {
                    "open": 45000,
                    "query": 100000,
                    "transfer": 70000
                }
            }
        }
    }
}
```

The top-level `caliper` attribute specifies the type of the blockchain platform, so Caliper can instantiate the appropriate adapter when it starts. To use this adapter, specify the `ethereum` value for the `blockchain` attribute.

Furthermore, it also contains two optional commands: a `start` command to execute once before the tests and an `end` command to execute once after the tests. Using these commands is an easy way, for example, to automatically start and stop a test network. When connecting to an already deployed network, you can omit these commands.

These are the keys to provide inside the configuration file under the `ethereum` one:
* [URL](#url) of the RPC endpoint to connect to. Only websocket is currently supported.
* [Deployer address](#deployer-address) with which deploy required contracts
* [Deployer address private key](#deployer-address-private-key) the private key of the deployer address
* [Deployer address password](#deployer-address-password) to unlock the deployer address
* [Address](#benchmark-address) from which invoke methods of the benchmark
* [Private Key](#benchmark-address-private-key) the private key of the benchmark address
* [Password](#benchmark-address-password) to unlock the benchmark address
* Number of [confirmation blocks](#confirmation-blocks) to wait to consider a transaction as successfully accepted in the chain
* [Contracts configuration](#contract-configuration)

The following sections detail each part separately. For a complete example, please refer to the [example section](#connection-profile-example) or one of the example files in the `network/ethereum` directories

## URL

The URL of the node to connect to. Any host and port can be used if it is reachable. Currently only websocket is supported.

```json
"url": "ws://localhost:8545"
```

Unfortunately, HTTP connections are explicitly disallowed, as

1. there is no efficient way to guarantee the order of transactions submitted over http, which leads to nonce errors, and
2. this adapter relies on web3.js, and this library has deprecated its support for RPC over HTTP.

## Deployer address

The address to use to deploy contracts of the network. Without particular or specific needs it can be set to be equal to the [benchmark address](#benchmark-address). Its private key must be hold by the node connected with [URL](#url) and it must be provided in the checksum form (the one with both lowercase and uppercase letters).

```json
"contractDeployerAddress": "0xc0A8e4D217eB85b812aeb1226fAb6F588943C2C2"
```

## Deployer address private key

The private key for the [deployer address](#deployer-address). If present then transactions are signed inside caliper and sent "raw" to the ethereum node.

```json
"contractDeployerAddressPrivateKey": "0x45a915e4d060149eb4365960e6a7a45f334393093061116b197e3240065ff2d8"
```

## Deployer address password

The password to use to unlock [deployer address](#deployer-address). If there isn't an unlock password, this key must be present as empty string. If the deployer address private key is present this is not used.

```json
"contractDeployerAddressPassword": "gottacatchemall"
```

## Benchmark address

The address to use while invoking all the methods of the benchmark. Its private key must be hold by the node connected with [URL](#url) and it must be provided in the checksum form (the one with both lowercase and uppercase letters).

```json
"fromAddress": "0xc0A8e4D217eB85b812aeb1226fAb6F588943C2C2"
```

## Benchmark address seed

As an alternative to `fromAddress`, `fromAddressPrivateKey`, and `fromAddressPassword` the network configuration can use a fixed seed and derive needed addresses via [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) key derivation.  Each caliper test worker will generate an address for use as `fromAddress` and `fromAddressPrivateKey` using the derivation path `m/44'/60'/<x>'/0/0`, where <x> is the `clientIdx` passed into `getContext`.

This configuration does not override `fromAddress`, but it takes priority over `fromAddressPrivateKey` and `fromAddressPassword`.

```json
"fromAddressSeed": "0x3f841bf589fdf83a521e55d51afddc34fa65351161eead24f064855fc29c9580"
```

## Benchmark address private key

The private key for the [benchmark address](#benchmark-address). If present then transactions are signed inside caliper and sent "raw" to the ethereum node.

This configuration takes priority over `fromAddressPassword`.

```json
"fromAddressPrivateKey": "0x45a915e4d060149eb4365960e6a7a45f334393093061116b197e3240065ff2d8"
```

## Benchmark address password

The password to use to unlock [benchmark address](#benchmark-address). If there isn't an unlock password, this key must be present as empty string. If the benchmark address private key is present this is not used.

```json
"fromAddressPassword": "gottacatchemall"
```

## Confirmation blocks

It is the number of blocks the adapter will wait before warn Caliper that a transaction has been successfully executed on the network. You can freely tune it from 1 to the desired confirmations. Keep in mind that in the Ethereum main net (PoW), 12 to 20 confirmations can be required to consider a transaction as accepted in the blockchain. If you're using different consensus algorith (like clique in the example network provided) it can be safely brought to a lower value. In any case it is up to you.

```json
"transactionConfirmationBlocks": 12
```

## Contract configuration
It is the list, provided as a json object, of contracts to deploy on the network before running the benchmark. You should provide a json entry for each contract; the key will represent the contract identifier to invoke methods on that contract.

For each key you must provide a JSON object with the `path` field pointing to the [contract definition file](#contract-definition-file).

It is also strongly recommended to specify a `gas` field, which is an object with one field per contract function that you will call in your test. The value of these fields should be set to the amount of gas that will be required to execute your transaction. There is no need for this number to be an exact match, as it's used to set the gas limit for the transaction, so if your transaction might have a variable gas cost, just set this value to the highest gas usage that you would expect to see for your transaction.

**Note**: If you do not specify the gas for your contract functions, web3 will automatically call out to your node to estimate the gas requirement before submitting the transaction. This causes three problems. First, it means that your transaction will effectively execute twice, doubling the load on the node serving as your RPC endpoint. Second, the extra call will add significant additional latency to every transaction. Third, your transactions may be reordered, causing transaction failures due to out of order nonces.

```json
"contracts": {
    "simple": {
        "path": "src/contract/ethereum/simple/simple.json",
        "gas": {
            "open": 45000,
            "query": 100000,
            "transfer": 70000
        }
    },
    "second": {
        "path": "src/contract/ethereum/second/second.json",
        "gas": {
            "function": 12345
        }
    }
}
```

## Contract definition file
Contract definition file is a simple JSON file containing basic information to deploy and use an Ethereum contract. Four keys are required:
* [Name](#name)
* [ABI](#abi)
* [Byetcode](#bytecode)
* [Gas](#gas)

Here is an example:
```json
{
    "name": "The simplest workload contract",
    "abi": [{"constant":true,"inputs":[{"nam......ype":"function"}],
    "bytecode": "0x608060405.........b0029",
    "gas": 259823
}
```

### Name
It is a name to display in logs when the contract gets deployed. It is only a description name.

### ABI
It is the ABI generated when compiling the contract. It is required in order to invoke methods on a contract.

### Bytecode
It is the bytecode generated when compiling the contract. Note that since it is an hexadecimal it must start with the `0x`.

### Gas
It is the gas required to deploy the contract. It can be easily calculated with widely used solidity development kits or querying to a running Ethereum node.

# Using the Adapter Interface

The [workload modules](./Workload_Module.md) interact with the adapter at two phases of the tests: during the initialization of the workload module (the `initializeWorkloadModule` function), and when submitting invoke or query transactions (the `submitTransaction` function).

## The _initializeWorkloadModule_ function

See the [corresponding documentation](./Workload_Module.md#initializeworkloadmodule) of the function for the description of its parameters.

The last argument of the function is a `sutContext` object, which is a platform-specific object provided by the backend blockchain's connector. The context object provided by this connector is the following:

```mson
{
  fromAddress: "0xA89....7G"
  web3: Web3
}
```

The `fromAddress` property is the [benchmark address](#benchmark-address) while web3 is the configured instance of the Web3js client.


## The _submitTransaction_ function

The `sutAdapter` object received (and saved) in the `initializeWorkloadModule` function is of type [`ConnectorInterface`](https://github.com/hyperledger/caliper/blob/v0.5.0/packages/caliper-core/lib/common/core/connector-interface.js). Its `getType()` function returns the `fabric` string value.

The `sendRequests` method of the connector API allows the workload module to submit requests to the SUT. It takes a single parameter: an object or array of objects containing the settings of the requests.

The settings object has the following structure:
* `contract`: _string. Required._ The ID of the contract (that is the key specified [here](#contract-configuration)).
* `readOnly`: _boolean. Optional._ Indicates whether the request is a TX or a query. Defaults to `false`.
* `verb`: _string. Required._ The name of the function to call on the contract.
* `value`: _number. Optional._ The value parameter in Wei to be passed to the payable function of the contract.
* `args`: _mixed[]. Optional._ The list of arguments to pass to the method in the correct order as they appear in method signature. It must be an array.

```js
let requestsSettings = [{
    contract: 'simple',
    verb: 'open',
    value: 1000000000000000000000,
    args: ['sfogliatella', 1000]
},{
    contract: 'simple',
    verb: 'open',
    value: 900000000000000000000,
    args: ['baba', 900]
}];

await this.sutAdapter.sendRequests(requestsSettings);
```

Currently each method call inside `sendRequests` is sent separately, that is, they are NOT sent as a batch of calls on RPC.

To query a state on a contract state, set the `readOnly` attribute to `true`. The difference is that it can't produce any change on the blockchain and node will answer with its local view of data. Like for traditional requests, currently there is no support for batch queries.

---

# Transaction Data Gathered by the Adapter

The previously discussed  `invokeSmartContract` and `queryState` functions return an array whose elements correspond to the result of the submitted request(s) with the type of [TxStatus](https://github.com/hyperledger/caliper/blob/v0.5.0/packages/caliper-core/lib/transaction-status.js). The class provides some standard and platform-specific information about its corresponding transaction.

The standard information provided by the type are the following:
* `GetID():string` returns the transaction ID for `invokeSmartContract`, `null` for `queryState` and `querySmartContract`.
* `GetStatus():string` returns the final status of the transaction, either `success` or `failed`.
* `GetTimeCreate():number` returns the epoch when the transaction was submitted.
* `GetTimeFinal():number` return the epoch when the transaction was finished.
* `IsVerified():boolean` indicates whether we are sure about the final status of the transaction. Always true for successful transactions. False in all other cases.

## License
The Caliper codebase is released under the [Apache 2.0 license](./LICENSE.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.
