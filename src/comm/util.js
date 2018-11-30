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
const yaml = require('js-yaml');
const cfUtil = require('../../src/comm/config-util.js');
// comm --> src --> root
const rootDir = path.join('..', '..');
const LOGGING_LEVELS =  ['debug','info','warn','error'];


/**
 * Save the logging configurations
 * @param {object} logger  cutomed winston logger
 */
function saveLogger(logger) {
    if (global.caliperLog) {
        global.caliperLog.logger = logger;
    } else {
        global.caliperLog = {
            logger: logger
        };
    }
}

/**
 * define a log format
 * @param {object} options winston's options for log definition
 * @returns {string} a formatted string
*/
function logFormat(options){
    return  options.timestamp() + ' - ' +
    options.level.toUpperCase() +
    ' ' +(options.message ? options.message : '') +
    (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : ' ') +
    '\r\n';
}

/**
 * If there is no  logging configurations, create a new logger,
 * it will generater 3 files named 'info.log', 'error.log','warn.log'.
 * The debug information is not saved to a file, it will just show to console.
 * @return {object}   the new winston logger
 */
function newDefaultLogger() {
    let filePath = path.join(__dirname, rootDir, 'log/caliper.log');
    let dirName = path.dirname(filePath);
    if(!fs.existsSync(dirName)){
        fs.mkdirSync(dirName);
    }
    let transports =[
        new (winston.transports.Console)({
            level: 'info',
            colorize: true
        }),
        new (winston.transports.DailyRotateFile)({
            timestamp: function (){return moment().format();},
            name: 'caliper-log',
            level: 'debug',
            filename: filePath,
            colorize: true,
            json: false,
            datePattern: 'YYYY-MM-DD',
            maxSize: '5m',
            handleExceptions: true,
            formatter: logFormat
        })
    ];
    return  new winston.Logger({
        transports: transports
    });
}

/**
 * According to the logger's name, insert a new log
 * @param {object} originalLogger original winston logger
 * @param {string} lname logger's name
 * @return {object}   the  logger after inserting a new line
 */
function insertLoggerName(originalLogger, lname) {
    const logger = Object.assign({}, originalLogger);
    ['debug', 'info', 'warn', 'error'].forEach((method) => {
        const func = originalLogger[method];

        logger[method] = (function (context, loggerName, f) {
            return function () {
                if (arguments.length > 0) {
                    arguments[0] = '[' + loggerName + ']: ' + arguments[0];
                }
                f.apply(context, arguments);
            };
        })(originalLogger, lname, func);
    });
    return logger;
}

/**
 * Internal Utility class for Caliper
 */
class Util {

    /**
     * Perform a sleep
     * @param {*} ms the time to sleep, in ms
     * @returns {Promise} a completed promise
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Simple log method to output to the console
     * @param {any} msg messages to log
     */
    static log(...msg) {
        // eslint-disable-next-line no-console
        console.log(...msg);
    }

    /**
     * unified logging framework to output to the console and files
     * @param {String} name logger's name
     * @returns {logger} logger the winston's logger
     */
    static getLogger(name) {

        if (global.caliperLog && global.caliperLog.logger) {
            return insertLoggerName(global.caliperLog.logger, name);
        }

        //see if the config has it set
        let config_log_setting = undefined;
        config_log_setting = cfUtil.getConfigSetting('core:log-file',undefined);

        let options = {};
        if (config_log_setting) {
            try {
                let config = null;
                if (typeof config_log_setting === 'string') {
                    config = JSON.parse(config_log_setting);
                }
                else {
                    config = config_log_setting;
                }
                if (typeof config !== 'object') {
                    throw new Error('logging variable "log-file" must be an object conforming to the format documented.');
                } else {
                    for (const level in config) {
                        if (!config.hasOwnProperty(level)) {
                            continue;
                        }

                        if (LOGGING_LEVELS.indexOf(level) >= 0) {
                            if (!options.transports) {
                                options.transports = [];
                            }

                            if (config[level] === 'console') {
                                options.transports.push(new (winston.transports.Console)({
                                    name: level + 'console',
                                    level: level,
                                    colorize: true
                                }));
                            } else {
                                let filePath = this.resolvePath(config[level]);
                                let dirName = path.dirname(filePath);
                                if(!fs.existsSync(dirName)){
                                    fs.mkdirSync(dirName);
                                }
                                options.transports.push(new (winston.transports.DailyRotateFile)({
                                    name: level + 'file',
                                    level: level,
                                    filename: filePath,
                                    datePattern: 'YYYY-MM-DD',
                                    colorize: true,
                                    timestamp: function (){return moment().format();},
                                    json: false,
                                    maxSize: '5m',
                                    handleExceptions: true,
                                    formatter: logFormat
                                }));
                            }
                        }
                    }
                }

                let logger = new winston.Logger(options);
                logger.debug('Successfully constructed a winston logger with configurations', config);
                saveLogger(logger);
                return insertLoggerName(logger, name);
            } catch (err) {
                // the user's configuration from environment variable failed to parse.
                // construct the default logger, log a warning and return it
                let logger = newDefaultLogger();
                saveLogger(logger);
                logger.log('warn', 'Failed to parse logging variable "log-file". Returned a winston logger with default configurations. Error: %s', err.stack ? err.stack : err);
                return insertLoggerName(logger, name);
            }
        }

        let logger = newDefaultLogger();
        saveLogger(logger);
        logger.debug('Returning a new winston logger with default configurations:  ' + name);
        return insertLoggerName(logger, name);
    }

    /**
     * Creates an absolute path from the provided relative path if necessary.
     * @param {String} relOrAbsPath The relative or absolute path to convert to an absolute path.
     *                              Relative paths are considered relative to the Caliper root folder.
     * @return {String} The resolved absolute path.
     */
    static resolvePath(relOrAbsPath) {
        if (!relOrAbsPath) {
            throw new Error('Util.resolvePath: Parameter is undefined');
        }

        if (path.isAbsolute(relOrAbsPath)) {
            return relOrAbsPath;
        }

        return path.join(__dirname, rootDir, relOrAbsPath);
    }

    /**
     * parse a yaml file.
     * @param {String} filenameOrFilepath the yaml file path
     * @return {object} the parsed data.
     */
    static parseYaml(filenameOrFilepath) {
        if (!filenameOrFilepath) {
            throw new Error('Util.parseYaml: Parameter is undefined');
        }

        let config ;
        try{
            config = yaml.safeLoad(fs.readFileSync(filenameOrFilepath),'utf8');
        }
        catch(e) {
            //console.log(e);
            throw new Error('failed to parse the yaml file');
        }
        return config;
    }
}

module.exports = Util;
