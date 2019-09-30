---
layout: pageNext
title:  "Runtime Configuration"
categories: reference
permalink: /vNext/runtime-config/
---

Caliper relies on the [nconf](https://github.com/indexzero/nconf) package to provide a flexible and hierarchical configuration mechanism for runtime-related settings. Hierarchical configuration means that a runtime setting can be set or overridden from multiple sources/locations, and there is a priority order among them.

Caliper supports the following sources/locations where runtime settings can be set/overridden, in priority order, starting with the highest priority:

1. [Memory](#in-memory-settings)
1. [Command line arguments](#command-line-arguments)
1. [Environment variables](#environment-variables)
1. [Project-level configuration file](#project-level)
1. [User-level configuration file](#user-level)
1. [Machine-level configuration file](#machine-level)
1. [Fallback/default configuration file](#default)

For simplicity, you can think of the above order as the following: the "closer" the setting is set to its point of use, the higher the priority of the set value.

For the available settings, see the `config/default.yaml` file and its comments.  
In general, a setting is a simple `string` key associated with some `value`. However, it is highly recommended to compose the keys in a way that follows the place of the module in the hierarchy that uses the setting. Consider the following key, for example:

`caliper-fabricccp-timeout-invokeorquery`

The key consists of several parts that makes it easy to identify the purpose of the setting: it is used in Caliper, by the Fabric-CCP adapter, it is a timeout-related setting that specifies the timeout to use for transaction invocations or queries. Every setting key in Caliper follows the same convention.

The rule of thumb is to use lowercase letters (maybe numbers), and the hierarchy should be denoted by dashes (`-`) as separator.

## In-memory settings

If some component (Caliper-related, or user provided) sets a setting during runtime (using the configuration API), then that value will have priority over any other source/location that might have also set the same setting.

The simple configuration API is provided by the `ConfigUtil` module of the `caliper-core` package. It exports a simple `get` and `set` method:

* `get(key:string, fallbackValue:any) => any` 

    Returns the value of the setting associated with the given `key`. If the setting is not set from any sources, then the `fallbackValue` is returned.
* `set(key:string, value:any)` 

    Sets the `value` for the settings associated with the given `key`. It will overwrite any other value set by other sources.

For example:
```js
const config = require('caliper-core').ConfigUtil;

// retrieves a setting for your module, if not set, use some default
const shouldBeFast = config.get('mymodule-performance-shoudbefast', /*default:*/ true);

if (shouldBeFast) { /* ... */ } else { /* ... */ }
```

The above code also shows how a custom user module/code can easily leverage Caliper's configuration mechanism. Since the `mymodule-performance-shoudbefast` setting is queried through the configuration API, setting it from various sources automatically became possible (see the next sections for details). 

> Thus adding a flexible runtime setting to any module requires only to query that setting through the configuration API when you need it (with the desired default/fallback value).

## Command line arguments

If we wish to influence the behavior of a third-party code (e.g., Caliper or a user callback module), we usually can't (or don't want to) overwrite the setting in the source code. A standard way of modifying the behavior of third-party/pre-packaged applications is to provide the settings as commandline arguments.

Starting Caliper through the [CLI](./Getting_Started.md#run-a-sample-benchmark), you can override runtime settings the following way:

```bash
caliper benchmark run --caliper-workspace yourworkspace/ --caliper-benchconfig yourconfig.yaml --caliper-networkconfig yournetwork.yaml --mymodule-performance-shoudbefast=true
```

The arguments will be converted to lower-case letters and every `_` character will be replaced with `-`. So the above command can be written in a more user friendly way:

```bash
caliper benchmark run --caliper-workspace yourworkspace/ --caliper-benchconfig yourconfig.yaml --caliper-networkconfig yournetwork.yaml --MyModule_Performance_ShoudBeFast=true
```

Both ways will result in the setting key `mymodule-performance-shoudbefast` associated with the `boolean` value `true`.

Note, that `nconf` will automatically parse values of common types, so the `true` and `false` values will be parsed (and returned by `get`) as `boolean` values. This also holds for (both integer and floating point) numbers.

Moreover, `boolean` values can be specified as flags, without explicitly setting the `true` or `false` value (note the `no-` prefix for the second case):
* Setting a key to `true`:
    ```bash
    caliper benchmark run --caliper-workspace yourworkspace/ --caliper-benchconfig yourconfig.yaml --caliper-networkconfig yournetwork.yaml --mymodule-performance-shoudbefast
    ```
* Setting a key to `false`:
    ```bash
    caliper benchmark run --caliper-workspace yourworkspace/ --caliper-benchconfig yourconfig.yaml --caliper-networkconfig yournetwork.yaml --no-mymodule-performance-shoudbefast
    ```


Command line arguments overwrite the settings set in locations of the next sections.

## Environment variables

If Caliper is part of a scripted environment, then it would be cumbersome to modify the script to pass command line arguments to Caliper. The standard approach in these scenarios is to use environment variables.

The example setting can be set the following way using an environment variable:

```bash
export MYMODULE_PERFORMANCE_SHOULDBEFAST=true

# calling some script containing the following command
caliper benchmark run --caliper-workspace yourworkspace/ --caliper-benchconfig yourconfig.yaml --caliper-networkconfig yournetwork.yaml
```

Note the standard notation of environment variable setting: upper-case letters separated by `_` characters. Caliper performs the same transformation as with command line arguments: the variable names will be converted to lower-case letters and every `_` character will be replaced with `-`. So the above setting will also result in the setting key `mymodule-performance-shoudbefast` associated with the `boolean` value `true`.

## Configuration files

Depending on the scenario, users may want to change multiple runtime settings. Using command line arguments and environment variables to change multiple settings can become cumbersome. 

Using configuration files is a standard way of overriding multiple settings in a manageable way. Caliper provides multiple configuration "locations" where you can insert configuration files into the settings hierarchy. These locations also follow the "closer one wins" semantic of the hierarchical configuration mechanism.

Moreover, YAML-based configuration files allow comments that make your configuration choices self-documenting and self-contained.

Note, that no additional transformation is performed on the key names of a YAML file, they are simply concatenated with `-` to get a flat string key from the object hierarchy. 

So the hierarchical setting
```yaml
mymodule:
  performance:
    shouldbefast: true
```
will be parsed as the `mymodule-performance-shouldbefast` string key associated with the `true` Boolean value.s

### Project-level

If you have a group of settings that are always overridden in your Caliper benchmark project, then it is recommended to define them as a project-level configuration file. This file will usually consist of a subset of settings defined in the default configuration file (and probably your custom settings associated with your custom user module).

The project-level configuration file can be included into the hierarchy in two ways:
* Define the overridden settings in the `caliper.yaml` file in the **workspace directory**
* Or set the path of the configuration file explicitly through the `caliper-projectconfig` setting key using one of the higher priority locations above (i.e., in-memory, command line argument or environment variable):

  * The command line approach: 
    ```bash
    caliper benchmark run --caliper-workspace yourworkspace/ --caliper-benchconfig yourconfig.yaml --caliper-networkconfig yournetwork.yaml --Caliper-ProjectConfig=mypath/project1-config.yaml
    ```
  * The environment variable approach: 
    ```bash
    export CALIPER_PROJECTCONFIG=mypath/project1-config.yaml
    caliper benchmark run --caliper-workspace yourworkspace/ --caliper-benchconfig yourconfig.yaml --caliper-networkconfig yournetwork.yaml
    ```
    
Note that project-level settings will override the settings defined by the locations of the next sections.

### User-level

If you find yourself overriding the same settings for multiple Caliper benchmark projects, then it is recommended to extract the common settings into a user-level configuration file. To include a user-level configuration file into the hierarchy, specify its path through the `caliper-userconfig` settings key using one of the higher priority locations above (i.e., in-memory, command line argument, environment variable or the project-level configuration file):

* The command line approach: 
    ```bash
    caliper benchmark run --caliper-workspace yourworkspace/ --caliper-benchconfig yourconfig.yaml --caliper-networkconfig yournetwork.yaml --Caliper-UserConfig=~/.config/my-caliper-config.yaml
    ```
* The environment variable approach: 
    ```bash
    export CALIPER_USERCONFIG=~/.config/my-caliper-config.yaml
    caliper benchmark run --caliper-workspace yourworkspace/ --caliper-benchconfig yourconfig.yaml --caliper-networkconfig yournetwork.yaml
    ```
* The configuration file approach (excerpt from the project-level configuration file): 
    ```yaml
    caliper:
      userconfig: ~/.config/my-caliper-config.yaml
    # additional settings
    ```

### Machine-level

If multiple users use the same workstation and want to share common settings across Caliper projects and users, then a machine-level configuration file can be included into the hierarchy by specifying its path through the `caliper-machineconfig` settings key using one of the higher priority locations above (i.e., in-memory, command line argument, environment variable, project- or user-level configuration files):

* The command line approach: 
    ```bash
    caliper benchmark run --caliper-workspace yourworkspace/ --caliper-benchconfig yourconfig.yaml --caliper-networkconfig yournetwork.yaml --Caliper-MachineConfig=/etc/config/caliper.yaml
    ```
* The environment variable approach: 
    ```bash
    export CALIPER_MACHINECONFIG=/etc/config/caliper.yaml
    caliper benchmark run --caliper-workspace yourworkspace/ --caliper-benchconfig yourconfig.yaml --caliper-networkconfig yournetwork.yaml
    ```
* The configuration file approach (excerpt from the project- or user-level configuration file): 
    ```yaml
    caliper:
      machineconfig: /etc/config/caliper.yaml
    # additional settings
    ```

### Default

A default/fallback configuration file is shipped with the Caliper-related packages that defines fallback values and documentation for each available setting used by the Caliper modules. This configuration file has the lowest priority among the supported setting locations.

Always refer to the self-documenting [default configuration file](https://github.com/hyperledger/caliper/blob/master/packages/caliper-core/lib/config/default.yaml) for the currently supported runtime configuration settings.