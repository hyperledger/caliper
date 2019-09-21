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

const {BlockchainInterface, CaliperUtils} = require('caliper-core');
const logger = CaliperUtils.getLogger('bftsmart.js');

/**
 * Implements {BlockchainInterface} for a BFTSMaRt backend.
 */
class bftsmart extends BlockchainInterface {
    /**
     * Create a new instance of the {BFTSMaRt} class.
     * @param {string} config_path The absolute path of the BFTSMaRt network configuration file.
     * @param {string} workspace_root The absolute path to the root location for the application configuration files.
     */
    constructor(config_path, workspace_root) {
        super(config_path);
        this.bcType = 'bftsmart';
        this.workspaceRoot = workspace_root;
    }

    /**
     * Initialize the {BFTSMaRt} object.
     * @async {string}
     */
    async init() {
    }

    /**
     * Starts server using gradle
     * @param {string}i d
     * @param {string} sclass server
     * @return {Promise} promise waits on event to occur
     * @async
     */
    async startServer(i, sclass) {
        let fork = require('child_process').exec;
        logger.info('Starting server '+i);
        let promise = new Promise (resolve => fork('./runscripts/smartrun.sh '+sclass+' '+i, {cwd: this.workspaceRoot+
                '/library-1.1-beta'}, function(err, stdout, stderr) {
        }).stdout.on('data', function(data) {
            logger.info(data);
            if(data.includes('-- Using view stored on disk\n')){
                logger.info('Server '+i+' is up!');
                resolve();
            }
        }));
        return await promise;
    }

    /**
     * Invoke a TX in stressed manner using args parameters
     * @param {String} context Context object. (cannot be used in BFTSMaRt)
     * @param {String} contractID Identity of the contract. (cannot be used in BFTSMaRt)
     * @param {String} contractVer Version of the contract. (cannot be used in BFTSMaRt)
     * @param {Array} args Array of JSON formatted arguments for multiple transactions.
     * @param {Number} i represents the round number
     * @return {Promise} promise waits on event to occur
     * @async
     */
    async invokeSmartContract(context, contractID, contractVer, args, i) {
        let fork = require('child_process').exec;
        logger.info('Starting server '+i);
        let cmd = './runscripts/smartrun.sh '+ context +' '+
            args[i].id+' '+ args[i].inc +' '+ args[i].txNumber +' '+ args[i].sendingrate +' '+ args[i].type;
        logger.info(cmd);
        let promise = new Promise (resolve => fork(cmd, {cwd: this.workspaceRoot+
                '/library-1.1-beta'}, function(err, stdout, stderr) {
            if(stdout.includes('"input_params"')) {
                logger.info(stdout);
                let res = JSON.parse(stdout);
                logger.info(res);
                resolve(res);
            }
        }));
        return await promise;
    }

}

module.exports = bftsmart;
