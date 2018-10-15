# Rate Controllers

The rate at which transactions are input to the blockchain system is a key factor within performance tests. It may be desired to send transactions at a specified rate or follow a specified profile. Caliper permits the specification of custom rate controllers to enable a user to perform testing under a custom loading mechanism. A user may specify their own rate controller or use one of the default options:

* [Fixed rate](#fixed-rate)
* [PID rate](#pid-rate)
* [Composite rate](#composite-rate)
* [Linear rate](#linear-rate)
* [Zero rate](#zero-rate)
* [Record rate](#record-rate)
* [Replay rate](#replay-rate)

## Fixed Rate
The fixed rate controller is the most basic controller, and also the default option if no controller is specified. It will send input transactions at a fixed interval that is specified as TPS (transactions per second).

The fixed rate controller, driving at 10 TPS, is specified through the following controller option: 

```json
{
  "type": "fixed-rate", 
  "opts": {"tps" : 10}
}
```

## PID Rate
The PID rate controller is a basic PID (proportional-derivative-integral) controller for driving the tests at a target loading (backlog transactions). This controller will aim to maintain a defined backlog of transactions within the system by modifying the driven TPS.

The modification of the TPS is performed by a basic controller, which aims to drive the backlog error (difference between current and desired transaction backlog) to zero. It works on the proportional (error size), derivative (rate of change of error) and integral (error history) to adjust the time between transaction submission such that the backlog is maintained at a set level.

The controller requires user input gains (constants) that are used to tune the controller for the deployed chaincode. Since each chaincode is unique, it will require unique gains to achieve stability. The controller is also seeded with an initial driving tps. To assist with controller tuning, there is an optional parameter to permit viewing the current backlog error, controller inputs, and current sleep time being applied between transactions.

There are numerous methods to tune the control parameters. A good starting point is:
1. Set all gains to zero.
2. Increase the P gain until the response to a disturbance is steady oscillation.
3. Increase the D gain until the the oscillations go away (i.e. it's critically damped).
4. Repeat steps 2 and 3 until increasing the D gain does not stop the oscillations.
5. Set P and D to the last stable values.
6. Increase the I gain until it brings you to the setpoint with the number of oscillations desired (normally zero but a quicker response can be had if you don't mind a couple oscillations of overshoot)

The PID rate controller, targeting a backlog of 5 transactions and seeded with an initial TPS of 2, and enabling viewing of the control parameters, is specified through the following controller option: 

```json
{
  "type": "pid-rate", 
  "opts": {
    "targetLoad": 5, 
    "initialTPS": 2, 
    "proportional": 0.2, 
    "integral": 0.0001, 
    "derrivative": 0.1, 
    "showVars": true
  }
}
``` 

In the specification, `proportional`, `derrivative` and `integral` respectively specify the gains `Kp`, `Kd`, and `Ki`, used within the controller.

## Composite Rate

A benchmark round in Caliper is associated with a single rate controller. However, a single rate controller is rarely sufficient to model advanced client behaviors. Moreover, implementing new rate controllers for such behaviors can be cumbersome and error-prone. Most of the time a complex client behavior can be split into several, simpler phases. 

Accordingly, the composite rate controller enables the configuration of multiple "simpler" rate controllers _in a single round_, promoting the reusability of existing rate controller implementations. The composite rate controller will automatically switch between the given controllers according to the specified weights (see the configuration details after the example).

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

The composite rate controller can be specified by setting the rate controller `type` to the `composite-rate` string. The available options (`opts` property) are the following:
* `weights`: an array of "number-like" values (explicit numbers or numbers as strings) specifying the weights associated with the rate controllers defined in the `rateControllers` property. 
    
    The weights do not necessarily have to sum to `1`, since they will eventually be normalized to a vector of unit length. This means, that the weights can be specified in a manner that is the most intuitive for the given configuration. For example, the weights can correspond to durations, numbers of transactions or ratios. 
    
    In the above example, the weights are corresponding to ratios (2:1:2). The exact meaning of the weights is determined by whether the benchmark round is _duration-based_ or _transaction number-based_. If the above controller definition is used in a round with a duration of 5 minutes, then in the first 2 minutes the transactions will be submitted at 100 TPS, then at 300 TPS for the next minute, and at 200 TPS for the last 2 minutes of the round.
    
    Note, that 0 weights are also allowed in the array. Setting the weight of one or more controllers to 0 is a convenient way to "remove/disable" those controllers without actually removing them from the configuration file.

* `rateControllers`: an array of arbitrary rate controller specifications. See the documentation of the individual rate controllers on how to configure them. The number of specified rate controllers must equal to the number of specified weights.

    Note, that technically, composite rate controllers can be nested to form a hierarchy. However, using a composite rate controller incurs an additional execution overhead in the rate control logic. Keep this in mind before specifying a deep hierarchy of composite rate controllers, or just flatten the hierarchy to a single level.
    
* `logChange`: a `boolean` value indicating whether the switches between the specified rate controllers should be logged or not.

**Important!** The existence of the composite rate controller is almost transparent to the specified "sub-controllers." This is achieved by essentially placing the controllers in a "virtualized" round, i.e., "lying" to them about: 
* the duration of the round (for duration-based rounds),
* the total number of transactions to submit (for transaction number-based rounds),
* the starting time of the round, and
* the index of the next transaction to submit.

The results of recently finished transactions are propagated to the sub-controllers as-is, so for the first few call of a newly activated sub-controller it can receive recent results that don't belong to its virtualized round. 

This virtualization does not affect the memoryless controllers, i.e., the controllers whose control logic does not depend on global round properties or past transaction results. However, other controllers might exhibit some strange (but hopefully transient) behavior due to this "virtualized" round approach. For example, the logic of the [PID controller](#pid-rate) for example depends on the transaction backlog.

## Linear Rate

Exploring the performance limits of a system usually consists of performing multiple measurements with increasing load intensity. However, finding the tipping point of the system this way is not easy, it is more like a trial-and-error method.

The linear rate controller can gradually (linearly) change the TPS rate between a starting and finishing TPS value (both in increasing and decreasing manner). This makes it easier to find the workload rates that affect the system performance in an interesting way.

The linear rate controller can be used in both duration-based and transaction number-based rounds. The following example specifies a rate controller that gradually changes the transaction load from 25 TPS to 75 TPS during the benchmark round. 

```json
{
  "type": "linear-rate",
  "opts": {
    "startingTps": 25,
    "finishingTps": 75
    }
}
```

The linear rate controller can be specified by setting the rate controller `type` to the `linear-rate` string. The available options (`opts` property) are the following:
* `startingTps`: the TPS at the beginning of the round.
* `finishingTps`: the TPS at the end of the round.

**Note:** similarly to the [fixed rate controller](#fixed-rate), this controller also divides the workload between the available client, so the specified rates in the configuration are cumulative rates, and not the rates of individual clients. Using the above configuration with 5 clients results in clients that start at 5 TPS and finish at 15 TPS. Together they generate a [25-75] TPS load.

## Zero Rate

This controller stops the workload generation for the duration of the round. Using the controller on its own for a round is meaningless. However, it can be used as a building block inside a [composite rate](#composite-rate) controller. **The zero rate controller can be used only in duration-based rounds!**

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
    * `<C>`: placeholder for the 1-based index of the current client that uses this rate controller.
    * `<R>`: placeholder for the 1-based index of the current round that uses this rate controller.
* `outputFormat`: optional. Determines the format in which the recording will be saved. Defaults to `"TEXT"`. The currently supported formats are the following:
    * `"TEXT"`: each recorded timing is encoded as text on separate lines.
    * `"BIN_BE"`: binary format with Big Endian encoding.
    * `"BIN_LE"`: binary format with Little Endian encoding.
* `logEnd`: optional. Indicates whether to log that the recordings are written to the file(s). Defaults to `false`.

**Template placeholders:** since Caliper provides a concise way to define multiple rounds and multiple clients with the same behavior, it is essential to differentiate between the recordings of the clients and rounds. Accordingly, the output file paths can contain placeholders for the round and client indices that will be resolved automatically at each client in each round. Otherwise, every client would write the same file, resulting in a serious conflict between timings and transaction IDs. 

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

The following example specifies a rate controller that replays some client-dependent workload profiles (for details, see the available options below the example):

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
    * `<C>`: placeholder for the 1-based index of the current client that uses this rate controller.
    * `<R>`: placeholder for the 1-based index of the current round that uses this rate controller.
* `inputFormat`: optional. Determines the format in which the transaction timings are stored (see the details at the [record rate controller](#record-rate)). Defaults to `"TEXT"`. The currently supported formats are the following:
    * `"TEXT"`: each recorded timing is encoded as text on separate lines.
    * `"BIN_BE"`: binary format with Big Endian encoding.
    * `"BIN_LE"`: binary format with Little Endian encoding.
* `logWarnings`: optional. Indicates whether to log that there are no more recordings to replay, so the `defaultSleepTime` is used between consecutive transactions. Defaults to `false`.
* `defaultSleepTime`: optional. Determines the sleep time between transactions for the case when the benchmark execution is longer than the specified recording. Defaults to `20` ms.

**About the recordings:** 

Special care must be taken, when using duration-based benchmark execution, as it is possible to issue more transactions than specified in the recording. A safety measure for this case is the `defaultSleepTime` option. This should only occur in the last few moments of the execution, affecting only a few transactions, that can be discarded before performing additional performance analyses on the results.

The recommended approach is to use transaction number-based round configurations, since the number of transactions to replay is known beforehand. Note, that the number of clients affects the actual number of transactions submitted by a client.

# Custom Controllers

Rate controllers must extend `/src/comm/rate-control/rateInterface.js`, providing concrete implementations for `init`, `applyRateControl`, and optionally for `end`. Once created it must be listed within `/src/comm/rate-control/rateControl.js` as an available controller within the constructor.

Custom options are passed to the controller through the `opts` parameter. For example `{"type": "my-rate-control", "opts": {"opt1" : x, "opt2" : [a,b,c]}}` will use the rate controller `my-rate-control` and pass it the `opts` object that will be available for use within the rate controller for custom actions.

