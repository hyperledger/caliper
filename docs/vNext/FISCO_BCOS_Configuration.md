---
layout: vNext
title:  "FISCO BCOS Configuration"
categories: config
permalink: /vNext/fisco-config/
---

>*The required minimal version of FISCO BCOS is v2.0.0*

This page introduces the FISCO BCOS adapter that may be used by Caliper. For general information on FISCO BCOS, please refer to their [documenation pages](https://fisco-bcos-documentation.readthedocs.io/en/latest).

### Node Configuration

A FISCO BCOS node uses several configuration files to control the network settings and certificates for connecting verification, which are described below:

*\*we refer the root directory of node as `node/`*

| Name | Location | Function |
| :--- | :---- | :---- |
| config.ini | `node/` | `ini` format, contains network ports (PRC, P2P and channel), black list of nodes, path of data and certificates, etc.
| group.***n***.genesis | `node/conf/` | `ini` format, the ***fixed configuration*** of group ***n***'s genesis block. FISCO BCOS support running several uncorrelated groups on the same set of nodes, you can get more information about concept "group" from [introduction of group architecture](https://fisco-bcos-documentation.readthedocs.io/en/latest/docs/design/architecture/group.html). The configuration contains the type of consensus algorithm,  ID of initial nodes, etc.|
| group.***n***.ini | `node/conf/` | `ini` format, the ***changeable configuration*** of group ***n***,  includes parameters of consensus module and storage module, configuration for features, etc. |
| node.key | `node/conf/` | `PEM` format, the private key used to connect to other nodes via SSL/TLS, using ECDSA-secp256k1. |
| node.crt | `node/conf/` | the certificate used in SSL/TLS connection between nodes. |
| ca.crt | `node/conf/` | the root certificate used in SSL/TLS connection between nodes. The ca.crt is used to verify whether the cerficate of peer node is correct or not. |

More detail information about configuration files and configuration items please refer [Configuration files and configuration items](https://fisco-bcos-documentation.readthedocs.io/en/latest/docs/manual/configuration.html).

### Network Configuration

This JSON-format configuration file describes how the nodes interact with each other in network and which smart contracts is used by a benchmark. It has the following top-level attributes.

- `caliper`, specifying the platform type for Caliper.
- `fisco-bcos`, specifying the network configuration for Caliper.
- `info`, specifying the customized content for the generated report.

The details of those sections will be described below.

#### caliper

*Caliper-specific.*

`caliper` attribute specifies the platform type for Caliper to instantiate the appropriate adapter. To test FISCO BCOS network, specify the `fisco-bcos` value for the `blockchain` attribute.

It also contains two optional command attributes: a `start` command that executes once before all the tests and an `end` command that executes once after all the tests. It is easy to use these commands start and stop a test network for benchmarking. When benchmarking a deployed network, you can omit these commands.

``` JSON
"caliper": {
    "blockchain": "fisco-bcos",
    "command": {
        "start": "docker-compose -f network/fisco-bcos/4nodes1group/docker-compose.yaml up -d; sleep 3s",
        "end": "docker-compose -f network/fisco-bcos/4nodes1group/docker-compose.yaml down"
    }
}
```

In the configuration example above, `start` command is specified to launch four FISCO BCOS nodes via docker-compose, and the `end` command is specified to shut them down.

#### fisco-bcos

`fisco-bcos` attribute indicates how the adapter interact with the network of SUT. It contains following child attributes:

- `config`, when FISCO BCOS adapter interact with nodes, it will be asked to show its identity, and all necessary information should be provided in adapter's `fisco-bcos.config` configuration. The configuration includes the following attributes:
  - `privateKey`, is used to sign transactions to confer them legitimacy. Private key is a large random number generated from third-party tools such as OpenSSL. In our simplified configuration example, a pre-defined and static private key is used to launch tests.
  - `account`, is calculated from `privateKey`, to point out the sender of a transaction. Similarly, we use a pre-defined account value in the adapter.

```JSON
"config": {
    "privateKey": "bcec428d5205abe0f0cc8a734083908d9eb8563e31f943d760786edf42ad67dd",
    "account": "0x64fa644d2a694681bd6addd6c5e36cccd8dcdde3"
}
```

- `network`: specifies the network information of nodes in the SUT. For simplicity, only sealer nodes (the node who is responsible for processing transactions and producing new blocks) can be specified now, which includes the following attributes:
  - `nodes`: a list of endpoints of the nodes. For each endpoint, the following child attributes are required. `ip` attribute is used to tell adapter the IP address of a peer node. `rpcPort` is the port of RPC service offered by the node. RPC service is used to send read-only request for better response speed, like getting block height. `channelPort`is the port of channel service offered by the node. Channel service is based on TLS (Transport Layer Security) protocol and is used to send the transactions that will be recorded by the blockchain, for stability and accurate performance statistics.
  - `authentication`, a set of certificates to use channel service of FISCO BCOS node, it includes file paths of private key, certificate and CA (Certificate Authorities) root certificate of the node.
  - `timeout`: the max waiting time before a node returns a transaction receipt back to adapter. A transaction receipt is the proof of that this transaction had been processed. But on some occasions, some nodes may not work well and stop responding to the requests. To avoid the adapter from infinite waiting, the value of `timeout` is necessary to be set. The unit of `timeout` is millisecond.
  - `groupID`:  FISCO BCOS allows several independent group running simultaneously on the same set of nodes. This attribute specifies which group to test for a benchmark.

```JSON
"network": {
    "nodes": [
        {
            "ip": "127.0.0.1",
            "rpcPort": "8914",
            "channelPort": "20914"
        },
        {
            "ip": "127.0.0.1",
            "rpcPort": "8915",
            "channelPort": "20915"
        },
        {
            "ip": "127.0.0.1",
            "rpcPort": "8916",
            "channelPort": "20916"
        },
        {
            "ip": "127.0.0.1",
            "rpcPort": "8917",
            "channelPort": "20917"
        }
    ],
    "authentication": {
        "key": "/path/to/adapter/private/key",
        "cert": "/path/to/adapter/certificate",
        "ca": "/path/to/CA/certificate"
    },
    "groupID": 1,
    "timeout": 100000
}
```

In the example above, there are four nodes in the topology of network, whose actual RPC service port and channel service port can be found in nodes' configuration. Certificate files included in `authentication` is used for [channel](https://fisco-bcos-documentation.readthedocs.io/en/latest/docs/design/protocol_description.html#network-transmission-protocol) connection and they are alway be produced during the process of FISCO BCOS chain's building. The introduction to those certificate files can be found in can be found in [Node file organization](https://fisco-bcos-documentation.readthedocs.io/en/latest/docs/manual/build_chain.html#node-file-organization). During the test, the benchmark will be run on `group` 1, and the `timeout` time for nodes to return a receipt is 100 seconds (100,000 milliseconds).

- `smartContracts`, a list of smart contracts used by the benchmark:
  - `id`, the unique ID of a smart contract.
  - `language`,  if the smart contract is implemented by Solidity, the value of this attribute should be `solidity`. If it is a FISCO BCOS precompiled contract, the value of this attribute should be `precompiled`.
  - `path`, if the smart contract is implemented by Solidity, this attribute need to be set to the Solidity code file's path, otherwise this attribute is not used.
  - `address`, if the smart contract is a FISCO BCOS precompiled contract, this attribute should be set to the preset address of the contract, otherwise this attribute is not used.
  - `version`, the version of the smart contract

```JSON
"smartContracts": [
    {
        "id": "helloworld",
        "path": "src/contract/fisco-bcos/helloworld/HelloWorld.sol",
        "language": "solidity",
        "version": "v0"
    },
    {
        "id": "parallelok",
        "path": "src/contract/fisco-bcos/transfer/ParallelOk.sol",
        "language": "solidity",
        "version": "v0"
    },
    {
        "id": "dagtransfer",
        "address": "0x0000000000000000000000000000000000005002",
        "language": "precompiled",
        "version": "v0"
    }
]
```

In the example above, there are three smart contracts need to be deployed on the blockchain. The first two are implemented by Solidity and their source code can be found in `src/contract/fisco-bcos/` directory. The last one is a FISCO BCOS precompiled contract, its source code can be found [here](https://github.com/FISCO-BCOS/FISCO-BCOS/blob/master/libprecompiled/extension/DagTransferPrecompiled.cpp).

#### info

This attribute specifies custom key-value pairs that will be included in the generated report. For example:

```JSON
"info": {
    "Version": "2.0.0",
    "Size": "4 Nodes",
    "Distribution": "Single Host"
}
```

### Running your own benchmark test instance

To run your own benchmarks on your own network topology, you should:

- Deploy you own FISCO BCOS network. To complete this step, please follow the instructions in [installation tutorial](https://fisco-bcos-documentation.readthedocs.io/en/latest/docs/installation.html).
- Add a new network configuration file.
- Create a test script that includes an `init`, `run` and `end` phase.
- Add the new test script to the test config file as a test round, making sure that the correct callback for Caliper is specified.

## License
The Caliper codebase is released under the [Apache 2.0 license](./LICENSE.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.
