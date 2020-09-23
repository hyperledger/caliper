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
const { CaliperEngine, CaliperUtils, ConfigUtil, Constants } = require('@hyperledger/caliper-core');
const BindCommon = require('../../lib/bindCommon');
const logger = CaliperUtils.getLogger('cli-launch-manager');

/**
 * Caliper command for launching a manager process.
 */
class LaunchManager {

    /**
    * Command processing for the Launch Manager command.
    * @param {object} argv Argument list from the caliper Launch Manager command. Unused, relying on ConfigUtil instead.
    */
    static async handler(argv) {
        CaliperUtils.assertConfigurationFilePaths();

        // Workspace is expected to be the root location of working folders
        let workspacePath = path.resolve(ConfigUtil.get(ConfigUtil.keys.Workspace));
        let benchmarkConfigPath = CaliperUtils.resolvePath(ConfigUtil.get(ConfigUtil.keys.BenchConfig));
        let networkConfigPath = CaliperUtils.resolvePath(ConfigUtil.get(ConfigUtil.keys.NetworkConfig));

        let benchmarkConfig = CaliperUtils.parseYaml(benchmarkConfigPath);
        let networkConfig = CaliperUtils.parseYaml(networkConfigPath);

        let sutType = networkConfig.caliper.blockchain;
        let bindingSpec = ConfigUtil.get(ConfigUtil.keys.Bind.Sut);

        if (bindingSpec) {
            logger.info(`Binding specification is present, performing binding for "${bindingSpec}"`);
            await BindCommon.handler(argv, true);
        }

        let knownError = false;

        try {
            logger.info(`Set workspace path: ${workspacePath}`);
            logger.info(`Set benchmark configuration path: ${benchmarkConfigPath}`);
            logger.info(`Set network configuration path: ${networkConfigPath}`);
            logger.info(`Set SUT type: ${sutType}`);

            let connectorFactory = CaliperUtils.loadModuleFunction(CaliperUtils.getBuiltinConnectorPackageNames(),
                sutType, Constants.Factories.Connector, require);

            const engine = new CaliperEngine(benchmarkConfig, networkConfig, connectorFactory);
            const response = await engine.run();

            if (response === 0) {
                logger.info('Benchmark successfully finished');
            } else {
                knownError = true;
                let msg = `Benchmark failed with error code ${response}`;
                logger.error(msg);
                throw new Error(msg);
            }
        } catch (err) {
            if (!knownError) {
                logger.error(`Unexpected error during benchmark execution: ${err}`);
            }
            throw err;
        }
    }
}

module.exports = LaunchManager;
