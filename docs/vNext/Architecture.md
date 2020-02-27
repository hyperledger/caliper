---
layout: pageNext
title:  "Architecture"
categories: docs
permalink: /vNext/architecture/
order: 4
---

Hyperledger Caliper can be abstracted into two components:

**Caliper Core**: The Core packages implement core functions for the running of a benchmark, including: 
* *Caliper CLI:* A CLI package is also provided for convenience running of a benchmark
* *Client load genration:* Clients interact via adaptors to drive a benchmark load, determined by a rate control mechanism.
* *Resource Monitoring:* contains operations to start/stop a monitor and fetch resource consumption status of backend blockchain system, including CPU, memory, network IO, etc.
* *Performance Analysis:* contains operations to read predefined performance statistics (including TPS, delay, success ratio, etc) and print benchmark results. Key metrics are recorded while invoking blockchain NBIs and are are used later to generate the statistics.
* *Report Generation:* contains operations to generate a HTML format testing report

**Caliper Adaptors**: Adaptors are used to integrate existing blockchain system into Caliper framework. Each adaptor implements the 'Caliper Blockchain Interface' by using corresponding blockchain's native SDK or RESTful API to map operations such as deploying smart contracts on backend blockchain, invoking contracts, querying states from the ledger etc.

<img src="{{ site.baseurl }}/assets/img/architecture.png" alt="architecture">

## Benchmark Engine

<img src="{{ site.baseurl }}/assets/img/test-framework.png" alt="Benchmark Engine">

### Benchmark Configuration File

For the structure and documentation of the benchmark configuration file, refer to its [documentation page](./BenchmarkConfiguration.md).

### Master

The master implements a default test flow which contains three stages:

* Preparing stage: In this stage, the master creates and initializes an internal blockchain object with the blockchain configuration file, deploys smart contracts as specified in the configuration and starts a monitor object to monitor the resource consumption of backend blockchain system.

* Testing stage: In this stage, the master starts a loop to perform tests according to the benchmark configuration file. Tasks will be generated and assigned to clients according to the defined workload. Performance statistics return by clients will be stored for later analyzing.

* Reporting stage: Statistics from all clients of each test round are analyzed, and a HTML format report will be generated automatically.
  
  The default directory path for the generated report is the workspace directory, and the file is named `report.html`. You can override this setting the following ways:
  * From the command line: `--caliper-report-path subdir/customName.html`
  * From an environment variable: `export CALIPER_REPORT_PATH=subdir/customName.html`
  * Using a [configuration file](./Runtime_Configuration.md) to override the `caliper.report.path` property.
  
  > __Note:__ It is the user's responsibility to ensure that the directory hierarchy exists between the workspace and the report file.
  
  A report example is as below:


<img src="{{ site.baseurl }}/assets/img/report.png" alt="report example">

### Clients

#### Local Clients

In this mode, the master uses Node.js cluster module to fork multiple local clients (child processes) to do the actual testing work. As Node.js is single-threaded by nature, local cluster could be useful to improve clients' performance on multi-core machine.

The total workload are divided and assigned equally to child processes. A child process acts as a blockchain client with a temporarily generated context to interact with the backend blockchain system. The context usually contains the client's identity and cryptographic materials, and will be released when the testing task is finished.

* For Hyperledger Fabric, the context is also bound to a specific channel, the relationship is defined in fabric configuration file.

The client invokes a test module which implements user defined testing logic.The module is explained later.

A local client will only be launched once at beginning of the first test round, and be destroyed after finishing all the tests.

### User Defined Test Module

A test module implements functions that actually generate and submit transactions. By this way, developers can implement their own testing logic and integrate it with the benchmark engine.  

Three functions should be implemented and exported, all those functions should return a Promise object.

* `init` - Will be called by a client at beginning of each test round with a given blockchain object and context, as well as user defined arguments read from the benchmark configuration file. The blockchain object and context should be saved for later use, and other initialization work could be implemented in here.
* `run` - The actual transactions should be generated and submitted in here using Caliper's blockchain APIs. The client will call this function repeatedly according to the workload. It is recommended that only one transaction is submitted in each call, but this is not a MUST requirement. If multiple transactions are submitted each time, the actual workload may be different with the configured workload. The function should be ran in asynchronous way.
* `end` - Will be called at the end of each test round, any clearing work should be implemented here.
