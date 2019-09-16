---
layout: pageNext
title:  "Logging Control"
categories: reference
permalink: /vNext/logging/
order: 6
---

Caliper builds on the [winston](https://github.com/winstonjs/winston) logger module to provide a flexible, multi-target logging mechanism. Using the logging functionality can be split into two aspects:

* [Configuring](#configuring-logging-targets) the logging targets
* [Creating](#creating-loggers) loggers at runtime

## Configuring Logging Targets

Setting up logging targets is handled through the configuration mechanism of Caliper. The default logging configuration can be used as a template for specifying customized targets. The default configuration can be found in the `config/default.yaml` file, under the `core:logging` section.

The `logging` section comprises of arbitrary but unique logging target names, each describing a target type, logging level and additional target-specific options. For example: 

```yaml
core:
  logging:
    mytarget1:
      target: console
      level: info
      # target-specific settings
    mytarget2:
      target: file
      level: error
      # target-specific settings
    mytarget3:
      target: daily-rotate-file
      level: debug
      # target-specific settings
```

The `target` and `level` attributes are mandatory for each target specification, and determine the logging target type and severity filter, respectively.

The level attribute can take the `debug`, `info`, `warning` and `error` values. This order matches the severity order of the levels, from least to most severe. If a log message has a lower severity that the `level` specified for that target, then the message is discarded (however, other targets could still log it, since the level is specified on a per-target basis).

The `target` attribute currently can take one of the following values, each type described in its own subsection:
* [console](#console-target-settings) ([original documentation](https://github.com/winstonjs/winston/blob/master/docs/transports.md#console-transport))
* [file](#file-target-settings) ([original documentation](https://github.com/winstonjs/winston/blob/master/docs/transports.md#file-transport))
* [daily-rotate-file](#daily-rotating-file-target-settings) ([original documentation](https://github.com/winstonjs/winston-daily-rotate-file#options))

### Console Target Settings

The `console` target outputs the log messages to `stdout`, i.e., displays them in the terminal. This target provides no additional customization options.

The following is an example console target configuration:
```yaml
core:
  logging:
    consolelogger:
      target: console
      level: info
```

### File Target Settings

The `file` target outputs/appends the log messages to a specified log file, that is optionally split into multiple files if configured. The following additional attributes can be set for this transport:
* `filename` _String._ The path to the log file. Defaults to `log/caliper.log`.
* `maxsize`: _Number._ Max size in bytes of the logfile. If set and the size is exceeded then a new file is created and a counter will become a suffix of the log file.
* `maxFiles`: _Number._ Limits the number of files created when the size of the logfile is exceeded.
* `tailable`: _Boolean._ If `true`, log files will be rolled based on `maxsize` and `maxFiles`, but in ascending order. The `filename` will always have the most recent log lines. The larger the appended number, the older the log file. This option requires `maxFiles` to be set, or it will be ignored.
* `zippedArchive`: _Boolean._ If `true`, all log files but the current one will be zipped.

The following is an example file target configuration:
```yaml
core:
  logging:
    filelogger:
      target: file
      level: error
      filename: log/caliper.log
      maxSize: 5242880
      zippedArchive: true
```

### Daily Rotating File Target Settings

The `daily-rotate-file` target outputs/appends the log messages to a specified log file, that is rotated among multiple files based on the specified settings. The following additional attributes can be set for this transport:
* `filename` _String._ The path to the log file. The path can include the `%DATE%` placeholder which will include the formatted `datePattern` at that point in the filename. Defaults to `log/caliper-%DATE%.log`.
* `frequency`: _String._ A string representing the frequency of rotation. This is useful if you want to have timed rotations, as opposed to rotations that happen at specific moments in time. Valid values are `#m` or `#h` (e.g., `5m` or `3h`). Leaving this null relies on `datePattern` for the rotation times.
* `datePattern`: _String._ A string representing the [moment.js date format](http://momentjs.com/docs/#/displaying/format/) to be used for rotating. The meta characters used in this string will dictate the frequency of the file rotation. For example, if your `datePattern` is simply `HH` you will end up with 24 log files that are picked up and appended to every day. Defaults to `YYYY-MM-DD-HH`.
* `maxSize`: _Number or String._ Maximum size of the file after which it will rotate. This can be a number of bytes, or units of kb, mb, and gb. If using the units, add `k`, `m`, or `g` as the suffix. The units need to directly follow the number.
* `maxFiles`: _Number or String._ Maximum number of logs to keep. If not set, no logs will be removed. This can be a number of files or number of days. If using days, add `d` as the suffix.
* `zippedArchive`: _Boolean._ If `true`, all log files but the current one will be zipped.

The following is an example, hourly rotating file target configuration:
```yaml
core:
  logging:
    rotatingfilelogger:
      target: daily-rotate-file
      level: debug
      filename: log/caliper-%DATE%.log
      datePattern: YYYY-MM-DD-HH
      maxSize: 5m
      zippedArchive: true
```

## Creating Loggers

The different modules of Caliper will automatically use the configured targets for logging. Moreover, your user test modules can also create logger instances to log runtime events related to your business logic.

To create your own logger instance, use the following API:

```js
const CaliperUtils = require('caliper-core').CaliperUtils;
const commlogger = CaliperUtils.getLogger('my-module');

// ...

mylogger.debug('My custom debug message');
```

Once a logger instance is created, it exposes the usual `info`, `warn`, `debug` and `error` functions that each take one or more strings (log messages) as arguments. It is good practice to use a separate logger instance for each JS file to being able to locate the origin of messages easily.