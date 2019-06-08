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

const {CaliperUtils, CaliperZooClient} = require('caliper-core');
const chalk = require('chalk');
const cmdUtil = require('../../utils/cmdutils');
const path = require('path');
const fs = require('fs');

/**
 * Star a zoo client
 */
class StartZooClient {

    /**
    * Command process for start zookeeper command
    * @param {string} argv argument list from caliper command
    */
    static async handler(argv) {
        let blockchainConfigFile;
        let workspace;

        // Workspace is expected to be the root location of working folders
        workspace = path.resolve(argv.workspace);
        blockchainConfigFile = path.isAbsolute(argv.blockchainConfig) ? argv.blockchainConfig : path.join(workspace, argv.blockchainConfig);

        if(!fs.existsSync(blockchainConfigFile)) {
            throw(new Error('Configuration file ' + blockchainConfigFile + ' does not exist'));
        }

        let blockchainType = '';
        let networkObject = CaliperUtils.parseYaml(blockchainConfigFile);
        if (networkObject.hasOwnProperty('caliper') && networkObject.caliper.hasOwnProperty('blockchain')) {
            blockchainType = networkObject.caliper.blockchain;
        } else {
            throw new Error('The ' + blockchainConfigFile + ' has no blockchain type');
        }

        try {
            cmdUtil.log(chalk.blue.bold('Starting zookeeper client of type ' + blockchainType));
            const {ClientFactory} = require('caliper-' + blockchainType);
            const clientFactory = new ClientFactory(blockchainConfigFile, workspace);

            const zooClient = new CaliperZooClient(argv.address, clientFactory, workspace);
            zooClient.start();
        } catch (err) {
            throw err;
        }
    }
}

module.exports = StartZooClient;
