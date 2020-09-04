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

const loggingUtil = require('./logging-util.js');
const Config = require('../config/config-util');

const {exec, spawn} = require('child_process');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const url = require('url');
require('winston-daily-rotate-file');

const BuiltinConnectors = new Map([
    ['ethereum', '@hyperledger/caliper-ethereum'],
    ['fabric', '@hyperledger/caliper-fabric'],
    ['fisco-bcos', '@hyperledger/caliper-fisco-bcos']
]);

const BuiltinMessengers = new Map([
    ['process', path.join(__dirname, './../messengers/process/factory.js')],
    ['mqtt', path.join(__dirname, './../messengers/mqtt/factory.js')]
]);

/**
 * Internal Utility class for Caliper
 */
class CaliperUtils {

    /**
     * Indicates whether the process is a forked/child process, i.e., it has a parent process.
     * @return {boolean} True, if the process has a parent process. Otherwise, false.
     */
    static isForkedProcess() {
        return (process.send !== undefined) && (typeof process.send === 'function');
    }

    /**
     * Assert that the core configuration file paths are set and exist.
     */
    static assertConfigurationFilePaths() {
        // Workspace is expected to be the root location of working folders
        let workspacePath = Config.get(Config.keys.Workspace); // default is "./"
        workspacePath = path.resolve(workspacePath);

        // check benchmark config path
        let benchmarkConfigPath = Config.get(Config.keys.BenchConfig);
        if(!benchmarkConfigPath) {
            let msg = 'Benchmark configuration file path is not set';
            throw new Error(msg);
        }

        benchmarkConfigPath = CaliperUtils.resolvePath(benchmarkConfigPath);
        if(!fs.existsSync(benchmarkConfigPath)) {
            let msg = `Benchmark configuration file "${benchmarkConfigPath}" does not exist`;
            throw new Error(msg);
        }

        // check network config path
        let networkConfigPath = Config.get(Config.keys.NetworkConfig);
        if(!networkConfigPath) {
            let msg = 'Network configuration file path is not set';
            throw new Error(msg);
        }

        networkConfigPath = CaliperUtils.resolvePath(networkConfigPath, workspacePath);
        if(!fs.existsSync(networkConfigPath)) {
            let msg = `Network configuration file "${networkConfigPath}" does not exist`;
            throw new Error(msg);
        }

        let networkConfig = CaliperUtils.parseYaml(networkConfigPath);
        if (!networkConfig.caliper || !networkConfig.caliper.blockchain || (typeof networkConfig.caliper.blockchain !== 'string')) {
            let msg = `Network configuration file "${networkConfigPath}" is missing its "caliper.blockchain" string attribute`;
            throw new Error(msg);
        }
    }

    /**
     * Get the mapping of simple builtin connector names to fully qualified package names.
     * @return {Map<string, string>} The mapping from simple names to package names.
     */
    static getBuiltinConnectorPackageNames() {
        return BuiltinConnectors;
    }

    /**
     * Get the mapping of simple builtin messenger names to fully qualified factory paths.
     * @return {Map<string, string>} The mapping from simple names to factory paths.
     */
    static getBuiltinMessengers() {
        return BuiltinMessengers;
    }

    /**
     * Loads the module at the given path.
     * @param {string} modulePath The path to the module or its name.
     * @param {Function} requireFunction The "require" function (with appropriate scoping) to use to load the module.
     * @return {object} The loaded module.
     */
    static loadModule(modulePath, requireFunction = require) {
        try {
            return requireFunction(modulePath);
        } catch (err) {
            throw new Error(`Module "${modulePath}" could not be loaded: ${err}\nSearched paths: ${module.paths}`);
        }
    }

    /**
     * Loads the given function from the given module.
     * @param {object} module The module exporting the function.
     * @param {string} functionName The name of the function.
     * @param {string} moduleName The name of the module.
     * @return {function} The loaded function.
     */
    static loadFunction(module, functionName, moduleName) {
        const func = module[functionName];
        if (!func || typeof func !== 'function') {
            throw new Error(`Function "${functionName}" could not be loaded for module "${moduleName}"`);
        }

        return func;
    }

    /**
     * Loads the given function from the module at the given path.
     * @param {Map<string, string>} builtInModules The mapping of built-in module names to their path.
     * @param {string} moduleName The name of the module.
     * @param {string} functionName The name of the function.
     * @param {Function} requireFunction The "require" function (with appropriate scoping) to use to load the module.
     * @return {Function} The loaded function.
     */
    static loadModuleFunction(builtInModules, moduleName, functionName, requireFunction = require) {
        let modulePath;

        // get correct module path
        if (builtInModules.has(moduleName)) {
            modulePath = builtInModules.get(moduleName);
        } else if (moduleName.startsWith('./') || moduleName.startsWith('/') || moduleName.endsWith('.js')) {
            // treat it as an external module, but resolve the path, so it's absolute
            modulePath = CaliperUtils.resolvePath(moduleName);
        } else {
            // treat it as a package dependency (user must install it beforehand)
            modulePath = moduleName;
        }

        let module = CaliperUtils.loadModule(modulePath, requireFunction);
        return CaliperUtils.loadFunction(module, functionName, moduleName);
    }

    /**
     * Check if a named module is installed and accessible by caliper
     * @param {string} moduleName the name of the module to check
     * @param {Function} requireFunction The "require" function (with appropriate scoping) to use to load the module.
     * @returns {boolean} boolean value for existence of accessible package
     */
    static moduleIsInstalled(moduleName, requireFunction = require) {
        let modulePath;
        if (moduleName.startsWith('./') || moduleName.startsWith('/')) {
            // treat it as an external module, but resolve the path, so it's absolute
            modulePath = CaliperUtils.resolvePath(moduleName);
        } else {
            // treat it as a package dependency (user must install it beforehand)
            modulePath = moduleName;
        }

        try {
            CaliperUtils.loadModule(modulePath, requireFunction);
            return true;
        } catch (err) {

            if (err.message.includes(`Cannot find module '${moduleName}'`)) {
                // If the expected module can not be found, it's not an error to throw
                return false;
            }

            throw err;
        }
    }

    /**
     * Utility function to check for singleton values
     * @param {string[]} passedArgs arguments passed by user
     * @param {string[]} uniqueArgs arguments that must be unique
     * @returns {boolean} boolean true if passes check
     */
    static checkSingleton(passedArgs, uniqueArgs) {
        uniqueArgs.forEach((e) => {
            if (Array.isArray(passedArgs[e])) {
                throw new Error(`Option [${e}] can only be specified once`);
            }
        });
        return true;
    }

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
     * @returns {Logger} The configured logger instance.
     */
    static getLogger(name) {
        // logger should be accessed through the Util class
        // but delegates to logging-util.js
        return loggingUtil.getLogger(name);
    }

    /**
     * Creates an absolute path from the provided relative path if necessary.
     * @param {String} relOrAbsPath The relative or absolute path to convert to an absolute path.
     *                              Relative paths are considered relative to the Caliper root folder.
     * @param {String} root_path root path to use
     * @return {String} The resolved absolute path.
     */
    static resolvePath(relOrAbsPath, root_path = undefined) {
        if (!relOrAbsPath) {
            throw new Error('Util.resolvePath: Parameter is undefined');
        }

        if (path.isAbsolute(relOrAbsPath)) {
            return relOrAbsPath;
        }

        return path.resolve(root_path || Config.get(Config.keys.Workspace), relOrAbsPath);
    }

    /**
     * parse a yaml file.
     * @param {String} filenameOrFilePath the yaml file path
     * @return {object} the parsed data.
     */
    static parseYaml(filenameOrFilePath) {
        if (!filenameOrFilePath) {
            throw new Error('Util.parseYaml: the name or path of a file is undefined');
        }

        try{
            return yaml.safeLoad(fs.readFileSync(filenameOrFilePath),'utf8');
        }
        catch(err) {
            throw new Error(`Failed to parse the ${filenameOrFilePath}: ${(err.message || err)}`);
        }
    }

    /**
     * Convert an object to YAML string.
     * @param {object} obj The object to stringify.
     * @return {string} The string YAML content.
     */
    static stringifyYaml(obj) {
        if (!obj) {
            throw new Error('Util.stringifyYaml: object to stringify is undefined');
        }

        try{
            return yaml.safeDump(obj);
        }
        catch(err) {
            throw new Error(`Failed to stringify object: ${(err.message || err)}`);
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

    /**
     * Executes the given command asynchronously.
     * @param {string} command The command to execute through a newly spawn shell.
     * @param {boolean} logAction Boolean flag to inform the command being run, default true
     * @return {Promise} The return promise is resolved upon the successful execution of the command, or rejected with an Error instance.
     * @async
     */
    static execAsync(command, logAction = true) {
        const logger = CaliperUtils.getLogger('caliper-utils');
        return new Promise((resolve, reject) => {
            if (logAction) {
                logger.info(`Executing command: ${command}`);
            }
            let child = exec(command, (err, stdout, stderr) => {
                if (err) {
                    logger.error(`Unsuccessful command execution. Error code: ${err.code}. Terminating signal: ${err.signal}`);
                    return reject(err);
                }
                return resolve();
            });
            child.stdout.pipe(process.stdout);
            child.stderr.pipe(process.stderr);
        });
    }

    /**
     * Invokes a given command in a spawned child process and attaches all standard IO.
     * @param {string} cmd The command to be run.
     * @param {string[]} args The array of arguments to pass to the command.
     * @param {Map<string, string>} env The key-value pairs of environment variables to set.
     * @param {string} cwd The current working directory to set.
     * @returns {Promise} A Promise that is resolved or rejected.
     */
    static invokeCommand(cmd, args, env, cwd) {
        return new Promise((resolve, reject) => {
            let proc = spawn(cmd, args, {
                stdio: 'inherit',
                cwd: cwd || './',
                env: env || process.env
            });

            proc.on('exit', (code, signal) => {
                if(code !== 0) {
                    return reject(new Error(`Failed to execute "${cmd}" with return code ${code}.${signal ? ` Signal: ${signal}` : ''}`));
                }
                resolve();
            });
        });
    }

    /**
     * Invokes a given command in a spawned child process and returns its output.
     * @param {string} cmd The command to be run.
     * @param {string[]} args The array of arguments to pass to the command.
     * @param {object} env The key-value pairs of environment variables to set.
     * @param {string} cwd The current working directory to set.
     * @returns {Promise} A Promise that is resolved with the command output or rejected with an Error.
     */
    static getCommandOutput(cmd, args, env = {}, cwd = './') {
        return new Promise((resolve, reject) => {
            let output = '';
            let proc = spawn(cmd, args, {
                cwd: cwd,
                env: { ...env, ...process.env }
            });

            proc.stdout.on('data', (data) => {
                output += data.toString();
            });

            proc.on('exit', (code, signal) => {
                if(code !== 0) {
                    return reject(new Error(`Failed to execute "${cmd}" with return code ${code}.${signal ? ` Signal: ${signal}` : ''}`));
                }
                resolve(output.trim());
            });
        });
    }

    /**
     * Retrieve user specified flow flags
     * @returns {JSON} a JSON object containing conditioned flow options
     */
    static getFlowOptions() {
        // High level flow default options
        const flowOpts = {
            performStart: true,
            performInit: true,
            performInstall: true,
            performTest: true,
            performEnd: true
        };

        let skip = 0;
        let only = 0;

        if (Config.get(Config.keys.Flow.Skip.Start, false)) {
            flowOpts.performStart = false;
            skip++;
        }

        if (Config.get(Config.keys.Flow.Skip.Init, false)) {
            flowOpts.performInit = false;
            skip++;
        }

        if (Config.get(Config.keys.Flow.Skip.Install, false)) {
            flowOpts.performInstall = false;
            skip++;
        }

        if (Config.get(Config.keys.Flow.Skip.Test, false)) {
            flowOpts.performTest = false;
            skip++;
        }

        if (Config.get(Config.keys.Flow.Skip.End, false)) {
            flowOpts.performEnd = false;
            skip++;
        }

        if (Config.get(Config.keys.Flow.Only.Start, false)) {
            flowOpts.performInit = false;
            flowOpts.performInstall = false;
            flowOpts.performTest = false;
            flowOpts.performEnd = false;
            only++;
        }

        if (Config.get(Config.keys.Flow.Only.Init, false)) {
            flowOpts.performStart = false;
            flowOpts.performInstall = false;
            flowOpts.performTest = false;
            flowOpts.performEnd = false;
            only++;
        }

        if (Config.get(Config.keys.Flow.Only.Install, false)) {
            flowOpts.performStart = false;
            flowOpts.performInit = false;
            flowOpts.performTest = false;
            flowOpts.performEnd = false;
            only++;
        }

        if (Config.get(Config.keys.Flow.Only.Test, false)) {
            flowOpts.performStart = false;
            flowOpts.performInit = false;
            flowOpts.performInstall = false;
            flowOpts.performEnd = false;
            only++;
        }

        if (Config.get(Config.keys.Flow.Only.End, false)) {
            flowOpts.performStart = false;
            flowOpts.performInit = false;
            flowOpts.performInstall = false;
            flowOpts.performTest = false;
            only++;
        }

        if (skip && only) {
            throw new Error('Incompatible benchmark flow parameters specified, caliper-flow-skip-x and caliper-flow-only-x flags may not be mixed');
        }

        if (only > 1) {
            throw new Error('Incompatible benchmark flow parameters specified, only one of [caliper-flow-only-start, caliper-flow-only-init, caliper-flow-only-install, caliper-flow-only-test, caliper-flow-only-end] may be specified at a time');
        }

        return flowOpts;

    }

    /**
     * Convert milliseconds to seconds
     * @param {number} value to convert
     * @returns {number} the converted value
     */
    static millisToSeconds(value) {
        return value / 1000;
    }

    /**
     * Augment the passed URL with basic auth if the settings are present
     * @param {string} urlPath the URL to augment
     * @param {string} component the component being augmented
     * @returns {string} the URL to be used, which may have been augmented with basic auth
     */
    static augmentUrlWithBasicAuth(urlPath, component) {
        const username = Config.get(Config.keys.Auth[component].UserName, undefined);
        const password = Config.get(Config.keys.Auth[component].Password, undefined);
        if (username && password) {
            const myURL = new url.URL(urlPath);
            myURL.username = username;
            myURL.password = password;
            return url.format(myURL);
        } else {
            return urlPath;
        }
    }

}

module.exports = CaliperUtils;
