## Overview

Caliper builds on the [winston](https://github.com/winstonjs/winston) logger module to provide a flexible, multi-target logging mechanism. There are three different aspects when it comes to interacting with the Caliper logging subsystem:

1. Customizing the logging style
2. Configuring logging targets
3. Creating your own loggers

The first two points can be achieved through the [runtime configuration](https://hyperledger.github.io/caliper/v0.6.0/reference/runtime-config/) mechanism of Caliper. So make sure that you are familiar with the different way of overriding runtime settings before reading on. The examples below only set the different options through the command line. Naturally, any other setting source could be used.

The runtime configuration settings corresponding to logging reside under the `caliper-logging` key hierarchy. See the `caliper.logging` section of the [default configuration file](https://github.com/hyperledger/caliper/blob/v0.6.0/packages/caliper-core/lib/config/default.yaml) bundled with Caliper for the general structure of the settings.

## Customizing the logging style

The two main aspects of the logging style are the message structure and the different formats that modify the message appearance if applied. The corresponding attributes are the `caliper.logging.template` property and the entire `caliper.logging.formats` property hierarchy, respectively.

The `caliper.logging.formats` hierarchy is special in a sense that every leaf property can be overridden one-by-one, even from the command line or from environment variables. As you will see later, this is not the case for the logging target settings.

!!!note
    *the following style settings apply to every specified logging target!*

### Setting the message structure

The message structure can be easily customized through the `caliper.logging.template` property. It is a simple string that contains predefined placeholders for some special values. Some placeholders are only available, when a corresponding format is also applied.

Let’s start with examining the default structure:

```sh
caliper:
  logging:
    template: '%timestamp% %level% [%label%] [%module%] %message% (%metadata%)'
```

The following placeholders are available at the moment.

| Placeholder  | Required format | Description                                                  |
|--------------|-----------------|--------------------------------------------------------------|
| `%timestamp%`| timestamp       | Will be replaced with the timestamp of the log message.      |
| `%level%`     | -               | Will be replaced with the severity level (e.g., info, warn, error) of the log message. |
| `%label%`     | label           | Will be replaced with the configured label of the process.   |
| `%module%`    | -               | Will be replaced with the module name that logged the message. |
| `%message%`   | -               | Will be replaced with the actual message.                     |
| `%metadata%`  | -               | Will be replaced with the string representation of additional logging arguments. |

You can override this template by changing the caliper-logging-template setting key, for example, from the command line: `--caliper-logging-template="%time%: %message%"`

<div style="border-left: 4px solid #2196F3; padding-left: 10px; margin: 10px 0;">
  <strong>Note:</strong>
  <ol>
    <li>
    Do not forget the two enclosing quotes, since the template can contain spaces!
    </li>
    <li>
    This template if applied after every format has been applied!
    </li>
    <li>
    Adding spaces and different brackets this way is fine for simple coloring scenarios (or when coloring is disabled). However, when coloring the entire log message (or just parts that should be surrounded with additional characters), the result looks inconsistent when formatted this way. See the <a href="https://hyperledger.github.io/caliper/v0.6.0/reference/logging/#tips--tricks">Tips & Tricks</a> section for advanced message formatting scenarios.
    </li>
  </ol>
</div>

### Applying formats

The logging subsystem relies on winston’s [format mechanism](https://github.com/winstonjs/logform#understanding-formats) to further modify the log messages. The corresponding settings are under the `caliper.logging.formats` property.

Each of these formats can be easily disabled by setting its property to `false`. For example, to disable the `colorize` format, set its corresponding `caliper.logging.formats.colorize` property to false, for example, from the command line: `--caliper-logging-formats-colorize=false`

Similarly, any sub-property of a format can be easily overridden. For example, changing the `caliper.logging.formats.colorize.colors.info` property from the command line: `--caliper-logging-formats-colorize-colors-info=blue`

The following formats and their options (sub-properties) are supported.

!!! note

    *the different formats are applied in the order they are presented, which is important (see the [Tips & Tricks](https://hyperledger.github.io/caliper/v0.6.0/reference/logging/#tips--tricks) section for the reason).*

#### Timestamp

Adds the timestamp to the message in the specified format. The format string must conform to the rules of the [fecha](https://github.com/taylorhakes/fecha#formatting-tokens) package.

For example: `--caliper-logging-formats-timestamp="YYYY.MM.DD-HH:mm:ss.SSS"`

!!! note

    *the format makes the `timestamp` attribute available in the message, thus it can be referenced in the message template, or in other formats that can access message attributes.*

#### Label

Adds a custom label to the message. This is useful for differentiating multiple Caliper instances (or the distributed client instances) after collecting their logs.

For example: `--caliper-logging-formats-label="caliper-test-1"`

!!! note

    *the format makes the `label` attribute available in the message, thus it can be referenced in the message template, or in other formats that can access message attributes.*

#### JSON

Outputs the messages as JSON strings. Useful for file-based logs that will be processed automatically by another tool. The format accepts a `space` sub-property as an options, which corresponds to the `space` parameter of the [JSON.stringify](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Syntax) function.

For example: `--caliper-logging-formats-json="{space:0}"`

<div style="border-left: 4px solid #2196F3; padding-left: 10px; margin: 10px 0;">
  <strong>Note:</strong>
  <ol>
    <li>
    Enabling this format is easier from a configuration file. See the <a href="https://hyperledger.github.io/caliper/v0.6.0/reference/logging/#tips--tricks">Tips & Tricks</a> section.
    </li>
    <li>
    Setting <code>space</code> to a non-zero number will effectively format the JSON output with indentations on multiple lines. This could “spam” the console a bit (not a problem for log files, unless you care about the extra newlines).
    </li>
    <li>
    If this format is enabled, the rest of the formats won’t be applied, since their purpose is mainly to make console logs more readable.
    </li>
  </ol>
</div>

#### Padding

Makes every log level string the same length, i.e., adds an extra space after `"info"` and `"warn"` make them the same length as `"error"` and `"debug"`.

For example: `--caliper-logging-formats-pad=true`

#### Align

Prepends the message part of the log with a tabulator (`"\t"`) to align the messages of different logs in the same place.

For example: `--caliper-logging-formats-align=true`

!!! note

    *if the message format contains other information with variable lengths (e.g., the module name), it can cause misaligned messages. So this is just a “best effort” format to make console messages more readable.*

#### Attribute format

Defines string formatting options for the different attributes of a message. A “format string” can be provided for each message attribute that will “reformat” its value. The format string can use the `%attribute%` placeholder to reference the original value.

A format string can be specified for the following message attributes:

- timestamp
- level
- label
- module
- message
- metadata

For example, to customize the level information of the log (enclose it in the `LEVEL[<level>]` string):

`--caliper-logging-formats-attributeformat-level="LEVEL[%attribute%]"`

!!! note

    *if the attribute is not a string (which can be the case for the “metadata” attribute), then first the attribute value is converted to string, using `JSON.stringify`, and then it’s inserted into the format string.*

#### Colorize

Applies color coding for the different attributes of a message. Enabling/disabling coloring is specified on an attribute basis. The following sub-properties can be set to `true/false` to enable/disable coloring for the corresponding attribute:

- timestamp
- level
- label
- module
- message
- metadata
- all: setting it to true enables coloring for every attribute

For example, to colorize every part of the message: `--caliper-logging-formats-colorize-all=true`

Additionally, the format exposes a `colors` attribute, which contains coloring information for the `info`, `error`, `warn` and `debug` levels. The value of a level can be set to [colors](https://github.com/Marak/colors.js#colors-and-styles) and styles provided by the colors package. To apply multiple styles, separate the values with a space.

For example, to really highlight error-level logs: `--caliper-logging-formats-colorize-colors-error="white bgRed bold italic"`

!!! note

    *the `colors` package offers some exotic styles which seem tempting at first, but don’t overdo it, for the sake of your eyes. Keep it simple.*

## Configuring logging targets

The source and target(s) of log messages are decoupled, thanks to the [transport mechanism](https://github.com/winstonjs/winston/tree/v3.13.1/docs/transports.md) of winston. This means that a log message can be easily logged to multiple places, like the console, or different log files. Moreover, this is completely transparent to the module generating the log message!

The different targets are specified under the `caliper.logging.targets` property. The `caliper.logging.targets` section takes the following general form:

```sh
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

- `target`: the identifier of a supported target. See the table below.
- `enabled`: indicates whether the target is enabled. Defaults to `true` if omitted.
- `options`: this object will be given as-is to the specific winston transport as options. See the table below for the supported options of each transport.

The following `target` values (i.e., transports) are supported. Click on the links for the official documentation of each transport.

| Target             | Available options              |
|--------------------|--------------------------------|
| console            | [Console Transport](https://github.com/winstonjs/winston/blob/master/docs/transports.md#console-transport)              |
| file               | [File Transport](https://github.com/winstonjs/winston/blob/master/docs/transports.md#file-transport)                 |
| daily-rotate-file  | [Daily Rotating File Transport](https://github.com/winstonjs/winston-daily-rotate-file#options)  |


### Disabling loggers

Even though the setting keys/properties of the `caliper.logging.targets` section cannot be overridden one-by-one (like the properties in the `caliper.logging.formats` section), the `enabled` property is an exception. To easily disable a logger, set its `enabled` property to `false` (using the target’s name in the property hierarchy).

For example, to disable the `mylogger1` target, the following approaches are available:

- From the command line: `--caliper-logging-targets-mylogger1-enabled=false`
- From an environment variable: `export CALIPER_LOGGING_TARGETS_MYLOGGER1_ENABLED=false`

!!!note

    *you must use lower-case letters (and/or digits) in your target name for this to work!*

### Overriding logger target settings

But what if you would like to modify one of the options of a transport? You can use a [configuration file](https://hyperledger.github.io/caliper/v0.6.0/reference/untime-config/#configuration-files) for that!

For the next example, we will disable the default file logger, modify the logging level of the console target, and also add a new daily rotating file logger. We can do all of this with a single configuration file.

```sh
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

!!! note

    Some remarks about the above file content:

    1. We only set the properties we wanted to override. The default configuration file will be merged with the above configuration file, the values in the latter taking precedence.
    2. The provided options for a transport are not verified by Caliper. It is simple passed to the specific transport. It is your responsibility to configure the transport the right way.
    3. We could have disabled the file logger also from the command line, or from an environment variable. The reason we did it from a config file is explained in the [Tips & tricks](https://hyperledger.github.io/caliper/v0.6.0/reference/logging/#tips--tricks) section.

## Creating your own loggers

The different modules of Caliper will automatically use the configured targets for logging. Moreover, your user test modules can also create logger instances to log runtime events related to your business logic.

To create your own logger instance, use the following API:

```sh
const logger = require('@hyperledger/caliper-core').CaliperUtils.getLogger('my-module');

// ...

logger.debug('My custom debug message', metadataObject1, metadataObject2);
```

Once a logger instance is created, it exposes the usual `info`, `warn`, `debug` and `error` functions that each take as parameter a log message and optional objects, considered as “metadata”.

This “metadata” is especially useful for debug level logs. When you perform an operation based on a complex input parameter/object, you can log the following at the beginning of your function:

```sh
function complexCalculation(complexInput) {
    logger.debug('Starting complex calculation. Input: ', complexInput);
    // complex calculation
}
```

The “metadata” will appear at the place of the `%metadata%` placeholder, as discussed in the message template section.

!!! note

    *pPassing large metadata objects can hurt the performance of logging if done in a loop/hot path. Only use “metadata” logging for debug messages, since the debug level is usually switched off in production code.*

## Tips & tricks

### The format pipeline

Winston formats are a powerful feature that allow the arbitrary manipulation of log messages. From the user’s perspective, a log message is a simple string displayed on the console, or saved in a file. However, to fully utilize the logging styles described in this documentation, it might help knowing what really happens under the hood.

!!!note
    *in the remainder of this section, we’ll refer to log messages as LOG.*

LOG can be considered an item/object, that is generated when issuing a call to `logger.info(...)` or similar functions. A LOG can have several attributes attached to it. Every LOG has the `level` and `message` attributes, containing the severity and the “description” of LOG. Additionally, Caliper automatically adds the `module` attribute to LOGs of every logger created through the Caliper API, denoting the name of the module who issued the log.

Let’s introduce the format pipeline through an example.

#### Assumptions

Let’s assume that the following `caliper.logging` configuration is used:

```sh
template: '%timestamp%%level%%label%%module%%message%%metadata%'
formats:
    timestamp: 'YYYY.MM.DD-HH:mm:ss.SSS'
    label: caliper
    json: false
    pad: true
    align: false
    attributeformat:
        level: ' %attribute%'
        label: ' [%attribute%]'
        module: ' [%attribute%] '
        metadata: ' (%attribute%)'
    colorize:
        all: true
        colors:
            info: green
            error: red
            warn: yellow
            debug: grey
```
This means that the following formats will be applied to every LOG:

- module (automatically added by Caliper)
- timestamp
- label
- padding
- attribute formats
- colorizing
- template substitution

Furthermore, let’s assume that the following code initiates the LOG:

```sh
const logger = require('@hyperledger/caliper-core').CaliperUtils.getLogger('my-module');

// ...

logger.info('Doing operation X with:', 'someSetting', 'anotherSetting');
```

#### The life of a LOG

The `logger.info` call generates the initial LOG with the following attributes:

```sh
level: 'info'
message: 'Doing operation X with:'
```

Before LOG enters the format pipeline, Caliper also adds the module name, and collects the additional parameters as metadata. Now LOG has the following attributes:

```sh
level: 'info'
message: 'Doing operation X with:'
module: 'my-module'
metadata: ['someSetting', 'anotherSetting']
```

This is the initial LOG entity that enters the format pipeline. Every enabled format is “just” a transformation on the attributes of LOG. A format can manipulate the value of an existing attribute or/and add/remove arbitrary attributes.

The first step of the pipeline is the timestamp format. This adds the `timestamp` attribute containing the current time, in the specified format. After this step, LOG looks like this:

```sh
level: 'info'
message: 'Doing operation X with:'
module: 'my-module'
metadata: ['someSetting', 'anotherSetting']
timestamp: '2019.10.07-12:45:47.962'
```

The next step if the label format, which adds the `label` attribute with the specified value (`caliper`, in this case):

```sh
level: 'info'
message: 'Doing operation X with:'
module: 'my-module'
metadata: ['someSetting', 'anotherSetting']
timestamp: '2019.10.07-12:45:47.962'
label: 'caliper'
```

The next step is the padding format, which ensure that every logging level string has the same length. This means, that an extra space is appended at the end of the `level` attribute:

```sh
level: 'info '
message: 'Doing operation X with:'
module: 'my-module'
metadata: ['someSetting', 'anotherSetting']
timestamp: '2019.10.07-12:45:47.962'
label: 'caliper'
```

The next step is the attribute formatter. This formatter is configured to modify multiple attributes of LOG, based on a string template:

- level: add a space before it
- label: enclose in `[]` and add a space before it
- module: enclose in `[]` and add a space before and after it
- metadata: enclose in `()` and add a space before it

After these transformation, LOG looks like the following:

```sh
level: ' info '
message: 'Doing operation X with:'
module: ' [my-module] '
metadata: ' (["someSetting", "anotherSetting"])'
timestamp: '2019.10.07-12:45:47.962'
label: ' [caliper]'
```

!!! note
    some remarks:
    1. `metadata` was an Array, not a string, so it was stringified before the formatting was applied.
    2. `message` and `timestamp` is unchanged.


The next step is the colorizing format, which adds certain color/style codes to the configured values. Since `all` is set true, and the `level` of LOG is info, every attribute is surrounded with the color code for green (denoted by `<green>` for sake of 
readability):

```sh
level: '<green> info <green>'
message: '<green>Doing operation X with:<green>'
module: '<green> [my-module] <green>'
metadata: '<green> (["someSetting", "anotherSetting"])<green>'
timestamp: '<green>2019.10.07-12:45:47.962<green>'
label: '<green> [caliper]<green>'
```

The last step in the pipeline (since the JSON format is disabled) is substituting the attributes into the logging template, to create the final message, that will appear in the console and in the file. The result is the concatenation of LOG’s attributes in the following order:

1. timestamp
2. level
3. label
4. module
5. message
6. metadata

Omitting the color code for the sake of readability, this results in:

```sh
2019.10.07-12:45:47.962 info  [caliper] [my-module] Doing operation X with: (["someSetting", "anotherSetting"])
```

!!! note

    try adding other characters to the template string. And then be surprised that they are not colorized with the rest of the line. Actually, this is not surprising at all. The template string is “evaluated” after the colorizing format. Since these extra characters are not part of any attributes of LOG, they won’t be colorized.

### Use a configuration file

Logging settings are usually determined by your log analysis requirements. This means that once you settle on some logging style and targets, those settings will rarely change.

To this end, the ability to override the logging style settings from the command line or from environment variables is really just a convenience feature. Once you found your ideal settings, it’s worth to record them in a configuration file.

The easiest way to do that is with a project-level configuration file. If you name the following file `caliper.yaml` and place it in your workspace root, then Caliper will automatically apply the settings.

!!! note
    there are other ways to load a configuration file, as discussed in the [runtime configuration page](https://hyperledger.github.io/caliper/v0.6.0/runtime-config/#configuration-files).

```sh
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

## License

The Caliper codebase is released under the [Apache 2.0 license](https://hyperledger.github.io/caliper/v0.6.0/general/license/). Any documentation developed by the Caliper Project is licensed under the Creative Commons Attribution 4.0 International License. You may obtain a copy of the license, titled CC-BY-4.0, at [http://creativecommons.org/licenses/by/4.0/](http://creativecommons.org/licenses/by/4.0/).