---
layout: v0.6.0
title:  "Rate Controllers"
categories: reference
permalink: /v0.6.0/rate-controllers/
order: 4
---

The rate at which transactions are input to the blockchain system is a key factor within performance tests. It may be desired to send transactions at a specified rate or follow a specified profile. Caliper permits the specification of custom rate controllers to enable a user to perform testing under a custom loading mechanism. A user may specify their own rate controller or use one of the default options:

* [Fixed rate](#fixed-rate)
* [Fixed feedback rate](#fixed-feedback-rate)
* [Fixed load](#fixed-load)
* [Maximum rate](#maximum-rate)
* [Linear rate](#linear-rate)
* [Composite rate](#composite-rate)
* [Zero rate](#zero-rate)
* [Record rate](#record-rate)
* [Replay rate](#replay-rate)

For implementing your own rate controller, refer to the [Adding Custom Controllers](#adding-custom-controllers) section.

## Fixed Rate
The fixed rate controller is the most basic controller, and also the default option if no controller is specified. It will send input transactions at a fixed interval that is specified as TPS (transactions per second).

### Options and use
The fixed-rate controller can be specified by setting the rate controller `type` to the `fixed-rate` string.

Controller options include:
- `tps`: the rate at which transactions are cumulatively sent to the SUT by all workers

The fixed rate controller, driving at 10 TPS, is specified through the following controller option:

```json
{
  "type": "fixed-rate",
  "opts": {
      "tps" : 10
  }
}
```

## Fixed Feedback Rate
The fixed feedback rate controller which is the extension of fixed rate also will originally send input transactions at a fixed interval. When the unfinished transactions exceeds times of the defined unfinished transactions for each worker,it will stop sending input transactions temporally by sleeping a long period of time.

### Options and use
The fixed-feedback-rate controller can be specified by setting the rate controller `type` to the `fixed-feedback-rate` string.

Controller options include:
- `tps`: the rate at which transactions are cumulatively sent to the SUT by all workers
- `transactionLoad`: the maximum transaction load on the SUT at which workers will pause sending further transactions

The fixed feedback rate controller, driving at 100 TPS, with a maximum transaction load of 100 on the SUT, is specified through the following controller option:

```json
{
  "type": "fixed-feedback-rate",
  "opts": {
      "tps" : 100,
      "transactionLoad": 100
  }
}
```

## Fixed Load
The fixed load rate controller is a controller for driving the tests at a target loading (backlog transactions). This controller will aim to maintain a defined backlog of transactions within the system by modifying the driven TPS. The result is the maximum possible TPS for the system whilst maintaining the pending transaction load.

### Options and use
The fixed-load controller can be specified by setting the rate controller `type` to the `fixed-load` string.

Controller options include:
- `startTps`: the initial rate at which transactions are cumulatively sent to the SUT by all workers
- `transactionLoad`: the number of transactions being processed by the SUT that is to be maintained

The fixed load controller, aiming to maintain a SUT transaction load of 5, with a starting TPS of 100, is specified through the following controller option:

```json
{
  "type": "fixed-load",
  "opts": {
    "transactionLoad": 5,
    "startTps": 100
  }
}
```

## Maximum Rate
The maximum rate controller is a controller for driving the workers to their maximum achievable rate without overloading the SUT. This controller will aim to maximize the driven TPS for the worker by ramping up the driven TPS and backing off again when a drop in TPS is witnessed; such drops are indicative of an overloaded system.

The achieved TPS is evaluated between txUpdate cycles, since this is the point at which TPS results are made available. A minimum sample interval that ensures settling of TPS rates should be considered for enhanced controller stability. 

Please note that the action of the controller is to slowly ramp to the maximum achievable rate for each worker until a threshold is reached, meaning that there will be a significant warm up phase that may skew averaged results for the round. It is recommended to investigate achievable results using Prometheus queries and/or Grafana visualization.

### Options and use
The maximum rate controller can be specified by setting the rate controller `type` to the `maximum-rate` string.

Controller options include:
- `tps`: the starting TPS
- `step`: the TPS increase for each interval. Note that on "back-off" this step size will automatically be reduced before re-attempting a TPS increase.
- `sampleInterval`: the minimum time between steps to ensure settling of achieved TPS rates
- `includeFailed`: boolean flag to indicate if the achieved TPS analysis within the controller is to include failed transactions (default true)

The maximum rate controller, with a starting TPS of 100, a TPS step size of 5, and a minimum sample interval of 20seconds, is specified through the following controller option:

```json
{
  "type": "maximum-rate",
  "opts": {
    "tps": 100,
    "step": 5,
    "sampleInterval": 20,
    "includeFailed": true
  }
}
```

## Linear Rate

Exploring the performance limits of a system usually consists of performing multiple measurements with increasing load intensity. However, finding the tipping point of the system this way is not easy, it is more like a trial-and-error method.

The linear rate controller can gradually (linearly) change the TPS rate between a starting and finishing TPS value (both in increasing and decreasing manner). This makes it easier to find the workload rates that affect the system performance in an interesting way.

The linear rate controller can be used in both duration-based and transaction number-based rounds.

### Options and use
The linear rate controller can be specified by setting the rate controller `type` to the `linear-rate` string.

Controller options include:
- `startTps`: the rate at which transactions are cumulatively sent to the SUT by all workers at the start of the round
- `finishingTps`: the rate at which transactions are cumulatively sent to the SUT by all workers at the end of the round

The following example specifies a rate controller that gradually changes the transaction load from 25 TPS to 75 TPS during the benchmark round.

```json
{
  "type": "linear-rate",
  "opts": {
    "startTps": 25,
    "finishingTps": 75
    }
}
```

**Note:** similarly to the [fixed rate controller](#fixed-rate), this controller also divides the workload between the available worker, so the specified rates in the configuration are cumulative rates, and not the rates of individual workers. Using the above configuration with 5 workers results in workers that start at 5 TPS and finish at 15 TPS. Together they generate a [25-75] TPS load.

## Composite Rate

A benchmark round in Caliper is associated with a single rate controller. However, a single rate controller is rarely sufficient to model advanced worker behaviors. Moreover, implementing new rate controllers for such behaviors can be cumbersome and error-prone. Most of the time a complex worker behavior can be split into several, simpler phases.

Accordingly, the composite rate controller enables the configuration of multiple "simpler" rate controllers _in a single round_, promoting the reusability of existing rate controller implementations. The composite rate controller will automatically switch between the given controllers according to the specified weights (see the configuration details after the example).

### Options and use
The composite rate controller can be specified by setting the rate controller `type` to the `composite-rate` string.

Controller options include:
- `weights`: an array of "number-like" values (explicit numbers or numbers as strings) specifying the weights associated with the rate controllers defined in the `rateControllers` property.

    The weights do not necessarily have to sum to `1`, since they will eventually be normalized to a vector of unit length. This means, that the weights can be specified in a manner that is the most intuitive for the given configuration. For example, the weights can correspond to durations, numbers of transactions or ratios.

    In the above example, the weights are corresponding to ratios (2:1:2). The exact meaning of the weights is determined by whether the benchmark round is _duration-based_ or _transaction number-based_. If the above controller definition is used in a round with a duration of 5 minutes, then in the first 2 minutes the transactions will be submitted at 100 TPS, then at 300 TPS for the next minute, and at 200 TPS for the last 2 minutes of the round.

    Note, that 0 weights are also allowed in the array. Setting the weight of one or more controllers to 0 is a convenient way to "remove/disable" those controllers without actually removing them from the configuration file.

- `rateControllers`: an array of arbitrary rate controller specifications. See the documentation of the individual rate controllers on how to configure them. The number of specified rate controllers must equal to the number of specified weights.

    Note, that technically, composite rate controllers can be nested to form a hierarchy. However, using a composite rate controller incurs an additional execution overhead in the rate control logic. Keep this in mind before specifying a deep hierarchy of composite rate controllers, or just flatten the hierarchy to a single level.

- `logChange`: a `boolean` value indicating whether the switches between the specified rate controllers should be logged or not.

For example, the definition of a square wave function (with varying amplitude) as the transaction submission rate is as easy as switching between [fixed rate](#fixed-rate) controllers with different TPS settings:

```json
{
  "type": "composite-rate",
  "opts": {
    "weights": [2, 1, 2],
    "rateControllers": [
      {
        "type": "fixed-rate",
        "opts": {"tps" : 100}
      },
      {
        "type": "fixed-rate",
        "opts": {"tps" : 300}
      },
      {
        "type": "fixed-rate",
        "opts": {"tps" : 200}
      }
    ],  
    "logChange": true
  }
}
```

**Important!** The existence of the composite rate controller is almost transparent to the specified "sub-controllers." This is achieved by essentially placing the controllers in a "virtualized" round, i.e., "lying" to them about:
* the duration of the round (for duration-based rounds),
* the total number of transactions to submit (for transaction number-based rounds),
* the starting time of the round, and
* the index of the next transaction to submit.

The results of recently finished transactions are propagated to the sub-controllers as-is, so for the first few call of a newly activated sub-controller it can receive recent results that don't belong to its virtualized round.

This virtualization does not affect the memoryless controllers, i.e., the controllers whose control logic does not depend on global round properties or past transaction results. However, other controllers might exhibit some strange (but hopefully transient) behavior due to this "virtualized" round approach. For example, the logic of the [PID controller](#pid-rate) for example depends on the transaction backlog.

## Zero Rate

This controller stops the workload generation for the duration of the round. 

### Options and use
Using the controller on its own for a round is meaningless. However, it can be used as a building block inside a [composite rate](#composite-rate) controller. **The zero rate controller can be used only in duration-based rounds!**

```json
{
  "type": "composite-rate",
  "opts": {
    "weights": [30, 10, 10, 30],
    "rateControllers": [
      {
        "type": "fixed-rate",
        "opts": {"tps" : 100}
      },
      {
        "type": "fixed-rate",
        "opts": {"tps" : 500}
      },
      {
        "type": "zero-rate",
        "opts": { }
      },
      {
        "type": "fixed-rate",
        "opts": {"tps" : 100}
      }
    ],  
    "logChange": true
  }
}
```

Let's assume, that the above example is placed in a round definition with an 80 seconds duration (note the intuitive specification of the weights). In this case, an initial 30 seconds _normal_ workload is followed by a 10 seconds _intensive_ workload, which is followed by a 10 seconds _cooldown_ period, etc.

The controller is identified by the `zero-rate` string as the value of the `type` property and requires no additional configuration.

## Record Rate

This rate controller serves as a decorator around an other (arbitrary) controller. Its purpose is to record the times (relative to the start of the round) when each transaction was submitted, i.e., when the transaction was "enabled" by the "sub-controller."

The following example records the times when the underlying [fixed rate](#fixed-rate) controller enabled the transactions (for details, see the available options below the example):

```json
{
  "type": "record-rate",
  "opts": {
    "rateController": {
      "type": "fixed-rate",
      "opts": {"tps" : 100}
    },
    "pathTemplate": "../tx_records_client<C>_round<R>.txt",
    "outputFormat": "TEXT",
    "logEnd": true
  }
}
```

The record rate controller can be specified by setting the rate controller `type` to the `record-rate` string. The available options (`opts` property) are the following:
* `rateController`: the specification of an arbitrary rate controller.
* `pathTemplate`: the template for the file path where the recorded times will be saved. The path can be either an absolute path or relative to the root Caliper directory.

    The template can (**and should**) contain special "variables/placeholders" that can refer to special environment properties (see the remarks below). The available placeholders are the following:
    * `<C>`: placeholder for the 1-based index of the current worker that uses this rate controller.
    * `<R>`: placeholder for the 1-based index of the current round that uses this rate controller.
* `outputFormat`: optional. Determines the format in which the recording will be saved. Defaults to `"TEXT"`. The currently supported formats are the following:
    * `"TEXT"`: each recorded timing is encoded as text on separate lines.
    * `"BIN_BE"`: binary format with Big Endian encoding.
    * `"BIN_LE"`: binary format with Little Endian encoding.
* `logEnd`: optional. Indicates whether to log that the recordings are written to the file(s). Defaults to `false`.

**Template placeholders:** since Caliper provides a concise way to define multiple rounds and multiple workers with the same behavior, it is essential to differentiate between the recordings of the workers and rounds. Accordingly, the output file paths can contain placeholders for the round and worker indices that will be resolved automatically at each worker in each round. Otherwise, every worker would write the same file, resulting in a serious conflict between timings and transaction IDs.

**Text format:** the rate controller saves the recordings in the following format (assuming a constant 10 TPS rate and ignoring the noise in the actual timings), row `i` corresponding to the `i`th transaction:
```csv
100
200
300
...
```

**Binary format:** Both binary representations encode the `X` number of recordings as a series of `X+1` UInt32 numbers (1 number for the array length, the rest for the array elements), either in Little Endian or Big Endian encoding:
```
Offset: |0      |4      |8      |12      |16      |...     
Data:   |length |1st    |2nd    |3rd     |4th     |...      
```

## Replay Rate

One of the most important aspect of a good benchmark is its repeatability, i.e., it can be re-executed in a deterministic way whenever necessary. However, some benchmarks define the workload (e.g., user behavior) as a function of probabilistic distribution(s). This presents two problems from a practical point of view:

1. Repeatability: The random sampling of the given probability distribution(s) can differ between benchmark (re-)executions. This makes the comparison of different platforms questionable.
1. Efficiency: Sampling a complex probability distribution incurs an additional runtime overhead, which can limit the rate of the load, distorting the originally specified workload.

This rate controller aims to mitigate these problems by replaying a fix transaction load profile that was created "offline." This way the profile is generated once, outside of the benchmark execution, and can be replayed any time with the same timing constraints with minimal overhead.

A trivial use case of this controller is to play back a transaction recording created by the [record controller](#record-rate). However, a well-formed trace file is the only requirement for this controller, hence any tool/method can be used to generate the transaction load profile.

The following example specifies a rate controller that replays some worker-dependent workload profiles (for details, see the available options below the example):

```json
{
  "type": "replay-rate",
  "opts": {
    "pathTemplate": "../tx_records_client<C>.txt",
    "inputFormat": "TEXT",
    "logWarnings": true,
    "defaultSleepTime": 50
    }
}
```

The replay rate controller can be specified by setting the rate controller type to the `replay-rate` string. The available options (`opts` property) are the following:

* `pathTemplate`: the template for the file path where the transaction timings will be replayed from. The path can be either an absolute path or relative to the root Caliper directory.

    The template can (**and should**) contain special "variables/placeholders" that can refer to special environment properties (see the remarks at the [record rate controller](#record-rate)). The available placeholders are the following:
    * `<C>`: placeholder for the 1-based index of the current worker that uses this rate controller.
    * `<R>`: placeholder for the 1-based index of the current round that uses this rate controller.
* `inputFormat`: optional. Determines the format in which the transaction timings are stored (see the details at the [record rate controller](#record-rate)). Defaults to `"TEXT"`. The currently supported formats are the following:
    * `"TEXT"`: each recorded timing is encoded as text on separate lines.
    * `"BIN_BE"`: binary format with Big Endian encoding.
    * `"BIN_LE"`: binary format with Little Endian encoding.
* `logWarnings`: optional. Indicates whether to log that there are no more recordings to replay, so the `defaultSleepTime` is used between consecutive transactions. Defaults to `false`.
* `defaultSleepTime`: optional. Determines the sleep time between transactions for the case when the benchmark execution is longer than the specified recording. Defaults to `20` ms.

**About the recordings:**

Special care must be taken, when using duration-based benchmark execution, as it is possible to issue more transactions than specified in the recording. A safety measure for this case is the `defaultSleepTime` option. This should only occur in the last few moments of the execution, affecting only a few transactions, that can be discarded before performing additional performance analyses on the results.

The recommended approach is to use transaction number-based round configurations, since the number of transactions to replay is known beforehand. Note, that the number of workers affects the actual number of transactions submitted by a worker.

## Adding Custom Controllers

It is possible to use rate controllers that are not built-in controllers of Caliper. When you specify the rate controller in the test configuration file (see the [architecture documentation](./Architecture.md)), you must set the `type` and `opts` attributes.

You can set the `type` attribute so that it points to your custom JS file that satisfies the following criteria:
1. The file/module exports a `createRateController` function that takes the following parameters:
    1. An `TestMessage` parameter that is the `object` representation of the `opts` attribute set in the configuration file, and contains the custom settings of your rate controller.
    1. A `TransactionStatisticsCollector` object that gives the rate controller access to the current worker transaction statistics
    1. A `workerIndex` parameter of type `number` that is the 0-based index of the worker process using this rate controller.
    
    The function must return an object (i.e., your rate controller instance) that satisfies the next criteria.
2. The object returned by `createRateController` must implement the `/packages/caliper-core/lib/rate-control/rateInterface.js` interface, i.e., must provide the following async functions:
    1. `applyRateControl`, for performing the actual rate control by "blocking" the execution (in an async manner) for the desired time.
    1. `end`, for disposing any acquired resources at the end of a round.

The following example is a complete implementation of a rate control that doesn't perform any control, thus allowing the submitting of transactions as fast as the program execution allows it (warning, this implementation run with many worker processes could easily over-load a backend network, so use it with caution).

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

const RateInterface = require('path-to-caliper/caliper-core/lib/rate-control/rateInterface.js');

/**
 * Rate controller for allowing uninterrupted workload generation.
 *
 * @property {object} options The user-supplied options for the controller. Empty.
 */
class MyRateController extends RateInterface{
    /**
     * Initializes the rate controller instance.
     * @param {TestMessage} testMessage The testMessage passed for the round execution
     * @param {TransactionStatisticsCollector} stats The TX stats collector instance.
     * @param {number} workerIndex The 0-based index of the worker node.
     * @param {number} roundIndex The 0-based index of the current round.
     * @param {number} numberOfWorkers The total number of worker nodes.
     * @param {object} roundConfig The round configuration object.
     */
    constructor(testMessage, stats, workerIndex) {
        super(testMessage, stats, workerIndex);
    }

    /**
     * Doesn't perform any rate control.
     * @async
     */
    async applyRateControl() {
        // no sleeping is needed, allow the transaction invocation immediately
    }

    /**
     * Notify the rate controller about the end of the round.
     * @async
     */
    async end() { 
        // nothing to dispose of
    }
}

/**
 * Factory for creating a new rate controller instance.
 * @param {TestMessage} testMessage start test message
 * @param {TransactionStatisticsCollector} stats The TX stats collector instance.
 * @param {number} workerIndex The 0-based index of the worker node.
 *
 * @return {RateInterface} The new rate controller instance.
 */
function createRateController(testMessage, stats, workerIndex) {
    return new MyRate(testMessage, stats, workerIndex);
}

module.exports.createRateController = createRateController;
``` 

Let's say you save this implementation into a file called `myRateController.js` next to your Caliper directory (so they're on the same level). In the test configuration file you can set this rate controller (at its required place in the configuration hierarchy) the following way:

```yaml
rateControl:
  # relative path from the Caliper directory
- type: ../myRateController.js
  # empty options
  opts: 

```

## License
The Caliper codebase is released under the [Apache 2.0 license](./LICENSE.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.
