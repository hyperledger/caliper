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
const cmdUtil = require('../utils/cmdutils');
const path = require('path');

const logger = CaliperUtils.getLogger('bind');

/**
 * Caliper benchmark Run command
 * @private
 */
class Bind {

    /**
    * Command process for the bind command.
    * @param {string} argv Argument list from the caliper bind command. Unused, relying on ConfigUtil instead.
    */
    static async handler(argv) {
        let sut = ConfigUtil.get(ConfigUtil.keys.Bind.Sut, undefined);
        let sdk = ConfigUtil.get(ConfigUtil.keys.Bind.Sdk, undefined);
        let cwd = ConfigUtil.get(ConfigUtil.keys.Bind.Cwd, undefined);
        let userArgs = ConfigUtil.get(ConfigUtil.keys.Bind.Args, undefined);

        let bindOptions = CaliperUtils.parseYaml(path.join(__dirname, './config.yaml'));

        let sutList = Object.keys(bindOptions.sut);
        if (!sut) {
            let msg = `SUT name is not specified. Available SUTs: ${sutList.join(' | ')}`;
            logger.error(msg);
            throw new Error(msg);
        }

        if (!sutList.includes(sut)) {
            let msg = `Unknown SUT name "${sut}". Available SUTs: ${sutList.join(' | ')}`;
            logger.error(msg);
            throw new Error(msg);
        }

        let sutSdkList = Object.keys(bindOptions.sut[sut]);
        if (!sdk) {
            let msg = `"${sut}" SDK version is not specified. Available versions: ${sutSdkList.join(' | ')}`;
            logger.error(msg);
            throw new Error(msg);
        }

        if (!sutSdkList.includes(sdk)) {
            let msg = `Unknown "${sut}" SDK version "${sdk}". Available versions: ${sutSdkList.join(' | ')}`;
            logger.error(msg);
            throw new Error(msg);
        }

        if (!cwd) {
            logger.warn(`Working directory for binding not specified. Using "${path.resolve('./')}"`);
            cwd = path.resolve('./');
        } else {
            cwd = path.resolve(cwd);
        }

        if (userArgs) {
            logger.info(`User-provided arguments for "npm install": "${userArgs}"`);
        }

        let bindSpec = bindOptions.sut[sut][sdk];
        let settings;

        // select the first matching setting, if any
        if (bindSpec.settings) {
            let nodeVersion;
            logger.info('Querying node version');
            try {
                nodeVersion = await cmdUtil.getCommandOutput('node', ['-v']);
            } catch (e) {
                logger.error(e.message);
                throw e;
            }
            logger.info(`Detected node version ${nodeVersion}`);

            for (let setting of bindSpec.settings) {
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

        logger.info(`Binding for ${sut}@${sdk}. This might take some time...`);
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

            let argArray = [ 'install' ];
            if (npmArgs) {
                // split by spaces
                argArray = argArray.concat(npmArgs.split(' '));
            }

            // add the packages at the end
            argArray = argArray.concat(bindSpec.packages);

            logger.info(`Binding working directory: ${cwd}`);
            logger.info(`Calling npm with: ${argArray.join(' ')}`);
            await cmdUtil.invokeCommand('npm', argArray, settings.env, path.resolve(cwd));
        } catch (e) {
            logger.error(e.message);
            throw e;
        }
    }
}

module.exports = Bind;
