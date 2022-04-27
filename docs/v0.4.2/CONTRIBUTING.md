---
layout: v0.4.2
title:  "Contributing"
categories: general
permalink: /v0.4.2/contributing/
---

## Contributing to Hyperledger Caliper

Welcome to Hyperledger Caliper project, we are excited about the prospect of you contributing.

## How to contribute

We are using GitHub issues for bug reports and feature requests.

If you find any bug in the source code or have any trivial changes (such as typos fix, minor feature), you can raise an issue or delivery a fix via a pull request directly.

If you have any enhancement suggestions or want to help extend caliper with more DLTs or have any other major changes, please start by opening an issue first.
That way, relevant parties (e.g. maintainers or main contributors of the relevant subsystem) can have a chance to look at it before you do any work.

All PRs must get at least one review, you can ask `hyperledger/caliper-committers` for review.
Normally we will review your contribution in one week.
If you haven't heard from anyone in one week, feel free to @ or mail a maintainer to review it.

All PRs must be signed before be merged, be sure to use `git commit -s` to commit your changes.

We use Travis Ci to test the build - please test on your local branch before raising a PR. More information on Travis, and linking to your github repository may be found here: https://docs.travis-ci.com/user/for-beginners/

There is also [Discord](https://discord.com/channels/905194001349627914/941417677778473031) with a Caliper channel for communication, anybody is welcome to join.

## Caliper Structure
Caliper is modularised under `packages` into the following components:

### caliper-samples
This contains samples that may be run using the caliper-cli, and extended to include more adaptor scenarios. The package contains the following folders:
- benchmark: contains benchmark configuration files
- src: contains smart contracts to be tested
- network: contains blockchain (network) configuration files

### caliper-cli
This is the Caliper CLI that enables the running of a benchmark

### caliper-core
Contains all the Caliper core code. Interested developers can follow the code flow from the above `run-benchmark.js` file, that enters `caliper-flow.js` in the core package.

### caliper-adaptor
Each `caliper-<adapter>` is a separate package that contains a distinct adaptor implementation to interact with different blockchain technologies. Current adaptors include:
- caliper-besu
- caliper-ethereum
- caliper-fabric
- caliper-fisco-bcos

Each adaptor implements the `BlockchainInterface` from the core package, as well as a `ClientFactory` and `ClientWorker` that are bespoke to the adaptor.

### caliper-tests-integration
This is the integration test suite used for caliper; it runs in the Travis build and can (*should*) be run locally when checking code changes. Please see the readme within the package for more details.

## Creating a New Test Case

Currently the easiest way to create a new test case is to extend or add to the `caliper-samples` package. You have options from this point:
- run the integration tests to get the CLI module installed, then use the command line comand `caliper benchmark run --caliper-workspace <path>/caliper-samples --caliper-benchconfig benchmark/my-config.yaml --caliper-networkconfig network/my-network.yaml`
- directly run `node ./packages/caliper-cli/caliper.js benchmark run --caliper-benchconfig benchmark/my-config.yaml --caliper-networkconfig network/my-network.yaml --caliper-workspace ./packages/caliper-samples` from the root folder

Before adding a benchmark, please inspect the `caliper-samples` structure and example benchmarks; you will need to add your own configuration files for the blockchain system under test, the benchmark configuration, smart contracts, and test files (callbacks) that interact with the deployed smart contract. You can then run the benchmark using the approaches above.

## Add an Adaptor for a New DLT

New adaptors must be added within a new package, under `packages`, with the naming convention `caliper-<adaptor_name>`. Each adaptor must implement a new class inherited from `BlockchainInterface` as the adaptor for the DLT, as well as a `ClientFactory` and `ClientWorker`. For more information, consult our main documentation.

## Inclusive language guidelines

Please adhere to the inclusive language guidelines that the project has adopted as you make documentation updates.

- Consider that users who will read the docs are from different backgrounds and
cultures and that they have different preferences.
- Avoid potential offensive terms and, for instance, prefer "allow list and
deny list" to "white list and black list".
- We believe that we all have a role to play to improve our world, and even if
writing inclusive documentation might not look like a huge improvement, it's a
first step in the right direction.
- We suggest to refer to
[Microsoft bias free writing guidelines](https://docs.microsoft.com/en-us/style-guide/bias-free-communication)
and
[Google inclusive doc writing guide](https://developers.google.com/style/inclusive-documentation)
as starting points.

## License
The Caliper codebase is released under the [Apache 2.0 license](./LICENSE.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.
