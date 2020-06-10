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

const { CaliperUtils, ConfigUtil, Messenger, MessageHandler } = require('@hyperledger/caliper-core');
const BindCommon = require('./../../lib/bindCommon');
const logger = CaliperUtils.getLogger('cli-launch-worker');

/**
 * Caliper command for launching a worker process.
 */
class LaunchWorker {

    /**
    * Command processing for the Launch Worker command.
    * @param {object} argv Argument list from the caliper Launch Master command. Unused, relying on ConfigUtil instead.
    */
    static async handler(argv) {
        CaliperUtils.assertConfigurationFilePaths();

        // Workspace is expected to be the root location of working folders
        let workspacePath = CaliperUtils.resolvePath(ConfigUtil.get(ConfigUtil.keys.Workspace));
        let benchmarkConfigPath = CaliperUtils.resolvePath(ConfigUtil.get(ConfigUtil.keys.BenchConfig));
        let networkConfigPath = CaliperUtils.resolvePath(ConfigUtil.get(ConfigUtil.keys.NetworkConfig));

        let sutType = CaliperUtils.parseYaml(networkConfigPath).caliper.blockchain;
        let bindingSpec = ConfigUtil.get(ConfigUtil.keys.Bind.Sut);

        if (bindingSpec) {
            if (CaliperUtils.isForkedProcess()) {
                logger.info('Worker is a locally forked process, skipping binding step already performed by the master process');
            }
            else {
                logger.info(`Binding specification is present, performing binding for "${bindingSpec}"`);
                await BindCommon.handler(argv, true, sutType);
            }
        }

        logger.info(`Set workspace path: ${workspacePath}`);
        logger.info(`Set benchmark configuration path: ${benchmarkConfigPath}`);
        logger.info(`Set network configuration path: ${networkConfigPath}`);
        logger.info(`Set SUT type: ${bindingSpec || sutType}`);

        let messagingMethod = ConfigUtil.get(ConfigUtil.keys.Worker.Communication.Method);
        let isRemoteProcess = ConfigUtil.get(ConfigUtil.keys.Worker.Remote);

        if (messagingMethod === 'process' && !CaliperUtils.isForkedProcess()) {
            const msg = 'Process-based communication is configured for the worker, but it does not have a parent process';
            logger.error(msg);
            throw new Error(msg);
        }

        if (messagingMethod === 'process' && isRemoteProcess) {
            const msg = 'Process-based communication is configured for the worker, but the worker is configured as a remote process';
            logger.error(msg);
            throw new Error(msg);
        }

        let adapterFactory = CaliperUtils.loadModuleFunction(CaliperUtils.getBuiltinAdapterPackageNames(),
            sutType, 'AdapterFactory', require);

        // Create the message client using the specified type
        const type = `${messagingMethod}-worker`;
        const messenger = new Messenger({type, sut: sutType});
        await messenger.initialize();

        // Create a handler context for this worker
        const handlerContext = new MessageHandler({
            init: adapterFactory
        }, messenger);

        // Pass to the messenger to configure
        await messenger.configure(handlerContext);
    }
}

module.exports = LaunchWorker;
