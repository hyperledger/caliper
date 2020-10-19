---
layout: v0.4.1
title:  "Workload Configuration"
categories: docs
permalink: /v0.4.1/workload-module/
order: 4
---

## Table of contents
{:.no_toc}

- TOC
{:toc}

## Overview

Workload modules are the essence of a Caliper benchmark since it is their responsibility to construct and submit TXs. Accordingly, workload modules implement the logic pertaining to your business, benchmark or user behavior. Think of the workload modules as the brain of an emulated SUT client, deciding what kind of TX to submit at the given moment.

## Implementing the workload module

Workload modules are Node.JS modules that expose a certain API. There are no further restrictions on the implementation, thus arbitrary logic (using further arbitrary components) can be implemented.

### The API

Workload modules are loaded through factory functions, just like other pluggable modules in Caliper. Accordingly, a workload module implementation must export a single factory function, named `createWorkloadModule`:

```js
/**
 * Create a new instance of the workload module.
 * @return {WorkloadModuleInterface}
 */
function createWorkloadModule() {
    return new MyWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
```

The factory function must return an instance that implements the [`WorkloadModuleInterface`](https://github.com/hyperledger/caliper/blob/master/packages/caliper-core/lib/worker/workload/workloadModuleInterface.js) class. See the [example](#example) for a complete implementation.

The interface contains the following three __asynchronous__ functions:

#### initializeWorkloadModule
The `initializeWorkloadModule` function is called by the worker processes before each round, providing contextual arguments to the module:
1. `workerIndex` (_Number_) The 0-based index of the worker instantiating the workload module.
2. `totalWorkers` (_Number_) The total number of workers participating in the round.
3. `roundIndex` (_Number_) The 0-based index of the currently executing round.
4. `roundArguments` (_Object_) The user-provided arguments for the round from the benchmark configuration file.
5. `sutAdapter` (_BlockchainConnector_) The connector of the underlying SUT.
6. `sutContext` (_Object_) The custom context object provided by the SUT connector.

This function is a good place to validate your workload module arguments provided by the [benchmark configuration file](./BenchmarkConfiguration.md). It's also a good practice to perform here any preprocessing needed to ensure the fast assembling of TX contents later in the `submitTransaction` function.

#### submitTransaction
The `submitTransaction` function is the backbone of the workload generation. The worker process calls this function every time the rate controller enables the next TX. So it is vital to keep this function implementation as efficient as possible in order to be able to keep up with high frequency scheduling settings.

The function requires no parameters, but it is its responsibility to submit the TX through the connector API.

#### cleanupWorkloadModule
The `cleanupWorkloadModule` function is called at the end of the round, and can be used to perform any resource cleanup required by your workload implementation.

### Simple base class

Although directly implementing the interface is possible, Caliper provides a simple utility base class that implements the required interface and also performs some common housekeeping operation. Thus inheriting from the `WorkloadModuleBase` class can result in simpler implementations.

The base class provides the following utilities:
* Creates instance variables in the constructor that match the parameters of the `initializeWorkloadModule` function.
* Provides an implementation for the `initializeWorkloadModule` function, where it saves the received arguments into the instance variables.
* Provides a no-op implementation for the `cleanupWorkloadModule` function.

Inheriting from this base class only requires the implementation of the `submitTransaction` function by the user. Additionally, the initialization logic can be extended/overridden if necessary.

### Example

A complete (albeit simple) example of a workload module implementation (mostly identical with the `WorkloadModuleBase` implementation):

```js
'use strict';

const { WorkloadModuleInterface } = require('@hyperledger/caliper-core');

class MyWorkload extends WorkloadModuleInterface {
    constructor() {
        super();
        this.workerIndex = -1;
        this.totalWorkers = -1;
        this.roundIndex = -1;
        this.roundArguments = undefined;
        this.sutAdapter = undefined;
        this.sutContext = undefined;
    }
    
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        this.workerIndex = workerIndex;
        this.totalWorkers = totalWorkers;
        this.roundIndex = roundIndex;
        this.roundArguments = roundArguments;
        this.sutAdapter = sutAdapter;
        this.sutContext = sutContext;
    }
    
    async submitTransaction() {
        let txArgs = {
            // TX arguments for "mycontract"
        };

        return this.sutAdapter.invokeSmartContract('mycontract', 'v1', txArgs, 30);
    }
    
    async cleanupWorkloadModule() {
        // NOOP
    }
}

function createWorkloadModule() {
    return new MyWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
```

The simpler implementation using the utility base class is the following:
```js
'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class MyWorkload extends WorkloadModuleBase {
    async submitTransaction() {
        let txArgs = {
            // TX arguments for "mycontract"
        };

        return this.sutAdapter.invokeSmartContract('mycontract', 'v1', txArgs, 30);
    }
}

function createWorkloadModule() {
    return new MyWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
```

## Configuring the workload module

To use your workload module for a given round, you only need to reference it in the [benchmark configuration](./BenchmarkConfiguration.md#benchmark-test-settings) file:
1. Set the `test.rounds[i].workload.module` attribute to the path of your workload module file. The path can be either an absolute path, or a relative path to the configured workspace path. You can also set the attribute to the package name of your published workload module, but in that case you need to install it beforehand.
2. If your module supports different settings, set the `test.rounds[i].workload.arguments` attribute object accordingly. It will be passed to your module upon initialization.

## Tips & Tricks

The following advices might help you to improve your workload module implementation.

1. You can use (`require`) any Node.JS module in your code (including the core Caliper module). Modularization is important for keeping your implementation clean and manageable.
2. If you use third-party modules, then it is your responsibility to make them available to your workload module. This usually requires an `npm install` call in your module directory before you start Caliper.
3. Caliper provides some core utilities that might make your life easier, such as [logging](./Logging_Control.md) and [runtime configuration](./Runtime_Configuration.md). Use them, don't reinvent the wheel!
4. The `submitTransaction` function is on the __hot path__ of the worker workload generation loop. Do computation-intensive tasks with care, it might hurt the scheduling precision of TXs! You can perform expensive pre-processing tasks in the `initializeWorkloadModule` function instead.

## License
The Caliper codebase is released under the [Apache 2.0 license](./LICENSE.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.