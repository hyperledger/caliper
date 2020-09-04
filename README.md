# ![Hyperledger Caliper](https://wiki.hyperledger.org/download/attachments/2392434/Hyperledger_Caliper_Logo_Color.svg?version=1&modificationDate=1548883186000&api=v2)

[![Build Status](https://travis-ci.com/hyperledger/caliper.svg?branch=master)](https://travis-ci.com/hyperledger/caliper)
[![CII Best Practices](https://bestpractices.coreinfrastructure.org/projects/2381/badge)](https://bestpractices.coreinfrastructure.org/projects/2381)
[![license](https://img.shields.io/badge/license-Apache%202.0-blue)](https://github.com/aklenik/caliper/blob/master/LICENSE)
[![node (scoped)](https://img.shields.io/node/v/@hyperledger/caliper-cli)](https://www.npmjs.com/package/@hyperledger/caliper-cli)
[![npm (scoped)](https://img.shields.io/npm/v/@hyperledger/caliper-cli?label=version)](https://www.npmjs.com/package/@hyperledger/caliper-cli)
[![npm](https://img.shields.io/npm/dt/@hyperledger/caliper-cli?label=npm%20downloads)](https://www.npmjs.com/package/@hyperledger/caliper-cli)
[![Docker Pulls](https://img.shields.io/docker/pulls/hyperledger/caliper)](https://hub.docker.com/r/hyperledger/caliper)
[![Rocket.Chat](https://img.shields.io/badge/rocket.chat-caliper-red)](https://chat.hyperledger.org/channel/caliper)
[![Mailing list](https://img.shields.io/badge/mailing%20list-caliper-blue)](https://lists.hyperledger.org/g/caliper/topics)

Welcome to the Hyperledger Caliper project. Caliper is a blockchain performance benchmark framework, which allows users to test different blockchain solutions with predefined use cases, and get a set of performance test results.

Currently supported blockchain solutions:

* [Hyperledger Besu](https://github.com/hyperledger/besu), utilizing the Ethereum adapter.
* [Hyperledger Fabric v1.X, v2.X](https://github.com/hyperledger/fabric)
* [Ethereum](https://github.com/ethereum/go-ethereum)
* [FISCO BCOS](https://github.com/FISCO-BCOS/FISCO-BCOS)

Currently supported performance indicators:
* Success rate
* Transaction/Read throughput
* Transaction/Read latency (minimum, maximum, average)
* Resource consumption (CPU, Memory, Network IO, ...)

See the [PSWG white paper](https://www.hyperledger.org/resources/publications/blockchain-performance-metrics) to find out the definitions and corresponding measurement methods.  

For more information on using Caliper, please consult the [documentation site](https://hyperledger.github.io/caliper/)

## Configuration and usage
See the [related documentation page](https://hyperledger.github.io/caliper/).

## How to contact us

If you have any issues using Caliper that the documentation does not help you solve, please reach out to us through the following methods:
* [RocketChat](https://chat.hyperledger.org/channel/caliper) Please feel free to contact us on Rocket Chat (instant messaging). We monitor that channel as close as possible, but even if you don't have a problem that needs resolving, why not jump on and say hi ... we'd love to hear from you about your experiences and any new features you think we should work on.
* [Issues](https://github.com/hyperledger/caliper/issues) Feel free to raise an issue if you are facing a Caliper related problem

Caliper interacts with multiple blockchain technologies and consequently it *might* be an issue with the underlying blockchain technology being interacted with. You can seek specific help on these technologies within the following Rocket Chat channels:
* [Hyperledger Besu](https://chat.hyperledger.org/channel/besu)
* [Hyperledger Fabric](https://chat.hyperledger.org/channel/fabric)

## How to contribute

We welcome contributions to the Caliper code base. Please see [Contributing](/CONTRIBUTING.md) for more information.

## License
Hyperledger Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the [LICENSE](LICENSE) file. Hyperledger Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0), available at http://creativecommons.org/licenses/by/4.0/.
