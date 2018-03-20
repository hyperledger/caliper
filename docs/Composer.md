# Composer Performance Tests
Hyperledger Composer is a set of development tools to assist in the building of blockchain business applications. When a Business Network Archive is deployed into a blockchain system using the Composer tooling, the resulting chaincode includes both the Composer runtime (which is generic) and the user defined business network. Consequently the performance of the business application is determined by both the Composer runtime and the user defined business network.

## Configuring Caliper to run Composer Performance Tests
Prior to running performance tests, it is important to note that the current framework has been written to support:
- Hyperledger Composer v0.18.2 and higher
- Hyperledger Fabric v1.1

The framework has been verified with the following dependencies:

```
    "composer-admin": "0.18.2",
    "composer-client": "0.18.2",
    "composer-common": "0.18.2",
    "fabric-ca-client": "1.1.0",
    "fabric-client": "1.1.0",
```

In order to configure your local system to run tests on static (published) versions, it is recommended to update the Caliper package.json to import the version of Composer packages (`composer-client`, `composer-admin` and `composer-common`) that you wish to test, and the relevant versions of `fabric-ca-client` and `fabric-client`.

In order to configure your system to run tests on unpublished version, for instance testing the impact of a code change in a local repository, it is necessary to:
- use an npm proxy such as [Verdaccio](https://github.com/verdaccio/verdaccio) to host the latest code
- update the package information in the Caliper project to reflect the unpublished version that are to be tested
- perform an npm install in the Caliper project in order to retrieve the latest code
A point of note here is that during the chaincode instantiation process using Composer, as the chaincode is built, it will perform an npm install of the latest Composer code that matches the version of the Composer code that invoked the process. Due to this it is necesary to ensure that for each system the chaincode is being instantiated on, an npm proxy that can make the required code available is present.

## Composer Code Locations
The Composer contribution to Caliper is contained within three folders:
- /Caliper/benchmark/composer, which contains the test runner and all tests
- /Caliper/src/composer, which comprises the Composer specific code that uses the Caliper interfaces
- /Caliper/contract/composer, which contains the business network archive files to be used in tests

## Running a Composer Performance Test
As per the Caliper framework, tests are run based on configuration files. These files are used to create a (Fabric) Blockchain topology and run a series of tests with a target tps.

The sample configuration file `/caliper/benchmark/composer/config-composer.json` indicates how a test should be run:
- Blockchain `type` is 'composer' and the blockchain `config` is pointed to a required composer.config file within a folder that contains a json specifiction of a desired test network topology.
- The `start` and `end` commands reflect the same folder location for the target topology
- The `rounds` indicate the test `label` to be run and hold a location to the test script itself as the `callback`

Points to note:
- The test `label` must match a corresponding `chaincodes` tag that is present within the network topology configration file.
- Currently, only a single client test is supported

To run a Composer based test, on a published set of versions, the required process is:
- npm install, having specified the required Hyperledger Fabric/Composer versions
- navigate to /caliper/benchmark/composer
- run `node runner.js -c my-config.json`

Following the command issue, the Caliper bench-flow process will execute, targeting the Composer tests specified within a config file. If no config file is passed, it will default to using config-composer.json. 

## Testing Your own Business Network Definition
To test your own Business Network, it is necessary to:
- Place the test Business Network Archive file into the src/contract/composer/bna folder
- Add the new business network within the netork topology file as a `chaincode` to deploy
- Create a test script that includes an `initilisation`, `run` and `end` phase
- Add the new test script to the test config file as a test round, making sure that the `label` matches the business network name and that specified in the network topology `chaincodes`, and that the correct `callback` is specified.
- If a Business Network has multiple transactions that are to be tested, it is possible to pass a named transaction within the test round `arguments`. Examples for doing this are provided within the `/caliper/benchmark/composer/composer-samples` directory.

### Creating Tests For Your Business Network
When creating tests for a business network, it is important to consider the system under test in order to prevent deadlocks and access denial. 

For instance, if the desire is to test the update of an Asset, then it is not recommended to try updating the same asset concurrently. Instead it is necessary to create a set of assets to work with during the initialiastion phase and then update each asset within a single instance of the test run.