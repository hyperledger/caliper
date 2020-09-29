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

const fs = require('fs');
const path = require('path');
const nconf = require('nconf');

nconf.formats.yaml = require('nconf-yaml');

const keys = {
    Auth: {
        PrometheusPush: {
            UserName: 'caliper-auth-prometheuspush-username',
            Password: 'caliper-auth-prometheuspush-password'
        },
        Prometheus: {
            UserName: 'caliper-auth-prometheus-username',
            Password: 'caliper-auth-prometheus-password'
        }
    },
    Bind: {
        Sut: 'caliper-bind-sut',
        Args: 'caliper-bind-args',
        Cwd: 'caliper-bind-cwd',
        File: 'caliper-bind-file'
    },
    Report: {
        Path: 'caliper-report-path',
        Options: 'caliper-report-options',
        Precision: 'caliper-report-precision',
        Charting: {
            Hue: 'caliper-report-charting-hue',
            Scheme: 'caliper-report-charting-scheme',
            Transparency: 'caliper-report-charting-transparency'
        }
    },
    Progress: {
        Reporting: {
            Enabled: 'caliper-progress-reporting-enabled',
            Interval: 'caliper-progress-reporting-interval'
        }
    },
    Monitor: {
        Interval: 'caliper-monitor-interval'
    },
    Observer: {
        Internal: {
            Interval: 'caliper-observer-internal-interval'
        },
        Prometheus: {
            ScrapePort: 'caliper-observer-prometheus-scrapeport'
        },
        PrometheusPush: {
            Interval: 'caliper-observer-prometheuspush-interval'
        }
    },
    Workspace: 'caliper-workspace',
    ProjectConfig: 'caliper-projectconfig',
    UserConfig: 'caliper-userconfig',
    MachineConfig: 'caliper-machineconfig',
    BenchConfig: 'caliper-benchconfig',
    NetworkConfig: 'caliper-networkconfig',
    MonitorConfig: 'caliper-monitorconfig',
    LoggingRoot: 'caliper-logging',
    Logging: {
        Template: 'caliper-logging-template',
        FormatsRoot: 'caliper-logging-formats',
        Formats: {
            Timestamp: 'caliper-logging-formats-timestamp',
            Label: 'caliper-logging-formats-label',
            JsonRoot: 'caliper-logging-formats-json',
            Json: {
                Space: 'caliper-logging-formats-json-space'
            },
            Pad: 'caliper-logging-formats-pad',
            Align: 'caliper-logging-formats-align',
            AttributeFormatRoot: 'caliper-logging-formats-attributeformat',
            AttributeFormat: {
                Timestamp: 'caliper-logging-formats-attributeformat-timestamp',
                Label: 'caliper-logging-formats-attributeformat-label',
                Level: 'caliper-logging-formats-attributeformat-level',
                Module: 'caliper-logging-formats-attributeformat-module',
                Message: 'caliper-logging-formats-attributeformat-message',
                Metadata: 'caliper-logging-formats-attributeformat-metadata'
            },
            ColorizeRoot: 'caliper-logging-formats-colorize',
            Colorize: {
                All: 'caliper-logging-formats-colorize-all',
                Timestamp: 'caliper-logging-formats-colorize-timestamp',
                Label: 'caliper-logging-formats-colorize-label',
                Level: 'caliper-logging-formats-colorize-level',
                Module: 'caliper-logging-formats-colorize-module',
                Message: 'caliper-logging-formats-colorize-message',
                Metadata: 'caliper-logging-formats-colorize-metadata',
                Colors: {
                    Info: 'caliper-logging-formats-colorize-colors-info',
                    Error: 'caliper-logging-formats-colorize-colors-error',
                    Warn: 'caliper-logging-formats-colorize-colors-warn',
                    Debug: 'caliper-logging-formats-colorize-colors-debug',
                }
            },
        },
        Targets: 'caliper-logging-targets'
    },
    Worker: {
        Remote: 'caliper-worker-remote',
        PollInterval: 'caliper-worker-pollinterval',
        Communication: {
            Method: 'caliper-worker-communication-method',
            Address: 'caliper-worker-communication-address',
        }
    },
    Flow: {
        Skip: {
            Start : 'caliper-flow-skip-start',
            Init: 'caliper-flow-skip-init',
            Install: 'caliper-flow-skip-install',
            Test: 'caliper-flow-skip-test',
            End: 'caliper-flow-skip-end'
        },
        Only: {
            Start: 'caliper-flow-only-start',
            Init: 'caliper-flow-only-init',
            Install: 'caliper-flow-only-install',
            Test: 'caliper-flow-only-test',
            End: 'caliper-flow-only-end'
        }
    },
    Fabric: {
        SleepAfter: {
            CreateChannel: 'caliper-fabric-sleepafter-createchannel',
            JoinChannel: 'caliper-fabric-sleepafter-joinchannel',
            InstantiateContract: 'caliper-fabric-sleepafter-instantiatecontract',
        },
        Verify: {
            ProposalResponse: 'caliper-fabric-verify-proposalresponse',
            ReadWriteSets: 'caliper-fabric-verify-readwritesets',
        },
        Timeout: {
            ContractInstantiate: 'caliper-fabric-timeout-contractinstantiate',
            ContractInstantiateEvent: 'caliper-fabric-timeout-contractinstantiateevent',
            InvokeOrQuery: 'caliper-fabric-timeout-invokeorquery',
        },
        LoadBalancing: 'caliper-fabric-loadbalancing',
        OverwriteGopath: 'caliper-fabric-overwritegopath',
        LatencyThreshold: 'caliper-fabric-latencythreshold',
        CountQueryAsLoad: 'caliper-fabric-countqueryasload',
        SkipCreateChannelPrefix: 'caliper-fabric-skipcreatechannel-',
        Gateway: {
            Discovery: 'caliper-fabric-gateway-discovery',
            Enabled: 'caliper-fabric-gateway-enabled',
            EventStrategy: 'caliper-fabric-gateway-eventstrategy',
            LocalHost: 'caliper-fabric-gateway-localhost',
            QueryStrategy: 'caliper-fabric-gateway-querystrategy',
        }
    }
};

/**
 * Normalizes the key of the given setting.
 * @param {{key: string, value: any}} kvPair The setting as a key-value pair.
 * @return {{key: string, value: any}} The setting with the modified key.
 */
function normalizeSettingKey(kvPair) {
    let newKey = kvPair.key.toLowerCase().replace(/[_]/g, '-');
    // only change the command line argument or environment variable name for Caliper settings
    if (newKey.startsWith('caliper-')) {
        kvPair.key = newKey;
    }

    return kvPair;
}

/**
 * Returns the settings for parsing a configuration file.
 * @param {string} filename The path of the configuration file.
 * @return {{file: string, logicalSeparator: string, format: object}} The parsing options.
 */
function getFileParsingOptions(filename) {
    return { file: filename, logicalSeparator: '-', format: nconf.formats.yaml };
}

/**
 * Creates an absolute path from the provided relative path if necessary.
 * @param {String} relOrAbsPath The relative or absolute path to convert to an absolute path.
 *                              Relative paths are considered relative to the Caliper root folder.
 * @param {String} root_path root path to use
 * @return {String} The resolved absolute path.
 */
function resolvePath(relOrAbsPath, root_path) {
    if (!relOrAbsPath) {
        throw new Error('Config.resolvePath: Parameter is undefined');
    }

    if (path.isAbsolute(relOrAbsPath)) {
        return relOrAbsPath;
    }

    return path.join(root_path, relOrAbsPath);
}

/**
 * The class encapsulating the hierarchy of runtime configurations.
 * @type {Config}
 */
class Config {
    /**
     * Constructor
     */
    constructor() {
        // create own instance in case other dependencies also use nconf
        this._config = new nconf.Provider();

        ///////////////////////////////////////////////////////////////////////////////
        // the priority is the following:                                            //
        // memory > commandline args > environment variables > project config file > //
        // > user config file > machine config file > default config file            //
        ///////////////////////////////////////////////////////////////////////////////

        this._config.use('memory');

        // normalize the argument names to be more robust
        this._config.argv({ parseValues: true, transform: normalizeSettingKey });

        // normalize the argument names to be more robust
        this._config.env({ parseValues: true, transform: normalizeSettingKey });

        // if "caliper-projectconfig" is set at this point, include that file
        let projectConf = this.get(keys.ProjectConfig, undefined);
        if (projectConf && (typeof projectConf === 'string')) {
            let projectConfFile = resolvePath(projectConf, this.get(keys.Workspace, '.'));
            this._config.file('project', getFileParsingOptions(projectConfFile));
        } else {
            // check whether caliper.yaml is present in the workspace directory for convenience
            let projectConfFile = resolvePath('caliper.yaml', this.get(keys.Workspace, '.'));
            if (fs.existsSync(projectConfFile)) {
                this._config.file('project', getFileParsingOptions(projectConfFile));
            }
        }

        // if "caliper-userconfig" is set at this point, include that file
        let userConfig = this.get(keys.UserConfig, undefined);
        if (userConfig && (typeof userConfig === 'string')) {
            let userConfFile = resolvePath(userConfig, this.get(keys.Workspace, '.'));
            this._config.file('user', getFileParsingOptions(userConfFile));
        }

        // if "caliper-machineconfig" is set at this point, include that file
        let machineConfig = this.get(keys.MachineConfig, undefined);
        if (machineConfig && (typeof machineConfig === 'string')) {
            let machineConfFile = resolvePath(machineConfig, this.get(keys.Workspace, '.'));
            this._config.file('machine', getFileParsingOptions(machineConfFile));
        }

        // as fallback, always include the default config packaged with Caliper
        const defaultConfig = path.join(__dirname, 'default.yaml');
        this._config.file('default', getFileParsingOptions(defaultConfig));
    }

    /**
     * Get the config setting with name.
     * If the setting is not found, returns the provided default value.
     * @param {string} name Key/name of the setting.
     * @param {any} defaultValue The default value to return if the setting is not found.
     * @return {any} Value of the setting
     */
    get(name, defaultValue) {
        let value = null;

        try {
            value = this._config.get(name);
        }
        catch(err) {
            value = defaultValue;
        }

        // NOTE: can't use !value, since a falsey value could be a valid setting
        if(value === null || value === undefined) {
            value = defaultValue;
        }

        return value;
    }

    /**
     * Set a value into the 'memory' store of config settings.
     * This will override all other settings.
     * @param {string} name name of the setting
     * @param {any} value value of the setting
     */
    set(name, value) {
        this._config.set(name,value);
    }
}

module.exports = Config;
module.exports.keys = keys;

