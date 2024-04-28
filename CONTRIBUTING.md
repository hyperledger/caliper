# Contributing to Hyperledger Caliper

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
    *  `git remote add upstream https://github.com/hyperledger/caliper.git`

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

## Caliper Components

The project is maintained as a Node.js monorepository. Accordingly, it can seem overwhelming at first to navigate its content. The following sections list and introduce the main components of the repository.

### Root layout

You can find the following main component types at the root of the repository:
* Project-related documentation files
    * [CHANGELOG.md](CHANGELOG.md)
    * [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
    * [CONTRIBUTING.md](CONTRIBUTING.md)
    * [ISSUE_TEMPLATE.md](ISSUE_TEMPLATE.md)
    * [LICENSE](LICENSE)
    * [MAINTAINERS.md](MAINTAINERS.md)
    * [PULL_REQUEST_TEMPLATE.md](PULL_REQUEST_TEMPLATE.md)
    * [SECURITY.md](SECURITY.md)
* Linting- and formatting-related files
    * [.editorconfig](.editorconfig)
    * [.eslintignore](.eslintignore)
    * [repolint.json](repolint.json)
* Dependency- and build-related files/directories
    * [.build/](.build/)
    * [scripts/](scripts/)
    * [azure-pipelines.yml](azure-pipelines.yml)
    * [package.json](package.json)
* Main code-based components of Caliper in the [packages/](packages/) directory

### Public/published packages

The [packages/](packages/) directory contains the following public/published packages:
* [caliper-cli](packages/caliper-cli/): The command line interface (CLI) of Caliper.
* [caliper-core](packages/caliper-core/): The core and common codebase of Caliper, used by the other packages.
* [caliper-ethereum](packages/caliper-ethereum/): The Ethereum and Hyperledger Besu connector implementation.
* [caliper-fabric](packages/caliper-fabric/): The Hyperledger Fabric connector implementation.
* [generator-caliper](packages/generator-caliper/): The Yeaoman generator for Caliper configuration files.

### Internal packages

The [packages/](packages/) directory contains the following internal packages:
* [caliper-publish](packages/caliper-publish/): Utility CLI for publishing Caliper to NPM and DockerHub.
* [caliper-tests-integration](packages/caliper-tests-integration/): Collection of CI integration tests.


## Creating New SUT Connectors

Connectors are relatively heavy components in Caliper. Before you attempt to create a new connector for a new SUT type, consult with the Caliper maintainers (on Discord, or in the form of a feature request).

> More importantly, make sure that you are overly familiar with the documentation page about [implementing new connectors](https://hyperledger.github.io/caliper/vNext/writing-connectors/).

## License
Hyperledger Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the [LICENSE](LICENSE) file. Hyperledger Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0), available at http://creativecommons.org/licenses/by/4.0/.
