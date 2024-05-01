## 0.6.0 (Wed  1 May 11:13:41 BST 2024)

### Notable
* **Security Fix**: Address issue in Prometheus monitor that allows the loading and running of an arbitrary binary on a system running a caliper worker
* **Feature**: Official support for Node 18 and Node 20 for users and contributors (previous versions of node are now unsupported)
* **Breaking**: Support for Fisco-BCOS has been removed

### Commits

* [0877b16](https://github.com/hyperledger/caliper/commit/0877b16) Removed unused dependencies (#1544)
* [62c7593](https://github.com/hyperledger/caliper/commit/62c7593) Remove collection of node gc stats in prometheus (#1545)
* [25ee0f9](https://github.com/hyperledger/caliper/commit/25ee0f9) Remove Caliper-gui-server packages and Caliper-gui-dashboard packages  #1538 (#1540)
* [3fafbf5](https://github.com/hyperledger/caliper/commit/3fafbf5) Update PSWG whitepaper link in README (#1524)
* [16d4983](https://github.com/hyperledger/caliper/commit/16d4983) Update the versions of fabric sdks (#1519)
* [4bdb98c](https://github.com/hyperledger/caliper/commit/4bdb98c) downgrade npm on publish as temp fix (#1523)
* [7477c70](https://github.com/hyperledger/caliper/commit/7477c70) Temporarily revert publish to using node 16.x to fix broken publish (#1520)
* [f24f777](https://github.com/hyperledger/caliper/commit/f24f777) test node 18/20, minimum version 18.19.0 (#1517)
* [31b978f](https://github.com/hyperledger/caliper/commit/31b978f) Remove fisco-bcos (#1515)
* [26da2f2](https://github.com/hyperledger/caliper/commit/26da2f2) Terminate workers if caliper manager is terminated prematurely (#1514)
* [8cef10c](https://github.com/hyperledger/caliper/commit/8cef10c) docker monitor remote monitoring bugfix (#1499)
* [943ab2a](https://github.com/hyperledger/caliper/commit/943ab2a) Update go chaincode dependencies in integration tests (#1485)
* [7c9c5d2](https://github.com/hyperledger/caliper/commit/7c9c5d2) Use go chaincode in integration tests (#1484)
* [35dcc86](https://github.com/hyperledger/caliper/commit/35dcc86) Add directory structure and introduction for the development documentation (#1400)
* [91870b7](https://github.com/hyperledger/caliper/commit/91870b7) Update cache action (#1469)
* [dc1ce93](https://github.com/hyperledger/caliper/commit/dc1ce93) Fix npmignore for report html (#1466)
* [4a64acf](https://github.com/hyperledger/caliper/commit/4a64acf) Add CODEOWNERS file (#1463)
* [394357f](https://github.com/hyperledger/caliper/commit/394357f) Move inactive maintainers to emeritus status (#1462)
* [cc3edeb](https://github.com/hyperledger/caliper/commit/cc3edeb) Bump moment-timezone from 0.5.34 to 0.5.38 (#1461)
* [2d58e09](https://github.com/hyperledger/caliper/commit/2d58e09) Add TxObserver for Prometheus manager (#1448)
* [2097812](https://github.com/hyperledger/caliper/commit/2097812) Fix integration test CI trigger (#1458)
* [e504bee](https://github.com/hyperledger/caliper/commit/e504bee) Revert "Add Node 18 to CI (#1455)" (#1460)
* [1eade51](https://github.com/hyperledger/caliper/commit/1eade51) Fix calculation and doc comment in prometheus observer (#1456)
* [85cf073](https://github.com/hyperledger/caliper/commit/85cf073) Add Node 18 to CI (#1455)
* [69000d4](https://github.com/hyperledger/caliper/commit/69000d4) Add VSCode extension skeleton and runtime config schema (#1404)
* [64f3868](https://github.com/hyperledger/caliper/commit/64f3868) Upload coverage reports on merge (#1433)
* [2cdd46d](https://github.com/hyperledger/caliper/commit/2cdd46d) Add coverage report workflow (#1428)
* [c648fa9](https://github.com/hyperledger/caliper/commit/c648fa9) Distinguish different workers in Prometheus PushGateway (#1427)
* [2efba52](https://github.com/hyperledger/caliper/commit/2efba52) Revert "Add workflow for gh-pages branch (#1423)" (#1425)
* [954eba5](https://github.com/hyperledger/caliper/commit/954eba5) Add workflow for gh-pages branch (#1423)
* [e476ba7](https://github.com/hyperledger/caliper/commit/e476ba7) Execute integration tests based on changes (#1421)
* [acb518e](https://github.com/hyperledger/caliper/commit/acb518e) Cache node modules across CI workflows (#1406)
* [9ecfb02](https://github.com/hyperledger/caliper/commit/9ecfb02) Migrate generator tests to test network (#1414)
* [c29fc0f](https://github.com/hyperledger/caliper/commit/c29fc0f) Migrate to npm workspaces (#1394)
* [dd5c85c](https://github.com/hyperledger/caliper/commit/dd5c85c) update fabric bindings (#1412)
* [78e4e84](https://github.com/hyperledger/caliper/commit/78e4e84) Remove channel and chaincode ops from Fabric v1 (#1411)
* [5025d20](https://github.com/hyperledger/caliper/commit/5025d20) Migrate Fabric integration tests to test network (#1410)
* [8a792e0](https://github.com/hyperledger/caliper/commit/8a792e0) Updated fabric bindings: fabric-network@2.2.12 -> 2.2.13, @hyperledger/fabric-gateway@1.0.1 -> 1.1.0 (#1402)
* [04a1154](https://github.com/hyperledger/caliper/commit/04a1154) Add DCI linting to CI of PRs (#1393)
* [f1634b5](https://github.com/hyperledger/caliper/commit/f1634b5) Fix #536: Minor changes in the error messages of '@hyperledger/caliper-fisco-bcos' package (#1383)
* [158a367](https://github.com/hyperledger/caliper/commit/158a367) change the generator binding from 2.2 to 1.4 (#1391)
* [3d22571](https://github.com/hyperledger/caliper/commit/3d22571) Pass secrets to CI workflow for publish (#1390)
* [e7a5a17](https://github.com/hyperledger/caliper/commit/e7a5a17) Port the publish workflow to GitHub Actions (#1384)
* [ae23774](https://github.com/hyperledger/caliper/commit/ae23774) Fix #536 Update error messages for '@hyperledger/caliper-ethereum' package (#1363)
* [7ca519b](https://github.com/hyperledger/caliper/commit/7ca519b) Disable unit and integration tests in Azure Pipelines (#1382)
* [2a3839f](https://github.com/hyperledger/caliper/commit/2a3839f) Port the integration test workflow to GitHub Actions (#1376)
* [5b96845](https://github.com/hyperledger/caliper/commit/5b96845) Port the unit test workflow to GitHub Actions (#1364)
* [0c1e973](https://github.com/hyperledger/caliper/commit/0c1e973) Fix #536 Update error messages for '@hyperledger/caliper-cli' package (#1348)

## 0.5.0 (Wed May 18 2022)

This release of caliper adds new capabilities and addresses lots of bugs. Note that Hyperledger Fabric 1.4 SUT binding is still available in this release however it now is _deprecated_.
### Notable

* [Feature] Official support for Node 14 and Node 16 for users and contributors
* [Feature] Experimental release for a Declaritive Workload Module
* [Feature] Support for the new Peer Gateway API introduced in Hyperledger Fabric 2.4
* [Fix] Fix Caliper round hang with unfinished transactions never completing
* [Fix] Corrections and Improvements to the documentation
* [Breaking] Caliper no longer supports the 1.0 version of the Fabric Network Configuration format
* [Breaking] Caliper no longer supports creating channels or deploying chaincode to Hyperledger Fabric
* [Breaking] Caliper no longer supports Hyperledger Fabric 1.3 or older
### Commits

* [2fd8925](https://github.com/hyperledger/caliper/commit/2fd8925) Fixes caliper hang of unfinished transactions (#1342)
* [df1b96c](https://github.com/hyperledger/caliper/commit/df1b96c) Peer Gateway txs error messsage: added output of the contents of the err details array (#1345)
* [671ca2f](https://github.com/hyperledger/caliper/commit/671ca2f) explicitly bind grpc-js for fabric 2.4 connector (#1344)
* [4bbb40c](https://github.com/hyperledger/caliper/commit/4bbb40c) changed all bit.ly links with a direct link (#1336)
* [14467a4](https://github.com/hyperledger/caliper/commit/14467a4) upgraded node-sdk binding for fabric-v2-lts from 2.2.11 to 2.2.12 (#1335)
* [b554467](https://github.com/hyperledger/caliper/commit/b554467) upgraded node-sdk binding for fabric-v1-lts from 1.4.19 to 1.4.20 (#1332)
* [1a6639c](https://github.com/hyperledger/caliper/commit/1a6639c) add peers property support to fabric network config (#1329)
* [ca58c47](https://github.com/hyperledger/caliper/commit/ca58c47) disable logging debug to file (#1331)
* [35ae4ca](https://github.com/hyperledger/caliper/commit/35ae4ca) Ensure that connector errors finishes caliper transactions (#1328)
* [d699171](https://github.com/hyperledger/caliper/commit/d699171) Fix cli and update dependabot security dependencies (#1324)
* [da99385](https://github.com/hyperledger/caliper/commit/da99385) correct interval usage in fabric-tests (#1323)
* [031267f](https://github.com/hyperledger/caliper/commit/031267f) fixed docker monitor to use dockerode only (#1319)
* [af6440f](https://github.com/hyperledger/caliper/commit/af6440f) address worker cleanup when an error occurs (#1315)
* [57d8d46](https://github.com/hyperledger/caliper/commit/57d8d46) Change monitor intervals from milliseconds to seconds (#1314)
* [7f4d374](https://github.com/hyperledger/caliper/commit/7f4d374) fixed colors dependency to 1.4.0 (#1311)
* [6fb76f2](https://github.com/hyperledger/caliper/commit/6fb76f2) add integration test for peer gateway connector + updated docker compose for fabric 2.4 (#1310)
* [9e736c0](https://github.com/hyperledger/caliper/commit/9e736c0) edit defaul.yaml (updated comments and deleted sllep after option for fabric) + updated the fabric Channel operations for the v1 fabric connector (#1306)
* [25f905d](https://github.com/hyperledger/caliper/commit/25f905d) added logic to pick new Peer Gateway connector in the connector selector in FabriConnectorFactory.js +  added 2.4 fabric SUT version with binding packages in .config.yaml +  added last fixes for the Peer Gateway connector implementation (#1298)
* [7c33aca](https://github.com/hyperledger/caliper/commit/7c33aca) Update the usage examples to more appropriate versions (#1297)
* [66e8386](https://github.com/hyperledger/caliper/commit/66e8386) remove latency values if no successful txns in final report (#1290)
* [5f9aa29](https://github.com/hyperledger/caliper/commit/5f9aa29) fix RecordRate rate controller (#1292)
* [a372f18](https://github.com/hyperledger/caliper/commit/a372f18) added main logic for the new peer-gateaway connector including unit tests (#1270)
* [ada19c3](https://github.com/hyperledger/caliper/commit/ada19c3) Caliper terminates if prometheus is not available (#1288)
* [6a76834](https://github.com/hyperledger/caliper/commit/6a76834) Remove CountQueryAsLoad Option (#1276)
* [4f03fef](https://github.com/hyperledger/caliper/commit/4f03fef) rename certain terms in code base (#1280)
* [4356663](https://github.com/hyperledger/caliper/commit/4356663) improve message to help when file not found (#1262)
* [ba1ffcf](https://github.com/hyperledger/caliper/commit/ba1ffcf) Improve integration tests (#1259)
* [a84cdd9](https://github.com/hyperledger/caliper/commit/a84cdd9) add changes to ConnectionProfileDefinition for new PeerGateway connector and add peer-gateway to nyc of caliper-fabric (#1253)
* [5ee6aaa](https://github.com/hyperledger/caliper/commit/5ee6aaa) Remove the need for gateway-enabled when binding to a fabric 2.2 SUT (#1255)
* [5380af7](https://github.com/hyperledger/caliper/commit/5380af7) add txid to proposal when doing a query (#1247)
* [c72dc9f](https://github.com/hyperledger/caliper/commit/c72dc9f) ensure endorsetimeout is set on v2 fabric connector (#1246)
* [71a5a87](https://github.com/hyperledger/caliper/commit/71a5a87) Update bindings to latest fabric sdks and remove old ones (#1244)
* [9043fd0](https://github.com/hyperledger/caliper/commit/9043fd0) Remove the legacy fabric connectors (#1235)
* [338212d](https://github.com/hyperledger/caliper/commit/338212d) Bump version to 0.5.0-unstable (#1239)
* [cbacc35](https://github.com/hyperledger/caliper/commit/cbacc35) Correct timeout defaults (#1230)
* [a8652a6](https://github.com/hyperledger/caliper/commit/a8652a6) Reference Discord instead of Rocket Chat (#1228)
* [986c856](https://github.com/hyperledger/caliper/commit/986c856) Add support for node 16 (#1223)
* [5922238](https://github.com/hyperledger/caliper/commit/5922238) add new folder peer-gateway containing new connector Wallet Facade and Wallet Facade Factory (#1227)
* [24fcdf3](https://github.com/hyperledger/caliper/commit/24fcdf3) Node 14 support  (#1221)
* [4a1860e](https://github.com/hyperledger/caliper/commit/4a1860e) enable support for node 14 - node engine >=14.19.0 (#1219)
* [caad464](https://github.com/hyperledger/caliper/commit/caad464) Docker monitor metrics fixes - cpu and memory usage (#1214)
* [7c2b3f7](https://github.com/hyperledger/caliper/commit/7c2b3f7) address fabric:1.4 sut binding not working in caliper container (#1211)
* [f0553d1](https://github.com/hyperledger/caliper/commit/f0553d1) Declarative workload module base integration (#1194)
* [a8e9ada](https://github.com/hyperledger/caliper/commit/a8e9ada) Add GitHub web forms-based issue templates (#1189)
* [9e296ac](https://github.com/hyperledger/caliper/commit/9e296ac) Update CONTRIBUTING.md document (#1192)
* [8701938](https://github.com/hyperledger/caliper/commit/8701938) Fix the unit of the interval of default-observer in the log (#1193)
* [1fb6011](https://github.com/hyperledger/caliper/commit/1fb6011) Propose myself as a new caliper Maintainer (#1186)
* [aa0b3db](https://github.com/hyperledger/caliper/commit/aa0b3db) Fix CompositeRateController class bug (#1181) (#1184)
* [595942a](https://github.com/hyperledger/caliper/commit/595942a) Fix issue where init flow errors when not using mutual TLS (#1183)
* [cc19cd6](https://github.com/hyperledger/caliper/commit/cc19cd6) Fix generator integration test (#1176)
* [5a538e1](https://github.com/hyperledger/caliper/commit/5a538e1) Fix Ethereum integration test (#1175)
* [c73f5a7](https://github.com/hyperledger/caliper/commit/c73f5a7) Fix Besu integration test (#1174)
* [14bbbcb](https://github.com/hyperledger/caliper/commit/14bbbcb) Add ValueProviderFactory, ListElementValueProvider and FormattedStringValueProvider. (#1168)
* [6d5f071](https://github.com/hyperledger/caliper/commit/6d5f071) Update branch name in Azure CI pipeline configuration (#1172)
* [4bd51cf](https://github.com/hyperledger/caliper/commit/4bd51cf) Update link for security bug handling wiki page (#1171)
* [4f98fa7](https://github.com/hyperledger/caliper/commit/4f98fa7) Open in Visual Studio Code badge added
* [0053563](https://github.com/hyperledger/caliper/commit/0053563) Add base classes for declarative workload module and unit tests for the base classes.
* [550fdb7](https://github.com/hyperledger/caliper/commit/550fdb7) comparison to ===
* [61410f3](https://github.com/hyperledger/caliper/commit/61410f3) Resolve issue in which only first round would be docker-monitored
* [5a34ad7](https://github.com/hyperledger/caliper/commit/5a34ad7) Make Mosquitto authentication and authorization explicit for v2
* [b615b17](https://github.com/hyperledger/caliper/commit/b615b17) FIX: caliper bind command now compatible with Windows OS
* [12a3e52](https://github.com/hyperledger/caliper/commit/12a3e52) Adding changes related to value parameter for payable function in Ethereum. (#1122)
* [69eec09](https://github.com/hyperledger/caliper/commit/69eec09) use 0.21.1 axios (#1119)
* [369d11e](https://github.com/hyperledger/caliper/commit/369d11e) use single publish script (#1118)
* [c48f9ad](https://github.com/hyperledger/caliper/commit/c48f9ad) Publish containers (#1117)
* [88a1568](https://github.com/hyperledger/caliper/commit/88a1568) prevent cascade skip (#1116)
* [5b74a2c](https://github.com/hyperledger/caliper/commit/5b74a2c) Change build reason for publish (#1114)
* [c3090ea](https://github.com/hyperledger/caliper/commit/c3090ea) update pipeline condition (#1113)
* [6ced65a](https://github.com/hyperledger/caliper/commit/6ced65a) update conditionals (#1112)
* [6fa9b12](https://github.com/hyperledger/caliper/commit/6fa9b12) publish to npm stage (#1110)
* [730a884](https://github.com/hyperledger/caliper/commit/730a884) Update contributing guide (#1109)
* [d6f0027](https://github.com/hyperledger/caliper/commit/d6f0027) Enable builds for PRs that target main branch (#1108)
* [bc436e8](https://github.com/hyperledger/caliper/commit/bc436e8) Azure pipelines build (#1105)

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
  * [Breaking] Caliper API change: rename CLI subcommand to manager ([PR893](https://github.com/hyperledger/caliper/pull/893))
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
  * Added MQTT-based communication between the manager and worker processes for fully distributed operation ([PR#682](https://github.com/hyperledger/caliper/pull/682)).
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
