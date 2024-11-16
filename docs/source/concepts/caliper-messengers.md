## Overview

Caliper uses an orchestrator to control workers that interact with the SUT in order to perform a benchmark. Messages are passed between the orchestrator and all workers in order to keep the workers synchronized, and to progress the specified benchmark tests. A user may specify the messaging protocol that is user by Caliper in order to facilitate communications between the orchestrator and worker.

## Messengers

The messaging protocol to be used for communications between the orchestrator and worker during a benchmark is declared in the `caliper runtime configuration file`. Unspecified values will default to those specified in the [default configuration file](https://github.com/hyperledger-caliper/caliper/blob/main/packages/caliper-core/lib/config/default.yaml).

Permitted messengers are:

- Process: The `process` messenger is the default messenger and is based on native NodeJS `process` based communications. This messenger type is only valid for instances when local workers are being used to perform a benchmark.
- MQTT: The `mqtt` messenger uses [MQTT](https://mqtt.org/) to facilitate communication between the orchestrator and workers. This messenger type is valid for both local and distributed workers, and assumes the existence of an MQTT broker service that may be used, such as [mosquitto](https://mosquitto.org/).

!!! note
    *Mosquitto v2 requires explicit authorization and authentication configurations, which is a breaking change compared to v1. To migrate to v2, follow the [official migration guide of Mosquitto](https://mosquitto.org/documentation/migrating-to-2-0/).*

The following yaml extract specifies the use of an MQTT communication method, using an existing MQTT broker that may be connected to via the specified address:

```sh
    worker:
        communication:
            method: mqtt
            address: mqtt://localhost:1883
```

If not specifying a `caliper.yaml` configuration file, the above may be specified as command line arguments to the CLI process as:

```sh
--caliper-worker-communication-method mqtt --caliper-worker-communication-address mqtt://localhost:1883
```

## License

The Caliper codebase is released under the [Apache 2.0 license](../getting-started/license.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at [http://creativecommons.org/licenses/by/4.0/](http://creativecommons.org/licenses/by/4.0/).