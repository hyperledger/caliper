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

const CaliperUtils = require('./../../caliper-core/lib/utils/caliper-utils');
const logger = CaliperUtils.getLogger('bftsmart-utils.js');

/**
 * Implements util methods for bftsmart deployment backend. It connects Caliper to bftsmart via webserver.
 */
class bftsmartUtils {
    /**
     * Create a new instance of the {bftsmartUtils} class
     * @param {string} client object reference.
     * @param {string} workspace_root indicates the working directory
     */
    constructor(client, workspace_root) {
        this.client = client;
        this.workspaceroot = workspace_root;
    }

    /**
     * Computes benchmark round defined in caliper configuration file
     * @param {string} test contains the caliper-bftsmart benchmarking configuration
     * @return {object} results contains benchmarking results in JSON format
     * @async
     */
    async computeRounds(test) {
        let rounds = test.rounds.length;
        let results = [];
        for (let i = 0; i < rounds; i++) {
            logger.info('Round '+i+' starting...');
            let context = test.clients.class;
            logger.info(context);
            let contractID = null;
            let contractVer = null;
            results.push(await this.client.invokeSmartContract(context, contractID, contractVer, test.rounds, i));
        }
        return results;
    }

    /**
     * Save the results into a log file
     * @param {string} results is sent into python to generate a graph representing the round
     * @param {string} filename for output results
     * @async
     */
    static async saveResults(results, filename) {
        const fs = require('fs');
        logger.info('Results: '+results);
        fs.writeFile('./packages/caliper-bftsmart/results/'+filename, results);
    }

}

module.exports = bftsmartUtils;
