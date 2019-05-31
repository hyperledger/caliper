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

Caliper is split into pacakges that are managed by Lerna, a tool for managing JavaScript projects with multiple packages. To build Caliper, it is necessary to first pull the required base dependancies, and then bootstrap the Caliper project. Note that if you modify base code, it is necessary to rebuild the project

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

## Run Benchmark

All predefined benchmarks can be found in [*benchmark*](https://github.com/hyperledger/caliper/tree/master/packages/caliper-application/benchmark/) folder.
To start your first benchmark, just run this from the folder `packages/caliper-application/scripts`:
```bash
node run-benchmark.js -c yourconfig -n yournetwork
```
* -c : specify the config file of the benchmark (required).
* -n : specify the config file of the blockchain network under test (required).

When running benchmarks, the errors like 'not find modules' occur. Please running `npm rebuild` from the root folder.

Some example SUTs are provided in [*network*](https://github.com/hyperledger/caliper/tree/master/packages/caliper-application/network) folder, they can be launched automatically before the test by setting the bootstrap commands in the configuration file, e.g.
```json
{
  "command" : {
    "start": "docker-compose -f network/fabric-v1.1/dev/docker-compose.yaml up -d",
    "end" : "docker-compose -f network/fabric-v1.1/dev/docker-compose.yaml down;docker rm $(docker ps -aq)"
  }
}
```
The scripts defined in *command.start* will be called before the test, and the scripts defined in *command.end* will be called after the finish of all tests. You can use them to define any preparation or clean-up works.  

You can also run the test with your own blockchain network, a network configuration should be provided and corresponding file path should be specified in  configuration file's *blockchain.config*.

> Note:
> * When running the benchmark, one or more blockchain clients will be used to generate and submit transactions to the SUT. The number of launched clients as well as testing workload can be defined using the [configuration file]({{ site.baseurl }}{% link docs/2_Architecture.md %}).  
> * A HTML report will be generated automatically after the testing.

### Alternative

You can also use npm scripts to run a benchmark.
* npm run list: list all available benchmarks

```bash
$ npm run list

> caliper@0.1.0 list /home/hurf/caliper
> node ./scripts/list.js

Available benchmarks:
drm
simple
```

## Run Benchmark with Distributed Clients (Experimental)

In this way, multiple clients can be launched on distributed hosts to run the same benchmark.

1. Start the ZooKeeper service: run `node zoo-service.js -t start` from the folder `packages/caliper-application/scripts`.
2. Launch a `caliper-zoo-client` on each target machine. This may be done via the `caliper-application` sample  by running `node start-zoo-client.js -n <network config> -a <zookeeper service address>`. Time synchronization between target machines should be executed before launching the clients.

    Example:
    ```bash
    > cd ~/github/caliper/packages/caliper-application/scripts
    > node start-zoo-client.js -t fabric -n ../network/fabric-v1.4/2org1peercouchdb/fabric-node.json -a "10.229.42.159:2181"

    Connected to ZooKeeper
    Created client node:/caliper/clients/client_1514532063571_0000000006
    Created receiving queue at:/caliper/client_1514532063571_0000000006_in
    Created sending queue at:/caliper/client_1514532063571_0000000006_out
    Waiting for messages at:/caliper/client_1514532063571_0000000006_in......
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
