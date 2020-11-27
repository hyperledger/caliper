## 0.4.2
  * [Feature] New Fabric connector (completed with [PR1095](https://github.com/hyperledger/caliper/pull/1095))
  * [Feature] New Fabric connector tutorial ([PR1091](https://github.com/hyperledger/caliper/pull/1091))

## 0.4.1
  * [Feature] Besu private transactions ([PR1030](https://github.com/hyperledger/caliper/pull/1030))

  * [Fix] Node engines out of date for project ([PR1053](https://github.com/hyperledger/caliper/pull/1053))
  * [Fix] Caliper docker image workers can hang ([PR1050](https://github.com/hyperledger/caliper/pull/1050))
  * [Fix] Negative send rates observable in reports ([PR1045](https://github.com/hyperledger/caliper/pull/1045))


## 0.4.0

* Core changes
  * [Breaking] Burrow connector removed
  * [Breaking] Sawtooth connector removed
  * [Breaking] Iroha connector removed
  * [Breaking] Modification of Prometheus Resource Monitor configuration ([PR974](https://github.com/hyperledger/caliper/pull/974))
  * [Breaking] Modification of Prometheus Push gateway configuration ([PR966](https://github.com/hyperledger/caliper/pull/966))
  * [Breaking] Alignment of rate controller configuration to be SUT centric ([PR959](https://github.com/hyperledger/caliper/pull/959))
  * [Breaking] Caliper API change for workload specification ([PR950](https://github.com/hyperledger/caliper/pull/950))
  * [Breaking] Caliper API change: removal of queryState ([PR931](https://github.com/hyperledger/caliper/pull/931))
  * [Breaking] Caliper API change: master -> manager ([PR893](https://github.com/hyperledger/caliper/pull/893))
  * [Breaking] Caliper API change: chaincode -> contract ([PR891](https://github.com/hyperledger/caliper/pull/891))
  * [Breaking] Caliper API change: adaptor -> connector ([PR881](https://github.com/hyperledger/caliper/pull/881))
  * [Breaking] Caliper API change: callbacks converted to Workload module class ([PR856](https://github.com/hyperledger/caliper/pull/856))

  * [Feature] Basic auth for Prometheus interaction ([PR966](https://github.com/hyperledger/caliper/pull/966), [PR960](https://github.com/hyperledger/caliper/pull/960))
  * [Feature] Prometheus txObserver scrape target ([PR960](https://github.com/hyperledger/caliper/pull/960))
  * [Feature] Introduction of txObservers ([PR943](https://github.com/hyperledger/caliper/pull/943))
  * [Feature] Max rate controller ([PR874](https://github.com/hyperledger/caliper/pull/874))

* Hyperledger Fabric adapter changes
  * [Breaking] Modification to Fabric binding options ([PR984](https://github.com/hyperledger/caliper/pull/984))

  * [Feature] Addition of target Organizations to fabric connector  ([PR937](https://github.com/hyperledger/caliper/pull/937))
  * [Feature] Addition of target channel to fabric connector  ([PR925](https://github.com/hyperledger/caliper/pull/925))

## 0.3.2 (June 11, 2020)

* Core changes
  * Addition of unbind command to Caliper CLI ([PR864](https://github.com/hyperledger/caliper/pull/864))
  * Fix of MQTT messenger disposal process ([PR863](https://github.com/hyperledger/caliper/pull/863))
  
* Hyperledger Fabric adapter changes
  * Fix network validation in V2 gateway adaptor ([PR863](https://github.com/hyperledger/caliper/pull/863))
  * Aligned passage of private data in gateway transactions with the documented specification ([PR863](https://github.com/hyperledger/caliper/pull/863))
  * Addition of 1.4.8 binding ([PR866](https://github.com/hyperledger/caliper/pull/866))

* Ethereum/Hyperledger Besu adapter changes
  * Update HL Besu binding web3 version ([PR#863](https://github.com/hyperledger/caliper/pull/863))

* FISCO-BCOS adapter changes
  * Removal of docker requirement for contract compilation ([PR#861](https://github.com/hyperledger/caliper/pull/861))

* Hyperledger generator
  * Enable publishing of generator ([PR#804](https://github.com/hyperledger/caliper/pull/804))

## 0.3.1 (May 11, 2020)

* Core changes
  * Relax constraints for monitor/observer combinations ([PR#761](https://github.com/hyperledger/caliper/pull/761))
  * Call the `end` function of workload modules sooner, so they can still access the adapter context ([PR#779](https://github.com/hyperledger/caliper/pull/779))
  * Improved error reporting in the worker processes ([PR#782](https://github.com/hyperledger/caliper/pull/782))
  * Improve TX handling/waiting approach for worker processes, thus enabling long-term benchmarks ([PR#794](https://github.com/hyperledger/caliper/pull/794)) 
  * Improve core package management for the Docker image ([PR#795](https://github.com/hyperledger/caliper/pull/795))
  * Improve handling of benchmark errors upon monitoring data reporing ([PR#797](https://github.com/hyperledger/caliper/pull/797))
  
* Hyperledger Fabric adapter changes
  * Fix orderer name check for Fabric v2 adapter ([PR#762](https://github.com/hyperledger/caliper/pull/762))  
  * Add support for stable Fabric v2 SDK packages

* Ethereum/Hyperledger Besu adapter changes
  * Improve connection/TX management to SUT ([PR#780](https://github.com/hyperledger/caliper/pull/780))
  * Update HL Besu versions ([PR#786](https://github.com/hyperledger/caliper/pull/786))
  * Make `contractDeployerAddress` available in the adapter context ([PR#808](https://github.com/hyperledger/caliper/pull/808))
  
* Hyperledger Sawtooth adapter changes
  * Refactored adapter to be more OO-like, and fixed non-existing variable reference bug ([PR#782](https://github.com/hyperledger/caliper/pull/782))
  
* Hyperledger Burrow adapter changes
  * Switch SDK package to `@hyperledger/burrow` ([PR#804](https://github.com/hyperledger/caliper/pull/804))

## 0.3.0 (March 4, 2020)

* Core changes
  * Fixed the round index bug in some rate controllers ([PR#747](https://github.com/hyperledger/caliper/pull/747)).
  * Added statistic summation option to Prometheus queries ([PR#720](https://github.com/hyperledger/caliper/pull/720)).
  * Fixed monitor bugs resulting in extra empty columns/metrics ([PR#718](https://github.com/hyperledger/caliper/pull/718)).
  * __BREAKING:__ Simplified backlog rate controller configuration ([PR#704](https://github.com/hyperledger/caliper/pull/704)).
  * Added MQTT-based communication between the master and worker processes for fully distributed operation ([PR#682](https://github.com/hyperledger/caliper/pull/682)).
  * Added Yeoman generator for the benchmark configuration and workload module files ([PR#671](https://github.com/hyperledger/caliper/pull/671)).
  * Added charting capabilities to the report generation ([PR#650](https://github.com/hyperledger/caliper/pull/650)).
  * __BREAKING:__ Configuration structure for Docker and process monitoring changed ([PR#650](https://github.com/hyperledger/caliper/pull/650)).
  * __BREAKING:__ Simplified (flattened) round settings in the benchmark configuration file, i.e., the YAML structure changed ([PR#639](https://github.com/hyperledger/caliper/pull/639)).
  
* CLI changes
  * Added new SDK bindings for Fabric ([PR#742](https://github.com/hyperledger/caliper/pull/742)).
  * __BREAKING:__ Changed the CLI commands. The binding command now accepts an external configuration file. The new launch commands can perform binding automatically ([PR#734](https://github.com/hyperledger/caliper/pull/734), [PR#742](https://github.com/hyperledger/caliper/pull/742)).
  
* Hyperledger Fabric adapter changes
  * Fixed channel initialization for the connection profiles ([PR#751](https://github.com/hyperledger/caliper/pull/751)).
  * Fixed error handling for TX broadcast errors ([PR#750](https://github.com/hyperledger/caliper/pull/750)).
  * Relaxed the network configuration schema constraints for channel peers and registrars ([PR#733](https://github.com/hyperledger/caliper/pull/733)).
  * Pass explicit Orderer objects when broadcasting a TX so the SDK won't create a new connection for each TX ([PR#731](https://github.com/hyperledger/caliper/pull/731)).
  * Added ability to pass transient data and peer targets to a gateway TXs ([PR#713](https://github.com/hyperledger/caliper/pull/713)).
  * Added experimental Fabric v2 support ([PR#703](https://github.com/hyperledger/caliper/pull/703)).

* Ethereum/Hyperledger Besu adapter changes
  * Added support for HD keys ([PR#652](https://github.com/hyperledger/caliper/pull/652)).
  * Gas estimation is now opt-in and secondary to explicit gas values. Nonces are only added if Caliper signs the TXs ([PR#640](https://github.com/hyperledger/caliper/pull/640)).
  * Allow the network configuration to specify the gas values that each method call is allotted ([PR#627](https://github.com/hyperledger/caliper/pull/627)).

* FISCO-BCOS adapter changes
  * Fixed bug for resolving certificate file paths ([PR#677](https://github.com/hyperledger/caliper/pull/677)).
  * Fixed bug related to stale response handling ([PR#647](https://github.com/hyperledger/caliper/pull/647)).

* Hyperledger Composer adapter changes
  * __BREAKING:__ The deprecated adapter has now been removed ([PR#655](https://github.com/hyperledger/caliper/pull/655)).


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
