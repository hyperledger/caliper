---
layout: vNext
title:  "Installing and Running Caliper"
categories: docs
permalink: /vNext/installing-caliper/
order: 2
---

## Table of contents

{:.no_toc}

- TOC
{:toc}

## Overview

Caliper is published as the [@hyperledger/caliper-cli](https://www.npmjs.com/package/@hyperledger/caliper-cli) NPM package and the [hyperledger/caliper](https://hub.docker.com/r/hyperledger/caliper) Docker image, both containing the CLI binary. Refer to the [Installing from NPM](#installing-from-npm) and [Using the Docker image](#using-the-docker-image) sections for the available versions and their intricacies.

Installing and running Caliper usually consists of the following steps, thoroughly detailed by the remaining sections:

1. Acquire the Caliper CLI either from NPM or from DockerHub.
2. Execute a _bind_ command through the CLI. This step pulls the specified version of SDK packages for the selected platform.
3. Start the benchmark through the CLI or by starting the Docker container.

The examples in the rest of the documentation use the [caliper-benchmarks](https://github.com/hyperledger/caliper-benchmarks) repository as the Caliper _workspace_ since it contains many sample artifacts for benchmarking.

> **Important:** make sure you check out the appropriate tag/commit of the repository, matching the version of Caliper you use.

To clone the `caliper-benchmarks` repository, run:

```bash
git clone https://github.com/hyperledger/caliper-benchmarks.git
cd caliper-benchmarks
git checkout <your Caliper version>
```

> __Note:__ If you are running your custom benchmark, then change this directory path (and other related configurations) accordingly in the examples.

## The Caliper CLI

Unless you are embedding the Caliper packages in your own application, you will probably use Caliper through its command line interface (CLI). The other sections will introduce the different ways of acquiring and calling the Caliper CLI. This section simply focuses on the API it provides.

> __Note:__ The following examples assume a locally installed CLI in the `~/caliper-benchmarks` directory, hence the `npx` call before the `caliper` binary. Refer to the [Local NPM install](#local-npm-install) section for the specifics.

The entry point of the CLI is the `caliper` binary. You can confirm whether the CLI is installed correctly by checking its version:

```console
user@ubuntu:~/caliper-benchmarks$ npx caliper --version
v0.5.1
```

The CLI provides multiple commands to perform different tasks. To check the available commands and their descriptions, execute:

```console
user@ubuntu:~/caliper-benchmarks$ npx caliper --help
caliper <command>

Commands:
  caliper.js bind [options]       Bind Caliper to a specific SUT and its SDK version
  caliper.js launch <subcommand>  Launch a Caliper process either in a manager or worker role.
  caliper.js unbind [options]     Unbind Caliper from a previously bound SUT and its SDK version
  caliper.js completion           generate completion script

Options:
  --help, -h  Show usage information  [boolean]
  --version   Show version information  [boolean]

Examples:
  caliper bind
  caliper unbind
  caliper launch manager
  caliper launch worker

For more information on Hyperledger Caliper: https://hyperledger.github.io/caliper/
```

You can also request the help page of a specific command, as demonstrated by the next subsections.

> __Note:__ the command options can be set either through the command line, or from various other sources supported by the [configuration mechanism](./Runtime_Configuration.md) of Caliper. This flexibility makes it easy to embed the CLI in different environments.

### The bind command

Acquiring Caliper is as easy as installing a single NPM package, or pulling a single Docker image. However, this single point of install necessitates an additional step of telling Caliper which platform to target and which platform SDK version to use. This step is called _binding_, provided by the `bind` CLI command.

To have a look at the help page of the command, execute:

```console
user@ubuntu:~/caliper-benchmarks$ npx caliper bind --help
Usage:
  caliper bind --caliper-bind-sut fabric:fabric-gateway --caliper-bind-cwd ./ --caliper-bind-args="-g"

Options:
  --help, -h           Show usage information  [boolean]
  --version            Show version information  [boolean]
  --caliper-bind-sut   The name and version of the platform and its SDK to bind to  [string]
  --caliper-bind-cwd   The working directory for performing the SDK install  [string]
  --caliper-bind-args  Additional arguments to pass to "npm install". Use the "=" notation when setting this parameter  [string]
  --caliper-bind-file  Yaml file to override default (supported) package versions when binding an SDK  [string]
```

 The binding step technically consists of an extra `npm install` call with the appropriate packages and install settings, fully managed by the CLI. The following parameters can be set for the command:

 * __SUT/platform name and SDK version:__ specifies the name of the target platform and its SDK version to install e.g., `fabric:fabric-gateway`
 * __Working directory:__ the directory from which the `npm install` command must be performed. Defaults to the current working directory
 * __User arguments:__ additional arguments to pass to `npm install`, e.g., `--save`

The following SUT name and SDK version combinations are supported:

* **besu**: `1.3.2`, `1.3`, `1.4`
* **ethereum**: `1.2.1`, `1.3`
* **fabric**: `1.4`, `2.2`, `fabric-gateway`
> __Note:__ Ensure that the SDK you are binding is compatible with the the SUT version that you intend to target.

The `bind` command is useful when you plan to run multiple benchmarks against the same SUT version. Bind once, then run different benchmarks without the need to bind again. As you will see in the next sections, the launcher commands for the manager and worker processes can also perform the binding step if the required parameter is present.

#### Custom bindings

The built-in bindings can be overridden by setting the `caliper-bind-file` parameter to a YAML file path. The file must match the structure of the [default binding file](https://github.com/hyperledger/caliper/blob/main/packages/caliper-cli/lib/lib/config.yaml), documented [here](../writing-connectors#binding-configuration). This way you can use experimental SDK versions that are not (yet) officially supported by Caliper. __This also means that we cannot provide help for such SDK versions!__

### The unbind command

It might happen that you would like to switch between different SUT SDK versions/bindings during your measurements or project development. Depending on the SUT SDK, simply rebinding to a different version might leave behind unwanted packages, resulting in obscure errors.

To avoid this, the CLI provides an `unbind` command, that behaves exactly like the `bind` command (even uses the same arguments), but instead of installing the packages present in the binding specification, it removes them, leaving no trace of the previous binding.

To have a look at the help page of the command, execute:

```console
user@ubuntu:~/caliper-benchmarks$ npx caliper unbind --help
Usage:
  caliper unbind --caliper-bind-sut fabric:2.2 --caliper-bind-cwd ./ --caliper-bind-args="-g"

Options:
  --help, -h           Show usage information  [boolean]
  --version            Show version information  [boolean]
  --caliper-bind-sut   The name and version of the platform and its SDK to unbind  [string]
  --caliper-bind-cwd   The working directory for performing the SDK removal  [string]
  --caliper-bind-args  Additional arguments to pass to "npm remove". Use the "=" notation when setting this parameter  [string]
  --caliper-bind-file  Yaml file to override default (supported) package versions when unbinding an SDK  [string]
```

> __Note:__ It is recommended to either bind/unbind globally (as done by the Caliper Docker image), or use the `--caliper-bind-args="--save-dev"` argument when performing the binding/unbinding. This ensures that `npm` will correctly remove the packages.

### The launch command

Caliper runs a benchmark by using _worker_ processes to generate the workload, and by using a _manager_ process to coordinate the different benchmark rounds among the worker processes. Accordingly, the CLI provides commands for launching both manager and worker processes.

To have a look at the help page of the command, execute:

```console
user@ubuntu:~/caliper-benchmarks$ npx caliper launch --help
caliper launch <subcommand>

Launch a Caliper process either in a manager or worker role.

Commands:
  caliper launch manager [options]  Launch a Caliper manager process to coordinate the benchmark run
  caliper launch worker [options]  Launch a Caliper worker process to generate the benchmark workload

Options:
  --help, -h  Show usage information  [boolean]
  --version   Show version information  [boolean]
```

#### The launch manager command

The Caliper manager process can be considered as the entry point of a distributed benchmark run. It coordinates (and optionally spawns) the worker processes throughout the benchmark run.

To have a look at the help page of the command, execute:

```console
user@ubuntu:~/caliper-benchmarks$ npx caliper launch manager --help
Usage:
 caliper launch manager --caliper-bind-sut fabric:2.2 [other options]

Options:
  --help, -h           Show usage information  [boolean]
  --version            Show version information  [boolean]
  --caliper-bind-sut   The name and version of the platform to bind to  [string]
  --caliper-bind-cwd   The working directory for performing the SDK install  [string]
  --caliper-bind-args  Additional arguments to pass to "npm install". Use the "=" notation when setting this parameter  [string]
  --caliper-bind-file  Yaml file to override default (supported) package versions when binding an SDK  [string]
```

As you can see, the `launch manager` command can also process the parameters of the `bind` command, just in case you would like to perform the binding and the benchmark run in one step.

However, the command __requires__ the following parameters to be set:

* __caliper-workspace:__ the directory serving as the root of your project. Every relative path in other configuration files or settings will be resolved from this directory. The workspace concept was introduced to make Caliper projects portable across different machines.
* __caliper-benchconfig:__ the path of the file containing the configuration of the test rounds, as detailed in the [Architecture page](./Architecture.md#benchmark-configuration-file). _Should be relative_ to the workspace path.
* __caliper-networkconfig:__ the path of the file containing the network configuration/description for the selected SUT, detailed in the configuration pages of the respective adapters. _Should be relative_ to the workspace path.

#### The launch worker command

The Caliper worker processes are responsible for generating the workload during the benchmark run. Usually more than one worker process is running, coordinated by the single manager process.

To have a look at the help page of the command, execute:

```console
user@ubuntu:~/caliper-benchmarks$ npx caliper launch worker --help
Usage:
 caliper launch manager --caliper-bind-sut fabric:2.2 [other options]

Options:
  --help, -h           Show usage information  [boolean]
  --version            Show version information  [boolean]
  --caliper-bind-sut   The name and version of the platform to bind to  [string]
  --caliper-bind-cwd   The working directory for performing the SDK install  [string]
  --caliper-bind-args  Additional arguments to pass to "npm install". Use the "=" notation when setting this parameter  [string]
  --caliper-bind-file  Yaml file to override default (supported) package versions when binding an SDK  [string]
```

As you can see, you can configure the worker processes the same way as the manager process. Including the optional binding step, but also the three mandatory parameters mentioned in the previous section.

#### Caliper test phase control

Caliper commands are capable of passing all [runtime configuration settings](./Runtime_Configuration.md). A subset of these commands are for flow control that provide direct control over the following Caliper phases:

- start
- init
- install
- test
- end

It is possible to skip, or perform only one of the above phases through use of the correct flag. For instance, it is common to have an existing network that may be targeted by Caliper through the provision of a `--caliper-flow-only-test` flag.

## Installing from NPM

Caliper is published as the [@hyperledger/caliper-cli](https://www.npmjs.com/package/@hyperledger/caliper-cli) NPM package, providing a single point of install for every supported adapter.

### Versioning semantics

Before explaining the steps for installing Caliper, let's take a look at the `Versions` page of the CLI package. You will see a list of tags and versions. If you are new to NPM, think of versions as _immutable_ pointers to a specific version (duh) of the source code, while tags are _mutable_ pointers to a specific version. So tags can change where they point to. Easy, right?

But why is all this important to you? Because Caliper is still in its pre-release life-cycle (< v1.0.0), meaning that even minor version bumps are allowed to introduce breaking changes. And if you use Caliper in your project, you might run into some surprises depending on how you install Caliper from time to time.

> __Note:__ Until Caliper reaches v1.0.0, always use the explicit version numbers when installing from NPM. So let's forget about the `latest` tag, as of now they are just a mandatory hindrance of NPM. We deliberately do not provide such tags for the Docker images.

Let's see the three types of version numbers you will encounter:

* `0.2.0`: Version numbers of this form denote releases deemed _stable_ by the maintainers. Such versions have a corresponding GitHub tag, both in the `caliper` and `caliper-benchmarks` repositories. Moreover, the latest stable version is documented by the matching version of the documentation page. So make sure to align the different versions if you run into some issue.
* `0.5.1-unstable-20240422122901`: Such version "numbers" denote _unstable_ releases that are published upon every merged pull request (hence the timestamp at the end), and eventually will become a stable version, e.g., `0.5.1`. This way you always have access to the NPM (and Docker) artifacts pertaining to the `main` branch of the repository. Let's find and fix the bugs of new features before they make it to the stable release!
* `unstable`: This is the very latest unstable release that has been published and would correspond to a version also published as `0.5.1-unstable-<some date>`. This lets you quickly work with the very latest code from the `main` branch.

> __Note:__ The newest unstable release always corresponds to the up-to-date version of the related repositories, and the `vNext` version of the documentation page!

### Pre-requisites

* Node.js v18 LTS or v20 LTS or later LTS version is required to install the Caliper CLI from NPM:
* Docker engine version 20.10.11 or later is required for use with the Caliper docker image

The following tools may be required depending on which SUT and version you bind to

* python3, make, g++ and git (for fetching and compiling some packages during bind)

### Local NPM install

> __Note:__ this is the highly recommended way to install Caliper for your project. Keeping the project dependencies local makes it easier to setup multiple Caliper projects. Global dependencies would require re-binding every time before a new benchmark run (to ensure the correct global dependencies).

1. Install the Caliper CLI as you would any other NPM package. It is highly recommended to explicitly specify the version number, e.g., `@hyperledger/caliper-cli@0.5.1`
2. Bind the CLI to the required platform SDK (e.g., `fabric` with the `fabric-gateway` SDK).
3. Invoke the local CLI binary (using [npx](https://www.npmjs.com/package/npx)) with the appropriate parameters. You can repeat this step for as many benchmarks as you would like.

Putting it all together:

```console
user@ubuntu:~/caliper-benchmarks$ npm install --only=prod @hyperledger/caliper-cli@0.5.1
user@ubuntu:~/caliper-benchmarks$ npx caliper bind --caliper-bind-sut fabric:fabric-gateway
user@ubuntu:~/caliper-benchmarks$ npx caliper launch manager \
    --caliper-workspace . \
    --caliper-benchconfig benchmarks/scenario/simple/config.yaml \
    --caliper-networkconfig networks/fabric/test-network.yaml
```

We could also perform the binding automatically when launching the manager process (note the extra parameter for `caliper launch manager`):

```console
user@ubuntu:~/caliper-benchmarks$ npm install --only=prod @hyperledger/caliper-cli@0.5.1
user@ubuntu:~/caliper-benchmarks$ npx caliper launch manager \
    --caliper-bind-sut fabric:fabric-gateway \
    --caliper-workspace . \
    --caliper-benchconfig benchmarks/scenario/simple/config.yaml \
    --caliper-networkconfig networks/fabric/test-network.yaml
```

> __Note:__ specifying the `--only=prod` parameter in step 2 will ensure that the default __latest__ SDK dependencies for __every__ platform will __not__ be installed. Since we perform an explicit binding anyway (and only for a single platform), this is the desired approach, while also saving some storage and time.

> __Note:__ always make sure that the versions of the SUT, the bound SDK and the used artifacts match!

### Global NPM install

> __Note:__ make sure that you have a really good reason for installing the Caliper CLI globally. The recommended approach is the local install. That way your project is self-contained and you can easily setup multiple projects (in multiple directories) that each target a different SUT (or just different SUT versions). Installing or re-binding dependencies globally can get tricky.

There are some minor differences compared to the local install:

1. You can perform the install, bind and run steps from anywhere (just specify the workspace accordingly).
2. You need to install the CLI globally (`-g` flag).
3. You need to tell the binding step to install the packages also globally (`--caliper-bind-args` parameter).
4. You can omit the `npx` command, since `caliper` will be in your `PATH`.

```console
user@ubuntu:~$ npm install -g --only=prod @hyperledger/caliper-cli@0.5.1
user@ubuntu:~$ caliper bind --caliper-bind-sut fabric:2.2 --caliper-bind-args=-g
user@ubuntu:~$ caliper launch manager \
    --caliper-workspace ~/caliper-benchmarks \
    --caliper-benchconfig benchmarks/scenario/simple/config.yaml \
    --caliper-networkconfig networks/fabric/test-network.yaml
```

> __Note:__ for global install you don't need to change the directory to your workspace, you can simply specify `--caliper-workspace ~/caliper-benchmarks`. But this way you can't utilize the auto complete feature of your commandline for the relative paths of the artifacts.

Depending on your NPM settings, your user might need write access to directories outside of its home directory. This usually results in _"Access denied"_ errors. The following pointers [here](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally) can guide you to circumvent the problem.

## Using the Docker image

Caliper is published as the [hyperledger/caliper](https://hub.docker.com/r/hyperledger/caliper) Docker image, providing a single point of usage for every supported adapter.

The important properties of the image are the following:

* Working directory: `/hyperledger/caliper/workspace`
* The commands are executed by the `node` user (created in the base image)
* The environment variable `CALIPER_WORKSPACE` is set to the `/hyperledger/caliper/workspace` directory
* The entry point is the __globally__ installed `caliper` binary
* The environment variable `CALIPER_BIND_ARGS` is set to `-g`, so the binding step also occurs globally.
* The default command is set to `--version`. This must be overridden when using the image.

This has the following implications:

1. It is recommended to mount your local workspace to the `/hyperledger/caliper/workspace` container directory. The default `CALIPER_WORKSPACE` environment variable value points to this location, so you don't need to specify it explicitly, one less setting to modify.
2. You need to choose a command to execute, either `launch manager` or `launch worker`. Check the Docker and Docker-Compose examples for the exact syntax.
3. The binding step is still necessary, similarly to the NPM install approach. Whether you use the `launch manager` or `launch worker` command, you only need to set the required binding parameter. The easiest way to do this is through the `CALIPER_BIND_SUT` environment variable.
4. You need to set the required parameters for the launched manager or worker. The easiest way to do this is through the `CALIPER_BENCHCONFIG` and `CALIPER_NETWORKCONFIG` environment variables.

### Starting a container

Parts of starting a Caliper container (following the recommendations above):

1. Pick the required image version
2. Mount your local working directory to a container directory
3. Set the required binding and run parameters

> __Note:__ the __latest__ (or any other) tag is __not supported__, i.e, you explicitly have to specify the image version you want: `hyperledger/caliper:0.5.1`, similar to the recommended approach for the [NPM packages](#versioning-semantics).

Putting it all together, split into multiple lines for clarity, and naming the container `caliper`:

```console
user@ubuntu:~/caliper-benchmarks$ docker run \
    -v $PWD:/hyperledger/caliper/workspace \
    -e CALIPER_BIND_SUT=fabric:fabric-gateway \
    -e CALIPER_BENCHCONFIG=benchmarks/scenario/simple/config.yaml \
    -e CALIPER_NETWORKCONFIG=networks/fabric/test-network.yaml \
    --name caliper hyperledger/caliper:0.5.1 launch manager
```

### Using docker-compose

The above command is more readable when converted to a `docker-compose.yaml` file:

```yaml
version: '2'

services:
    caliper:
        container_name: caliper
        image: hyperledger/caliper:0.5.1
        command: launch manager
        environment:
        - CALIPER_BIND_SUT=fabric:fabric-gateway
        - CALIPER_BENCHCONFIG=benchmarks/scenario/simple/config.yaml
        - CALIPER_NETWORKCONFIG=networks/fabric/test-network.yaml
        volumes:
        - ~/caliper-benchmarks:/hyperledger/caliper/workspace
```

Once you navigate to the directory containing the `docker-compose.yaml` file, just execute:

```bash
docker-compose up
```

## License

The Caliper codebase is released under the [Apache 2.0 license](./LICENSE.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.