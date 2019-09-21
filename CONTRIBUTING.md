## Contributing to Hyperledger Caliper

We are using GitHub issues for bug reports and feature requests.

If you find any bug in the source code or have any trivial changes (such as typos fix, minor feature), you can raise an issue or delivery a fix via a pull request directly.

If you have any enhancement suggestions or want to help extend caliper with more DLTs or have any other major changes, please start by opening an issue first.
That way, relevant parties (e.g. maintainers or main contributors of the relevant subsystem) can have a chance to look at it before you do any work.

All PRs must get at least one review, you can ask `hyperledger/caliper-committers` for review.
Normally we will review your contribution in one week.
If you haven't heard from anyone in one week, feel free to @ or mail a maintainer to review it.

All PRs must be signed before be merged, be sure to use `git commit -s` to commit your changes.

We use Travis Ci to test the build - please test on your local branch before raising a PR. More information on Travis, and linking to your github repository may be found here: https://docs.travis-ci.com/user/for-beginners/
   
There is also a [RocketChat Channel](https://chat.hyperledger.org/channel/caliper) for communication, anybody is welcome to join. 

## Caliper Structure
Caliper is modularised under `packages` into the following components:

### caliper-samples
This contains samples that may be run using the caliper-cli, and extended to include more adaptor scenarios. The package contains the following folders:
- benchmark: contains benchmark configuration files
- src: contains smart contracts to be tested
- network: contains blockchain (network) configuration files

### caliper-cli
This is the Caliper CLI that enables the running of a benchmark and interaction with zookeeper clients/services. 

### caliper-core
Contains all the Caliper core code. Interested developers can follow the code flow from the above `run-benchmark.js` file, that enters `caliper-flow.js` in the core package.

### caliper-adaptor
Each `caliper-<adapter>` is a separate package that contains a distinct adaptor implementation to interact with different blockchain technologies. Current adaptors include:
- caliper-burrow
- caliper-composer
- caliper-fabric
- caliper-iroha
- caliper-sawtooth

Each adaptor implements the `BlockchainInterface` from the core package, as well as a `ClientFactory` and `ClientWorker` that are bespoke to the adaptor.

### caliper-tests-integration
This is the integration test suite used for caliper; it runs in the Travis build and can (*should*) be run locally when checking code changes. Please see the readme within the package for more details.

## Creating a New Test Case

Currently the easiest way to create a new test case is to extend or add to the `caliper-samples` package. You have options from this point:
- run the integration tests to get the CLI module installed, then use the command line comand `caliper benchmark run -c benchmark/my-config.yaml -n network/my-network.yaml -w <path>/caliper-samples`
- directly run `node ./packages/caliper-cli/caliper.js benchmark run -c benchmark/my-config.yaml -n network/my-network.yaml -w ./packages/caliper-samples` from the root folder

Before adding a benchmark, please inspect the `caliper-samples` structure and example benchmarks; you will need to add your own configuration files for the blockchain system under test, the benchmark configuration, smart contracts, and test files (callbacks) that interact with the deployed smart contract. You can then run the benchmark using the `run-benchmark.js` script and passing your configuration files that describe that benchmark.
    
## Add an Adaptor for a New DLT
  
New adaptors must be added within a new package, under `packages`, with the naming convention `caliper-<adaptor_name>`. Each adaptor must implement a new class inherited from `BlockchainInterface` as the adaptor for the DLT, as well as a `ClientFactory` and `ClientWorker`. For more information, consult our main documentation.
  
