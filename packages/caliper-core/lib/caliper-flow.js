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

const Blockchain = require('./blockchain');
const CaliperUtils = require('./utils/caliper-utils');
const ClientOrchestrator  = require('./client/client-orchestrator');
const MonitorOrchestrator = require('./monitor/monitor-orchestrator');
const Report = require('./report/report');
const DefaultTest = require('./test-runners/default-test');
const TestObserver = require('./test-observers/test-observer');
const BenchValidator = require('./utils/benchmark-validator');

const logger = CaliperUtils.getLogger('caliper-flow');

/**
 * Run the benchmark based on passed arguments
 * @param {String} absConfigFile fully qualified path of the test configuration file
 * @param {String} absNetworkFile fully qualified path of the blockchain configuration file
 * @param {AdminClient} admin a constructed Caliper Admin Client
 * @param {ClientFactory} clientFactory a Caliper Client Factory
 * @param {String} workspace fully qualified path to the root location of network files
 * @returns {Integer} the error status of the run
 */
module.exports.run = async function(absConfigFile, absNetworkFile, admin, clientFactory, workspace) {

    let errorStatus = 0;
    let successes = 0;
    let failures = 0;

    // Retrieve flow conditioning options
    const flowOpts = CaliperUtils.getFlowOptions();
    let configObject = CaliperUtils.parseYaml(absConfigFile);
    let networkObject = CaliperUtils.parseYaml(absNetworkFile);

    // Validate configObject (benchmark configuration file)
    BenchValidator.validateObject(configObject);

    logger.info('####### Caliper Test #######');
    const adminClient = new Blockchain(admin);
    const clientOrchestrator  = new ClientOrchestrator(absConfigFile);
    const monitorOrchestrator = new MonitorOrchestrator(absConfigFile);

    // Test observer is dynamically loaded, but defaults to none
    const observerType = (configObject.observer && configObject.observer.type) ? configObject.observer.type : 'none';
    const testObserver = new TestObserver(observerType, absConfigFile);

    // Report
    const report = new Report(monitorOrchestrator);
    report.createReport(absConfigFile, absNetworkFile, adminClient.getType());

    try {
        // Conditional running of 'start' commands
        if (!flowOpts.performStart)  {
            logger.info('Skipping start commands due to benchmark flow conditioning');
        } else {
            if (networkObject.hasOwnProperty('caliper') && networkObject.caliper.hasOwnProperty('command') && networkObject.caliper.command.hasOwnProperty('start')) {
                if (!networkObject.caliper.command.start.trim()) {
                    throw new Error('Start command is specified but it is empty');
                } else {
                    const cmd = 'cd ' + workspace + ';' + networkObject.caliper.command.start;
                    await CaliperUtils.execAsync(cmd);
                }
            }
        }

        // Conditional network initialization
        if (!flowOpts.performInit) {
            logger.info('Skipping initialization phase due to benchmark flow conditioning');
        } else {
            await adminClient.init();
        }

        // Conditional smart contract installation
        if (!flowOpts.performInstall) {
            logger.info('Skipping install smart contract phase due to benchmark flow conditioning');
        } else {
            await adminClient.installSmartContract();
        }

        // Conditional test phase
        if (!flowOpts.performTest) {
            logger.info('Skipping benchmark test phase due to benchmark flow conditioning');
        } else {
            // Start all the monitors
            try {
                await monitorOrchestrator.startAllMonitors();
                logger.info('Started monitors successfully');
            } catch (err) {
                logger.error('Could not start monitors, ' + (err.stack ? err.stack : err));
            }

            let testIdx = 0;
            let numberOfClients = await clientOrchestrator.init();
            let clientArgs = await adminClient.prepareClients(numberOfClients);

            const tester = new DefaultTest(clientArgs, absNetworkFile, clientOrchestrator, clientFactory, workspace, report, testObserver, monitorOrchestrator);
            const allTests = configObject.test.rounds;
            for (let test of allTests) {
                ++testIdx;
                const response = await tester.runTestRounds(test, (testIdx === allTests.length));
                successes += response.successes;
                failures += response.failures;
            }

            logger.info('---------- Finished Test ----------\n');
            report.printResultsByRound();
            await monitorOrchestrator.stopAllMonitors();

            await report.finalize();

            clientOrchestrator.stop();

            // NOTE: keep the below multi-line formatting intact, otherwise the indents will interfere with the template literal
            let testSummary = `# Test summary: ${successes} succeeded, ${failures} failed #`;
            logger.info(`

${'#'.repeat(testSummary.length)}
${testSummary}
${'#'.repeat(testSummary.length)}
`);
        }
    } catch (err) {
        logger.error(`Error: ${err.stack ? err.stack : err}`);
        errorStatus = 1;
    } finally {
        await testObserver.stopWatch();

        // Conditional running of 'end' commands
        if (flowOpts.performEnd) {
            if (networkObject.hasOwnProperty('caliper') && networkObject.caliper.hasOwnProperty('command') && networkObject.caliper.command.hasOwnProperty('end')) {
                if (!networkObject.caliper.command.end.trim()) {
                    logger.error('End command is specified but it is empty');
                } else {
                    const cmd = 'cd ' + workspace + ';' + networkObject.caliper.command.end;
                    await CaliperUtils.execAsync(cmd);
                }
            }
        } else {
            logger.info('Skipping end commands due to benchmark flow conditioning');
        }
    }

    return errorStatus;
};
