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

const { CaliperUtils, ConfigUtil } = require('@hyperledger/caliper-core');

const fs = require('fs');
const path = require('path');

/**
 * Common class for the bind/unbind commands.
 */
class BindCommon {

    /**
     * Implementation of the bind/unbind command.
     * @param {object} argv Argument list from the caliper bind command. Unused, relying on ConfigUtil instead.
     * @param {boolean} binding Indicates whether binding should be performed, or unbinding.
     */
    static async handler(argv, binding) {
        const logger = CaliperUtils.getLogger(binding ? 'bind' : 'unbind');
        const defaultOpts = CaliperUtils.parseYaml(path.join(__dirname, './config.yaml'));

        let sutSpec = ConfigUtil.get(ConfigUtil.keys.Bind.Sut);
        if (!sutSpec) {
            let msg = `SUT is not specified. Available SUTs: ${Object.keys(defaultOpts.sut).join(' | ')}`;
            logger.error(msg);
            throw new Error(msg);
        }

        let sutSpecParts = sutSpec.split(':');
        if (sutSpecParts.length < 1 || sutSpecParts.length > 2) {
            let msg = `SUT specification is expected in the <SUT type>:<SDK version> format, not as "${sutSpec}"`;
            logger.error(msg);
            throw new Error(msg);
        }

        let sut = sutSpecParts[0];
        let sdk = sutSpecParts[1];
        if (!sdk) {
            logger.warn('SUT SDK version is not specified, defaulting to "latest"');
            sdk = 'latest';
        }

        let cwd = ConfigUtil.get(ConfigUtil.keys.Bind.Cwd);
        let userArgs = ConfigUtil.get(ConfigUtil.keys.Bind.Args);
        let file = ConfigUtil.get(ConfigUtil.keys.Bind.File);

        let options;
        if (file) {
            // User has passed a configuration file to bind
            file = CaliperUtils.resolvePath(file);
            if (!fs.existsSync(file)) {
                let msg = `Passed custom configuration file "${file}" does not exist`;
                logger.error(msg);
                throw new Error(msg);
            } else {
                options = CaliperUtils.parseYaml(file);
            }
        } else {
            options = defaultOpts;
        }

        // TODO: schema validation for the loaded configuration
        // until then, the error messages won't provide the available settings
        let sutList = Object.keys(options.sut);
        if (!sutList.includes(sut)) {
            let msg = `Unknown SUT type "${sut}"`;
            logger.error(msg);
            throw new Error(msg);
        }

        let sutSdkList = Object.keys(options.sut[sut]);
        if (!sutSdkList.includes(sdk)) {
            let msg = `Unknown "${sut}" SDK version "${sdk}"`;
            logger.error(msg);
            throw new Error(msg);
        }

        if (!cwd) {
            logger.warn(`Working directory not specified. Using "${path.resolve('./')}"`);
            cwd = path.resolve('./');
        } else {
            cwd = path.resolve(cwd);
        }

        if (userArgs) {
            logger.info(`User-provided arguments for npm: "${userArgs}"`);
        }

        let extraSpec = options.sut[sut][sdk];
        let settings;

        // select the first matching setting, if any
        if (extraSpec.settings) {
            let nodeVersion;
            logger.info('Querying node version');
            try {
                nodeVersion = await CaliperUtils.getCommandOutput('node', ['-v']);
            } catch (e) {
                logger.error(e.message);
                throw e;
            }
            logger.info(`Detected node version ${nodeVersion}`);

            for (let setting of extraSpec.settings) {
                let regex = new RegExp(setting.versionRegexp, 'g');
                if (regex.test(nodeVersion)) {
                    settings = setting;
                    break;
                }
            }

            if (!settings) {
                logger.warn(`None of the settings matched node ${nodeVersion} for ${sut}@${sdk}`);
                settings = {};
            }
        } else {
            settings = {};
        }

        logger.info(`${binding ? 'Binding for' : 'Unbinding from'} ${sut}@${sdk}. This might take some time...`);
        try {
            // combine, then convert the arguments to an array
            let npmArgs;
            if (!userArgs) {
                if (settings.args) {
                    npmArgs = settings.args;
                }
            } else {
                npmArgs = userArgs;
                if (settings.args) {
                    npmArgs += ` ${settings.args}`;
                }
            }

            let argArray = [ binding ? 'install' : 'uninstall' ];
            if (npmArgs) {
                // split by spaces
                argArray = argArray.concat(npmArgs.split(' '));
            }

            let packages = extraSpec.packages;
            // remove version numbers when unbinding
            if (!binding) {
                packages = packages.map(pkg => {
                    const versionIndex = pkg.lastIndexOf('@');
                    // the version @ can't be the first (and only) character
                    return versionIndex > 0 ? pkg.substring(0, versionIndex) : pkg;
                });
            }

            // add the packages at the end
            argArray = argArray.concat(packages);

            logger.info(`Using working directory: ${cwd}`);
            logger.info(`Calling npm with: ${argArray.join(' ')}`);
            await CaliperUtils.invokeCommand('npm', argArray,  { ...settings.env, ...process.env }, cwd);
        } catch (e) {
            logger.error(e.message);
            throw e;
        }
    }
}

module.exports = BindCommon;
