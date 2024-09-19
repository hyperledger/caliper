# Contributing to Hyperledger Caliper

Welcome to Hyperledger Caliper project, we are excited about the prospect of you contributing.

This guideline intends to make contribtuions to Caliper easier by:

* presenting a simple development workflow for contributors to follow;
* and providing a high-level description of the repository components.

If you have further suggestions about improving the guideline, then you can follow the presented workflow to make your contribution.

## Overview

The project uses GitHub to manage [issues](https://github.com/hyperledger/caliper/issues) (bug reports and feature requests) and [contributions](https://github.com/hyperledger/caliper/pulls) (in the form of pull requests).

> For general queries and discussion, please use the [#caliper](https://discord.com/channels/905194001349627914/941417677778473031) channel on the Hyperledger Discord Server (Discord Id required) or the Caliper [mailing list](https://lists.hyperledger.org/g/caliper) (LFID recommended).

The contribution process boils down to two major steps: opening an issue and submitting a pull request (PR). Opening issues before PRs serves the following purposes:

* Documenting bugs, related error logs, potential fixes, and/or workarounds that users can find using their favorite search engine.
* Providing a forum for discussions where both contributors and users can weigh in about new features and their potential design.
* Enabling easy traceability of contributions through the "Commit &rarr; PR &rarr; Issue" reference chain.

Opening issues can be omitted only in the case of trivial and small fixes (e.g., typo fixes, simple documentation enhancements, etc.).

## Opening Issues

Before opening an issue, make sure that:

1. You read the documentation carefully, so the observed error does not stem from incorrect Caliper configuration or usage.
2. You searched older issues (or other forums) for your question, maybe it is already answered/fixed.
3. It is worth to ask around on Discord, maybe other users already encountered your issue/task, and managed to solve it.

> When opening an issue about a potential bug or feature request, make sure to properly fill and format the issue contents!

Choose the **issue template** that suits your intent (bug report or feature request), then fill out the form as best as you can.

If you find the available issue templates too constraining, then you can still use the "blank" issue template for now (it will be deprecated in the future), and also let us know how we can improve the issue templates.

The details of the blank template should be filled according to the following guideline:

1. **Issue title**: Should be a concise sentence summarising the details below, including which component or part of the benchmarking process is affected. For example: `Fabric contract deployment silently fails in generator CI test`
2. **Context**: A detailed description of the context of the issue. Should include information about, for example, how you encountered the issue, what were you trying to achieve, why you consider this a bug, and how it affected your work with Caliper?
3. **Expected Behavior**: What was your expected outcome/behavior of the Caliper run?
4. **Actual Behavior**: What was your actually observered outcome/behaviour instead of the expected one?
5. **Possible Fix**: If you have already identified the source of the issue, you can also propose a possible fix for it. It does not necessarily have to be a working code, some general steps/ideas of a fix is also appreciated.
6. **Steps to Reproduce**: This is perhaps the most important part of an issue. Since Caliper is highly configurable and can interact with multiple SUTs, it is crucial for the maintainers to know the exact steps to reproduce an issue. Always try to provide (or just describe) a *minimal working example (MWE)* that can reproduce the issue. Also, please attach the following information to the issues whenever possible (preferably using collapsable code blocks or GitHub gists):
    * The benchmark configuration file content.
    * The network configuration file content.
    * The workload module implementation.
    * The exact error logs (and their surroundings).
    * Any other information you deem neccessary.
7. **Existing Issues**: You can also provide links to similar (or the same) issues in other forums (GitHub issues, StackOverflow questions or Discord messages). Such cross-linking can help us ensure that we can broadcast the potential fixes to multiple instances of the question.
8. **Your Environment**: Always include your execution environment information, including the used version/commit of Caliper, the operating system, Node.JS version, or any relevant information about your project that uses Caliper.

## Submitting Pull Requests

### Basic workflow

The following workflow should make your contribution process clean and straighforward (some deviations might be neccessary in exceptional cases):

> The following list assumes that you use the `git` command line tool. IDEs and graphical git tools should also expose the same commands if you prefer those.

1. Fork the Caliper repository. This needs to be done only once.
2. Clone the fork repository to your local machine (ideally done once):
    * Using the `HTTPS` method: `git clone https://github.com/<username>/caliper.git`
    * or using the `SSH` method: `git clone git@github.com:<username>/caliper.git`
3. Add the upstream/original Caliper repository as a remote, using the name `upstream` (ideally done once). This will allow you to easily sync your fork with the original repository.
    * `git remote add upstream https://github.com/hyperledger/caliper.git`

> The following steps follow the "feature branch" development practice, and should be performed for each of your contribution:

4. Checkout your `main` branch that will be the starting point/state of your contribution.
    * `git checkout main`
    * or `git checkout -b main` if the branch does not exist locally (only during your first checkout)
5. Retrieve the new updates from the `upstream` Caliper repository
    * `git fetch upstream` (downloads the updates locally)
    * then `git rebase upstream/main` ("adds" the updates to your local `main` brach)
    > This step is crucial to ensure that you always contribute based on the latest Caliper version, minimizing the chance of version control conflicts!
6. (Optional) Push your updated `main` branch to your remote repository just to keep things in sync
    * `git push`
7. Create a new feature branch (named `my-bug-fix`) from the updated `main` branch:
    * `git checkout -b my-bug-fix`
    * then `git push --set-upstream origin my-bug-fix` to push the new branch to your remote repository
8. Implement and test your contribution
    * The `.build/checks-and-unit-tests.sh` script runs the basic tests for the repository
    * The `BENCHMARK=<test_name> .build/benchmark-integration-test-direct.sh` script can run one of the CI integration tests, depending on the value of `<test_name>`:
        * `BESU`
        * `ETHEREUM`
        * `FABRIC`
        * `GENERATOR`
    > Make sure that the tests pass locally before pushing your changes and opening a PR!
9. Commit your changes to your local feature branch, **adding the DCO sign-off**:
    * `git commit -s -m "Commit message"`
    * or `git commit -s` (without the `-m` parameter) to make git open up the configured text editor where you can write a detailed, multi-line commit message:
        * The first line is a concise description of the commit (its purpose, what does it fix, etc).
        * After a blank line, you can go into details about the changes of the commit.
10. Push your changes to your remote branch:
    * `git push`
11. Open a PR using the GitHub webpage.

### Updating PRs

It is possible that the maintainers/reviewers request some changes before your PR can be merged. In that case, just add your changes to your feature branch using a new signed commit (based on the above workflow), then push it to your remote branch. The PR will automatically pick up the new commit.

> The maintainers can/will squash commits before merging to keep a simpler commit history for the project.

## How to contribute

We are using GitHub issues for bug reports and feature requests.

If you find any bug in the source code or have any trivial changes (such as typos fix, minor feature), you can raise an issue or delivery a fix via a pull request directly.

If you have any enhancement suggestions or want to help extend caliper with more DLTs or have any other major changes, please start by opening an issue first. That way, relevant parties (e.g. maintainers or main contributors of the relevant subsystem) can have a chance to look at it before you do any work.

All PRs must get at least one review, you can ask `hyperledger/caliper-committers` for review. Normally we will review your contribution in one week. If you haven’t heard from anyone in one week, feel free to @ or mail a maintainer to review it.

All PRs must be signed before be merged, be sure to use `git commit -s` to commit your changes.

If a PR is reviewed and changes are requested then please do not force push the changes, push the changes into a new commit, this makes it easier to see the changes between the previously reviewed code and the new changes.

We use Github Actions to test the build - please test on your local branch before raising a PR.

There is also [Discord](https://discord.com/channels/905194001349627914/941417677778473031) with a Caliper channel for communication, anybody is welcome to join.

## Caliper Components

The project is maintained as a Node.js monorepository. Accordingly, it can seem overwhelming at first to navigate its content. The following sections list and introduce the main components of the repository.

## Installing the Caliper code base

!!! note

    *this section is intended only for developers who would like to modify the Caliper code-base and experiment with the changes locally before raising pull requests. You should perform the following steps every time you make a modification you want to test, to correctly propagate any changes.*

The workflow of modifying the Caliper code-base usually consists of the following steps:

1. [Bootstrapping the repository](https://hyperledger.github.io/caliper/v0.6.0/getting-started/contributing/#bootstrapping-the-caliper-repository)
2. [Modifying and testing the code](https://hyperledger.github.io/caliper/v0.6.0/getting-started/contributing/#testing-the-code)
3. [Publishing package changes locally](https://hyperledger.github.io/caliper/v0.6.0/getting-started/contributing/#publishing-to-local-npm-repository)
4. [Building the Docker image](https://hyperledger.github.io/caliper/v0.6.0/getting-started/contributing/#building-the-docker-image)

### Bootstrapping the Caliper repository

To install the basic dependencies of the repository, and to resolve the cross-references between the different packages in the repository, you must execute the following commands from the root of the repository directory:

1. `./.build/check-prerequisites.sh`: Checks the version of Node and NPM in the system and warns if the versions are not compatible.

2. `npm ci`: Installs the dependencies of the repository from the `package-lock.json` file.

Or as a one-liner:

```sh
user@ubuntu:~/caliper$ ./.build/check-prerequisites.sh && npm ci
```
!!! note

    *do not run any of the above commands with `sudo`, as it will cause the bootstrap process to fail.*

### Public/published packages

The [https://github.com/hyperledger/caliper/tree/main/packages/](packages/) directory contains the following public/published packages:

* [caliper-cli](https://github.com/hyperledger/caliper/tree/main/packages/caliper-cli/): The command line interface (CLI) of Caliper.
* [caliper-core](https://github.com/hyperledger/caliper/tree/main/packages/caliper-core/): The core and common codebase of Caliper, used by the other packages.
* [caliper-ethereum](https://github.com/hyperledger/caliper/tree/main/packages/caliper-ethereum/): The Ethereum and Hyperledger Besu connector implementation.
* [caliper-fabric](https://github.com/hyperledger/caliper/tree/main/packages/caliper-fabric/): The Hyperledger Fabric connector implementation.
* [generator-caliper](https://github.com/hyperledger/caliper/tree/main/packages/generator-caliper/): The Yeaoman generator for Caliper configuration files.

### Internal packages

The [https://github.com/hyperledger/caliper/tree/main/packages/](packages/) directory contains the following internal packages:

* [caliper-publish](https://github.com/hyperledger/caliper/tree/main/packages/caliper-publish/): Utility CLI for publishing Caliper to NPM and DockerHub.
* [caliper-tests-integration](https://github.com/hyperledger/caliper/tree/main/packages/caliper-tests-integration/): Collection of CI integration tests.

## Testing Methodologies

This section outlines the testing methodologies that this project follows, including both unit-level and integration-level testing.

### Unit Level Testing

Unit testing focuses on testing individual packages in isolation. The tests are typically located within a test folder at the same level as the corresponding lib folder, mirroring the structure of the lib folder for easy navigation. This setup ensures that each component of the code is verified independently, confirming that it behaves as expected without interference from other parts of the system.

#### Unit Testing Dependencies and Their Use

The following are the recommended testing modules for this project. While these tools are commonly used in the current codebase, other appropriate tools may be used as long as they facilitate effective testing.

* [mockery](https://www.npmjs.com/package/mockery): Mockery is a simple module for mocking Node.js modules during testing. It allows you to replace real modules with mocks or stubs.
  
* [mocha](https://mochajs.org/): Mocha is a feature-rich JavaScript test framework that runs on Node.js and in the browser. It facilitates asynchronous testing, making it easy to write simple and flexible tests.

* [chai](https://www.npmjs.com/package/chai): Chai is a BDD/TDD assertion library for Node.js and the browser. It can be paired with any JavaScript testing framework. We use it to create readable and expressive assertions.

* [sinon](https://sinonjs.org/releases/v18/): Sinon is a standalone test spies, stubs, and mocks for JavaScript. It works with any test framework and integrates well with Mocha and Chai. We utilize Sinon for checking how functions are called during testing.

* [sinon-chai](https://www.npmjs.com/package/sinon-chai): This library provides a set of custom assertions for using Sinon with Chai. It allows you to write more readable assertions for Sinon spies, stubs, and mocks.

* [nyc](https://www.npmjs.com/package/nyc): NYC is a command-line utility for generating code coverage reports. It is often used with Mocha to ensure that tests cover as much code as possible.

#### Mandatory Tools in the Testing Pipeline

In addition to the testing frameworks, the following tools are mandatory for all testing pipelines:

* [eslint](https://eslint.org/): ESLint is a static code analysis tool for identifying problematic patterns in JavaScript code. It is essential for maintaining code quality.
* [license-check-and-add](https://www.npmjs.com/package/license-check-and-add): This tool ensures that all files in the codebase contain the required license headers. It is mandatory for all code submissions.

#### Points to Note for Adding a Conforming Unit Test

When writing unit tests, the following structure and practices are mandatory:

1. **License Header**: All test files must include the project's license header.
2. **'use strict' Directive**: Ensure strict mode is enabled in all test files.
3. **Test Organization**:
    * Use `describe` blocks to group related test cases.
    * Use `it` statements for individual test cases.
    * Nested `describe` blocks are encouraged for organizing complex test scenarios.
4. **Consistent Test Naming**: Test descriptions should flow naturally, making it clear what behavior is being tested (e.g., 'should return the correct value when input is valid').
5. **Mocking Guidance**: Be cautious with mocks that persist across tests. Always clean up after each test to avoid unexpected behavior.
6. **Test Patterns**: Refer to the Fabric Unit tests for examples of recommended patterns and best practices.
7. **Final Checks**: Always run all unit tests before submitting a PR and ensure no `.only` is left in the code, which would skip other tests.

### Integration Level Testing

Integration testing ensures that Caliper integrates correctly with various packages, effectively testing the functionality of the package itself. These tests are organized within the caliper-tests-integration folder, with each test suite dedicated to a specific package or module.

### Testing the code

Caliper has both unit tests and integration tests.

Unit tests can be run using `npm test` either in the root of the caliper source tree (to run them all) or within the specific package (eg caliper-fabric) to run just the tests within that package.

To run the integration tests for a specific SUT, use the following script from the root directory of the repository, setting the `BENCHMARK` environment variable to the platform name:

```sh
user@ubuntu:~/caliper$ BENCHMARK=fabric ./.build/benchmark-integration-test-direct.sh
```

The following platform tests (i.e., valid BENCHMARK values) are available: besu, ethereum, fabric.

A PR must pass all unit and integration tests.

If you would like to run other examples, then you can directly access the CLI in the `packages/caliper-cli` directory, without publishing anything locally.

```sh
user@ubuntu:~/caliper$ node ./packages/caliper-cli/caliper.js launch manager \
    --caliper-workspace ~/caliper-benchmarks \
    --caliper-benchconfig benchmarks/scenario/simple/config.yaml \
    --caliper-networkconfig networks/fabric/test-network.yaml
```

## Creating New SUT Connectors

Connectors are relatively heavy components in Caliper. Before you attempt to create a new connector for a new SUT type, consult with the Caliper maintainers (on Discord, or in the form of a feature request).

> More importantly, make sure that you are overly familiar with the documentation page about [implementing new connectors](https://hyperledger.github.io/caliper/v0.6.0/connectors/writing-connectors/).

### Publishing to local NPM repository

The NPM publishing and installing steps for the modified code-base can be tested through a local NPM proxy server, Verdaccio. The steps to perform are the following:

1. Start a local Verdaccio server to publish to
2. Publish the packages from the Caliper repository to the Verdaccio server
3. Install and bind the CLI from the Verdaccio server
4. Run the integration tests or any sample benchmark

The `packages/caliper-publish` directory contains an internal CLI for easily managing the following steps. So the commands of the following sections must be executed from the `packages/caliper-publish` directory:

```sh
user@ubuntu:~/caliper$ cd ./packages/caliper-publish
```

!!! note

    *use the `--help` flag for the following CLI commands and sub-commands to find out more details.*

#### Starting Verdaccio

To setup and start a local Verdaccio server, run the following npm command:

```sh
user@ubuntu:~/caliper/packages/caliper-tests-integration$ npm run start_verdaccio
...
[PM2] Spawning PM2 daemon with pm2_home=.pm2
[PM2] PM2 Successfully daemonized
[PM2] Starting /home/user/projects/caliper/packages/caliper-tests-integration/node_modules/.bin/verdaccio in fork_mode (1 instance)
[PM2] Done.
| App name  | id | mode | pid    | status | restart | uptime | cpu | mem       | user   | watching |
|-----------|----|------|--------|--------|---------|--------|-----|-----------|--------|----------|
| verdaccio | 0  | fork | 115203 | online | 0       | 0s     | 3%  | 25.8 MB   | user   | disabled |

Use `pm2 show <id|name>` to get more details about an app
```

The Verdaccio server is now listening on the following address: `http://localhost:4873`

#### Publishing the packages

Once Verdaccio is running, you can run the following command to publish every Caliper package locally:

```sh
user@ubuntu:~/caliper/packages/caliper-publish$ ./publish.js npm --registry "http://localhost:4873"
...
+ @hyperledger/caliper-core@0.6.1-unstable-20240422122901
[PUBLISH] Published package @hyperledger/caliper-core@0.6.1-unstable-20240422122901
...
+ @hyperledger/caliper-fabric@0.6.1-unstable-20240422122901
[PUBLISH] Published package @hyperledger/caliper-fabric@0.6.1-unstable-20240422122901
...
+ @hyperledger/caliper-cli@0.6.1-unstable-20240422122901
[PUBLISH] Published package @hyperledger/caliper-cli@0.6.1-unstable-20240422122901
```

Take note of the dynamic version number you see in the logs, you will need it to install you modified Caliper version from Verdaccio (the unstable tag is also present on NPM, so Verdaccio would probably pull that version instead of your local one).

Since the published packages include a second-precision timestamp in their versions, you can republish any changes immediately without restarting the Verdaccio server and without worrying about conflicting packages.

#### Running package-based tests

Once the packages are published to the local Verdaccio server, we can use the usual NPM install approach. The only difference is that now we specify the local Verdaccio registry as the install source instead of the default, public NPM registry:

```sh
user@ubuntu:~/caliper-benchmarks$ npm install --registry=http://localhost:4873 --only=prod \
    @hyperledger/caliper-cli@0.6.1-unstable-20240422122901
user@ubuntu:~/caliper-benchmarks$ npx caliper bind --caliper-bind-sut fabric:fabric-gateway
user@ubuntu:~/caliper-benchmarks$ npx caliper launch manager \
    --caliper-workspace . \
    --caliper-benchconfig benchmarks/scenario/simple/config.yaml \
    --caliper-networkconfig networks/fabric/test-network.yaml
```

!!! note

    *we used the local registry only for the Caliper packages. The binding happens through the public NPM registry. Additionally, we performed the commands through npx and the newly installed CLI binary (i.e., not directly calling the CLI code file).*

### Building the Docker image

Once the modified packages are published to the local Verdaccio server, you can rebuild the Docker image. The Dockerfile is located in the `packages/caliper-publish` directory.

To rebuild the Docker image, execute the following:

```sh
user@ubuntu:~/caliper/packages/caliper-publish$ ./publish.js docker
...
Successfully tagged hyperledger/caliper:manager-unstable-20220206065953
[BUILD] Built Docker image "hyperledger/caliper:manager-unstable-20220206065953"
```

Now you can proceed with the Docker-based benchmarking as described in the previous sections.

!!! note

    *once you are done with the locally published packages, you can clean them up the following way:*

    ```sh
    user@ubuntu:~/caliper/packages/caliper-publish$ ./publish.js verdaccio stop
    ```

## Caliper Structure

Caliper is modularised under `packages` into the following components:

**caliper-cli**
This is the Caliper CLI that enables the running of a benchmark

**caliper-core**
Contains all the Caliper core code.

**caliper-**
Each `caliper-<adapter>` is a separate package that contains a distinct adaptor implementation to interact with different blockchain technologies. Current adaptors include:

- caliper-ethereum
- caliper-fabric

Each adapter extends the `ConnectorBase` from the core package, as well as exports a `ConnectorFactory` function.

**caliper-tests-integration**
This is the integration test suite used for caliper; it runs in the Azure pipelines build and can (should) be run locally when checking code changes. Please see the readme within the package for more details.

## Dependency management in the monorepo

### npm version

For developing Caliper, the minimum required version of npm is `7.24.2`. This is because npm 7 introduced the npm workspaces feature, which is used to manage the Caliper monorepo.

In case the npm version is not sufficient, the following error may be thrown when trying to install the dependencies:

```sh
user@ubuntu:~/caliper$ npm install
npm ERR! code ENOTSUP
npm ERR! notsup Unsupported engine for caliper@0.6.1-unstable: wanted: {"node":">=18.19.0","npm":">=7.24.2"} (current: {"node":"14.21.3","npm":"6.14.18"})
npm ERR! notsup Not compatible with your version of node/npm: caliper@0.6.1-unstable
npm ERR! notsup Not compatible with your version of node/npm: caliper@0.6.1-unstable
npm ERR! notsup Required: {"node":">=18.19.0","npm":">=7.24.2"}
npm ERR! notsup Actual:   {"npm":"6.14.18","node":"14.21.3"}
```

If the npm version is lower than `7.24.2`, you can update it to latest by running the following command:

```sh
npm install -g npm@latest
```

### Adding new dependencies

The monorepo is managed using npm workspaces. So to add a dependency to a package, the following command should be executed:

```sh
user@ubuntu:~/caliper$ npm install <dependency> --workspace=<package>
```

### Removing unused dependencies

To remove a dependency from a package, the following command should be executed:

```sh
user@ubuntu:~/caliper$ npm uninstall <dependency> --workspace=<package>
```

### Managing the package-lock.json file

The `package-lock.json` file is generated by npm and it is used to lock the dependency versions. It is generated automatically when installing dependencies, and it should be committed to the repository. Please make sure that the right version of npm is used when installing dependencies, otherwise the `package-lock.json` file may be updated unnecessarily.

### How dependency conflicts are resolved in workspaces

When installing dependencies to a workspace, if the dependency is already installed as a direct or indirect dependency of another workspace, npm will try to reuse the existing version. If the version is not compatible with the one specified in the workspace, npm will try to resolve the conflict by installing the requested version of the dependency in the `node_modules` directory of the workspace.

## Add an Adaptor for a New DLT

New adapters must be added within a new package, under `packages`, with the naming convention `caliper-<adapter_name>`. Each adapter must implement a new class extended from `ConnectorBase` as the adapter for the DLT, as well export a `ConnectorFactory` function. Please refer to the existing Connectors for examples and requirements for implementation.

## Inclusive language guidelines

Please adhere to the inclusive language guidelines that the project has adopted as you make documentation updates.

- Consider that users who will read the docs are from different backgrounds and cultures and that they have different preferences.
- Avoid potential offensive terms and, for instance, prefer “allow list and deny list” to “white list and black list”.
- We believe that we all have a role to play to improve our world, and even if writing inclusive documentation might not look like a huge improvement, it’s a first step in the right direction.
- We suggest to refer to [Microsoft bias free writing guidelines](https://docs.microsoft.com/en-us/style-guide/bias-free-communication) and [Google inclusive doc writing guide](https://developers.google.com/style/inclusive-documentation) as starting points.

## Building the documentation

### Requirements

- Python
- Pip (Python package installer)

### Installation

1. **Clone the Repository**:
   ```sh
   git clone https://github.com/hyperledger/caliper.git
   cd caliper
   ```

2. **Go to the documentation folder**:
    ```sh
    cd docs
    ```

3. **Install Dependencies**:
    ```sh
    pip install -r pip-requirements.txt
    ```

4. **Building the Documentation**:
    To build the documentation, run:
    ```sh
    mkdocs build
    ```
    
    This command generates static files in the site directory.

5. **Previewing Locally**:
    To preview your documentation locally, use:
    ```sh
    mkdocs serve
    ```

    This starts a local development server at [http://127.0.0.1:8000/](http://127.0.0.1:8000/) where you can view your changes in real-time.

## License

The Caliper codebase is released under the Apache 2.0 license. Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.