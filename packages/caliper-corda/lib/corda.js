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
const logger = CaliperUtils.getLogger('corda.js');

/**
 * Implements {BlockchainInterface} for a corda backend.
 */
class Corda extends BlockchainInterface {
    /**
     * Create a new instance of the {corda} class.
     * @param {string} config_path The absolute path of the corda network configuration file.
     * @param {string} workspace_root The absolute path to the root location for the application configuration files.
     */
    constructor(config_path, workspace_root) {
        super(config_path);
        this.bcType = 'corda';
        this.workspaceRoot = workspace_root;
    }

    /**
     * Initialize the {corda} object.
     * @async
     */
    async init() {
        logger.info('Corda network is up!');
        try {
            await this.startServer();
        } catch (err) {
            logger.error(`Corda initialization failed: ${(err.stack ? err.stack : err)}`);
            throw err;
        }
    }

    /**
     * Starts the webserver using gradle
     * @return {Promise} promise waits on event to occur
     * @async
     */
    async startServer() {
        let fork = require('child_process').exec;
        logger.info('Starting Spring webserver... ');
        let promise = new Promise (resolve => fork('./gradlew runTemplateServer', {cwd: this.workspaceRoot+
                '/cordapps/finance'}, function(err, stdout, stderr) {
        }).stdout.on('data', function(data) {
            logger.info(data);
            if(data.includes('ServerKt.logStarted - Started ServerKt in')){
                logger.info('Webserver is up and is waiting for requests!');
                resolve();
            }
        }));
        return await promise;
    }

    /**
     * Invoke a smart contract in stressed manner using args parameters
     * @param {String} context Context object. (cannot be used in Corda)
     * @param {String} contractID Identity of the contract. (cannot be used in Corda)
     * @param {String} contractVer Version of the contract. (cannot be used in Corda)
     * @param {Array} args Array of JSON formatted arguments for multiple transactions.
     * @param {Number} i represents the round number
     * @return {Promise} promise waits on event to occur
     * @async
     */
    async invokeSmartContract(context, contractID, contractVer, args, i) {
        let http = require('http');
        let cmd = 'http://'+context.host+':'+context.port+'/startCashIssueFlow?nTX='+ args[i].txNumber +'&batch='+
            args[i].threads+'&sendingrate='+ args[i].sendingrate;
        let promise = new Promise(resolve => {
            http.get(cmd, (resp) => {
                let data = '';
                let done = false;
                resp.on('data', (chunk) => {
                    data += chunk;
                });
                resp.on('end', () => {
                    if (!done) {
                        let res = JSON.parse(data);
                        resolve(res);
                    }
                });
            }).on('error', () => {});
        });
        return await promise;
    }

}

module.exports = Corda;
