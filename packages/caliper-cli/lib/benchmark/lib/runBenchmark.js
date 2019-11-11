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

const {CaliperEngine, CaliperUtils, ConfigUtil} = require('@hyperledger/caliper-core');
const logger = CaliperUtils.getLogger('CLI');
const path = require('path');
const fs = require('fs');
/**
 * Caliper benchmark Run command
 * @private
 */
class RunBenchmark {

    /**
    * Command process for run benchmark command
    * @param {string} argv argument list from caliper benchmark command
    */
    static async handler(argv) {
        let workspacePath = ConfigUtil.get(ConfigUtil.keys.Workspace);
        let benchmarkConfigPath = ConfigUtil.get(ConfigUtil.keys.BenchConfig);
        let networkConfigPath = ConfigUtil.get(ConfigUtil.keys.NetworkConfig);

        // Workspace is expected to be the root location of working folders
        workspacePath = path.resolve(workspacePath);
        benchmarkConfigPath = CaliperUtils.resolvePath(benchmarkConfigPath, workspacePath);
        networkConfigPath = CaliperUtils.resolvePath(networkConfigPath, workspacePath);

        if(!benchmarkConfigPath || !fs.existsSync(benchmarkConfigPath)) {
            let msg = `Benchmark configuration file "${benchmarkConfigPath || 'UNSET'}" does not exist`;
            logger.error(msg);
            throw new Error(msg);
        }

        if(!networkConfigPath || !fs.existsSync(networkConfigPath)) {
            let msg = `Network configuration file "${networkConfigPath || 'UNSET'}" does not exist`;
            logger.error(msg);
            throw new Error(msg);
        }

        let benchmarkConfig = CaliperUtils.parseYaml(benchmarkConfigPath);
        let networkConfig = CaliperUtils.parseYaml(networkConfigPath);

        let blockchainType = '';
        if (networkConfig.caliper && networkConfig.caliper.blockchain) {
            blockchainType = networkConfig.caliper.blockchain;
        } else {
            let msg = `Network configuration file "${networkConfigPath}" is missing its "caliper.blockchain" attribute`;
            logger.error(msg);
            throw new Error(msg);
        }

        let knownError = false;

        try {
            logger.info(`Set workspace path: ${workspacePath}`);
            logger.info(`Set benchmark configuration path: ${benchmarkConfigPath}`);
            logger.info(`Set network configuration path: ${networkConfigPath}`);
            logger.info(`Detected SUT type: ${blockchainType}`);

            const {AdminClient, ClientFactory} = require(`@hyperledger/caliper-${blockchainType}`);
            const blockchainAdapter = new AdminClient(networkConfigPath, workspacePath);
            const workerFactory = new ClientFactory();

            const engine = new CaliperEngine(benchmarkConfig, networkConfig, blockchainAdapter, workerFactory);
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
                logger.error(`Unexpected error during benchmark execution: ${err.stack || err}`);
            }
            throw err;
        }
    }
}

module.exports = RunBenchmark;
