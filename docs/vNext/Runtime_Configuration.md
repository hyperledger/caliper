---
layout: vNext
title:  "Runtime Configuration"
categories: reference
permalink: /vNext/runtime-config/
order: 3
---

## Table of contents
{:.no_toc}

- TOC
{:toc}

## Overview

Caliper relies on the [nconf](https://github.com/indexzero/nconf) package to provide a flexible and hierarchical configuration mechanism for runtime-related settings. Hierarchical configuration means that a runtime setting can be set or overridden from multiple sources/locations, and there is a priority order among them.

In general, a setting is a simple `string` key associated with some `value`. However, it is highly recommended to compose the keys in a way that follows the place of the module in the hierarchy that uses the setting. Consider the following key, for example:

`caliper-fabric-timeout-invokeorquery`

The key consists of several parts that makes it easy to identify the purpose of the setting: it is used in Caliper, by the Fabric connector, it is a timeout-related setting that specifies the timeout to use for transaction invocations or queries. Every setting key in Caliper follows the same convention.

The rule of thumb is to use lowercase letters (maybe numbers), and the hierarchy should be denoted by dashes (`-`) as separator.

Every setting used by Caliper is prefixed with the `caliper-` string. The prefix serves as a namespace for the internal settings of Caliper modules. It also prevents name collisions since the configuration mechanism parses every setting available from the various sources, some intended, for example, to the underlying SDK modules or the workload modules.

> For every available runtime setting, refer to the [last section](#available-settings).

## Setting sources

Caliper supports the following sources/locations where runtime settings can be set/overridden, in priority order, starting with the highest priority:

1. [Memory](#in-memory-settings)
1. [Command line arguments](#command-line-arguments)
1. [Environment variables](#environment-variables)
1. [Project-level configuration file](#project-level)
1. [User-level configuration file](#user-level)
1. [Machine-level configuration file](#machine-level)
1. [Fallback/default configuration file](#default-configuration)

For simplicity, you can think of the above order as the following: the "closer" the setting is set to its point of use, the higher the priority of the set value.

### In-memory settings

If some component (internal or plugin) sets a setting during runtime (using the configuration API), then that value will have priority over any other source/location that might have also set the same setting.

The simple configuration API is provided by the `ConfigUtil` module of the `@hyperledger/caliper-core` package. It exports a simple `get` and `set` method:

* `get(key:string, fallbackValue:any) => any` 

    Returns the value of the setting associated with the given `key`. If the setting is not set from any sources, then the `fallbackValue` is returned.
* `set(key:string, value:any)` 

    Sets the `value` for the setting associated with the given `key`. It will overwrite any other value set by other sources.

For example:
```js
const { ConfigUtil } = require('@hyperledger/caliper-core');

// retrieves a setting for your module, if not set, use some default
const shouldBeFast = ConfigUtil.get('mymodule-performance-shoudbefast', /*default:*/ true);

if (shouldBeFast) { /* ... */ } else { /* ... */ }
```

The above code also shows how a plugin module can easily leverage Caliper's configuration mechanism. Since the `mymodule-performance-shoudbefast` setting is queried through the configuration API, setting it from various sources automatically became possible (see the next sections for details). 

> Thus adding a flexible runtime setting to any module requires only to query that setting through the configuration API when you need it (with the desired default/fallback value).

### Command line arguments

If we wish to influence the behavior of a third-party code (e.g., Caliper or a workload module), we usually can't (or don't want to) overwrite the setting in the source code. A standard way of modifying the behavior of third-party/pre-packaged applications is to provide the settings as commandline arguments.

Starting Caliper through the [CLI](./Installing_Caliper.md#the-caliper-cli), you can override runtime settings the following way:

```bash
caliper launch manager \
    --caliper-workspace yourworkspace/ \
    --caliper-benchconfig yourconfig.yaml \
    --caliper-networkconfig yournetwork.yaml \
    --mymodule-performance-shoudbefast=true
```

The arguments will be converted to lower-case letters and every `_` character will be replaced with `-`. So the above command can be written in a more user friendly way:

```bash
caliper launch manager \
    --caliper-workspace yourworkspace/ \
    --caliper-benchconfig yourconfig.yaml \
    --caliper-networkconfig yournetwork.yaml \
    --MyModule_Performance_ShoudBeFast=true
```

Both ways will result in the setting key `mymodule-performance-shoudbefast` associated with the `boolean` value `true`.

Note, that `nconf` will automatically parse values of common types, so the `true` and `false` values will be parsed (and returned by `get`) as `boolean` values. This also holds for (both integer and floating point) numbers.

Moreover, `boolean` values can be specified as flags, without explicitly setting the `true` or `false` value.
* Setting a key to `true`:
    ```bash
    caliper launch manager \
        --caliper-workspace yourworkspace/ \
        --caliper-benchconfig yourconfig.yaml \
        --caliper-networkconfig yournetwork.yaml \
        --mymodule-performance-shoudbefast
    ```
* Setting a key to `false` (note the `no-` prefix):
    ```bash
    caliper launch manager \
        --caliper-workspace yourworkspace/ \
        --caliper-benchconfig yourconfig.yaml \
        --caliper-networkconfig yournetwork.yaml \
        --no-mymodule-performance-shoudbefast
    ```

Command line arguments overwrite the settings set in locations of the next sections.

### Environment variables

If Caliper is part of a scripted environment, then it would be cumbersome to modify the script to pass command line arguments to Caliper. The standard approach in these scenarios is to use environment variables.

The example setting can be set the following way using an environment variable:

```bash
export MYMODULE_PERFORMANCE_SHOULDBEFAST=true

# calling some script containing the following command
caliper launch manager \
    --caliper-workspace yourworkspace/ \
    --caliper-benchconfig yourconfig.yaml \
    --caliper-networkconfig yournetwork.yaml
```

Note the standard notation of environment variable settings: upper-case letters separated by `_` characters. Caliper performs the same transformation as with command line arguments: the variable names will be converted to lower-case letters and every `_` character will be replaced with `-`. So the above setting will also result in the setting key `mymodule-performance-shoudbefast` associated with the `boolean` value `true`.

### Configuration files

Depending on the scenario, users may want to change multiple runtime settings. Using command line arguments and environment variables to change multiple settings can become cumbersome and hard to read. Moreover, sometimes it is desirable for the configuration to be a separate project artifact (that can be version controlled, for example) rather than just embedded around the place of CLI call.

Using configuration files is a standard way of overriding multiple settings in a manageable way. Caliper provides multiple configuration "locations" where you can insert configuration files into the settings hierarchy. These locations also follow the "closer one wins" semantic of the hierarchical configuration mechanism.

Moreover, YAML-based configuration files allow comments that make your configuration choices self-documenting and self-contained.

Note, that no additional transformation is performed on the key names of a YAML file, they are simply concatenated with `-` to get a flat string key from the object hierarchy. 

So the hierarchical setting
```yaml
mymodule:
  performance:
    shouldbefast: true
```
will be parsed as the `mymodule-performance-shouldbefast` string key associated with the `true` Boolean value.

#### Project-level

If you have a group of settings that are always overridden in your Caliper benchmark project, then it is recommended to define them as a project-level configuration file. This file will usually consist of a subset of settings defined in the default configuration file (and probably your custom settings associated with your custom user module).

The project-level configuration file can be included into the hierarchy in two ways:
* Define the overridden settings in the `caliper.yaml` file in the **workspace directory**
* Or set the path of the configuration file explicitly through the `caliper-projectconfig` setting key using one of the higher priority locations above (i.e., command line argument or environment variable):

  * The command line approach: 
    ```bash
    caliper launch manager \
        --caliper-workspace yourworkspace/ \
        --caliper-benchconfig yourconfig.yaml \
        --caliper-networkconfig yournetwork.yaml \
        --Caliper-ProjectConfig mypath/project1-config.yaml
    ```
  * The environment variable approach: 
    ```bash
    export CALIPER_PROJECTCONFIG=mypath/project1-config.yaml
    caliper launch manager \
        --caliper-workspace yourworkspace/ \
        --caliper-benchconfig yourconfig.yaml \
        --caliper-networkconfig yournetwork.yaml
    ```
    
Note that project-level settings will override the settings defined by the locations of the next sections.

#### User-level

If you find yourself overriding the same settings for multiple Caliper benchmark projects, then it is recommended to extract the common settings into a user-level configuration file. To include a user-level configuration file into the hierarchy, specify its path through the `caliper-userconfig` settings key using one of the higher priority locations above (i.e., command line argument, environment variable or the project-level configuration file):

* The command line approach: 
    ```bash
    caliper launch manager \
        --caliper-workspace yourworkspace/ \
        --caliper-benchconfig yourconfig.yaml \
        --caliper-networkconfig yournetwork.yaml \
        --Caliper-UserConfig ~/.config/my-caliper-config.yaml
    ```
* The environment variable approach: 
    ```bash
    export CALIPER_USERCONFIG=~/.config/my-caliper-config.yaml
    caliper launch manager \
        --caliper-workspace yourworkspace/ \
        --caliper-benchconfig yourconfig.yaml \
        --caliper-networkconfig yournetwork.yaml
    ```
* The configuration file approach (excerpt from the project-level configuration file): 
    ```yaml
    caliper:
      userconfig: ~/.config/my-caliper-config.yaml
    # additional settings
    ```

#### Machine-level

If multiple users use the same workstation and want to share common settings across Caliper projects and users, then a machine-level configuration file can be included into the hierarchy by specifying its path through the `caliper-machineconfig` settings key using one of the higher priority locations above (i.e., command line argument, environment variable, project- or user-level configuration files):

* The command line approach: 
    ```bash
    caliper launch manager \
        --caliper-workspace yourworkspace/ \
        --caliper-benchconfig yourconfig.yaml \
        --caliper-networkconfig yournetwork.yaml \
        --Caliper-MachineConfig /etc/config/caliper.yaml
    ```
* The environment variable approach: 
    ```bash
    export CALIPER_MACHINECONFIG=/etc/config/caliper.yaml
    caliper launch manager \
        --caliper-workspace yourworkspace/ \
        --caliper-benchconfig yourconfig.yaml \
        --caliper-networkconfig yournetwork.yaml
    ```
* The configuration file approach (excerpt from the project- or user-level configuration file): 
    ```yaml
    caliper:
      machineconfig: /etc/config/caliper.yaml
    # additional settings
    ```

#### Default configuration

A default/fallback configuration file is shipped with the Caliper-related packages that defines sensible fallback values and documentation for each available setting used by the Caliper modules. This configuration file has the lowest priority among the supported setting locations.

## Available settings

> Always refer to the self-documenting [default configuration file](https://github.com/hyperledger/caliper/blob/master/packages/caliper-core/lib/common/config/default.yaml) for the currently supported runtime configuration settings.

### Basic settings

| Key | Description |
|:----|:------------|
| caliper-benchconfig | Path to the benchmark configuration file that describes the test worker(s), test rounds and monitors. |
| caliper-networkconfig | Path to the network configuration file that contains information required to interact with the SUT. |
| caliper-machineconfig | The file path for the machine-level configuration file. Can be relative to the workspace. |
| caliper-projectconfig | The file path for the project-level configuration file. Can be relative to the workspace. |
| caliper-userconfig | The file path for the user-level configuration file. Can be relative to the workspace. |
| caliper-workspace | Workspace directory that contains all configuration information |
| caliper-progress-reporting-enabled  | Boolean value for enabling transaction completion progress display by the Caliper manager process|
| caliper-progress-reporting-interval | Numeric value used to specify the caliper progress update frequency, in milliseconds|

### Binding settings

| Key | Description |
|:----|:------------|
| caliper-bind-args | The additional args to pass to the binding (i.e., npm install) command. |
| caliper-bind-cwd | The CWD to use for the binding (i.e., npm install) command. |
| caliper-bind-file | The path of a custom binding configuration file that will override the default one. |
| caliper-bind-sut | The binding specification of the SUT in the `<SUT type>:<SDK version>` format. |

### Reporting settings

| Key | Description |
|:----|:------------|
| caliper-report-charting-hue | The HUE value to construct the chart [color scheme](https://www.npmjs.com/package/color-scheme) from. |
| caliper-report-charting-scheme | The [color scheme](https://www.npmjs.com/package/color-scheme) method to use for producing chart colors. |
| caliper-report-charting-transparency | The transparency value [0..1] to use for the charts. |
| caliper-report-options | The options object to pass to [fs.writeFile](https://nodejs.org/docs/latest-v8.x/api/fs.html#fs_fs_writefile_file_data_options_callback) |
| caliper-report-path | The absolute or workspace-relative path of the generated report file. |
| caliper-report-precision | Precision (significant digits) for the numbers in the report. |

### Logging settings

| Key | Description |
|:----|:------------|
| caliper-logging-formats-align | Adds a tab delimiter before the messages to align them in the same place. |
| caliper-logging-formats-attributeformat-\<attribute\> | Specifies the formatting string for the log message attribute `<attribute>`. |
| caliper-logging-formats-json | Indicates that the logs should be serialized in JSON format. |
| caliper-logging-formats-label | Adds a specified label to every message. Useful for distributed worker scenario. |
| caliper-logging-formats-pad | Pads the log level strings to be the same length. |
| caliper-logging-formats-timestamp | Adds a timestamp to the messages with the specified format. |
| caliper-logging-formats-colorize-all | Indicates that all log message attributes must be colorized. |
| caliper-logging-formats-colorize-\<attribute\> | Indicates that log message attribute `<attribute>` must be colorized. |
| caliper-logging-formats-colorize-colors-\<level\> | Sets the color for the log messages with level `<level>`. |
| caliper-logging-targets-\<target\>-enabled | Sets whether the target transport `<target>` is enabled or disabled. |
| caliper-logging-template | Specifies the message structure through placeholders. |

### Worker management settings

| Key | Description |
|:----|:------------|
| caliper-worker-communication-method | Indicates the type of the communication between the manager and workers. |
| caliper-worker-communication-address | The address of the MQTT broker used for distributed worker management. |
| caliper-worker-pollinterval | The interval for polling for new available workers, in milliseconds. |
| caliper-worker-remote | Indicates whether the workers operate in distributed mode. |

### Benchmark phase settings

| Key | Description |
|:----|:------------|
| caliper-flow-only-end | Indicates whether to only perform the end command script in the network configuration file. |
| caliper-flow-only-init | Indicates whether to only perform the init phase of the benchmark. |
| caliper-flow-only-install | Indicates whether to only perform the smart contract install phase of the benchmark. |
| caliper-flow-only-start | Indicates whether to only perform the start command script in the network configuration file. |
| caliper-flow-only-test | Indicates whether to only perform the test phase of the benchmark. |
| caliper-flow-skip-end | Indicates whether to skip the end command script in the network configuration file. |
| caliper-flow-skip-init | Indicates whether to skip the init phase of the benchmark. |
| caliper-flow-skip-install | Indicates whether to skip the smart contract install phase of the benchmark. |
| caliper-flow-skip-start | Indicates whether to skip the start command script in the network configuration file. |
| caliper-flow-skip-test | Indicates whether to skip the test phase of the benchmark. |

### Fabric adapter settings

| Key | Description |
|:----|:------------|
| caliper-fabric-countqueryasload | Indicates whether to count queries as workload, i.e., whether the generated report should include them. |
| caliper-fabric-gateway-discovery | Indicates whether to use the Fabric discovery mechanism (via Gateway API). |
| caliper-fabric-gateway-eventstrategy | Sets the event strategy to use. |
| caliper-fabric-gateway-localhost | Indicates whether to use the localhost default within the Fabric Gateway API. |
| caliper-fabric-gateway-querystrategy | Sets the query strategy to use. |
| caliper-fabric-gateway-enabled | Indicates whether to use the Fabric gateway-based SDK API. |
| caliper-fabric-latencythreshold | Determines the reported commit time of a transaction based on the given percentage of event sources. |
| caliper-fabric-loadbalancing | Determines how automatic load balancing is applied. |
| caliper-fabric-overwritegopath | Indicates whether to temporarily set the GOPATH environment variable to the workspace directory. |
| caliper-fabric-sleepafter-createchannel | The time in milliseconds to sleep after creating the channels. |
| caliper-fabric-sleepafter-joinchannel | The time in milliseconds to sleep after joining the channels. |
| caliper-fabric-sleepafter-instantiatecontract | The time in milliseconds to sleep after instantiated the contracts. |
| caliper-fabric-timeout-contractinstantiate | Timeout in milliseconds for the endorsement part of a contract instantiation. |
| caliper-fabric-timeout-contractinstantiateevent | Timeout in milliseconds for receiving the event about the result of a contract instantiation. |
| caliper-fabric-timeout-invokeorquery | The default timeout in milliseconds to use for invoking or querying transactions. |
| caliper-fabric-verify-proposalresponse | Indicates whether to verify the received proposal responses. |
| caliper-fabric-verify-readwritesets | Indicates whether to verify that the read-write sets returned by the endorsers match. |

## License
The Caliper codebase is released under the [Apache 2.0 license](./LICENSE.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.