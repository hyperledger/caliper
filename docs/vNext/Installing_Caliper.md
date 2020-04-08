---
layout: pageNext
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

The examples in the rest of the documentation use the [caliper-benchmarks](https://github.com/hyperledger/caliper-benchmarks) repository as the Caliper _workspace_ since it contains many sample artifacts for benchmarking. Make sure you check out the appropriate tag/commit of the repository, matching the version of Caliper you use.

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
v0.3.0
```

The CLI provides multiple commands to perform different tasks. To check the available commands and their descriptions, execute:

```console
user@ubuntu:~/caliper-benchmarks$ npx caliper --help
caliper <command>

Commands:
  caliper bind [options]       Bind Caliper to a specific SUT and its SDK version
  caliper launch <subcommand>  Launch a Caliper process either in a master or worker role.
  caliper completion           generate completion script

Options:
  --help, -h  Show usage information  [boolean]
  --version   Show version information  [boolean]

Examples:
  caliper bind
  caliper launch master
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
  caliper bind --caliper-bind-sut fabric:1.4.1 --caliper-bind-cwd ./ --caliper-bind-args="-g"

Options:
  --help, -h           Show usage information  [boolean]
  --version            Show version information  [boolean]
  --caliper-bind-sut   The name and version of the platform and its SDK to bind to  [string]
  --caliper-bind-cwd   The working directory for performing the SDK install  [string]
  --caliper-bind-args  Additional arguments to pass to "npm install". Use the "=" notation when setting this parameter  [string]
  --caliper-bind-file  Yaml file to override default (supported) package versions when binding an SDK  [string]
```

 The binding step technically consists of an extra `npm install` call with the appropriate packages and install settings, fully managed by the CLI. The following parameters can be set for the command:
 
 * __SUT/platform name and SDK version:__ specifies the name of the target platform and its SDK version to install e.g., `fabric:1.4.1`
 * __Working directory:__ the directory from which the `npm install` command must be performed. Defaults to the current working directory
 * __User arguments:__ additional arguments to pass to `npm install`, e.g., `--save`

The following SUT name (column header) and SDK version (column value) combinations are supported:


| besu   | burrow | ethereum | fabric | fisco-bcos | iroha  | sawtooth |
|:------:|:------:|:--------:|:------:|:----------:|:------:|:--------:|
| 1.3.2  | 0.23.0 | 1.2.1    | 1.0.0  | 2.0.0      | 0.6.3  | 1.0.0    |
| latest | latest | latest   | 1.1.0  | latest     | latest | 1.0.1    |
|        |        |          | 1.2.0  |            |        | 1.0.2    |
|        |        |          | 1.3.0  |            |        | 1.0.4    |
|        |        |          | 1.4.0  |            |        | 1.0.5    |
|        |        |          | 1.4.1  |            |        | latest   |
|        |        |          | 1.4.3  |            |        |          |
|        |        |          | 1.4.4  |            |        |          |
|        |        |          | 1.4.5  |            |        |          |
|        |        |          | 1.4.6  |            |        |          |
|        |        |          | 1.4.7  |            |        |          |
|        |        |          | latest |            |        |          |


> __Note:__ the `latest` value always points to the last explicit versions in the columns. However, it is recommended to explicitly specify the SDK version to avoid any surprise between two benchmark runs.

The `bind` command is useful when you plan to run multiple benchmarks against the same SUT version. Bind once, then run different benchmarks without the need to bind again. As you will see in the next sections, the launcher commands for the master and worker processes can also perform the binding step if the required parameter is present.  

> __Note:__ the built-in bindings can be overridden by setting the `caliper-bind-file` parameter to a YAML file path. The file must match the structure of the [default binding file](https://github.com/hyperledger/caliper/blob/master/packages/caliper-cli/lib/lib/config.yaml). This way you can use experimental SDK versions that are not (yet) officially supported by Caliper. __This also means that we cannot provide help for such SDK versions!__

### The launch command

Caliper runs a benchmark by using _worker_ processes to generate the workload, and by using a _master_ process to coordinate the different benchmark rounds among the worker processes. Accordingly, the CLI provides commands for launching both master and worker processes. 

To have a look at the help page of the command, execute:
```console
user@ubuntu:~/caliper-benchmarks$ npx caliper launch --help
caliper launch <subcommand>

Launch a Caliper process either in a master or worker role.

Commands:
  caliper launch master [options]  Launch a Caliper master process to coordinate the benchmark run
  caliper launch worker [options]  Launch a Caliper worker process to generate the benchmark workload

Options:
  --help, -h  Show usage information  [boolean]
  --version   Show version information  [boolean]
```

#### The launch master command

The Caliper master process can be considered as the entry point of a distributed benchmark run. It coordinates (and optionally spawns) the worker processes throughout the benchmark run.  

To have a look at the help page of the command, execute:
```console
user@ubuntu:~/caliper-benchmarks$ npx caliper launch master --help
Usage:
 caliper launch master --caliper-bind-sut fabric:1.4.1 [other options]

Options:
  --help, -h           Show usage information  [boolean]
  --version            Show version information  [boolean]
  --caliper-bind-sut   The name and version of the platform to bind to  [string]
  --caliper-bind-cwd   The working directory for performing the SDK install  [string]
  --caliper-bind-args  Additional arguments to pass to "npm install". Use the "=" notation when setting this parameter  [string]
  --caliper-bind-file  Yaml file to override default (supported) package versions when binding an SDK  [string]
```

As you can see, the `launch master` command can also process the parameters of the `bind` command, just in case you would like to perform the binding and the benchmark run in one step.

However, the command __requires__ the following parameters to be set:
* __caliper-workspace:__ the directory serving as the root of your project. Every relative path in other configuration files or settings will be resolved from this directory. The workspace concept was introduced to make Caliper projects portable across different machines.
* __caliper-benchconfig:__ the path of the file containing the configuration of the test rounds, as detailed in the [Architecture page](./Architecture.md#configuration-file). _Should be relative_ to the workspace path. 
* __caliper-networkconfig:__ the path of the file containing the network configuration/description for the selected SUT, detailed in the configuration pages of the respective adapters. _Should be relative_ to the workspace path.

#### The launch worker command

The Caliper worker processes are responsible for generating the workload during the benchmark run. Usually more than one worker process is running, coordinated by the single master process.  

To have a look at the help page of the command, execute:
```console
user@ubuntu:~/caliper-benchmarks$ npx caliper launch worker --help
Usage:
 caliper launch master --caliper-bind-sut fabric:1.4.1 [other options]

Options:
  --help, -h           Show usage information  [boolean]
  --version            Show version information  [boolean]
  --caliper-bind-sut   The name and version of the platform to bind to  [string]
  --caliper-bind-cwd   The working directory for performing the SDK install  [string]
  --caliper-bind-args  Additional arguments to pass to "npm install". Use the "=" notation when setting this parameter  [string]
  --caliper-bind-file  Yaml file to override default (supported) package versions when binding an SDK  [string]
```

As you can see, you can configure the worker processes the same way as the master process. Including the optional binding step, but also the three mandatory parameters mentioned in the previous section. 

## Installing from NPM

Caliper is published as the [@hyperledger/caliper-cli](https://www.npmjs.com/package/@hyperledger/caliper-cli) NPM package, providing a single point of install for every supported adapter. 

### Versioning semantics

Before explaining the steps for installing Caliper, let's take a look at the `Versions` page of the CLI package. You will see a list of tags and versions. If you are new to NPM, think of versions as _immutable_ pointers to a specific version (duh) of the source code, while tags are _mutable_ pointers to a specific version. So tags can change where they point to. Easy, right?

But why is all this important to you? Because Caliper is still in its pre-release life-cycle (< v1.0.0), meaning that even minor version bumps are allowed to introduce breaking changes. And if you use Caliper in your project, you might run into some surprises depending on how you install Caliper from time to time. 

> __Note:__ Until Caliper reaches v1.0.0, always use the explicit version numbers when installing from NPM. So let's forget about the `latest` and `unstable` tags, as of now they are just a mandatory hindrance of NPM. As you will see, we deliberately do not provide such tags for the Docker images.

Now that we ignored the tags, let's see the two types of version numbers you will encounter:
* `0.2.0`: Version numbers of this form denote releases deemed _stable_ by the maintainers. Such versions have a corresponding GitHub tag, both in the `caliper` and `caliper-benchmarks` repositories. Moreover, the latest stable version is documented by the `latest` version of the documentation page. So make sure to align the different versions if you run into some issue.
* `0.3.0-unstable-20200206065953`: Such version "numbers" denote _unstable_ releases that are published upon every merged pull request (hence the timestamp at the end), and eventually will become a stable version, e.g., `0.3.0`. This way you always have access to the NPM (and Docker) artifacts pertaining to the `master` branch of the repository. Let's find and fix the bugs of new features before they make it to the stable release! 

> __Note:__ The newest unstable release always corresponds to the up-to-date version of the related repositories, and the `vNext` version of the documentation page!

### Pre-requisites

The following tools are required to install the CLI from NPM:
* node-gyp, python2, make, g++ and git (for fetching and compiling some packages during install)
* Node.js v8.X LTS or v10.X LTS (for running Caliper)
* Docker and Docker Compose (only needed when running local examples, or using Caliper through its Docker image)

### Local NPM install

> __Note:__ this is the highly recommended way to install Caliper for your project. Keeping the project dependencies local makes it easier to setup multiple Caliper projects. Global dependencies would require re-binding every time before a new benchmark run (to ensure the correct global dependencies). 

1. Set your NPM project details with `npm init` (or just execute `npm init -y`) in your workspace directory (if you haven't done this already, i.e., you don't have a `package.json` file).
2. Install the Caliper CLI as you would any other NPM package. It is highly recommended to explicitly specify the version number, e.g., `@hyperledger/caliper-cli@0.3.0` 
3. Bind the CLI to the required platform SDK (e.g., `fabric` with the `1.4.0` SDK).
4. Invoke the local CLI binary (using [npx](https://www.npmjs.com/package/npx)) with the appropriate parameters. You can repeat this step for as many Fabric 1.4.0 benchmarks as you would like.

Putting it all together: 
```console
user@ubuntu:~/caliper-benchmarks$ npm init -y
user@ubuntu:~/caliper-benchmarks$ npm install --only=prod \
    @hyperledger/caliper-cli@0.3.0
user@ubuntu:~/caliper-benchmarks$ npx caliper bind \
    --caliper-bind-sut fabric:1.4.0
user@ubuntu:~/caliper-benchmarks$ npx caliper launch master \
    --caliper-workspace . \
    --caliper-benchconfig benchmarks/scenario/simple/config.yaml \
    --caliper-networkconfig networks/fabric/fabric-v1.4.1/2org1peergoleveldb/fabric-go.yaml
```

We could also perform the binding automatically when launching the master process (note the extra parameter for `caliper launch master`):
```console
user@ubuntu:~/caliper-benchmarks$ npm init -y
user@ubuntu:~/caliper-benchmarks$ npm install --only=prod \
    @hyperledger/caliper-cli@0.3.0
user@ubuntu:~/caliper-benchmarks$ npx caliper launch master \
    --caliper-bind-sut fabric:1.4.0 \
    --caliper-workspace . \
    --caliper-benchconfig benchmarks/scenario/simple/config.yaml \
    --caliper-networkconfig networks/fabric/fabric-v1.4.1/2org1peergoleveldb/fabric-go.yaml
```

> __Note:__ specifying the `--only=prod` parameter in step 2 will ensure that the default __latest__ SDK dependencies for __every__ platform will __not__ be installed. Since we perform an explicit binding anyway (and only for a single platform), this is the desired approach, while also saving some storage and time.

> __Note:__ always make sure that the versions of the SUT, the bound SDK and the used artifacts match!

### Global NPM install

> __Note:__ make sure that you have a really good reason for installing the Caliper CLI globally. The recommended approach is the local install. That way your project is self-contained and you can easily setup multiple projects (in multiple directories) that each target a different SUT (or just different SUT versions). Installing or re-binding dependencies globally can get tricky. 

There are some minor differences compared to the local install:
1. You don't need a `package.json` file.
2. You can perform the install, bind and run steps from anywhere (just specify the workspace accordingly).
3. You need to install the CLI globally (`-g` flag).
4. You need to tell the binding step to install the packages also globally (`--caliper-bind-args` parameter).
5. You can omit the `npx` command, since `caliper` will be in your `PATH`. 

```console
user@ubuntu:~$ npm install -g --only=prod @hyperledger/caliper-cli@0.3.0
user@ubuntu:~$ caliper bind \
    --caliper-bind-sut fabric:1.4.0 \
    --caliper-bind-args=-g
user@ubuntu:~$ caliper launch master \
    --caliper-workspace ~/caliper-benchmarks \
    --caliper-benchconfig benchmarks/scenario/simple/config.yaml \
    --caliper-networkconfig networks/fabric/fabric-v1.4.1/2org1peergoleveldb/fabric-go.yaml
```

> __Note:__ for global install you don't need to change the directory to your workspace, you can simply specify `--caliper-workspace ~/caliper-benchmarks`. But this way you can't utilize the auto complete feature of your commandline for the relative paths of the artifacts. 

Depending on your NPM settings, your user might need write access to directories outside of its home directory. This usually results in _"Access denied"_ errors. The following pointers [here](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally) can guide you to circumvent the problem.

## Using the Docker image

Caliper is published as the [hyperledger/caliper](https://hub.docker.com/r/hyperledger/caliper) Docker image, providing a single point of usage for every supported adapter. The image builds upon the [node:10.16-alpine](https://hub.docker.com/_/node/) image to keep the image size as low as possible. 

The important properties of the image are the following:
* Working directory: `/hyperledger/caliper/workspace`
* The commands are executed by the `node` user (created in the base image)
* The environment variable `CALIPER_WORKSPACE` is set to the `/hyperledger/caliper/workspace` directory
* The entry point is the __globally__ installed `caliper` binary
* The environment variable `CALIPER_BIND_ARGS` is set to `-g`, so the binding step also occurs globally.
* The default command is set to `--version`. This must be overridden when using the image.

This has the following implications:
1. It is recommended to mount your local workspace to the `/hyperledger/caliper/workspace` container directory. The default `CALIPER_WORKSPACE` environment variable value points to this location, so you don't need to specify it explicitly, one less setting to modify.
2. You need to choose a command to execute, either `launch master` or `launch worker`. Check the Docker and Docker-Compose examples for the exact syntax.
3. The binding step is still necessary, similarly to the NPM install approach. Whether you use the `launch master` or `launch worker` command, you only need to set the required binding parameter. The easiest way to do this is through the `CALIPER_BIND_SUT` environment variable. 
4. You need to set the required parameters for the launched master or worker. The easiest way to do this is through the `CALIPER_BENCHCONFIG` and `CALIPER_NETWORKCONFIG` environment variables. 

### Starting a container

Parts of starting a Caliper container (following the recommendations above):
1. Pick the required image version
2. Mount your local working directory to a container directory
3. Set the required binding and run parameters

> __Note:__ the __latest__ (or any other) tag is __not supported__, i.e, you explicitly have to specify the image version you want: `hyperledger/caliper:0.3.0`, just like it's the recommended approach for the [NPM packages](#versioning-semantics).

Putting it all together, split into multiple lines for clarity, and naming the container `caliper`:

```console
user@ubuntu:~/caliper-benchmarks$ docker run \
    -v $PWD:/hyperledger/caliper/workspace \
    -e CALIPER_BIND_SUT=fabric:1.4.0 \
    -e CALIPER_BENCHCONFIG=benchmarks/scenario/simple/config.yaml \
    -e CALIPER_NETWORKCONFIG=networks/fabric/fabric-v1.4.1/2org1peergoleveldb/fabric-go.yaml \
    --name caliper hyperledger/caliper:0.3.0 launch master
```

> __Note:__ the above network configuration file contains a start script to spin up a local Docker-based Fabric network, which will not work in this form. So make sure to remove the start (and end) script, and change the node endpoints to remote addresses.

### Using docker-compose

The above command is more readable when converted to a `docker-compose.yaml` file:
```yaml
version: '2'

services:
    caliper:
        container_name: caliper
        image: hyperledger/caliper:0.3.0
        command: launch master
        environment:
        - CALIPER_BIND_SUT=fabric:1.4.0
        - CALIPER_BENCHCONFIG=benchmarks/scenario/simple/config.yaml
        - CALIPER_NETWORKCONFIG=networks/fabric/fabric-v1.4.1/2org1peergoleveldb/fabric-go.yaml
        volumes:
        - ~/caliper-benchmarks:/hyperledger/caliper/workspace
```

Once you navigate to the directory containing the `docker-compose.yaml` file, just execute:
```bash
docker-compose up
```

> __Note:__ if you would like to test a locally deployed SUT, then you also need to add the necessary SUT containers to the above file and make sure that Caliper starts last (using the `depends_on` attribute).

## Installing locally from source

> __Note:__ this section is intended only for developers who would like to modify the Caliper code-base and experiment with the changes locally before raising pull requests. You should perform the following steps every time you make a modification you want to test, to correctly propagate any changes.

The workflow of modifying the Caliper code-base usually consists of the following steps:
1. [Bootstrapping the repository](#bootstrapping-the-caliper-repository)
2. [Modifying and testing the code](#testing-the-code)
3. [Publishing package changes locally](#publishing-to-local-npm-repository)
4. [Building the Docker image](#building-the-docker-image)

### Bootstrapping the Caliper repository

To install the basic dependencies of the repository, and to resolve the cross-references between the different packages in the repository, you must execute the following commands from the root of the repository directory:
1. `npm i`: Installs development-time dependencies, such as [Lerna](https://github.com/lerna/lerna#readme) and the license checking package.
2. `npm run repoclean`: Cleans up the `node_modules` directory of all packages in the repository. Not needed for a freshly cloned repository.
3. `npm run bootstrap`: Installs the dependencies of all packages in the repository and links any cross-dependencies between the packages. It will take some time to finish installation. If it is interrupted by `ctrl+c`, please recover the `package.json` file first and then run `npm run bootstrap` again.

Or as a one-liner:
```console
user@ubuntu:~/caliper$ npm i && npm run repoclean -- --yes && npm run bootstrap
```

> __Note:__ do not run any of the above commands with `sudo`, as it will cause the bootstrap process to fail.

### Testing the code

The easiest way to test your changes is to run the CI process locally. Currently, the CI process runs benchmarks for specific adapters. You can trigger these tests by running the following script from the root directory of the repository, setting the `BENCHMARK` environment variable to the platform name:

```console
user@ubuntu:~/caliper$ BENCHMARK=fabric ./.travis/benchmark-integration-test-direct.sh
```

The following platform tests (i.e., valid `BENCHMARK` values) are available:
* besu
* ethereum
* fabric
* fisco-bcos
* sawtooth

The scripts will perform the following tests (also necessary for a successful pull request):
* Linting checks
* Licence header checks
* Unit tests
* Running sample benchmarks

If you would like to run other examples, then you can directly access the CLI in the `packages/caliper-cli` directory, without publishing anything locally. 

> __Note:__ the SDK dependencies in this case are fixed (the binding step is not supported with this approach), and you can check (and change) them in the `package.json` files of the corresponding packages. In this case the repository needs to be bootstrapped again.

```console
user@ubuntu:~/caliper$ node ./packages/caliper-cli/caliper.js launch master \
    --caliper-workspace ~/caliper-benchmarks \
    --caliper-benchconfig benchmarks/scenario/simple/config.yaml \
    --caliper-networkconfig networks/fabric/fabric-v1.4.1/2org1peergoleveldb/fabric-go.yaml
```

### Publishing to local NPM repository

The NPM publishing and installing steps for the modified code-base can be tested through a local NPM proxy server, Verdaccio. The steps to perform are the following:

1. Start a local Verdaccio server to publish to
2. Publish the packages from the local (and possible modified) Caliper repository to the Verdaccio server
3. Install and bind the CLI from the Verdaccio server
4. Run the integration tests or any sample benchmark

The `packages/caliper-publish` directory contains an internal CLI for easily managing the following steps. So the commands of the following sections must be executed from the `packages/caliper-publish` directory:

```console
user@ubuntu:~/caliper$ cd ./packages/caliper-publish
``` 

> __Note:__ use the `--help` flag for the following CLI commands and sub-commands to find out more details.

#### Starting Verdaccio

To setup and start a local Verdaccio server, simply run the following command:
```console
user@ubuntu:~/caliper/packages/caliper-publish$ ./publish.js verdaccio start
...
[PM2] Spawning PM2 daemon with pm2_home=.pm2
[PM2] PM2 Successfully daemonized
[PM2] Starting /home/user/projects/caliper/packages/caliper-tests-integration/node_modules/.bin/verdaccio in fork_mode (1 instance)
[PM2] Done.
┌───────────┬────┬──────┬────────┬────────┬─────────┬────────┬─────┬───────────┬────────┬──────────┐
│ App name  │ id │ mode │ pid    │ status │ restart │ uptime │ cpu │ mem       │ user   │ watching │
├───────────┼────┼──────┼────────┼────────┼─────────┼────────┼─────┼───────────┼────────┼──────────┤
│ verdaccio │ 0  │ fork │ 115203 │ online │ 0       │ 0s     │ 3%  │ 25.8 MB   │ user   │ disabled │
└───────────┴────┴──────┴────────┴────────┴─────────┴────────┴─────┴───────────┴────────┴──────────┘
 Use `pm2 show <id|name>` to get more details about an app
```

The Verdaccio server is now listening on the following address: `http://localhost:4873`

#### Publishing the packages

Once Verdaccio is running, you can run the following command to publish every Caliper package locally:

```console
user@ubuntu:~/caliper/packages/caliper-publish$ ./publish.js npm --registry "http://localhost:4873"
...
+ @hyperledger/caliper-core@0.3.0-unstable-20200206065953
[PUBLISH] Published package @hyperledger/caliper-core@0.3.0-unstable-20200206065953
...
+ @hyperledger/caliper-fabric@0.3.0-unstable-20200206065953
[PUBLISH] Published package @hyperledger/caliper-fabric@0.3.0-unstable-20200206065953
...
+ @hyperledger/caliper-cli@0.3.0-unstable-20200206065953
[PUBLISH] Published package @hyperledger/caliper-cli@0.3.0-unstable-20200206065953
```

Take note of the dynamic version number you see in the logs, you will need it to install you modified Caliper version from Verdaccio (the `unstable` tag is also present on NPM, so Verdaccio would probably pull that version instead of your local one).

Since the published packages include a second-precision timestamp in their versions, you can republish any changes immediately without restarting the Verdaccio server and without worrying about conflicting packages.

#### Running package-based tests

Once the packages are published to the local Verdaccio server, we can use the usual NPM install approach. The only difference is that now we specify the local Verdaccio registry as the install source instead of the default, public NPM registry:

```console
user@ubuntu:~/caliper-benchmarks$ npm init -y
user@ubuntu:~/caliper-benchmarks$ npm install --registry=http://localhost:4873 --only=prod \
    @hyperledger/caliper-cli@0.3.0-unstable-20200206065953
user@ubuntu:~/caliper-benchmarks$ npx caliper bind --caliper-bind-sut fabric:1.4.0
user@ubuntu:~/caliper-benchmarks$ npx caliper launch master \
    --caliper-workspace . \
    --caliper-benchconfig benchmarks/scenario/simple/config.yaml \
    --caliper-networkconfig networks/fabric/fabric-v1.4.1/2org1peergoleveldb/fabric-go.yaml
```

> __Note:__ we used the local registry only for the Caliper packages. The binding happens through the public NPM registry. Additionally, we performed the commands through npx and the newly installed CLI binary (i.e., not directly calling the CLI code file).

### Building the Docker image

Once the modified packages are published to the local Verdaccio server, you can rebuild the Docker image. The Dockerfile is located in the `packages/caliper-publish` directory.

To rebuild the Docker image, execute the following:
```console
user@ubuntu:~/caliper/packages/caliper-publish$ ./publish.js docker
...
Successfully tagged hyperledger/caliper:0.3.0-unstable-20200206065953
[BUILD] Built Docker image "hyperledger/caliper:0.3.0-unstable-20200206065953"
```

Now you can proceed with the Docker-based benchmarking as described in the previous sections.

> __Note:__ once you are done with the locally published packages, you can clean them up the following way:
> ```console
> user@ubuntu:~/caliper/packages/caliper-publish$ ./publish.js verdaccio stop
> ```

## License
The Caliper codebase is released under the [Apache 2.0 license](./LICENSE.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.