## 0.2.0 (October 25, 2019)

* __REMOVED:__ The Zookeeper-based distributed clients feature has been removed, and will be reimplemented in 0.3.0 ([PR#588](https://github.com/hyperledger/caliper/pull/588)).
* __DEPRECATED:__ The HL Composer adapter has been marked as deprecated and __will be removed__ in 0.3.0.
* __BREAKING:__ Added rigorous and strict validation for Fabric network configuration files. Some attributes became mutually exclusive, which might break your previous configuration files that relied on precedence between attributes ([PR#595](https://github.com/hyperledger/caliper/pull/595)).
* __BREAKING:__ Improved the logging configuration flexibility. The default log message structure has changed, which might break your dependent (e.g. log mining) applications ([PR#598](https://github.com/hyperledger/caliper/pull/595), [PR#607](https://github.com/hyperledger/caliper/pull/607)).
* __BREAKING:__ Made report file path configurable. The default report path has changed, which might break your dependent applications ([PR#601](https://github.com/hyperledger/caliper/pull/601)).
* Added support for Ethereum ([PR#432](https://github.com/hyperledger/caliper/pull/432))
* Added support for Hyperledger Besu ([PR#616](https://github.com/hyperledger/caliper/pull/616))
* Added support for FISCO BCOS ([PR#515](https://github.com/hyperledger/caliper/pull/515))
* Added the `querySmartContract` function to the `Blockchain` interface ([PR#578](https://github.com/hyperledger/caliper/pull/578)). _The old `queryState` function will be deprecated and removed in the upcoming releases (once every adapter supports the new function)!_
* Introduced observers for continuous status updates about the running benchmark ([PR#588](https://github.com/hyperledger/caliper/pull/588)).
* Added a Prometheus-based observer and monitor ([PR#588](https://github.com/hyperledger/caliper/pull/588)).
* Fixed bug that prevented using mutual TLS with the Fabric gateway mode ([PR#604](https://github.com/hyperledger/caliper/pull/604))

## 0.1.0 (September 5, 2019)
Initial release of Caliper.

## License
Hyperledger Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the [LICENSE](LICENSE) file. Hyperledger Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0), available at http://creativecommons.org/licenses/by/4.0/.
