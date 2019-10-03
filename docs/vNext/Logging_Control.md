---
layout: pageNext
title:  "Logging Control"
categories: reference
permalink: /vNext/logging/
order: 6
---

## Table of contents
{:.no_toc}

- TOC
{:toc}

## Overview

Caliper builds on the [winston](https://github.com/winstonjs/winston) logger module to provide a flexible, multi-target logging mechanism. There are three different aspects when it comes to interacting with the Caliper logging subsystem:

1. Customizing the logging style
2. Configuring logging targets
3. Creating your own loggers

The first two points can be achieved through the [runtime configuration mechanism](./Runtime_Configuration.md) of Caliper. So make sure that you are familiar with the different way of overriding runtime settings before reading on.

The runtime configuration settings corresponding to logging reside under the `caliper-logging` key hierarchy. See the `caliper.logging` section of the [default configuration file](https://github.com/hyperledger/caliper/blob/master/packages/caliper-core/lib/config/default.yaml) bundled with Caliper for the general structure of the settings.

## Customizing the logging style

The two main aspects of the logging style are the message structure and the different formats that modify the message appearance if applied. The corresponding attributes are the `caliper.logging.template` property and the entire `caliper.logging.formats` property hierarchy, respectively.

These properties are special in a sense that their values can be overridden one-by-one, even from the command line or from environment variables. As you will see later, this is not the case for the logging target settings.

> __Note:__ the following style settings apply to every specified logging target!

### Setting the message structure  

The message structure can be easily customized through the `caliper.logging.template` property. It is a simple string that contains predefined placeholders for some special values. Some placeholders are only available, when a corresponding format is also applied.

Let's start with examining the default structure:

```yaml
caliper:
  logging:
    template: '%time% %level% [%label%] [%module%] %message% %meta%'
```

The following placeholders are available at the moment.

| Placeholder | Required format | Description                                                                       |
|:-----------:|:---------------:|:----------------------------------------------------------------------------------|
| `%time%`    | _timestamp_     | Will be replaced with the timestamp of the log message.                           |
| `%level%`   | -               | Will be replaced the severity level (e.g., info, warn, error) of the log message. |
| `%label%`   | _label_         | Will be replaced with the configured label of the process.                        |
| `%module%`  | -               | Will be replaced with the module name that logged the message.                    |
| `%message%` | -               | Will be replaced with the actual message.                                         |
| `%meta%`    | -               | Will be replaced with the one-line JSON string of additional logging arguments.   |

You can override this template (i.e., the `caliper-logging-template` setting key) from multiple sources.

* From the command line: `--caliper-logging-template="%time%: %message%"`
* From an environment variable: `export CALIPER_LOGGING_TEMPLATE="%time%: %message%"`
  > __Note:__ do not forget the two enclosing `". . ."`, since the template can contain spaces!
* From a [configuration file](./Runtime_Configuration.md#configuration-files) with the following content:
  ```yaml
  caliper:
    logging:
      template: '%time%: %message%'
  ```

### Applying formats

The logging subsystem relies on winston's [logform](https://github.com/winstonjs/logform) library to apply additional formatting to the messages. The corresponding settings are under the `caliper.logging.formats` property.

Each of these formats can be easily disabled by setting its property to `false`. For example, to disable the `colorize` format, set its corresponding `caliper.logging.formats.colorize` property to false, from any of the following sources.

* From the command line: `--caliper-logging-formats-colorize=false`
* From an environment variable: `export CALIPER_LOGGING_FORMATS_COLORIZE=false`
* From a [configuration file](./Runtime_Configuration.md#configuration-files) with the following content:
  ```yaml
  caliper:
    logging:
      formats:
        colorize: false
  ```
  
Similarly, any subproperty of a format can be easily overridden. For example, changing the `caliper.logging.formats.colorize.colors.info` property can be done from any of the following sources:

* From the command line: `--caliper-logging-formats-colorize-colors-info=blue`
* From an environment variable: `export CALIPER_LOGGING_FORMATS_COLORIZE_COLORS_INFO=blue`
* From a [configuration file](./Runtime_Configuration.md#configuration-files) with the following content:
  ```yaml
  caliper:
    logging:
      formats:
        colorize:
          colors:
            info: blue
  ```

The following formats and their options are supported (click on the name for the official documentation):

| Format | Supported options |
|:------:|:-----------------:|
| [Align](https://github.com/winstonjs/logform#align) | N.A. |
| [Pad](https://github.com/winstonjs/logform#padlevels) | N.A. |
| [Colorize](https://github.com/winstonjs/logform#colorize) | `level`, `message`, `colors` |
| [Errors](https://github.com/winstonjs/logform#errors) | `stack` |
| [JSON](https://github.com/winstonjs/logform#json) | `space` |
| [Label](https://github.com/winstonjs/logform#label) | `label`, `message` |
| [Timestamp](https://github.com/winstonjs/logform#timestamp) | `format` |

## Configuring logging targets

The source and target(s) of log messages are decoupled, thanks to the [transport mechanism](https://github.com/winstonjs/winston/blob/master/docs/transports.md) of winston. This means that a log message can be easily logged to multiple places, like the console, or different log files. Moreover, this is completely transparent to the module generating the log message!

The different targets are specified under the `caliper.logging.targets` property. The `caliper.logging.targets` section takes the following general form:

```yaml
caliper:
  logging:
    targets:
      mylogger1:
        target: console
        enabled: true
        options:
          # console target-specific options
      mylogger2:
        target: file
        enabled: true
        options:
          # file target-specific options
```

Each subproperty of `caliper.logging.targets` is an arbitrary name for the given logging target (e.g., `mylogger1`, `mylogger2`, etc.).

Each target must specify the following properties:
* `target`: the identifier of a supported target. See the table below.
* `enabled`: indicates whether the target is enabled. Defaults to `true` if omitted.
* `options`: this object will be given as-is to the specific winston transport as options. See the table below for the supported options of each transport.

The following `target` values (i.e., transports) are supported. Click on the links for the official documentation of each transport.

| Target | Available options |
|:------:|:-----------------:|
| `console` | [Console Transport](https://github.com/winstonjs/winston/blob/master/docs/transports.md#console-transport) |
| `file` | [File Transport](https://github.com/winstonjs/winston/blob/master/docs/transports.md#file-transport) |
| `daily-rotate-file` | [Daily Rotating File Transport](https://github.com/winstonjs/winston-daily-rotate-file#options) |

### Disabling loggers

Even though the setting keys/properties of the `caliper.logging.targets` section cannot be overridden one-by-one (like the properties in the `caliper.logging.formats` section), the `enabled` property is an exception. To easily disable a logger, set its `enabled` property to `false` (using the target's name in the property hierarchy).
 
For example, to disable the `mylogger1` target, the following approaches are available:
* From the command line: `--caliper-logging-targets-mylogger1-enabled=false`
* From an environment variable: `export CALIPER_LOGGING_TARGETS_MYLOGGER1_ENABLED=false`

> __Note:__ you must use lower-case letters (and/or digits) in your target name for this to work!

### Overriding logger target settings

But what if you would like to modify one of the options of a transport? You can use a [configuration file](./Runtime_Configuration.md#configuration-files) for that!

For the next example, we will disable the default file logger, modify the logging level of the console target, and also add a new daily rotating file logger. We can do all of this with a single configuration file.   

```yaml
caliper:
  logging:
    targets:
      console:
        options:
          # we don't care about info level messages anymore
          level: warn 
      file:
        # we disable this
        enabled: false
      rotatingfile:
        target: daily-rotate-file
        # enabled by default
        options:
          # we log every message this way
          level: debug
          # start a new log file every hour
          datePattern: 'YYYY-MM-DD-HH'
          # compress old log files after rotating
          zippedArchive: true
          # include the hour-precision date in the file names
          filename: 'caliper-%DATE%.log'
          # options for opening the file for writing
          options:
            # append mode
            flags: a
            # make the file readable/writable by anyone
            mode: 0666
```

If you save the above content as `caliper.yaml` in your workspace directory, then Caliper will pick it up automatically.

> __Note:__ some remarks about the above file content:
> 1. We only set the properties we wanted to override. The default configuration file will be merged with the above configuration file, the values in the latter taking precedence.
> 2. The provided options for a transport are not verified by Caliper. It is simple passed to the specific transport. It is your responsibility to configure the transport the right way.
> 3. We could have disabled the `file` logger also from the command line, or from an environment variable. The reason we did it from a config file is explained in the [Tips & tricks](#tips--tricks) section.  

## Creating your own loggers

The different modules of Caliper will automatically use the configured targets for logging. Moreover, your user test modules can also create logger instances to log runtime events related to your business logic.

To create your own logger instance, use the following API:

```js
const logger = require('@hyperledger/caliper-core').CaliperUtils.getLogger('my-module');

// ...

logger.debug('My custom debug message', metadataObject);
```

Once a logger instance is created, it exposes the usual `info`, `warn`, `debug` and `error` functions that each take as parameter a log message and an optional object, considered as "metadata".

This "metadata" is especially useful for debug level logs. When you perform an operation based on a complex input parameter/object, you can log the following at the beginning of your function:

```js
function complexCalculation(complexInput) {
    logger.debug('Starting complex calculation. Input: ', complexInput);
    // complex calculation
}
```

This "metadata" can also be an array of object, if you would like to log multiple inputs. The "metadata" will appear at the place of the `%meta%` placeholder, as discussed in the message template section.

> __Note:__ the "metadata" object will be serialized as a JSON string. This can hurt the performance of logging if done in a loop with larger objects. Only use "metadata" logging for debug messages, since the debug level can be switched off in production code.

## Tips & tricks

Logging settings are usually determined by your log analysis requirements. This means that once you settle on some logging style and targets, those settings will rarely change.

To this end, the ability to override the logging style settings from the command line or from environment variables is really just a convenience feature. Once you found your ideal settings, it's worth to record them in a configuration file.

The easiest way to do that is with a project-level configuration file. If you name the following file `caliper.yaml` and place it in your workspace root, then Caliper will automatically apply the settings.

> __Note:__ there are other ways to load a configuration file, as discussed in the [runtime configuration page](./Runtime_Configuration.md#configuration-files).

```yaml
caliper:
  logging:
    # no need for timestamp and label
    template: '%level% [%module%]: %message% %meta%'
    formats:
      # color codes look ugly in log files
      colorize: false
      # don't need these, since won't appear in the template
      label: false
      timestamp: false
    targets:
      file:
        options:
          # bump the log level from debug to warn, only log the critical stuff in this file
          level: warn
          filename: 'critical.log'
      rotatingfile:
        target: daily-rotate-file
        enabled: true
        options:
          level: debug
          datePattern: 'YYYY-MM-DD-HH'
          zippedArchive: true
          filename: 'debug-%DATE%.log'
          options:
            flags: a
            mode: 0666
```