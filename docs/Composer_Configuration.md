---
layout: page
title:  "Composer Configuration"
categories: config
---

> The latest supported version of Hyperledger Composer is v0.20


Hyperledger Composer is a set of development tools to assist in the building of blockchain business applications. When a Business Network Archive is deployed into a blockchain system using the Composer tooling, the resulting chaincode includes both the Composer runtime (which is generic) and the user defined business network. Consequently the performance of the business application is determined by both the Composer runtime and the user defined business network.

## Composer Code Locations
The Composer contribution to Caliper is contained within three folders:
- `/caliper/packages/caliper-application/benchmark/composer`, contains the test configuration and benchmark test files
- `/caliper/packages/caliper-composer`, comprises the Composer specific code that uses the Caliper interfaces
- `/caliper/packages/caliper-application/contract/composer`, contains the business network files to be used in tests

## Using Alternative Composer Versions
If you wish to use a specific Composer version, it is necessary to modify the `composer-admin`, `composer-clietn`, and `composer-common` version levels listed as dependancies in `packages/caliper-composer/package.json`, and then rebuild the Caliper project using the following commands issued at the root Caliper project location:

- `npm install`
- `npm run repoclean`
- `npm run bootstrap`

## Running a Composer Performance Test
As per the Caliper framework, tests are run based on configuration files. These files are used to create a (Fabric) Blockchain topology and run a series of tests with a target tps.

The sample configuration file `/caliper/packages/caliper-application/benchmark/composer/config.yaml` indicates how a test should be run:
- Blockchain `type` is 'composer' and the blockchain `config` is pointed to a required composer.config file within a folder that contains a json specifiction of a desired test network topology.
- The `start` and `end` commands reflect the same folder location for the target topology
- The `rounds` indicate the test `label` to be run and hold a location to the test script itself as the `callback`

Points to note:
- The test `label` must match a corresponding `chaincodes` tag that is present within the network topology configration file.

To run a Composer based test, on a published set of versions, the required process is:
- npm install, having specified the required Hyperledger Fabric/Composer versions
- navigate to /caliper/benchmark/composer
- run `node main.js -c my-config.json`

Following the command issue, the Caliper bench-flow process will execute, targeting the Composer tests specified within a config file. If no config file is passed, it will default to using config-composer.json.

## Testing Your own Business Network Definition
Examples for existing Business Networks are provided within the `/caliper/packages/caliper-application/contract/composer` directory. To test your own Business Network, you must:
- Place your Business Network files into a folder within `/caliper/packages/caliper-application/contract/composer`. The name of the folder that holds your Buinsess Network files should be named the same as your Business Network and represents the `chaincode` that is deployed.
- Add the new Business Network within the network topology file as a `chaincode` to deploy
- Create a test script that includes an `init`, `run` and `end` phase
- Add the new test script to the test config file as a test round, making sure that the `label` matches the Business Network name and that specified in the network topology `chaincodes`, and that the correct `callback` is specified.
- If a Business Network has multiple transactions that are to be tested, it is possible to pass a named transaction within the test round `arguments`.


If modifying the existing config.yaml file, then:
- Modify `config.yaml`
  - Change `rounds.label` to be the name of the folder inside `/caliper/packages/caliper-application/contract/composer` that contains your Business Network files
  - Change `rounds.callback` to be the location of your test script
  - Change `rounds.arguments` to provide any required arguments to your test
- Modify the corresponding `composer.json` file identified in `config.yaml` under `blockchain.config` to list (or replace) your business network name in the `composer.chaincodes` array

### Creating Tests For Your Business Network
When creating tests for a business network, it is important to consider the system under test in order to prevent deadlocks and access denial.

For instance, if the desire is to test the update of an Asset, then it is not recommended to try updating the same asset concurrently. Instead it is necessary to create a set of assets to work with during the `init` phase and then update each asset within a single instance of the test run. In such instances the test should be driven under `txNumber` mode and the number of assets created in the test should ideally match the number of transactions specified within `txNumber`.
