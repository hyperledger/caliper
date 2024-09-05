## Overview

Caliper monitoring modules are used to collect resource utilization and transaction statistics during test execution, with the output being collated into the generated reports. Caliper monitors resources and transactions using:

- Resource monitors. Collect statistics on resource utilization during benchmarking, with monitoring reset between test rounds.
- Transaction monitors. Collect worker transaction statistics and provide conditional dispatch actions.

## Resource

The type of resource monitor to be used within a Caliper benchmark is declared in the `benchmark configuration file` through the specification one or more monitoring modules in an array under the label `monitors.resource`.

Permitted monitors are:

- **Process**: The `process` monitor enables monitoring of a named process on the host machine, and is most typically used to monitor the resources consumed by the running clients. This monitor will retrieve statistics on: [memory(max), memory(avg), CPU(max), CPU(avg), Network I/O, Disc I/O]
- **Docker**: The `docker` monitor enables monitoring of specified Docker containers on the host or a remote machine, through using the Docker Remote API to retrieve container statistics. This monitor will retrieve statistics on: [memory(max), memory(avg), CPU(max), CPU(avg), Network I/O, Disc I/O]
- **Prometheus**: The `prometheus` monitor enables the retrieval of data from Prometheus. This monitor will only report based on explicit user provided queries that are issued to Prometheus. If defined, the provision of a Prometheus server will cause Caliper to default to using the Prometheus PushGateway.

Each declared resource monitoring module is accompanied with options required to configure each of the named monitors. A common option for some modules is `interval`, which is used to configure the refresh interval at which point resource utilization is measured by the monitor.

### Process Monitor

The process monitoring module options comprise:

- interval: monitor update interval in seconds
- processes: of an array of `[command, arguments, multiOutput]` key:value pairs.
    - command: names the parent process to monitor
    - arguments: filters on the parent process being monitored
    - multiOutput: enables handling of the discovery of multiple processes and may be one of:
    - avg: take the average of process values discovered under `command/name`
    - sum: sum all process values discovered under `command/name`

The following declares the monitoring of all local `node` processes that match `caliper.js`, with a 3 second update frequency, and the average of all discovered processes being taken.

```sh
monitors:
  resource:
  - module: process
    options:
      interval: 3
      processes: [{ command: 'node', arguments: 'caliper.js', multiOutput: 'avg' }]
```      

### Docker Monitor

The docker monitoring module options comprise:

- interval: monitor update interval in seconds
- cpuUsageNormalization: an optional boolean that may be used to convert the cpu usage in a more covenient value (scaled to 100) by normalising for the number of cores of the host machine, default is set to false
- containers: an array of container names that may relate to local or remote docker containers to be monitored. If all **local** docker containers are to be monitored, this may be achieved by providing `all` as a name

The following declares the monitoring of two named docker containers; one local and the other remote, with a 5 second update frequency:

```sh
monitors:
  resource:
  - module: docker
    options:
      interval: 5
      containers:
      - peer0.org1.example.com
      - http://192.168.1.100:2375/orderer.example.com
```

The following declares the monitoring of all local docker containers, with a 5 second update frequency and normalization of the cpuUsage metric set to true.

```sh
monitors:
  resource:
  - module: docker
    options:
      interval: 5
      cpuUsageNormalization: true
      containers:
      - all
```      

### Prometheus Monitor

[Prometheus](https://prometheus.io/docs/introduction/overview/) is an open-source systems monitoring and alerting toolkit that scrapes metrics from instrumented jobs, either directly or via an intermediary push gateway for short-lived jobs. It stores all scraped samples locally and runs rules over this data to either aggregate and record new time series from existing data or generate alerts. [Grafana](https://grafana.com/) or other API consumers can be used to visualize the collected data.

All data stored on Prometheus may be queried by Caliper using the Prometheus query [HTTP API](https://prometheus.io/docs/prometheus/latest/querying/api/). At a minimum this may be used to perform aggregate queries in order to report back the transaction statistics, though it is also possible to perform custom queries in order to report back information that has been scraped from other connected sources. Queries issued are intended to generate reports and so are expected to result in either a single value, or a vector that can be condensed into a single value through the application of a statistical routine. It is advisable to create required queries using Grafana to ensure correct operation before transferring the query into the monitor. Please see [Prometheus](https://prometheus.io/docs/introduction/overview/) and [Grafana](https://grafana.com/) documentation for more information.

#### Configuring The Prometheus Monitor

The prometheus monitoring module options comprise:

- url: The Prometheus URL, used for direct queries
- metrics: The queries to be run for inclusion within the Caliper report, comprised of to keys: include and queries.
    - `include` a string array that is used to determine metric inclusion through javascript regex. Any query results where the label of interest, as specified in the queries block, matches an item within the include list via regex, will be included in a generated report.
    - `queries` a series of blocks that describe the queries that are to be run at the end of each Caliper test.

The `queries` block is defined by:

- name: the metric name that the query relates to, used when building the report
- query: the query to be issued to the Prometheus server at the end of each test. Note that Caliper will add time bounding for the query so that only results pertaining to the test round are included.
- step: the timing step size to use within the range query
- label: a string to match on the returned query and used as a component identifier when populating the report
- statistic: if multiple values are returned, for instance if looking at a specific resource over a time range, the statistic will condense the values to a single result to enable reporting. Permitted options are:
    - avg: return the average from all values
    - max: return the maximum from all values
    - min: return the minimum from all values
    - sum: return the summation of all values
    - multiplier: An optional multiplier that may be used to convert exported metrics into a more convenient value (such as converting bytes to GB)

The following declares a Prometheus monitor that will run two bespoke queries between each test within the benchmark

```sh
monitors:
    resource:
    - module: prometheus
      options:
        url: "http://localhost:9090"
        metrics:
            include: [dev-.*, couch, peer, orderer]
            queries:
                - name: Endorse Time (s)
                  query: rate(endorser_propsal_duration_sum{chaincode="marbles:v0"}[1m])/rate(endorser_propsal_duration_count{chaincode="marbles:v0"}[1m])
                  step: 1
                  label: instance
                  statistic: avg
                - name: Max Memory (MB)
                  query: sum(container_memory_rss{name=~".+"}) by (name)
                  step: 10
                  label: name
                  statistic: max
                  multiplier: 0.000001
```                  
The two queries above will be listed in the generated report as “Endorse Time (s)” and “Max Memory (MB)” respectively:

- *Endorse Time (s)*: Runs the listed query with a step size of 1; filters on return tags within the Prometheus query response using the `instance` label; exclude the result if the instance value does not regex match any of the string values provided in the `include` array; if the instance does match an include option, then determine the average of all return results and return this value to be reported under “Endorse Time (s)”.
- *Max Memory (MB)*: Runs the listed query with a step size of 10; filter return tags within the Prometheus query response using the `name` label; exclude the result if the instance value does not regex match any of the string values provided in the `include` array; if the instance does match an include option, then determine the maximum of all return results; multiply by the provided multiplier and return this value to be reported under “Max Memory (MB)”.

Returned components with labels that pass a regex test against the `include` array items, will be included within the report; all others will be omitted.

#### Basic Auth

It is possible to use a Prometheus Server that is secured via basic authentication through provision of a username and password as runtime parameters, under the flags:

- caliper-auth-prometheus-username
- caliper-auth-prometheus-password

These will be used to augment the configuration file based URL prior to making a connection.

## Transaction

Transaction monitors are used by Caliper workers to act on the completion of transactions. They are used internally to aggregate and dispatch transaction statistics to the manager process to enable transaction statistics aggregation for progress reporting via the default transaction monitor, and report generation.

The default transaction monitor, used for progress reporting by consuming information from the internal transaction monitor, may be updated through configuration file settings:

- `caliper-progress-reporting-enabled`: boolean flag to enable progress reporting, default true
- `caliper-progress-reporting-interval`: numeric value to set the update frequency, in milliseconds (default 5000)
Additional transaction monitoring modules include:

- logging
- prometheus-push

One or more transaction modules may be specified by naming them as modules with an accompanying options block in an array format under `monitors.transaction`.

### Logging

The `logging` transaction module is used to log aggregated transaction statistics at the completion of a test round, within the worker. The following specifies the use of a `logging` transaction monitor. No options are required by the module.

```sh
monitors:
    transaction:
    - module: logging
```

### Prometheus

The `prometheus` transaction module is used to expose current transaction statistics of all workers to a Prometheus server, via a scrape mechanism. The module exposes the following metrics:

- caliper_tx_submitted (counter)
- caliper_tx_finished (counter)
- caliper_tx_e2e_latency (histogram)

The following specifies the use of a `prometheus` transaction module that exposes metrics for collection on the default port (3000) and the default scrape URL (`/metrics`).

```sh
monitors:
    transaction:
    - module: prometheus
```

If operating with process based workers, each worker will increment the default (or overridden) port with their 0 based index, thereby exposing metrics for each worker on different ports.

It is the responsibility of the user to configure a Prometheus server that correctly targets the exposed URLS through a correctly specified [configuration file](https://prometheus.io/docs/prometheus/latest/configuration/configuration/).

Options comprise:

- metricPath: override for the metrics path to be scraped (default /metrics).
- scrapePort: override for the port to be used when configuring the scrape sever (default 3000).
- processMetricCollectInterval: time interval for default metrics collection, enabled when present
- defaultLabels: object of key:value pairs to augment the default labels applied to the exposed metrics during collection.
- histogramBuckets: override for the histogram to be used for collection of caliper_tx_e2e_latency
    - explicit: direct pass through of user defined bucket
    - linear: use a linear bucket with user defined start, width and count parameters
        - start: start bucket size
        - width: bucket width
        - count: number of buckets to create
    - exponential
        - start: start bucket size
        -   factor: bucket factor
        - count: number of buckets to create

### Prometheus Push Gateway

The `prometheus-push` transaction module is used to expose current transaction statistics of all workers to a Prometheus server, via a push gateway. The module exposes the following metrics:

- caliper_tx_submitted (counter)
- caliper_tx_finished (counter)
- caliper_tx_e2e_latency (histogram)

The following specifies the use of a `prometheus-push` transaction module that sends current transaction statistics to a push gateway located at `http://localhost:9091` at 5 second intervals.

```sh
monitors:
    transaction:
    - module: prometheus-push
      options:
        pushInterval: 5000
        pushUrl: "http://localhost:9091"
```

Options comprise:

- pushInterval: push interval in milliseconds
- pushUrl: URL for Prometheus Push Gateway
- processMetricCollectInterval: time interval for default metrics collection, enabled when present
- defaultLabels: object of key:value pairs to augment the default labels applied to the exposed metrics during collection.
- histogramBuckets: override for the histogram to be used for collection of caliper_tx_e2e_latency
    - explicit: direct pass through of user defined bucket
    - linear: use a linear bucket with user defined start, width and count parameters
        - start: start bucket size
        - width: bucket width
        - count: number of buckets to create
    - exponential
        - start: start bucket size
        - factor: bucket factor
        - count: number of buckets to create

Use of a `prometheus-push` transaction module is predicated on the availability and use of a Prometheus Push Gateway that is available as a scrape target to Prometheus.

#### Basic Auth

It is possible to use a Prometheus Push Gateway that is secured via basic authentication through provision of a username and password as runtime parameters, under the flags:

- caliper-auth-prometheuspush-username
- caliper-auth-prometheuspush-password

These will be used to augment the configuration file based URL prior to making a connection.

### Grafana Visualization

Grafana is an analytics platform that may be used to query and visualize metrics collected by Prometheus. Caliper clients make the following metrics available, either via a direct scrape or indirectly via a Prometheus Push Gateway:

- caliper_tx_submitted (counter)
- caliper_tx_finished (counter)
- caliper_tx_e2e_latency (histogram)

Each of the above are tagged with the following default labels:

- roundLabel: the current test round label
- roundIndex: the current test round index
- workerIndex: the zero based worker index that is sending the information

We are currently working on a Grafana dashboard to give you immediate access to the metrics published above, but in the interim please feel free to create custom queries to view the above metrics that are accessible in real time.

## Resource Charting

The data from each monitor is capable of being output in chart form within the generated Caliper report, via an option within the benchmark configuration file for each monitor. In addition to tabulated data for resource monitors, Caliper currently supports rendering of the following charts using `charting.js`:

- horizontal bar
- polar area

Charting is an option that is available for each resource monitor, and the specification of the charting to be produced is specified under each monitor type within the benchmark configuration file, under a charting block. It is possible to specify multiple charting options for a single resource monitor.

A chart will contain data for all items that are being tracked by the monitor; it is only possible to filter on the metrics that are to be charted. The following declares the `charting` block that is valid for the listed monitors:

```sh
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

he process resource monitor exposes the following metrics: Memory(max), Memory(avg), CPU%(max), CPU%(avg).

The following declares the monitoring of any running processes named caliper.js, with charting options specified to produce bar charts for all available metrics. Charts will be produced containing data from all monitored processes:

```sh
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

The following declares the monitoring of all local docker containers, with charting options specified to produce bar charts for `Memory(avg)` and `CPU%(avg)`, and polar charts for all metrics. Charts will be produced containing data from all monitored containers:

```sh
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

```sh
monitors:
    resource:
    - module: prometheus
      options:
        url: "http://localhost:9090"
        metrics:
            include: [dev.*, couch, peer, orderer]
            queries:
                - name: Endorse Time (s)
                  query: rate(endorser_propsal_duration_sum{chaincode="marbles:v0"}[1m])/rate(endorser_propsal_duration_count{chaincode="marbles:v0"}[1m])
                  step: 1
                  label: instance
                  statistic: avg
                - name: Max Memory (MB)
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

The Caliper codebase is released under the [Apache 2.0 license](https://hyperledger.github.io/caliper/v0.6.0/general/license/). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at [http://creativecommons.org/licenses/by/4.0/](http://creativecommons.org/licenses/by/4.0/).