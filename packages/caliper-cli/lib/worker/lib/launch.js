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
const Bind = require('../../bind/bind');
const logger = CaliperUtils.getLogger('launch');

/**
 * Caliper worker Launch command
 * @private
 */
class Launch {

    /**
    * Command process for the Launch command.
    * @param {string} argv Argument list from the caliper Launch command. Unused, relying on ConfigUtil instead.
    */
    static async handler(argv) {
        let sut = ConfigUtil.get(ConfigUtil.keys.Bind.Sut, undefined);
        let sdk = ConfigUtil.get(ConfigUtil.keys.Bind.Sdk, undefined);

        // only valid command if distributed workers
        if (!ConfigUtil.get(ConfigUtil.keys.Worker.Remote, false)) {
            const msg = 'Configuration definition indicates that worker is not remote: worker launch is invalid in this mode';
            throw new Error(msg);
        }

        // not valid for process communications
        if (ConfigUtil.get(ConfigUtil.keys.Worker.Communication.Method, 'process').localeCompare('process') === 0) {
            const msg = 'Configuration definition indicates that worker is based on process communications: worker launch is invalid in this mode';
            throw new Error(msg);
        }

        // bind first
        logger.info(`Binding worker to SDK ${sdk}`);
        await Bind.handler(argv);

        // Launch target worker
        logger.info(`Launching worker for sut ${sut}`);
        const { WorkerFactory} = require(`@hyperledger/caliper-${sut}`);
        WorkerFactory.spawnWorker();
    }
}

module.exports = Launch;
