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
const { ColorizerExtra, PadLevelExtra, AttributeFormat } = require('./log-formats.js');
require('winston-daily-rotate-file');

const conf = require('../config/config-util.js');

/**
 * Returns the common message format for printing messages.
 * @return {Format} The message format.
 * @private
 */
function _messageFormat() {
    let template = conf.get(conf.keys.Logging.Template,
        '%timestamp%%level%%label%%module%%message%%metadata%');

    let timestampRegex = /%timestamp%/gi;
    let levelRegex = /%level%/gi;
    let labelRegex = /%label%/gi;
    let moduleRegex = /%module%/gi;
    let messageRegex = /%message%/gi;
    let metadataRegex = /%metadata%/gi;

    return format.printf(info => {
        // NOTE: info will contain the mandatory "level" and "message" properties
        // additionally it contains the "module" due to our wrapping approach
        // plus it might contain the "timestamp" and "label" properties, if those formats are enabled

        let output = template.replace(timestampRegex, info.timestamp || '');
        output = output.replace(levelRegex, info.level || '');
        output = output.replace(labelRegex, info.label || '');
        output = output.replace(moduleRegex, info.module || '');
        output = output.replace(messageRegex, info.message || '');
        return output.replace(metadataRegex, info.metadata || '');
    });
}

/**
 * Assembles a default format for the default logger, with aligning, padding, colors, stack traces and timestamps.
 * @return {Format} The combined format.
 * @private
 */
function _assembleDefaultFormat() {
    let formats = [];

    // add timestamp
    formats.push(format.timestamp({
        format: 'YYYY.MM.DD-HH:mm:ss.SSS'
    }));

    // pad level strings
    formats.push(PadLevelExtra());

    // enable aligning log messages
    formats.push(format.align());

    formats.push(AttributeFormat({
        level: ' %attribute%',
        label: ' [%attribute%]',
        module: ' [%attribute%] ',
        metadata: ' (%attribute%)'
    }));

    // enable colors for every attribute
    formats.push(ColorizerExtra({
        all: true,
        colors: {
            info: 'green',
            error: 'red',
            warn: 'yellow',
            debug: 'grey'
        }
    }));

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
    // 3) The formats are applied in the following order: timestamp, label, json,
    //    if not json, then padding, align, AttributeFormat, colorize


    let formatKey = conf.keys.Logging.Formats;

    // timestamp
    let timestamp = conf.get(formatKey.Timestamp);
    if (timestamp && typeof timestamp === 'string') {
        let opts = {
            format: timestamp
        };
        formats.push(format.timestamp(opts));
    }

    // label
    let label = conf.get(formatKey.Label);
    if (label && typeof label === 'string') {
        let opts = {
            label: label,
            message: false
        };
        formats.push(format.label(opts));
    }

    // JSON
    let json = conf.get(formatKey.JsonRoot);
    if (json && typeof json === 'object') {
        let opts = {
            space: conf.get(formatKey.Json.Space, 0)
        };
        formats.push(format.json(opts));

        // return now, since the other formats are mutually exclusive with the JSON format
        return format.combine(...formats);
    }

    // padding
    let pad = conf.get(formatKey.Pad);
    if (pad === true) {
        formats.push(PadLevelExtra());
    }

    // aligning
    let align = conf.get(formatKey.Align);
    if (align === true) {
        formats.push(format.align());
    }

    // attribute formatter
    let attributeFormat = conf.get(formatKey.AttributeFormatRoot);
    if (attributeFormat && typeof attributeFormat === 'object') {
        let opts = {
            timestamp: conf.get(formatKey.AttributeFormat.Timestamp),
            label: conf.get(formatKey.AttributeFormat.Label),
            level: conf.get(formatKey.AttributeFormat.Level),
            module: conf.get(formatKey.AttributeFormat.Module),
            message: conf.get(formatKey.AttributeFormat.Message),
            metadata: conf.get(formatKey.AttributeFormat.Metadata)
        };
        formats.push(AttributeFormat(opts));
    }

    // colorize
    let colorize = conf.get(formatKey.ColorizeRoot);
    if (colorize && typeof colorize === 'object') {
        let opts = {
            all: conf.get(formatKey.Colorize.All),
            timestamp: conf.get(formatKey.Colorize.Timestamp),
            label: conf.get(formatKey.Colorize.Label),
            level: conf.get(formatKey.Colorize.Level),
            module: conf.get(formatKey.Colorize.Module),
            message: conf.get(formatKey.Colorize.Message),
            metadata: conf.get(formatKey.Colorize.Metadata),
            colors: {
                info: conf.get(formatKey.Colorize.Colors.Info),
                error: conf.get(formatKey.Colorize.Colors.Error),
                warn: conf.get(formatKey.Colorize.Colors.Warn),
                debug: conf.get(formatKey.Colorize.Colors.Debug)
            }
        };
        formats.push(ColorizerExtra(opts));
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

    // wrap the following methods of the winston logger
    ['debug', 'info', 'warn', 'error'].forEach((method) => {
        const originalFunction = logger[method];

        // NOTE: the winston info/warn/etc functions expect a message, and a metadata/info object.
        // This wrapper function adds the "module" name as part of the winston metadata, collecting other
        // passed objects (if any) under a single "metadata" property (unwrapping arrays if it can).
        // The "info" object will be extended by winston with the "message" and "level" properties automatically,
        // and this "info" objects will be processed by the format pipeline
        const wrapMethod = function (context, loggerName, f) {
            return function (message, ...objects) {
                let info = {
                    module: loggerName
                };

                if (objects.length > 0) {
                    info.metadata = objects.length === 1 ? objects[0] : objects;
                }

                f.apply(context, [message, info]);
            };
        };

        newLogger[method] = wrapMethod(logger, name, originalFunction);
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
        if (enabled !== undefined && enabled === false) {
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
