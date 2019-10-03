/*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

'use strict';

const path = require('path');

const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');

const conf = require('../config/config-util.js');

/**
 * Returns the common message format for printing messages.
 * @return {Format} The message format.
 * @private
 */
function _messageFormat() {
    let template = conf.get(conf.keys.Logging.Template,
        '%time% %level% [%label%] [%module%] %message% %meta%');

    let timeRegex = /%time%/gi;
    let levelRegex = /%level%/gi;
    let labelRegex = /%label%/gi;
    let moduleRegex = /%module%/gi;
    let messageRegex = /%message%/gi;
    let metaRegex = /%meta%/gi;

    return format.printf(info => {
        // NOTE: info will contain the mandatory "level" and "message" properties
        // additionally it contains the "moduleName" due to our wrapping approach
        // plus it might contain the "timestamp" and "label" properties, if those formats are enabled

        let output = template.replace(timeRegex, info.timestamp || '');
        output = output.replace(levelRegex, info.level || '');
        output = output.replace(labelRegex, info.label || '');
        output = output.replace(moduleRegex, info.moduleName || '');
        output = output.replace(messageRegex, info.message || '');
        return output.replace(metaRegex, info.meta ? JSON.stringify(info.meta) : '');
    });
}

/**
 * Assembles a default format for the default logger, with aligning, padding, colors, stack traces and timestamps.
 * @return {Format} The combined format.
 * @private
 */
function _assembleDefaultFormat() {
    let formats = [];

    // enable aligning log messages
    formats.push(format.align());

    // enable colors for log levels
    formats.push(format.colorize({
        level: true,
        message: false,
        colors: {
            info: 'green',
            error: 'red',
            warn: 'yellow',
            debug: 'grey'
        }
    }));

    // enable printing stacktrace
    formats.push(format.errors({
        stack: true
    }));

    // add timestamp
    formats.push(format.timestamp({
        format: 'YYYY.MM.DD-HH:mm:ss.SSS'
    }));

    formats.push(format.padLevels());

    // message format
    formats.push(_messageFormat());

    return format.combine(...formats);
}

/**
 * Processes the format configuration and assembles the combined format.
 * @return {Format} The combined format.
 * @private
 */
function _processFormatOptions() {
    let formats = [];

    // NOTES:
    // 1) The format options are queried directly (i.e., not using the "logging.formats" root object),
    //    so the user can change them from the command line or from evn vars
    // 2) The sub-properties of the formats are also queried directly for the same reason


    let formatKey = conf.keys.Logging.Formats;

    // aligning
    let align = conf.get(formatKey.Align);
    if (align && align === true) {
        formats.push(format.align());
    }

    // colorize
    let colorize = conf.get(formatKey.ColorizeRoot);
    if (colorize && colorize !== false) {
        let opts = {
            level: conf.get(formatKey.Colorize.Level),
            message: conf.get(formatKey.Colorize.Message),
            colors: {
                info: conf.get(formatKey.Colorize.Colors.Info),
                error: conf.get(formatKey.Colorize.Colors.Error),
                warn: conf.get(formatKey.Colorize.Colors.Warn),
                debug: conf.get(formatKey.Colorize.Colors.Debug)
            }
        };
        formats.push(format.colorize(opts));
    } else {
        formats.push(format.uncolorize({
            level: true,
            message: true
        }));
    }

    // errors
    let errors = conf.get(formatKey.ErrorsRoot);
    if (errors && errors !== false) {
        let opts = {
            stack: conf.get(formatKey.Errors.Stack)
        };
        formats.push(format.errors(opts));
    }

    // JSON
    let json = conf.get(formatKey.JsonRoot);
    if (json && json !== false) {
        let opts = {
            space: conf.get(formatKey.Json.Space)
        };
        formats.push(format.json(opts));
    }

    // label
    let label = conf.get(formatKey.LabelRoot);
    if (label && label !== false) {
        let opts = {
            label: conf.get(formatKey.Label.Label),
            message: conf.get(formatKey.Label.Message)
        };
        formats.push(format.label(opts));
    }

    // timestamp
    let timestamp = conf.get(formatKey.TimestampRoot);
    if (timestamp && timestamp !== false) {
        let opts = {
            format: conf.get(formatKey.Timestamp.Format)
        };
        formats.push(format.timestamp(opts));
    }

    // padding
    let pad = conf.get(formatKey.Pad);
    if (pad && pad === true) {
        formats.push(format.padLevels());
    }

    // message format
    formats.push(_messageFormat());

    return format.combine(...formats);
}

/**
 * Saves the global logger object in the caliper namespace. For internal use only!
 * @param {Logger} logger  The configured winston logger instance.
 * @private
 */
function _saveLogger(logger) {
    if (global.caliper) {
        global.caliper.logger = logger;
    } else {
        global.caliper = {
            logger: logger
        };
    }
}

/**
 * Wraps the debug, info, warn and error functions of the given logger so they append the given name before the logs.
 * @param {Logger} logger The original winston logger instance.
 * @param {string} name The name of the module using the logger.
 * @return {Logger}   the  logger after inserting a new line.
 * @private
 */
function _wrapWithLoggerName(logger, name) {
    const newLogger = Object.assign({}, logger);
    ['debug', 'info', 'warn', 'error'].forEach((method) => {
        const originalFunction = logger[method];

        // NOTE: this needs some explanation due to the magical winston mechanics
        // 1) Without wrapping, the winston info/warn/etc. functions receive a message as first argument
        // 2) They can also accept any extra arguments (metadata), that will be merged into the "info" object passed to the format pipeline
        // 3) The "function (message, ...metadata)" signature matches this interface
        // 4) To flexibly handle the extra module name, it is not prepended to the message, like before
        // 5) Instead, a new "metadata" object is constructed, that contains the "moduleName" key, plus every originally passed metadata, if any
        // 6) Don't pass "metadata" to the "meta" field if it's empty (as is the case when no extra args were passed...)
        newLogger[method] = (function (context, loggerName, f) {
            return function (message, ...metadata) {
                let logMeta = {
                    moduleName: loggerName,
                    meta: metadata.length > 0 ? metadata : undefined
                };

                f.apply(context, [message, logMeta]);
            };
        })(logger, name, originalFunction);
    });

    return newLogger;
}

/**
 * Creates a default logger instance if the configuration is omitted. Only an info-level console target is created.
 * @return {Logger} The default logger instance.
 * @private
 */
function _createDefaultLogger() {
    return createLogger({
        format: _assembleDefaultFormat(),
        transports: [new transports.Console({
            name: 'console',
            level: 'info'
        })]
    });
}

/**
 * Creates a logger according to the provided target configurations.
 * @return {Logger} The configured logger instance.
 * @private
 */
function _createConfiguredLogger() {
    let winstonOptions = {};
    let logFormats = conf.get(conf.keys.Logging.FormatsRoot);

    // if the "logging.formats" key/object exists, then probably it contains settings to process
    winstonOptions.format = typeof logFormats === 'object'
        ? _processFormatOptions()
        : _assembleDefaultFormat();

    winstonOptions.transports = [];

    let logTargets = conf.get(conf.keys.Logging.Targets);
    if (typeof logTargets !== 'object') {
        throw new Error('The "caliper-logging-targets" attribute must be an object');
    }

    // create the transports based on the provided configuration
    for (let target of Object.keys(logTargets)) {
        let targetSettings = logTargets[target];

        if (!targetSettings.target) {
            throw new Error(`Mandatory "target" attribute is missing for the "${target}" logging target`);
        }

        // skip disabled targets
        // NOTE: read property directly from config, so it can be overridden
        let enabled = conf.get(`caliper-logging-targets-${target}-enabled`);
        if (enabled && enabled === false) {
            continue;
        }

        switch (targetSettings.target) {
        case 'console': {
            let consoleOptions = targetSettings.options || {};
            consoleOptions.name = target;
            winstonOptions.transports.push(new transports.Console(consoleOptions));
            break;
        }
        case 'file': {
            // NOTE: the parent directories should already exist
            // This is the responsibility of the user
            // Only the user knows the necessary dir permissions
            // And the user can also configure the file creation mode/permissions

            let fileOptions = targetSettings.options || {};
            // resolve filename
            if (fileOptions.filename && !path.isAbsolute(fileOptions.filename)) {
                let workspace = conf.get(conf.keys.Workspace, './');
                fileOptions.filename = path.join(workspace, fileOptions.filename);
            }
            fileOptions.name = target;

            winstonOptions.transports.push(new transports.File(fileOptions));
            break;
        }
        case 'daily-rotate-file': {
            // NOTE: the parent directories should already exist
            // This is the responsibility of the user
            // Only the user knows the necessary dir permissions
            // And the user can also configure the file creation mode/permissions

            let fileOptions = targetSettings.options || {};
            // resolve filename
            if (fileOptions.filename && !path.isAbsolute(fileOptions.filename)) {
                let workspace = conf.get(conf.keys.Workspace, './');
                fileOptions.filename = path.join(workspace, fileOptions.filename);
            }
            fileOptions.name = target;

            winstonOptions.transports.push(new transports.DailyRotateFile(fileOptions));
            break;
        }
        default:
            throw new Error(`Unsupported target type "${targetSettings.target}" for the "${target}" logging target`);
        }
    }

    // if every logger is disabled, this error will trigger a warning and creation of the default logger
    if (winstonOptions.transports.length < 1) {
        throw new Error('Every configured logger target is disabled');
    }

    return createLogger(winstonOptions);
}

/**
 * Returns a logger configured with the given module name.
 * @param {string} name The name of module who will use the logger.
 * @returns {Logger} The configured logger instance.
 */
function getLogger(name) {
    // wrap the global Caliper logger if exists
    if (global.caliper && global.caliper.logger) {
        return _wrapWithLoggerName(global.caliper.logger, name);
    }

    // The global Caliper logger must be created

    // Check if there are any logger targets configured
    let logConfig = conf.get(conf.keys.LoggingRoot);

    // if not, just create a default logger with a console target
    if (!logConfig) {
        let logger = _createDefaultLogger();
        _saveLogger(logger);
        let wrappedLogger = _wrapWithLoggerName(logger, name);
        wrappedLogger.debug('Triggered the construction of a default logger');
        return wrappedLogger;
    }

    try {
        let logger = _createConfiguredLogger();
        _saveLogger(logger);
        let wrappedLogger = _wrapWithLoggerName(logger, name);
        wrappedLogger.debug('Constructed a winston logger with the specified settings');
        return wrappedLogger;
    } catch (err) {
        // parsing the logging configuration failed
        // construct the default logger, log a warning and return it
        let logger = _createDefaultLogger();
        _saveLogger(logger);
        let wrappedLogger = _wrapWithLoggerName(logger, name);
        wrappedLogger.warn('Failed to parse logging settings, using a default logger. Error:', err);
        return wrappedLogger;
    }

}

module.exports.getLogger = getLogger;
