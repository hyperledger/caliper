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
require('winston-daily-rotate-file');
const fs = require('fs');
const yaml = require('js-yaml');
const loggingUtil = require('./logging-util.js');

/**
 * Internal Utility class for Caliper
 */
class CaliperUtils {

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
     * Returns a logger configured with the given module name.
     * @param {string} name The name of module who will use the logger.
     * @param {winston.LoggerInstance} parentLogger Optional. The logger of the parent module. Defaults to the global Caliper logger.
     * @returns {winston.LoggerInstance} The configured logger instance.
     */
    static getLogger(name, parentLogger) {
        // logger should be accessed through the Util class
        // but delegates to logging-util.js
        return loggingUtil.getLogger(name, parentLogger);
    }

    /**
     * Creates an absolute path from the provided relative path if necessary.
     * @param {String} relOrAbsPath The relative or absolute path to convert to an absolute path.
     *                              Relative paths are considered relative to the Caliper root folder.
     * @param {String} root_path root path to use
     * @return {String} The resolved absolute path.
     */
    static resolvePath(relOrAbsPath, root_path) {
        if (!relOrAbsPath) {
            throw new Error('Util.resolvePath: Parameter is undefined');
        }

        if (path.isAbsolute(relOrAbsPath)) {
            return relOrAbsPath;
        }

        return path.join(root_path, relOrAbsPath);
    }

    /**
     * parse a yaml file.
     * @param {String} filenameOrFilepath the yaml file path
     * @return {object} the parsed data.
     */
    static parseYaml(filenameOrFilepath) {
        if (!filenameOrFilepath) {
            throw new Error('Util.parseYaml: the name or path of a file is undefined');
        }

        try{
            return yaml.safeLoad(fs.readFileSync(filenameOrFilepath),'utf8');
        }
        catch(err) {
            throw new Error(`Failed to parse the ${filenameOrFilepath}: ${(err.message || err)}`);
        }
    }

    /**
     * Parse a YAML conform string into an object.
     * @param {string} stringContent The YAML content.
     * @return {object} The parsed object.
     */
    static parseYamlString(stringContent) {
        if (!stringContent) {
            throw new Error('Util.parseYaml: stringContent parameter is undefined or empty');
        }

        try{
            return yaml.safeLoad(stringContent);
        }
        catch(err) {
            throw new Error(`Failed to parse the YAML string: ${(err.message || err)}`);
        }
    }

    /**
     * Checks whether the given object is defined and not null.
     * @param {object} object The object to check.
     * @return {boolean} True, if the object is defined and not null. Otherwise false.
     */
    static checkDefined(object) {
        return object !== 'undefined' && object !== null;
    }

    /**
     * Throws an error if the object is undefined or null.
     * @param {object} object The object to check.
     * @param {string} msg Optional error message to throw in case of unsuccessful check.
     */
    static assertDefined(object, msg) {
        if (object === 'undefined' || object === null) {
            throw new Error(msg || 'Object is undefined or null!');
        }
    }

    /**
     * Checks whether the property exists on the object and it isn't undefined or null.
     * @param {object} object The object to check for the property.
     * @param {string} propertyName The name of the property to check.
     * @return {boolean} True, if the property exists and it's defined and not null. Otherwise false.
     */
    static checkProperty(object, propertyName) {
        return object.hasOwnProperty(propertyName) && object[propertyName] !== undefined &&
            object[propertyName] !== null;
    }

    /**
     * Throws an error if the property doesn't exists on the object or it's undefined or null.
     * @param {object} object The object to check for the property.
     * @param {string} objectName Optional error message to throw in case of an unsuccessful check.
     * @param {string} propertyName The name of the property to check.
     */
    static assertProperty(object, objectName, propertyName) {
        if (!object.hasOwnProperty(propertyName) || object[propertyName] === undefined ||
            object[propertyName] === null) {
            throw new Error(`Property '${propertyName}' of ${objectName || 'object'} is missing, undefined or null`);
        }
    }

    /**
     * Checks whether any of the given properties exists and is defined and is not null on the given object.
     * @param {object} object The object to check for the properties.
     * @param {string[]} propertyNames The list of property names to check.
     * @return {boolean} True if any of the given properties exists on the object and is defined and is not null. Otherwise false.
     */
    static checkAnyProperty(object, ...propertyNames) {
        for (let property of propertyNames) {
            if (CaliperUtils.checkProperty(object, property)) {
                return true; // found an existing property with a value
            }
            // else ignore it, maybe an other property will exist
        }

        // none of them exists
        return false;
    }

    /**
     * Throws an error if none of the given properties exists and is defined and is not null on the given object.
     * @param {object} object The object to check for the properties.
     * @param {string} objectName The name of the object
     * @param {string[]} propertyNames The list of property names to check.
     */
    static assertAnyProperty(object, objectName, ...propertyNames) {
        if (!CaliperUtils.checkAnyProperty(object, ...propertyNames)) {
            throw new Error(`None of the properties of ${objectName || 'object'} exists or has values: ${propertyNames.toString()}`);
        }
    }

    /**
     * Checks whether all of the given properties exist and are defined and are not null on the given object.
     * @param {object} object The object to check for the properties.
     * @param {string[]} propertyNames The list of property names to check.
     * @return {boolean} True if all of the given properties exist on the object and are defined and are not null. Otherwise false.
     */
    static checkAllProperties(object, ...propertyNames) {
        for (let property of propertyNames) {
            if (!CaliperUtils.checkProperty(object, property)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Throws an error if  any of the given properties exists and is defined and is not null on the given object.
     * @param {object} object The object to check for the properties.
     * @param {string} objectName The name of the object for the error message.
     * @param {string[]} propertyNames The list of property names to check.
     */
    static assertAllProperties(object, objectName, ...propertyNames) {
        for (let property of propertyNames) {
            CaliperUtils.assertProperty(object, objectName, property);
        }
    }
}

module.exports = CaliperUtils;
