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
     * @param {TestObserver} testObserver the test observer
     * @param {Object} monitorOrchestrator The monitor object
     */
    constructor(clientArgs, absNetworkFile, clientOrchestrator, clientFactory, networkRoot, report, testObserver, monitorOrchestrator) {
        this.clientArgs = clientArgs;
        this.absNetworkFile = absNetworkFile;
        this.clientFactory = clientFactory;
        this.clientOrchestrator = clientOrchestrator;
        this.networkRoot = networkRoot;
        this.report = report;
        this.round = 0;
        this.testObserver = testObserver;
        this.monitorOrchestrator = monitorOrchestrator;
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
        this.testObserver.setBenchmark(args.label);
        const testLabel   = args.label;
        const testRounds  = args.txDuration ? args.txDuration : args.txNumber;
        const tests = []; // array of all test rounds
        const configPath = path.resolve(this.absNetworkFile);

        // Build test rounds
        for (let i = 0 ; i < testRounds.length ; i++) {
            const test = {
                type: 'test',
                label : testLabel,
                rateControl: args.rateControl[i] ? args.rateControl[i] : {type:'fixed-rate', 'opts' : {'tps': 1}},
                trim: args.trim ? args.trim : 0,
                args: args.arguments,
                cb  : args.callback,
                config: configPath,
                root: this.networkRoot,
                testRound: i,
                pushUrl: this.monitorOrchestrator.hasMonitor('prometheus') ? this.monitorOrchestrator.getMonitor('prometheus').getPushGatewayURL() : null
            };
            // condition for time based or number based test driving
            if (args.txNumber) {
                test.numb = testRounds[i];
            } else if (args.txDuration) {
                test.txDuration = testRounds[i];
            } else {
                throw new Error('Unspecified test driving mode');
            }
            tests.push(test);
        }


        let successes = 0;
        let failures = 0;
        let testIdx = 0;

        // Run each test round
        for (let test of tests) {
            logger.info(`------ Test round ${this.round += 1} ------`);
            testIdx++;

            this.testObserver.setRound(test.testRound);
            try {
                this.testObserver.startWatch(this.clientOrchestrator);
                const {results, start, end} = await this.clientOrchestrator.startTest(test, this.clientArgs, this.clientFactory);
                await this.testObserver.stopWatch();

                // Build the report
                // - TPS
                let idx;
                if (this.monitorOrchestrator.hasMonitor('prometheus')) {
                    idx = await this.report.processPrometheusTPSResults({start, end}, testLabel, test.testRound);
                } else {
                    idx = await this.report.processLocalTPSResults(results, testLabel);
                }

                // - Resource utilization
                await this.report.buildRoundResourceStatistics(idx, testLabel);

                successes++;
                logger.info(`------ Passed '${testLabel}' testing ------`);

                // prepare for the next round
                if(!final || testIdx !== tests.length) {
                    logger.info('Waiting 5 seconds for the next round...');
                    await CaliperUtils.sleep(5000);
                    await this.monitorOrchestrator.restartAllMonitors();
                }
            } catch (err) {
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
