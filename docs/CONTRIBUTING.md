---
layout: page
title:  "Contributing"
categories: opensource
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
   
There is also a [RocketChat Channel](https://chat.hyperledger.org/channel/caliper) for communication, anybody is welcome to join. 

## Caliper Structure

Caliper is modularised under `packages` into the following components:

### caliper-application
This is an application that uses the core and adaptor packages to run benchmarks. We will soon be converting this into a caliper-cli package, which will enable a CLI command to run benchmarks based on files within a single workspace. The scripts directory `packages/caliper-application/scripts` contains a `run-benchmark.js` script, which is used to run benchmarks based on passing a benchmark configuration file and a blockchain configuration file. The package contains the folowing folders:
- benchmark: contains benchmark configuration files
- src: contains smart contracts to be tested
- network: contains blockchain (network) configuration files
- scripts: contains useful scripts for running Caliper benchmarks


### caliper-core
Contains all the Caliper core code. Interested developers can follow the code flow from the above `run-benchmark.js` file, that enters `caliper-flow.js` in the core package.

###caliper-adaptor
Each `caliper-<adapter>` is a separate package that contains a distinct adaptor implementation to interact with different blockchain technologies. Current adaptors include:
- caliper-burrow
- caliper-composer
- caliper-fabric
- caliper-iroha
- caliper-sawtooth

Each adaptor implements the `BlockchainInterface` from the core package, as well as a `ClientFactory` and `ClientWorker` that are bespoke to the adaptor.

## Creating a New Test Case

Currently the easiest way to create a new test case is to extend the `caliper-application` package. Once the CLI module is published, it will be far easier to create test cases within a workspace.

Before adding a benchmark, please inspect the `caliper-application` structure and example benchmarks; you will need to add your own configuration files for the blockchain system under test, the benchmark configuration, smart contracts, and test files (callbacks) that interact with the deployed smart contract. You can then run the benchmark using the `run-benchmark.js` script and passing your configuration files that describe that benchmark.
    
## Add an Adaptor for a New DLT
  
New adaptors must be added within a new package, under `packages`, with the naming convention `caliper-<adaptor_name>`. Each adaptor must implement a new class inherited from `BlockchainInterface` as the adaptor for the DLT, as well as a `ClientFactory` and `ClientWorker`. For more information, consult our main documentation.
  