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

const CaliperUtils = require('../utils/caliper-utils');
const logger = CaliperUtils.getLogger('defaultTest');

const path = require('path');

/**
 * Default testing class fot Caliper
 */
class DefaultTest {

    /**
    * load client(s) to do performance tests
    * @param {Array} clientArgs arguments for clients
    * @param {String} absNetworkFile the network config file patch
    * @param {ClientOrchestrator} clientOrchestrator the client orchestrator
    * @param {Object} clientFactory factory used to spawn test clients
    * @param {String} networkRoot the root location
    * @param {Report} report the report being built
    * @param {Object} demo the demo UI component
    */
    constructor(clientArgs, absNetworkFile, clientOrchestrator, clientFactory, networkRoot, report, demo) {
        this.clientArgs = clientArgs;
        this.absNetworkFile = absNetworkFile;
        this.clientFactory = clientFactory;
        this.clientOrchestrator = clientOrchestrator;
        this.networkRoot = networkRoot;
        this.report = report;
        this.round = 0;
        this.demo = demo;
    }

    /**
     * Run test rounds
     * @param {JSON} args testing arguments
     * @param {Boolean} final =true, the last test round; otherwise, =false
     * @returns {Object} the number of successful and failed tests
     * @async
     */
    async runTestRounds(args, final) {
        logger.info(`####### Testing '${args.label}' #######`);
        const testLabel   = args.label;
        const testRounds  = args.txDuration ? args.txDuration : args.txNumber;
        const tests = []; // array of all test rounds
        const configPath = path.resolve(this.absNetworkFile);

        // Build test rounds
        for (let i = 0 ; i < testRounds.length ; i++) {
            const msg = {
                type: 'test',
                label : testLabel,
                rateControl: args.rateControl[i] ? args.rateControl[i] : {type:'fixed-rate', 'opts' : {'tps': 1}},
                trim: args.trim ? args.trim : 0,
                args: args.arguments,
                cb  : args.callback,
                config: configPath,
                root: this.networkRoot
            };
            // condition for time based or number based test driving
            if (args.txNumber) {
                msg.numb = testRounds[i];
                // File information for reading or writing transaction request
                msg.txFile = {roundLength: testRounds.length, roundCurrent: i, txMode: args.txMode};
                if (args.txMode && args.txMode.type === 'file-write') {
                    logger.info('------ Prepare(file-write) waiting ------');
                    msg.txFile.readWrite = 'write';
                    msg.rateControl = {type: 'fixed-rate', opts: {tps: 400}};
                    try {
                        await this.clientOrchestrator.startTest(msg, this.clientArgs, function(){}, testLabel, this.clientFactory);
                        msg.numb = testRounds[i];
                        msg.txFile.readWrite = 'read';
                        msg.rateControl = args.rateControl[i] ? args.rateControl[i] : {type:'fixed-rate', 'opts' : {'tps': 1}};
                        if(i === (testRounds.length - 1)) {
                            logger.info('Waiting 5 seconds...');
                            logger.info('------ Prepare(file-write) success------');
                            await CaliperUtils.sleep(5000);
                        }
                    } catch (err) {
                        logger.error('------Prepare(file-write) failed------');
                        args.txMode.type = 'file-no';
                    }

                } else if(args.txMode && args.txMode.type === 'file-read'){
                    msg.txFile.readWrite = 'read';
                } else {
                    msg.txFile.readWrite = 'no';
                }
            } else if (args.txDuration) {
                msg.txDuration = testRounds[i];
            } else {
                throw new Error('Unspecified test driving mode');
            }
            tests.push(msg);
        }


        let successes = 0;
        let failures = 0;
        let testIdx = 0;

        // Run each test round
        for (let test of tests) {
            logger.info(`------ Test round ${this.round += 1} ------`);
            testIdx++;

            test.roundIdx = this.round; // propagate round ID to clients
            this.demo.startWatch(this.clientOrchestrator);
            try {
                await this.clientOrchestrator.startTest(test, this.clientArgs, this.report, testLabel, this.clientFactory);

                this.demo.pauseWatch();
                successes++;
                logger.info(`------ Passed '${testLabel}' testing ------`);

                // prepare for the next round
                if(!final || testIdx !== tests.length) {
                    logger.info('Waiting 5 seconds for the next round...');
                    await CaliperUtils.sleep(5000);
                    await this.monitor.restart();
                }
            } catch (err) {
                this.demo.pauseWatch();
                failures++;
                logger.error(`------ Failed '${testLabel}' testing with the following error ------
    ${err.stack ? err.stack : err}`);
                // continue with next round
            }
        }

        return {successes, failures};
    }

}

module.exports = DefaultTest;
