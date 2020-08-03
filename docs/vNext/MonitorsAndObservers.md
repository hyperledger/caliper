---
layout: vNext
title:  "Monitors and Observers"
categories: reference
permalink: /vNext/caliper-monitors/
order: 5
---

## Table of Contents

* [Overview](#overview)
* [Resource](#resource)
  * [Process monitor](#process-monitor)
  * [Docker monitor](#docker-monitor)
  * [Prometheus monitor](#prometheus-monitor)
* [Transaction](#transaction)
  * [Logging](#logging)
  * [Prometheus](#prometheus)
* [Resource Charting](#resource-charting)
  * [Process charting](#process-charting)
  * [Docker charting](#docker-charting)
  * [Prometheus charting](#prometheus-charting)


## Overview
Caliper monitoring modules are used to collect resource utilization and transaction statistics during test execution, with the output being collated into the generated reports. Caliper monitors resources and transactions using:
- Resource monitors. Collect statistics on resource utilization during benchmarking, with monitoring reset between test rounds.
- Transaction monitors. Collect worker transaction statistics and provide conditional dispatch actions.

## Resource
The type of resource monitor to be used within a Caliper benchmark is declared in the `benchmark configuration file` through the specification one or more monitoring modules in an array under the label `monitors.resource`. 

Permitted monitors are:
- **Process:** The `process` monitor enables monitoring of a named process on the host machine, and is most typically used to monitor the resources consumed by the running clients. This monitor will retrieve statistics on: [memory(max), memory(avg), CPU(max), CPU(avg), Network I/O, Disc I/O]
- **Docker:** The `docker` monitor enables monitoring of specified Docker containers on the host or a remote machine, through using the Docker Remote API to retrieve container statistics. This monitor will retrieve statistics on: [memory(max), memory(avg), CPU(max), CPU(avg), Network I/O, Disc I/O]
- **Prometheus:** The `prometheus` monitor enables the retrieval of data from Prometheus. This monitor will only report based on explicit user provided queries that are issued to Prometheus. If defined, the provision of a Prometheus server will cause Caliper to default to using the Prometheus PushGateway.

Each declared resource monitoring module is accompanied with options required to configure each of the named monitors. A common option for all modules is `interval`, which is used to configure the refresh interval at which point resource utilization is measured by the monitor.

### Process Monitor
The process monitoring module options comprise:
- interval: monitor update interval
- processes: of an array of `[command, arguments, multiOutput]` key:value pairs. 
    - command: names the parent process to monitor
    - arguments: filters on the parent process being monitored
    - multiOutput: enables handling of the discovery of multiple processes and may be one of:
    - avg: take the average of process values discovered under `command/name`
    - sum: sum all process values discovered under `command/name`

The following declares the monitoring of all local `node` processes that match `caliper.js`, with a 3 second update frequency, and the average of all discovered processes being taken.
```
monitors:
  resource:
  - module: process
    options:
      interval: 3
      processes: [{ command: 'node', arguments: 'caliper.js', multiOutput: 'avg' }]
```
### Docker Monitor
The docker monitoring module options comprise:
 - interval: monitor update interval
 - containers: an array of container names that may relate to local or remote docker containers to be monitored. If all **local** docker containers are to be monitored, this may be achieved by providing `all` as a name

The following declares the monitoring of two named docker containers; one local and the other remote, with a 5second update frequency:
```
monitors:
  resource:
  - module: docker
    options:
      interval: 5
      containers:
      - peer0.org1.example.com
      - http://192.168.1.100:2375/orderer.example.com
```

The following declares the monitoring of all local docker containers, with a 5second update frequency:
```
monitors:
  resource:
  - module: docker
    options:
      interval: 5 
      containers:
      - all
```

### Prometheus Monitor
[Prometheus](https://prometheus.io/docs/introduction/overview/) is an open-source systems monitoring and alerting toolkit that scrapes metrics from instrumented jobs, either directly or via an intermediary push gateway for short-lived jobs. It stores all scraped samples locally and runs rules over this data to either aggregate and record new time series from existing data or generate alerts. [Grafana](https://grafana.com/) or other API consumers can be used to visualize the collected data.

All data stored on Prometheus may be queried by Caliper using the Prometheus query [HTTP API](https://prometheus.io/docs/prometheus/latest/querying/api/). At a minimum this may be used to perform aggregate queries in order to report back the transaction statistics, though it is also possible to perform custom queries in order to report back information that has been scraped from other connected sources. Queries issued are intended to generate reports and so are expected to result in either a single value, or a vector that can be condensed into a single value through the application of a statistical routine. It is advisable to create required queries using Grafana to ensure correct operation before transferring the query into the monitor. Please see [Prometheus](https://prometheus.io) and [Grafana](https://grafana.com/grafana) documentation for more information.

#### Configuring The Prometheus Monitor
The prometheus monitoring module options comprise:
- interval: monitor update interval
- url: The Prometheus URL, used for direct queries
- metrics: The queries to be run for inclusion within the Caliper report, comprised of to keys: `ignore` and `include`. 
  - `ignore` a string array that is used as a blacklist for report results. Any results where the component label matches an item in the list, will *not* be included in a generated report.
  - `include` a series of blocks that describe the queries that are to be run at the end of each Caliper test.

The `include` block is defined by:
- query: the query to be issued to the Prometheus server at the end of each test. Note that Caliper will add time bounding for the query so that only results pertaining to the test round are included.
- step: the timing step size to use within the range query
- label: a string to match on the returned query and used when populating the report
- statistic: if multiple values are returned, for instance if looking at a specific resource over a time range, the statistic will condense the values to a single result to enable reporting. Permitted options are:
  - avg: return the average from all values
  - max: return the maximum from all values
  - min: return the minimum from all values
  - sum: return the summation of all values
- multiplier: An optional multiplier that may be used to convert exported metrics into a more convenient value (such as converting bytes to GB)

The following declares a Prometheus monitor that will run two bespoke queries between each test within the benchmark
```
monitors:
    resource:
    - module: prometheus
      options:
        interval: 5
        url: "http://localhost:9090"
        metrics:
            ignore: [prometheus, pushGateway, cadvisor, grafana, node-exporter]
            include:
                Endorse Time (s):
                    query: rate(endorser_propsal_duration_sum{chaincode="marbles:v0"}[1m])/rate(endorser_propsal_duration_count{chaincode="marbles:v0"}[1m])
                    step: 1
                    label: instance
                    statistic: avg
                Max Memory (MB):
                    query: sum(container_memory_rss{name=~".+"}) by (name)
                    step: 10
                    label: name
                    statistic: max
                    multiplier: 0.000001
```
The two queries above will be listed in the generated report as "Endorse Time (s)" and "Max Memory (MB)" respectively:
 - **Endorse Time (s):** Runs the listed query with a step size of 1; filters on return tags using the `instance` label; exclude the result if the instance value matches any of the string values provided in the `ignore` array; if the instance does not match an exclude option, then determine the average of all return results and return this value to be reported under "Endorse Time (s)".
 - **Max Memory (MB):** Runs the listed query with a step size of 10; filter return tags using the `name` label; exclude the result if the instance value matches any of the string values provided in the `ignore` array; if the instance does not match an exclude option, then determine the maximum of all return results; multiply by the provided multiplier and return this value to be reported under "Max Memory (MB)".


#### Obtaining a Prometheus Enabled Network
A sample network that includes a docker-compose file for standing up a Prometheus server, a Prometheus PushGateway and a linked Grafana analytics container, is available within the companion [caliper-benchmarks repository](https://github.com/hyperledger/caliper-benchmarks/tree/master/networks/prometheus-grafana).

## Transaction
Transaction monitors are used by Caliper workers to act on the completion of transactions. They are used internally to aggregate and dispatch transaction statistics to the manager process to enable transaction statistics aggregation for progress reporting via the default observer, and report generation. 

The default observer, used for progress reporting by consuming information from the internal transaction monitor, may be updated through configuration file settings:
- `caliper-progress-reporting-enabled`: boolean flag to enable progress reporting, default true
- `caliper-progress-reporting-interval`: numeric value to set the update frequency, in milliseconds (default 5000)

Additional transaction monitoring modules include:
 - logging
 - prometheus-push

One or more transaction modules may be specified by naming them as modules with an accompanying options block in an array format under `monitors.transaction`.

### Logging
The `logging` transaction module is used to log aggregated transaction statistics at the completion of a test round, within the worker. The following specifies the use of a `logging` transaction observer. No options are required by the module.

```
monitors:
    transaction:
    - module: logging
```

### Prometheus
The `prometheus-push` transaction module is used to dispatch current transaction submissions of all clients to a Prometheus server, via a push gateway. The following specifies the use of a `prometheus-push` transaction module that sends current transaction statistics to a push gateway located at `http://localhost:9091` at 5 second intervals.

```
monitors:
    transaction:
    - module: prometheus-push
      options:
        interval: 5
        push_url: "http://localhost:9091"
```

Use of a `prometheus-push` transaction module is predicated on the availability and use of a Prometheus monitor. 

### Grafana Visualization
Grafana is an analytics platform that may be used to query and visualize metrics collected by Prometheus. Caliper clients will send the following to the PushGateway:
 - caliper_tps
 - caliper_latency
 - caliper_send_rate
 - caliper_txn_submitted
 - caliper_txn_success
 - caliper_txn_failure
 - caliper_txn_pending

 Each of the above are sent to the PushGateway, tagged with the following labels: 
  - instance: the current test label
  - round: the current test round
  - client: the client identifier that is sending the information

 We are currently working on a Grafana dashboard to give you immediate access to the metrics published above, but in the interim please feel free to create custom queries to view the above metrics that are accessible in real time.

## Resource Charting
The data from each monitor is capable of being output in chart form within the generated Caliper report, via an option within the benchmark configuration file for each monitor. In addition to tabulated data for resource monitors, Caliper currently supports rendering of the following charts using `charting.js`:
 - horizontal bar
 - polar area

Charting is an option that is available for each resource monitor, and the specification of the charting to be produced is specified under each monitor type within the benchmark configuration file, under a `charting` block. It is possible to specify multiple charting options for a single resource monitor.

A chart will contain data for all items that are being tracked by the monitor; it is only possible to filter on the metrics that are to be charted. The following declares the charting block that is valid for the listed monitors:
```
charting:
  bar:
  - metrics: [all | <sting list>]
  polar:
  - metrics: [all | <sting list>]
```

If the `all` option is specified, then a chart will be output for each metric and include all monitored items within each chart. It is possible to filter on metrics by providing a comma separated list. The provided list is matched against metrics using a string comparison, and so it is only required to provide the initial part of the required match. The following declares a charting block that specifies a bar chart for all available metrics, and a polar chart for only metric0 and metric1:
```
charting:
  bar:
  - metrics: [all]
  polar:
  - metrics: [metric0, metric1]
```
### Process Charting
The process resource monitor exposes the following metrics: Memory(max), Memory(avg), CPU%(max), CPU%(avg).

The following declares the monitoring of any running processes named `caliper.js`, with charting options specified to produce bar charts for `all` available metrics. Charts will be produced containing data from all monitored processes:
```
monitors:
  resource:
  - module: process
    options:
      interval: 3
      processes: [{ command: 'node', arguments: 'caliper.js', multiOutput: 'avg' }]
    charting:
      bar:
        metrics: [all]
```
### Docker Charting
The docker resource monitor exposes the following metrics: Memory(max), Memory(avg), CPU%(max), CPU%(avg), Traffic In, Traffic Out, Disc Read, Disc Write.

The following declares the monitoring of all local docker containers, with charting options specified to produce bar charts for `Memory(avg)` and `CPU%(avg)`, and polar charts for `all` metrics. Charts will be produced containing data from all monitored containers:
```
monitors:
  resource:
  - module: docker
    options:
      interval: 5 
      containers:
      - all
    charting:
      bar:
        metrics: [Memory(avg), CPU%(avg)]
      polar:
        metrics: [all]
```

### Prometheus Charting
The Prometheus monitor enables user definition of all metrics within the configuration file. 

The following declares the monitoring of two user defined metrics `Endorse Time(s)` and `Max Memory(MB)`. Charting options are specified to produce polar charts filtered on the metric `Max Memory (MB)`, and bar charts of all user defined metrics.
```
monitors:
    resource:
    - module: prometheus
      options:
        interval: 5
        url: "http://localhost:9090"
        metrics:
            ignore: [prometheus, pushGateway, cadvisor, grafana, node-exporter]
            include:
                Endorse Time (s):
                    query: rate(endorser_propsal_duration_sum{chaincode="marbles:v0"}[1m])/rate(endorser_propsal_duration_count{chaincode="marbles:v0"}[1m])
                    step: 1
                    label: instance
                    statistic: avg
                Max Memory (MB):
                    query: sum(container_memory_rss{name=~".+"}) by (name)
                    step: 10
                    label: name
                    statistic: max
                    multiplier: 0.000001
      charting:
        polar:
          metrics: [Max Memory (MB)]
        bar:
          metrics: [all]
```

## License
The Caliper codebase is released under the [Apache 2.0 license](./LICENSE.md). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at http://creativecommons.org/licenses/by/4.0/.
