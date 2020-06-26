---
layout: vNext
title:  "Workload Configuration"
categories: docs
permalink: /vNext/workload-module/
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

A workload module must export the following three asynchronous functions:

* `init(blockchain: BlockchainInterface, context: object, args: object)`
  
  The `init` function is called before a round is started. It receives:
  * the SUT adapter instance in the `blockchain` parameter;
  * the adapter-specific `context` created by the adapter (usually containing additional data about the network);
  * and the user-provided settings object as `args` which is set in the [benchmark configuration](./BenchmarkConfiguration.md#benchmark-test-settings) file's `test.rounds[i].arguments` attribute (if the workload module is configurable).
* `run() => Promise<TxResult[]>`

  The `run` function is called every time the set [rate controller](./Rate_Controllers.md) enables the next TX. The function must assemble the content of the next TX (using arbitrary logic) and call the `invokeSmartContract` or `querySmartContract` functions of the `blockchain` adapter instance. See the adapter configuration pages for the exact usage of the mentioned functions.
  > __At the end, the function must return the result of the invoke/query call!__
* `end()`

  The `end` function is called after the round has ended. The workload module can perform resource cleanup or any other maintenance activity at this point.

### Example

A complete (albeit simple) example of a workload module implementation:

```js
/*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

'use strict';

const logger = require('@hyperledger/caliper-core').CaliperUtils.getLogger('my-module');

// save the objects during init
let bc, contx;

/**
* Initializes the workload module before the start of the round.
* @param {BlockchainInterface} blockchain The SUT adapter instance.
* @param {object} context The SUT-specific context for the round.
* @param {object} args The user-provided arguments for the workload module.
*/
module.exports.init = async (blockchain, context, args) => {
    bc = blockchain;
    contx = context;
    logger.debug('Initialized workload module');
};

module.exports.run = async () => {
    let txArgs = {
        // TX arguments for "mycontract"
    };
    
    return bc.invokeSmartContract(contx, 'mycontract', 'v1', txArgs, 30);
};

module.exports.end = async () => {
    // Noop
    logger.debug('Disposed of workload module');
};
```

## Configuring the workload module

To use your workload module for a given round, you only need to reference it in the [benchmark configuration](./BenchmarkConfiguration.md#benchmark-test-settings) file:
1. Set the `test.rounds[i].callback` attribute to the path of your workload module file. The path can be either an absolute path, or a relative path to the configured workspace path.
2. If your module supports different settings, set the `test.rounds[i].arguments` attribute object accordingly. It will be passed to your module upon initialization.

## Tips & Tricks

The following advices might help you to improve your workload module implementation.

1. You can use (`require`) any Node.JS module in your code (including the core Caliper module). Modularization is important for keeping your implementation clean and manageable.
2. If you use third-party modules, then it is your responsibility to make them available to your workload module. This usually requires an `npm install` call in your module directory before you start Caliper.
3. Caliper provides some core utilities that might make your life easier, such as [logging](./Logging_Control.md) and [runtime configuration](./Runtime_Configuration.md). Use them, don't reinvent the wheel! 
4. The `run` function is on the __hot path__ of the worker workload generation loop. Do computation-intensive tasks with care, it might hurt the scheduling precision of TXs! You can perform expensive pre-processing tasks in the `init` function instead. 

## License
The Caliper codebase is released under the [Apache 2.0 license](./LICENSE.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.