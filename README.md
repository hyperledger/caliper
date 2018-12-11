## Hyperledger Caliper

Welcome to the Hyperledger Caliper project. Caliper is a blockchain performance benchmark framework, which allows users to test different blockchain solutions with predefined use cases, and get a set of performance test results.

Currently supported blockchain solutions:
* [fabric v1.0+](https://github.com/hyperledger/fabric), the lastest version that has been verified is v1.1.0
* [sawtooth 1.0+](https://github.com/hyperledger/sawtooth-core)
* [Iroha 1.0 beta-3](https://github.com/hyperledger/iroha)
* [Burrow 1.0](https://github.com/hyperledger/burrow)

[Hyperledger Composer](https://github.com/hyperledger/composer) is also supported.

Currently supported performance indicators:
* Success rate
* Transaction/Read throughput
* Transaction/Read latency(minimum, maximum, average, percentile)
* Resource consumption (CPU, Memory, Network IO,...)

See [to add the link to PSWG] to find out the definitions and corresponding measurement methods.  

For more information please consult the [documentation site](https://hyperledger.github.io/caliper/)

## How to contribute

We welcome contributions to the Caliper code base. Please see [Contributing](/CONTRIBUTING.md) for more information.

## License
The Caliper codebase is release under the [Apache 2.0 license](./LICENSE). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.
