---
layout: page
title:  "Benchmark Configuration"
categories: docs
permalink: /vLatest/bench-config/
order: 5
---

## Table of contents
{:.no_toc}

- TOC
{:toc}

## Overview

The `benchmark configuration file` is one of the required configuration files necessary to run a Caliper benchmark. In contrast to the [runtime configurations](./Runtime_Configuration.md), used for tweaking the internal behavior of Caliper, the benchmark configuration pertains only to the execution of the benchmark workload and collection of the results.

> __Note:__ In theory, a benchmark configuration is independent of the system under test (SUT) and the internal configuration of Caliper. However, this independence might be limited by the implementation details of the benchmark workload module, which could target only a single SUT type.

The benchmark configuration consists of three main parts:
1. [Test settings](#benchmark-test-settings)
2. [Observer settings](#observer-settings)
3. [Monitoring settings](#monitoring-settings)

For a complete benchmark configuration example, refer to the [last section](#example).

> __Note:__ The configuration file can be either a YAML or JSON file, conforming to the format described below. The benchmark configuration file path can be specified for the master and worker processes using the `caliper-benchconfig` setting key. 

## Benchmark test settings

The settings related to the benchmark workload all reside under the root `test` attribute, which has some general child attributes, and the important `rounds` attribute.

| Attribute | Description |
|:----------|:------------|
| test.name | Short name of the benchmark to display in the report. |
| test.description | Detailed description of the benchmark to display in the report. |
| test.clients | Object of worker-related configurations. |
| test.clients.type | Currently unused. |
| test.clients.number | Specifies the number of worker processes to use for executing the workload. |
| test.rounds | Array of objects, each describing the settings of a round. |
| test.rounds[i].label | A short name of the rounds, usually corresponding to the types of submitted TXs. |
| test.rounds[i].txNumber | The number of TXs Caliper should submit during the round. |
| test.rounds[i].txDuration | The length of the round in seconds during which Caliper will submit TXs. |
| test.rounds[i].rateControl | The object describing the [rate controller](./Rate_Controllers.md) to use for the round. |
| test.rounds[i].callback | The path to the benchmark [workload module](./Workload_Module.md) that will construct the TXs to submit |
| test.rounds[i].arguments | Arbitrary object that will be passed to the workload module as configuration. |

A benchmark configuration with the above structure will define a benchmark run that consists of multiple rounds. Each round is associated with a [rate controller](./Rate_Controllers.md) that is responsible for the scheduling of TXs, and a [workload module](./Workload_Module.md) that will generate the actual content of the scheduled TXs. 

## Observer settings

The observer configuration determines how the master process gathers progress information from the worker processes. The configuration resides under the `observer` attribute. Refer to the [observer configuration page](./MonitorsAndObservers.md#observers) for the details.

## Monitoring settings

The monitoring configuration determines what kind of metrics the master process can gather and from where. The configuration resides under the `monitor` attribute. Refer to the [monitor configuration page](./MonitorsAndObservers.md#monitors) for the details.

## Example

The example configuration below says the following:
* Perform the benchmark run using 5 worker processes.
* There will be two rounds.
* The first `init` round will submit 500 TXs at a fixed 25 TPS send rate.
* The content of the TXs are determined by the `init.js` workload module.
* The second `query` round will submit TXs for 60 seconds at a fixed 5 TPS send rate.
* The content of the TXs are determined by the `query.js` workload module.
* The master process will observe the progress of the worker processes through a separate Prometheus instance at every 5 seconds.
* The master process should include the predefined metrics of all local Docker containers in the report.
* The master process should include the custom metric `Endorse Time (s)` based on the provided query for every available (peer) instance.

```yaml
test:
  clients:
    type: local
    number: 5
  rounds:
  - label: init
    txNumber: 500
    rateControl:
      type: fixed-rate
      opts:
        tps: 25
    callback: benchmarks/samples/fabric/marbles/init.js
  - label: query
    txDuration: 60
    rateControl:
    - type: fixed-rate
      opts:
        tps: 5
    callback: benchmarks/samples/fabric/marbles/query.js
observer:
  type: prometheus
  interval: 5
monitor:
  interval: 1
  type: ['docker', 'prometheus']
  docker:
    containers: ['all']
  prometheus:
    url: "http://prometheus:9090"
    push_url: "http://pushGateway:9091"
    metrics:
      ignore: [prometheus, pushGateway, cadvisor, grafana, node-exporter]
      include:
        Endorse Time (s):
          query: rate(endorser_propsal_duration_sum{chaincode="marbles:v0"}[5m])/rate(endorser_propsal_duration_count{chaincode="marbles:v0"}[5m])
          step: 1
          label: instance
          statistic: avg
```

## License
The Caliper codebase is released under the [Apache 2.0 license](./LICENSE.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.