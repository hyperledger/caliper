## Overview

Connectors are probably the most important modules in Caliper. They provide an abstraction layer between the system under test (SUT) and the different Caliper components (e.g., the manager and workers processes, or the workload modules). A connector’s job is to simplify interaction with the SUT as much as possible, hiding any peculiarities behind its API.

!!! note

    *To get a sense of how a connector fits into the Caliper architecture, see the corresponding architecture documentation sections about [multi-platform support](../getting-started/architecture.md/#multi-platform-support), [the manager process](../getting-started/architecture.md/#the-manager-process) and [the worker processes](../getting-started/architecture.md/#the-worker-process).*

Caliper ships with some [predefined/built-in connectors](../index.md#supported-blockchain-solutions), but in general, connectors are treated as pluggable components (just like resource and TX monitors, workload modules, etc.). So nothing stops you from implementing and using your 3rd party connector! However, we strongly recommend that you absorb every part of this guide before implementing a new connector.

## Requirements for quality connectors

A connector’s complexity is usually proportional to the complexity of the SUT (and/or its programming model). Accordingly, connectors are considered heavy-weight components compared to other extension points in Caliper.

There are a few things to keep in mind when implementing a connector. Some are technical, some impact usability.

!!! note

    *Caliper does not constrain the types of SUT you can test. Accordingly, the following points are general guidelines for connectors targeting complex distributed systems. You are allowed to deviate from the advices, but you should probably document such choices to lower the surprise factor for end-users.*

1. **Keep to the predefined interface.**
- You must implement the given interface so Caliper modules can interact with the connector.
- If you expose additional capabilities outside of the interface, then you will disrupt the programming model of workload module developers. They will have to handle your extra API as a separate case, complicating the development of cross-platform benchmarks However, if you are implementing a workload module to performance test a specific SUT, then this is not a concern.
- If your connector behaves similarly to other connectors following this guide, users will be quick to adapt and experiment with your connector/SUT.

2. **Consider the distributed nature of the SUT.**
- Distributed systems consist of multiple nodes, sometimes with different roles.
- You probably don’t want the connector to be just a proxy for a single SUT node. The connector should be aware of as many SUT nodes as it makes sense to support features like load balancing or SUT-specific request execution policies.
- Hide the network topology as much as you can from other Caliper modules, especially from workload modules. Most of the time an emulated client does not care about the receiving end of a request as long as it’s executed.
- If you must expose certain nodes to the workload modules, then do that through simple (preferably text-based) handles. But do not expose implementation-specific classes representing the nodes!

3. **Consider the actors in the SUT.**
- Authentication and authorization are cornerstones for almost every remote system, thus handling digital identities (that can come in many forms) must be a first-class feature in connectors.
- Similarly to the nodes in the SUT, there will be many actors/clients with different privileges initiating different requests. A connector should be able to impersonate multiple clients to allow for diverse client behaviors in workload modules.
- A connector should allow for easy switching between client identities for each request, thus the connector must expose the identities towards the workload modules somehow. The same advice applies as for the nodes: use simple (preferably text-based) handles, but do not expose implementation-specific classes representing the identities!

4. **Do not reinvent the wheel.**
- Each system exposes a standard remote API for communicating with clients. These APIs can take many forms (REST, gRPC, etc.).
Regardless of the used API technology, there’s probably a mature client library for it. Or even better, the target platform has its own SDK!
- A connector shouldn’t bother with network-level communication and such low-level details. Delegate such tasks to the SDKs or client libraries. This will allow your connector to be more robust and to attract additional contributors familiar with the used libraries.

5. **Do not be the bottleneck.**
- The purpose of Caliper is to performance test the SUT from the client’s point-of-view.
- If assembling and sending a request takes time in the same order of magnitude as executing the request, then the results won’t be representative. Sending requests is considered a hot path for connectors, and it should be as efficient as possible.
- Using SDKs and widely known client libraries is an exception. Real client-side applications will probably do the same, so the library overheads must be incorporated into the request latencies. Do not micro-optimize by writing your own special-purpose SDK, just to push down the latency numbers!
- Connector bottlenecks on the hot path will influence/limit the request output rate of Caliper worker processes. Caliper users won’t be happy if they have to launch 10 worker processes just to send 100 requests per second to the SUT.

!!! note

    ***A connector’s job is to bridge the platform-agnostic Caliper-side API with the high-level SUT-specific client library, while adhering to the above points.***

## Implementing the connector

You should treat a connector implementation process as a full-fledged Node.js project. Refer to the [Caliper integration](#integration-with-caliper) section for the suggested project structure. Putting the project structure aside, you have four implementation-related tasks:

1. Implement the connector interface (optionally using the available utility base class).
2. Implement a factory method for instantiating the connector.
3. Define the schema of your network configuration file.
4. Provide binding configurations for your connector.

### The connector interface

Once you add the `@hyperledger/caliper-core` package (or one of its specific versions) as your project dependency, you will gain access to its exported `ConnectorInterface` class, which declares the following [interface](https://github.com/hyperledger-caliper/caliper/blob/v0.6.0/packages/caliper-core/lib/common/core/connector-interface.js):

```sh
class ConnectorInterface extends EventEmitter {
    getType() {}
    getWorkerIndex() {}
    async init(workerInit) {}
    async installSmartContract() {}
    async prepareWorkerArguments(number) {}
    async getContext(roundIndex, args) {}
    async releaseContext() {}
    async sendRequests(requests) {}
}

module.exports = ConnectorInterface;
```

The interface is detailed in the next subsection, but for now, keep the following things in mind:

1. The connector is used in two [different environments](../getting-started/architecture.md#caliper-processes): in the manager and worker processes. The corresponding environment of the methods will be discussed in the interface reference subsection.
2. The connector must expose certain [events](https://nodejs.org/docs/latest-v10.x/api/events.html) about the requests, otherwise it’s not observable by the Caliper workers, which breaks the scheduling mechanism of Caliper.
3. `sendRequests` is the hot path for the interface, implement it carefully and efficiently!
4. The behavior of the connector (and the methods to really implement) largely depends on the capabilities of the network configuration schema. The more flexibility you allow on the Caliper-side of the network, the more features you will have to provide. A flexible connector makes it easier to setup benchmark scenarios, resulting in happy users.

#### Interface reference

`getType`

- **Description** Retrieves a short name for the connector type, usually denoting the SUT, e.g., `fast-ledger`. The name can be used by workload modules capable of targeting multiple types of SUT.
- **Return type** *string*
- **Returns** The name of the connector.

`getWorkerIndex`

- **Description** Retrieves the zero-based worker process index that instantiated the connector.
- **Return type** *number*
- **Returns** The worker process index.

`init`

- **Description** The method is called by both the manager and (optionally) the worker processes to initialize the connector instance, and potentially certain aspects of the SUT. The initialization tasks are connector-specific, but usually can be divided among the processes:
    - The manager process instance performs one-time initialization tasks that require interaction with the SUT. Such tasks can include, for example, the creation of digital identities, or other housekeeping actions regarding the SUT.
    - The worker process instances usually just perform local housekeeping tasks, like creating the necessary data structures or caches needed later on when sending requests. This step is optional and can be performed by your factory method after creating the connector instance. If the worker processes need to access the SUT in this phase, then they should do so using only idempotent operations (like configuration queries) that guarantee correct execution for arbitrary number of parallel worker processes.
- **Parameters**
    - *workerInit (boolean)* Denotes whether the method is called by a worker process, or by the manager process.
- **Return type** *Promise*
- **Returns** The promise that will resolve upon method completion.

`installSmartContract`

- **Description** The method is called by the manager process to perform contract deployment on the SUT, if allowed remotely.
- **Return type** *Promise*
- **Returns** The promise that will resolve upon method completion.

`prepareWorkerArguments`

- **Description** This method is called by the manager process, and ensures that the connector instance in the manager process can distribute data to the connector instances in the worker processes. This method is the perfect place to return, for example, newly created digital identities to the manager process, which in turn will distribute them to the worker process instances for further use.
- **Return type** *Promise<object[]\>*
- **Returns** The promise of connector-specific objects for each worker that will resolve upon method completion.

`getContext`

- **Description:** The method is called by the worker processes before each round, and can be used to assemble a connector-specific object that will be shared with the workload module of the current round. The method is also the perfect place to claim resources necessary for the next round, like establishing connections to remote nodes.
- **Parameters:**
  - *roundIndex (number)*: The zero-based index of the imminent round.
  - *args (object)*: The object assembled for this worker instance in the `prepareWorkerArguments` method of the manager instance.
- **Return type:** *Promise<object\>*
- **Returns:** The promise of a connector-specific object that will resolve upon method completion.

`releaseContext`

- **Description:** The method is called by the worker processes after each round, and can be used to release resources claimed in the `getContext` method.
- **Return type:** *Promise*
- **Returns:** The promise that will resolve upon method completion.

`sendRequests`

- **Description:** This method is the hot path of the connector, called in the worker processes by the workload modules of the rounds. The method must accept one or multiple settings objects pertaining to the request or requests that must be sent to the SUT. The connector doesn’t have to preserve the order of execution for the requests, unless the target SUT type supports such request batches. The connector must gather at least the start time, finish time, and final status (successful or failed) of every request through [TxStatus](https://github.com/hyperledger-caliper/caliper/blob/v0.6.0/packages/caliper-core/lib/common/core/transaction-status.js) instances.
- **Return type:** *Promise<TxStatus|TxStatus[]>*
- **Returns:** The promise of one or more request execution results that will resolve upon method completion.

#### Exposed events

The connector must expose the following events with names matching the defined [constants](https://github.com/hyperledger-caliper/caliper/blob/v0.6.0/packages/caliper-core/lib/common/utils/constants.js) for them. Without these events the Caliper scheduling mechanism won’t function correctly, and other components might also rely on them (like TX monitors).

`txsSubmitted`

- **Description** The event must be raised when one or more requests are submitted for execution to the SUT. Typically the event should be raised for every individual request.
- **Parameters**
    - *count (number)* The number of requests submitted.

`txsFinished`

- **Description** The event must be raised when one or more requests are fully processed by the SUT (i.e., the connector received the results).
- **Parameters**
    - *results (TxStatus|TxStatus[])* One or more request execution result gathered by the connector.   

#### Optional base class

The `@hyperledger/caliper-core` package also exports a `ConnectorBase` class that provides sensible default implementations for the following `ConnectorInterface` methods:

- `prepareWorkerArguments`: An empty object is returned for each worker by default, i.e., nothing is shared with the worker process instances.
- `sendRequests`: Handles the cases when a single or multiple requests are submitted by the workload modules. Also raises the necessary events before and after the requests. The method delegates the execution of a single request to the `_sendSingleRequest` method (see below).
- `constructor`: Declares a constructor that requires the worker index and SUT/connector type as parameters.
- `getType`: Provides a simple getter for the corresponding constructor argument.
- `getWorkerIndex`: Provides a simple getter for the corresponding constructor argument.

If you opt in to use this base class for your connector then you must implement the `_sendSingleRequest` method.

`_sendSingleRequest`

- **Description** The method only has to handle the sending and processing of a single request.
- **Parameters**
    - *request (object)* A connector-specific settings object for the request.
- **Return type** *Promise<TxStatus>*
- **Returns** The promise of a request execution result that will resolve upon method completion.

### The factory method

The entry point for your connector implementation will be a factory method. The manager and worker processes will call this exported factory method to instantiate your connector (be careful with the casing).

`ConnectorFactory`
- **Description** Instantiates a connector and optionally initializes it. When called from the manager process (denoted with a worker index of `-1`), the manager will handle calling the `init` and `installSmartContracts` methods. This initialization is optional in the worker processes, so the factory method must handle it if required.
- Parameters
    - workerIndex (number) The zero-based index of the worker process, or `-1` for the manager process.
- **Return type** *Promise<ConnectorInterface>*
- **Returns** The promise of a `ConnectorInterface` instance that will resolve upon method completion.

The following is a possible implementation of a factory method for our `fast-ledger` connector:

```sh
    'use strict';

    const FastLedgerConnector = require('./fast-ledger-connector');

    async function ConnectorFactory(workerIndex) {
        const connector = new FastLedgerConnector(workerIndex, 'fast-ledger');

        // initialize the connector for the worker processes
        if (workerIndex >= 0) {
            await connector.init(true);
        }

        return connector;
    }

    module.exports.ConnectorFactory = ConnectorFactory;
```    

### The network configuration file

The [network configuration file](../getting-started/architecture.md#network-configuration-file) can contain whatever information your connector requires to communicate with the SUT and fulfill the connector [quality requirements](#requirements-for-quality-connectors). The configuration file can be either a JSON or YAML file. YAML is preferred for its readability and comment support.

The network configuration schema must contain a mandatory top-level field with the following structure:

```sh
# mandatory
caliper:
  # mandatory
  blockchain: fast-ledger
  # optional
  commands:
    start: startLedger.sh
    end: stopLedger.sh
```

The `caliper.blockchain` attribute tells Caliper which connector to load for the test. The value of the attribute depends on how you want to [integrate the connector with Caliper](#integration-with-caliper).

## Binding configuration

The [binding](../getting-started/installing-caliper.md/#the-bind-command) command of Caliper allows you to specify major connector dependencies to be installed during runtime (instead of packaged with the connector during development time). SUT SDKs and other client libraries usually fall into this category (i.e., libraries that facilitate interactions with the SUT). If the APIs of such libraries are consistent across different versions, then your single connector implementation can possibly target multiple SUT versions.

In that case, users should be able to select a specific SDK version that will target the corresponding SUT version. You can achieve this by providing a binding configuration file (JSON or YAML) for your connector.

### Simple configuration

The schema of a general binding configuration is usually simple:

```sh
sut:
  fast-ledger:
    1.0:
      packages: ['fast-ledger-sdk@1.0.0']
    1.4:
      packages: ['fast-ledger-sdk@1.4.5']
    2.0: &fast-ledger-latest
      packages: ['fast-ledger-sdk@2.0.0']
    latest: *fast-ledger-latest
```

Several things to note about the above configuration:

1. The `sut` top-level attribute denotes the configuration section that Caliper will process. You can write arbitrary YAML sections outside of this attribute, without any schema constraints. This means you can utilize, for example, YAML anchors and aliases to improve the readability of your complex binding specification. You will see an example soon.
2. The `sut` attribute contains keys that identify the SUT types whose connector supports binding. We defined a single SUT type (`fast-ledger`) for our example connector.
3. Under `fast-ledger` we can define several SUT versions our connector supports. It’s recommended to use keys corresponding to the semantic version of the SUT. The users will specify the binding using the SUT type and SUT version, for example, by passing the `--caliper-bind-sut fast-ledger:1.4` command line argument to Caliper.
4. Every SUT version needs to declare the required `packages` Caliper should install during runtime. The different SUT versions will usually declare different SDK version to install.
5. Even though we declared `1.4` as SUT version, we asked Caliper to install the `1.4.5` SDK version. It’s good practice to always bind to the latest available patch release, so users can enjoy the latest bug fixes for an SDK version.
6. Many library management systems (like NPM and DockerHub) provide `latest` tags to denote the newest release. If you provide such a binding “version” for your connector, then users can bind your connector by using the simplified `--caliper-bind-sut fast-ledger` notation. You can easily refer to the binding version you deem latest using YAML anchors and aliases. Doing so will make your configuration easier to read and maintain.

### Advanced configuration

Even though your connector supports multiple SUT versions on the implementation level, that doesn’t mean that all versions can be equally supported in the same environment. A typical example would be to support older SUT versions, whose corresponding SDK packages fail to build “automagically” under newer Node.js version. The binding configuration provides some flexibility to tune the installation of these packages.

Node modules can include native components which may have to be compiled on the system it will run on and against the specific version of node that is being used (some package owners make precompiled versions for specific platforms and versions of node available to download to avoid having to perform a local compilation). This means you will have to have appropriate compilers installed. Moreover, the used compiler is strict by default, resulting in multiple compilation errors.

To circumvent such hardships, the binding configuration schema allows us to tinker with the install process by specifying command line arguments and environment variables (picked up by `npm install`). You can put such install logic under the `settings` attribute.

```sh
sut:
  fast-ledger:
    1.0:
      packages: ['fast-ledger-sdk@1.0.0', 'comm-lib@1.0.0']
      settings:
      # compiling older comm-lib on newer Node.js version
      - versionRegexp: '^((?!v8\.).)*$'
        env:
          CXXFLAGS: '-Wno-error=class-memaccess'
          CFLAGS: '-Wno-error=class-memaccess'
        args: '--build-from-source'
```        

The `settings` attribute is actually an array of potentially applicable settings. Caliper will process them in order, and picks the first settings object whose regular expression (`versionRegexp`) matches the used Node.js version. The example demonstrates a setting that should be applied if a newer Node.js version is used (i.e., the version is not `v8.X`). If that is the case, then pass the command line arguments (specified by `args`) to `npm install`, and also set the environment variables specified under `env` (which will also be picked up by `npm install` and any sub-command executed by it).

Your connector can use such advanced specification to provide support for a wide range of SUT/SDK versions in multiple environments.

## Documenting the connector

Providing proper user manual for your connector is just as important as a quality implementation. Otherwise, users will have a hard time interacting with your connector. We will take the [Fabric connector documentation](fabric-config.md) as an example, section by section.

### Overview

You should provide a short summary of your connector. This should include the following:

- The supported SUT type and versions.
- The capabilities of your connector (supported SUT features and limitations).

The overview will lay down the foundation of what users can expect from your connector.

### Installing dependencies

If your connector supports multiple SUT versions through the binding process, then document the necessary steps to bind to a specific version. The binding process is universal for every connector, so a short example should suffice.

However, it can happen that not every SUT feature is supported by every binding. Carefully document the limitations of the affected bindings, and provide some workaround if possible.

### Runtime settings

The network configuration file only describes the SUT topology and related artifacts. SUT-agnostic design choices can still arise during the development of a connector. Instead of deciding yourself, you should delegate such choices to the end users utilizing the [runtime configuration mechanism](../concepts/runtime-config.md) of Caliper where possible/meaningful.

Such settings typically affect the operating mode of the connector, but don’t change the overall semantics of the SUT interactions. Be sure to document every available runtime setting for your connector! Also, don’t forget to provide sensible defaults to these settings where possible.

### Request API

The main users of your connector will be workload module developers. They will interact with your connector mainly through the `[sendRequests](#interface-reference)` method. The method accepts either a single, or multiple settings object relating to the requests the user wants to send. You have to precisely specify what kind of settings are available for a request. These will typically include:

- The operation to execute on the SUT.
- The arguments of the operation.
- The identity who should submit the request.
- The node(s) to send the request to.
- Differentiation between read-only/write requests.

### Gathered request data

Your connector must report basic execution data towards Caliper to ensure correct reporting. But you are also free to collect any kind of client-side data you have access to. Who knows what data users will find useful. Make sure to document such collected data (both semantics and data types).

### Network configuration file

The probably most important piece of your documentation is the schema of the network configuration file your connector can process. Try to provide an intuitive structure for defining the network topology, participants and any required artifacts. You should document the semantics and data types of different settings. Be sure to document any constraints that could arise between multiple attributes (mutual exclusion, valid values, etc.).

### Example network configuration

Be sure to provide a fully specified and functioning network configuration example. For some, it is easier to absorb a concrete example than a reference-style documentation.

## Integration with Caliper

Once you’ve implemented your connector, you have two choices to integrate it with Caliper:

1. Use it as a 3rd party, pluggable component, which is part of your benchmark project.
2. Contribute your connector to the official Caliper code-base, so it’s always installed together with Caliper.

### 3rd party connector

You can easily plug in your connector dynamically without it being part of the Caliper code-base. The process is the following:

1. Create an `index.js` file in your project that will export your connector factory. The file provides a clean entry point for your connector:

```sh
'use strict';
module.exports.ConnectorFactory = require('./lib/connectorFactory').ConnectorFactory;
```

2. Set the `./fast-ledger/index.js` path for the `caliper.blockchain` attribute in your network configuration file. The path should be relative to the Caliper workspace directory, or an absolute path (not recommended for portability reasons). Caliper will load the module and the factory method from this path.
3. If you support different bindings, then prepare a binding configuration file for your connector.
4. When you launch Caliper, your connector implementation will be picked up through your network configuration file.
5. You can specify your custom binding configuration using, for example, the `--caliper-bind-file ./fast-ledger-binding.yaml` command line argument that points to your custom file. Don’t forget to also specify the binding itself with `--caliper-bind-sut fast-ledger:1.0`.

Alternatively, you can set your `caliper.blockchain` attribute to an NPM package name if you published your connector. In that case, you must ensure that the package is installed in the Caliper workspace directory prior to running the benchmark. The recommended naming convention for packages is `caliper-sut`. For our example, the caliper.blockchain attribute would be set to `caliper-fast-ledger`.

!!! note
     
    *Until Caliper reaches its first major version, it is recommended to version your connector package based on which `@hyperledger/caliper-core` version you depend on.*   

### Built-in 

!!! note
     
    ***By contributing a connector to the code-base, you also accept the responsibility of maintaining the connector when needed. Otherwise, it might become stale and deprecated in future releases.***   

If you would like to expose you connector to a wider user-base, then you should contribute your code to the official Caliper repository, so your connector becomes a built-in module, immediately available when someone installs Caliper.

!!! note

    *Don’t hesitate to reach out to the project maintainers on Rocket.Chat (`#caliper-contributors` channel) who will help you with the integration.*

The integration consists of the following steps (for an example, see the `[caliper-ethereum](https://github.com/hyperledger-caliper/caliper/tree/v0.6.0/packages/caliper-ethereum)` connector):

1. Create a `caliper-fast-ledger` directory in the `packages` directory of the repository. This will contain your connector implementation.
2. Update your metadata in your own `package.json` file accordingly. The package name should be scoped: `@hyperledger/caliper-fast-ledger`.
3. If your connector supports binding, then you should list the dynamic packages in the `devDependencies` section, so they’re not automatically installed with Caliper (since the users will rebind it anyway). Also, add your connector’s binding specifications to the built-in [binding configuration file](https://github.com/hyperledger-caliper/caliper/blob/v0.6.0/packages/caliper-cli/lib/lib/config.yaml).
4. Add your new directory path to the root `lerna.json` file, under the `packages` section. This will ensure that your package is bootstrapped correctly for other developers (and for testing, publishing, etc.).
5. Add your new package (by name) to the [Caliper CLI dependencies](https://github.com/hyperledger-caliper/caliper/blob/v0.6.0/packages/caliper-cli/package.json).
6. List your connector as a built-in connector in the `caliper-utils.js` module, under the `BuiltinConnectors` variable:
```sh
const BuiltinConnectors = new Map([
 ['fast-ledger', '@hyperledger/caliper-fast-ledger'],
 // other connectors...
]);
```
7. It is highly recommended to provide [integration tests](https://github.com/hyperledger-caliper/caliper/tree/v0.6.0/packages/caliper-tests-integration) for your connector.
8. Make sure that every code-related artifact (mostly `.js`, `.yaml` and `.md` files) contains the appropriate license header!
9. And you’re done! Now users can refer to the connector as `fast-ledger` in their network configuration files. The connector package will be published automatically upon every merged PR.

## License

The Caliper codebase is released under the [Apache 2.0 license](../getting-started/license.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at [http://creativecommons.org/licenses/by/4.0/](http://creativecommons.org/licenses/by/4.0/).