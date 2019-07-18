---
layout: page
title:  "Getting Started"
categories: docs
order: 1
---

## Caliper Introduction

Caliper is a blockchain performance benchmark framework, which allows users to test different blockchain solutions with predefined use cases, and get a set of performance test results.

**Currently supported blockchain solutions:**
* [Hyperledger Burrow](https://github.com/hyperledger/burrow)
* [Hyperledger Composer](https://github.com/hyperledger/composer)
* [Hyperledger Fabric](https://github.com/hyperledger/fabric)
* [Hyperledger Iroha](https://github.com/hyperledger/iroha)
* [Hyperledger Sawtooth](https://github.com/hyperledger/sawtooth-core)

<br>

**Currently supported performance indicators:**
* Success rate
* Transaction/Read throughput
* Transaction/Read latency(minimum, maximum, average, percentile)
* Resource consumption (CPU, Memory, Network IO,...)

See [PSWG](https://wiki.hyperledger.org/groups/pswg/performance-and-scale-wg) to find out the definitions and corresponding measurement methods.  

## Achitecture
See [Architecture Introduction]({{ site.baseurl }}{% link docs/2_Architecture.md %}).

## Pre-requisites

Make sure following tools are installed
* NodeJS 8 (LTS), 9, or 10 (LTS) *we do not support higher versions as the dependancy chain does not permit this*
* node-gyp
* Docker
* Docker-compose

### Building Caliper

Caliper is split into packages that are managed by Lerna, a tool for managing JavaScript projects with multiple packages. To build Caliper, it is necessary to first pull the required base dependancies, and then bootstrap the Caliper project. Note that if you modify any base code, it is necessary to rebuild the project

- Run `npm install` in Caliper root folder to install base dependencies locally
- Run `npm run repoclean` in Caliper root folder to ensure that all the packages are clean
- Run `npm run bootstrap` to bootstrap the packages in the Caliper repository. This will install all package dependancies and link any cross dependancies. It will take some time to finish installation. If it is interrupted by `ctrl+c`, please recover the file `package.json` first and then run `npm run bootstrap` again.

Do not run any of the above commands with `sudo`, as it will cause the bootstrap process to fail

Steps for configuring a benchmark that targets a supported blockchain technology are given in the following links:

- [Burrow]({{ site.baseurl }}{% link docs/Burrow_Configuration.md %})
- [Composer]({{ site.baseurl }}{% link docs/Composer_Configuration.md %})
- [Fabric]({{ site.baseurl }}{% link docs/Fabric_Configuration.md %})
- [Fabric CCP]({{ site.baseurl }}{% link docs/Fabric_Ccp_Configuration.md %})
- [Iroha]({{ site.baseurl }}{% link docs/Iroha_Configuration.md %})
- [Sawtooth]({{ site.baseurl }}{% link docs/Sawtooth_Configuration.md %})

## Running a Benchmark

Benchmarks may be run using the Caliper command line interface. We are preparing to publish Caliper packages to npm, though our build process includes an integration test that publishes all Caliper modules to a proxy npm server, and then globally installs the CLI package from this server. We advise using the Caliper test utility to obtain the Caliper CLI.

### Install the Caliper CLI

We have not yet published Caliper to npm, however the Caliper CLI may be obtained via our test scripts located in `<CaliperRoot>/packages/caliper-tests-integration`.

Steps:
 1. If you have not already built the Caliper project, outlined in the section above, please do so.
 2. Follow the described steps in the [integration package readme](https://github.com/hyperledger/caliper/blob/master/packages/caliper-tests-integration/README.md).

The current Caliper packages are set to support the following adaptor client libraries:
 - Burrow: @monax/burrow@0.23.0
 - Composer: composer@0.20.8
 - Fabric: fabric-client@1.4.0
 - Iroha: iroha-helpers@0.6.3
 - Sawtooth: sawtooth-sdk@1.0.5

If you need to run a benchmark using an adaptor with an alternative client dependancy to the above, it will be necessary to modify the respective package.json file and then rebuild the Caliper project prior to publishing and installing it again locally. A known compatibility list is provided below.
 
#### Compatibility List:
 
 | DLT | Client Compatibility |
 | :-- | :------------------ |
 |Fabric v1.0 | grpc@1.10.1 fabric-ca-client@1.1.0 fabric-client@1.1.0 |
 |Fabric v1.1 | grpc@1.10.1 fabric-ca-client@1.1.0 fabric-client@1.1.0 |
 |Fabric v1.2 | fabric-ca-client@1.4.0 fabric-client@1.4.0 fabric-network@1.4.0 |
 |Fabric v1.3 | fabric-ca-client@1.4.0 fabric-client@1.4.0 fabric-network@1.4.0 |
 |Fabric v1.4 | fabric-ca-client@1.4.0 fabric-client@1.4.0 fabric-network@1.4.0 |


For instance, if you wish to test Hyperledger Fabric v1.1, it will be necessary to modify the `caliper-fabric-ccp` adaptor to use `grpc@1.10.1, fabric-ca-client@1.1.0, fabric-client@1.1.0`.

> Note:
> When the Caliper packages are published to npm, we will be publishing versions for the above compatibility requirements and will update the compatibility table with published Caliper versions that you will be able to obtain using `npm install -g caliper-<package>@<version>`

### Run a Sample Benchmark 

All predefined benchmarks can be found in the [*benchmark*](https://github.com/hyperledger/caliper/tree/master/packages/caliper-samples/benchmark/) folder. The Caliper CLI has the notion of a workspace, which contains your 
benchmark configuration and test files.

Benchmarks may be run using the Caliper CLI command

```bash
caliper benchmark run -w <path to workspace> -c <benchmark config> -n <blockchain config>
```
* -w : path to a workspace directory (required)
* -c : relative path from the workspace to the benchmark configuration file (required).
* -n : relative path from the workspace to the config file of the blockchain network under test (required).

Assuming you are in the root caliper directory, the following command will run a test using the material from a Caliper sample:

```bash
caliper benchmark run -w ./packages/caliper-samples -c benchmark/simple/config.yaml -n network/fabric-v1.4/2org1peercouchdb/fabric-ccp-node.yaml
```

The files present in the `caliper-samples` directory may be modified or added to, in order to perform the desired benchmark. Before adding a benchmark, please inspect the example benchmark content and structure; you will need to add your own configuration files for the blockchain system under test, the benchmark configuration, smart contracts, and test files (callbacks) that interact with the deployed smart contract.


## Run Benchmark with Distributed Clients (Experimental)

In this way, multiple clients can be launched on distributed hosts to run the same benchmark.

1. Start the ZooKeeper service using the Caliper CLI: 
```bash
caliper zooservice start
```
2. Launch a caliper-zoo-client on each target machine using the Caliper CLI:
```bash
caliper zooclient start -w ~/myCaliperProject -a <host-address>:<port>  -n my-sut-config.yaml
```

3. Modify the client type setting in configuration file to 'zookeeper'.

    Example:
    ```
    "clients": {
      "type": "zookeeper",
      "zoo" : {
        "server": "10.229.42.159:2181",
        "clientsPerHost": 5
      }
    }
    ```

4. Launch the benchmark on any machine as usual.

> Note:
> * Zookeeper is used to register clients and exchange messages. A launched client will add a new znode under /caliper/clients/. The benchmark checks the directory to learn how many clients are there, and assign tasks to each client according to the workload.
> * There is no automatic time synchronization between the clients. You should manually synchronize time between target machines, for example using 'ntpdate'.
> * The blockchain configuration file must exist on machines which run the client, and the relative path (relative to the caliper folder) of the file must be identical. All referenced files in the configuration must also exist.   

## How to Contribute

See [Contributing]({{ site.baseurl }}{% link docs/CONTRIBUTING.md %})

## License
The Caliper codebase is release under the [Apache 2.0 license]({{ site.baseurl }}{% link docs/LICENSE.md %}). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.
