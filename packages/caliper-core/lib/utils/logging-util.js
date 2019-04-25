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
const moment  = require('moment');
const winston = require('winston');
require('winston-daily-rotate-file');
const fs = require('fs');
const configUtil = require('../config/config-util.js');
const util = require('./caliper-utils');

/**
 * Saves the global logger object in the caliper namespace. For internal use only!
 * @param {winston.LoggerInstance} logger  The configured winston logger instance.
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
 * @param {winston.LoggerInstance} logger The original winston logger instance.
 * @param {string} name The name of the module using the logger.
 * @return {winston.LoggerInstance}   the  logger after inserting a new line.
 * @private
 */
function _wrapWithLoggerName(logger, name) {
    const newLogger = Object.assign({}, logger);
    ['debug', 'info', 'warn', 'error'].forEach((method) => {
        const originalFunction = logger[method];

        // replace with the wrapper function
        newLogger[method] = (function (context, loggerName, f) {
            return function () {
                if (arguments.length > 0) {
                    arguments[0] = '[' + loggerName + ']: ' + arguments[0];
                }
                f.apply(context, arguments);
            };
        })(logger, name, originalFunction);
    });

    return newLogger;
}

/**
 * Custom formatter for log messages.
 * @param {object} options Winston's object containing the log message parts.
 * @returns {string} The formatted text.
 * @private
 */
function _formatter(options){
    return  options.timestamp() + ' - ' +
        options.level.toUpperCase() +
        ' ' +(options.message ? options.message : '') +
        (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : ' ') +
        '\r\n';
}

/**
 * Creates a default logger instance if the configuration is omitted.
 * An info-level console and debug-level file target is created.
 * @return {winston.LoggerInstance} The default logger instance.
 * @private
 */
function _createDefaultLogger() {
    let winstonOptions = {};
    winstonOptions.transports = [];

    winstonOptions.transports.push(new (winston.transports.Console)({
        name: 'console',
        level: 'info',
        handleExceptions: true
    }));

    let fileName = 'log/caliper-%DATE%.log';
    let dirName = path.dirname(fileName);
    if (!fs.existsSync(dirName)) {
        fs.mkdirSync(dirName);
    }
    winstonOptions.transports.push(new (winston.transports.DailyRotateFile)({
        name: 'file',
        level: 'debug',
        handleExceptions: true,
        timestamp: () => moment().format(),
        formatter: _formatter,
        filename: fileName,
        datePattern: 'YYYY-MM-DD-HH',
        json: false,
        maxSize: '5m',
        zippedArchive: false
    }));

    return new winston.Logger(winstonOptions);
}

/**
 * Creates a logger according to the provided target configurations.
 * @param {object} logConfig The configuration object containing the target specifications.
 * @return {winston.LoggerInstance} The configured logger instance.
 * @private
 */
function _createConfiguredLogger(logConfig) {
    let winstonOptions = {};
    winstonOptions.transports = [];

    let config = (typeof logConfig === 'string') ? util.parseYamlString(logConfig) : logConfig;

    if (typeof config !== 'object') {
        throw new Error('The \'core:logging\' attribute must be an object conforming to the documented format');
    }

    // create the transports based on the provided configuration
    for (let target in config) {
        if (!config.hasOwnProperty(target)) {
            continue;
        }

        let targetSettings = config[target];
        if (!targetSettings.target) {
            throw new Error(`Mandatory 'target' attribute is missing for the ${target} logging target`);
        }

        if (!targetSettings.level) {
            throw new Error(`Mandatory 'level' attribute is missing for the ${target} logging target`);
        }

        if (!['debug', 'info', 'warning', 'error'].includes(targetSettings.level)) {
            throw new Error(`Unknown level value '${targetSettings.level}' for the ${target} logging target`);
        }

        switch (targetSettings.target) {
        case 'console': {
            winstonOptions.transports.push(new (winston.transports.Console)({
                name: target.toString(),
                level: targetSettings.level,
                handleExceptions: true
            }));
            break;
        }
        case 'file': {
            let filePath = targetSettings.filename || 'log/caliper.log';
            let dirName = path.dirname(filePath);
            if (!fs.existsSync(dirName)) {
                fs.mkdirSync(dirName);
            }
            winstonOptions.transports.push(new (winston.transports.File)({
                name: target.toString(),
                level: targetSettings.level,
                handleExceptions: true,
                timestamp: () => moment().format(),
                formatter: _formatter,
                filename: filePath,
                json: false,
                maxsize: targetSettings.maxsize,
                maxFiles: targetSettings.maxFiles,
                tailable: targetSettings.tailable,
                zippedArchive: targetSettings.zippedArchive
            }));
            break;
        }
        case 'daily-rotate-file': {
            let filePath = targetSettings.filename || 'log/caliper-%DATE%.log';
            let dirName = path.dirname(filePath);
            if (!fs.existsSync(dirName)) {
                fs.mkdirSync(dirName);
            }
            winstonOptions.transports.push(new (winston.transports.DailyRotateFile)({
                name: target.toString(),
                level: targetSettings.level,
                handleExceptions: true,
                timestamp: () => moment().format(),
                formatter: _formatter,
                dirname: dirName,
                filename: filePath,
                datePattern: targetSettings.datePattern || 'YYYY-MM-DD-HH',
                json: false,
                frequency: targetSettings.frequency,
                maxSize: targetSettings.maxSize,
                maxFiles: targetSettings.maxFiles,
                tailable: targetSettings.tailable,
                zippedArchive: targetSettings.zippedArchive
            }));
            break;
        }
        default:
            throw new Error(`Unsupported target type '${targetSettings.target}' for the ${target} logging target`);
        }
    }

    return new winston.Logger(winstonOptions);
}

/**
 * Returns a logger configured with the given module name.
 * @param {string} name The name of module who will use the logger.
 * @param {winston.LoggerInstance} parentLogger Optional. The logger of the parent module. Defaults to the global Caliper logger.
 * @returns {winston.LoggerInstance} The configured logger instance.
 */
function getLogger(name, parentLogger) {
    if (parentLogger) {
        return _wrapWithLoggerName(parentLogger, name);
    }

    // if the parent isn't specified, use the global Caliper logger if exists
    if (global.caliper && global.caliper.logger) {
        return _wrapWithLoggerName(global.caliper.logger, name);
    }

    // The global Caliper logger must be created

    // Check if there are any logger targets configured
    let logConfig = configUtil.getConfigSetting('core:logging', undefined);

    // if not, just create a default logger with console and file targets
    if (!logConfig) {
        let logger = _createDefaultLogger();
        _saveLogger(logger);
        logger.debug(`Returning a default winston logger to [${name}]`);
        return _wrapWithLoggerName(logger, name);
    }

    try {
        let logger = _createConfiguredLogger(logConfig);
        logger.debug('Constructed a winston logger with the specified targets:', logConfig);
        _saveLogger(logger);
        return _wrapWithLoggerName(logger, name);
    } catch (err) {
        // parsing the logging configuration failed
        // construct the default logger, log a warning and return it
        let logger = _createDefaultLogger();
        _saveLogger(logger);
        logger.log('warn', `Failed to parse logging settings 'core:logging', using a default logger. Error: ${err.message || err}`);
        return _wrapWithLoggerName(logger, name);
    }

}

module.exports.getLogger = getLogger;
