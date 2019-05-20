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

const {CaliperFlow, CaliperUtils} = require('caliper-core');
const chalk = require('chalk');
const cmdUtil = require('../../utils/cmdutils');
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
        let benchConfigFile;
        let blockchainConfigFile;
        let workspace;

        // Workspace is expected to be the root location of working folders
        workspace = path.resolve(argv.workspace);
        benchConfigFile = path.isAbsolute(argv.benchConfig) ? argv.benchConfig : path.join(workspace, argv.benchConfig);
        blockchainConfigFile = path.isAbsolute(argv.blockchainConfig) ? argv.blockchainConfig : path.join(workspace, argv.blockchainConfig);

        if(!fs.existsSync(benchConfigFile)) {
            throw(new Error('Configuration file ' + benchConfigFile + ' does not exist'));
        }

        if(!fs.existsSync(blockchainConfigFile)) {
            throw(new Error('Configuration file ' + blockchainConfigFile + ' does not exist'));
        }

        let blockchainType = '';
        let networkObject = CaliperUtils.parseYaml(blockchainConfigFile);
        if (networkObject.hasOwnProperty('caliper') && networkObject.caliper.hasOwnProperty('blockchain')) {
            blockchainType = networkObject.caliper.blockchain;
        } else {
            throw new Error('The configuration file [' + blockchainConfigFile + '] is missing its "caliper.blockchain" attribute');
        }

        try {
            cmdUtil.log(chalk.blue.bold('Benchmark for target Blockchain type ' + blockchainType + ' about to start'));
            const {AdminClient, ClientFactory} = require('caliper-' + blockchainType);
            const adminClient = new AdminClient(blockchainConfigFile, workspace);
            const clientFactory = new ClientFactory(blockchainConfigFile, workspace);

            const response = await CaliperFlow.run(benchConfigFile, blockchainConfigFile, adminClient, clientFactory, workspace);

            if (response === 0) {
                cmdUtil.log(chalk.blue.bold('Benchmark run successful'));
            } else {
                cmdUtil.log(chalk.red.bold('Benchmark failure'));
                throw new Error('Benchmark failure');
            }
        } catch (err) {
            throw err;
        }
    }
}

module.exports = RunBenchmark;
