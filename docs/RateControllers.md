# Rate Controllers

The rate at which transactions are input to the blockchain system is a key factor within performance tests. It may be desired to send transactions at a specified rate or follow a specified profile. Caliper permits the specification of custom rate controllers to enable a user to perform testing under a custom loading mechanism. A user may specify their own rate controller or use one of the defualt options:

- Fixed rate
- PID rate

## Fixed Rate
The fixed rate controller is the most basic controller, and also the default option if no controller is specified. It will send input transactions at a fixed interval that is specified as TPS (transactions per second).

The fixed rate controller, driving at 10 TPS, is specifed through the following controller option: `{"type": "fixed-rate", "opts": {"tps" : 10}}`

## PID Rate
The PID rate controller is a discrete time PID (proportional-derivative-integral) controller for driving the tests at a target loading (backlog transactions). This controller will aim to maintain a defined backlog of transactions within the system by modifying the driven TPS.

The modification of the TPS is performed by a basic discrete time controller, which aims to drive the backlog error (difference between current and desired transaction backlog) to zero. It works on the proportional (error size), derivative (rate of change of error) and integral (error history) to adjust the TPS such that the backlog is maintained.

The controller is an implementation of the following discrete time control law:

```
u(k) = u(k-1) + a*e[k] + b*e[k-1] + c*e[k-2]
a = (Kp + Ki*(t/2) + Kd/t)
b = (-Kp + Ki*(t/2) -2*Kd/t)
c = Kd/t
```

The controller requires user input gains (constants) that are used to tune the controller for the deployed chaincode. Since each chaincode is unique, it will require unique gains to achieve stability.The controller is also seeded with an initial driving tps.

The PID rate controller, targeting a backlog of 10 transactions and seeded with and intial TPS of 10, is specified through the following controller option: `{"type": "pid-rate", "opts": {"targetLoad": 10, "initialTPS": 4, "proportional": 0.0005, "integral": 0.0001, "derrivative": 0.005}}`. In the specification, `proportional`, `derrivative` and `integral` respectively specify the gains `Kp`, `Kd`, and `Ki`, used within the controller.

## Custom Controllers

Rate controllers must extend `/src/comm/rate-control/rateInterface.js`, providing concrete implementations for `init` and `applyRateControl`. Once created it must be listed within `/src/comm/rate-control/rateControl.js` as an available controller within the constructor.

Custom options are passed to the controller through the `opts` parameter. For example `{"type": "my-rate-control", "opts": {"opt1" : x, "opt2" : [a,b,c]}}` will use the rate controller `my-rate-control` and pass it the `opts` object that will be available for use within the rate controller for custom actions.

