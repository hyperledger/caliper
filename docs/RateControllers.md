# Rate Controllers

The rate at which transactions are input to the blockchain system is a key factor within performance tests. It may be desired to send transactions at a specified rate or follow a specified profile. Caliper permits the specification of custom rate controllers to enable a user to perform testing under a custom loading mechanism. A user may specify their own rate controller or use one of the defualt options:

* [Fixed rate](#fixed-rate)
* [PID rate](#pid-rate)
* [Composite rate](#composite-rate)
* [Zero rate](#zero-rate)

## Fixed Rate
The fixed rate controller is the most basic controller, and also the default option if no controller is specified. It will send input transactions at a fixed interval that is specified as TPS (transactions per second).

The fixed rate controller, driving at 10 TPS, is specifed through the following controller option: 

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

The PID rate controller, targeting a backlog of 5 transactions and seeded with and intial TPS of 2, and enabling viewing of the control parameters, is specified through the following controller option: 

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

**Important!** The existence of the composite rate controller is completely transparent to the specified "sub-controllers." This is achieved by essentially placing the controllers in a "virtualized" round, i.e., "lying" to the them about: 
* the duration of the round (for duration-based rounds),
* the total number of transactions to submit (for transaction number-based rounds),
* the starting time of the round,
* the index of the next transaction to submit, and
* the set of previously executed transactions.

This "virtualization" does not affect the memoryless controllers, i.e., the controllers whose control logic does not depend on global round properties or past transaction results. However, other controllers might exhibit some strange (but hopefully transient) behavior due to this "virtualized" round approach. The logic of the [PID controller](#pid-rate) for example depends on the transaction backlog, but the (possibly pending) transactions submitted in the previous phase (with a different controller) are not visible to the controller.

## Zero Rate

This controller stops the workload generation for the duration of the round. Using the controller on its own for a round is meaningless. However, it can be used as a building block inside a [composite rate](#composite-rate) controller. The zero rate controller can be used only in _duration-based_ rounds!

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

## Custom Controllers

Rate controllers must extend `/src/comm/rate-control/rateInterface.js`, providing concrete implementations for `init`, `applyRateControl`, and optionally for `end`. Once created it must be listed within `/src/comm/rate-control/rateControl.js` as an available controller within the constructor.

Custom options are passed to the controller through the `opts` parameter. For example `{"type": "my-rate-control", "opts": {"opt1" : x, "opt2" : [a,b,c]}}` will use the rate controller `my-rate-control` and pass it the `opts` object that will be available for use within the rate controller for custom actions.

