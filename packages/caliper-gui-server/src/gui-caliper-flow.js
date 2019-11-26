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
/*
 * Author:               Jason You
 * Last modified date:   Sep 1 2019
 *
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


const {
    Blockchain,
    CaliperUtils,
    ConfigUtil,
    ClientOrchestrator,
    MonitorOrchestrator,
    Report,
    DefaultTest,
    LocalObserver,
    PrometheusObserver,
} = require('@hyperledger/caliper-core');

const path = require('path');

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

    let configObject = CaliperUtils.parseYaml(absConfigFile);
    let networkObject = CaliperUtils.parseYaml(absNetworkFile);

    logger.info('####### Caliper Test #######');
    const adminClient = new Blockchain(admin);
    const clientOrchestrator = new ClientOrchestrator(absConfigFile);
    const monitorOrchestrator = new MonitorOrchestrator(absConfigFile);

    // Test observer is dynamically loaded, but defaults to local
    const observerType = (configObject.observer && configObject.observer.type) ? configObject.observer.type : 'local';
    // Select test observer
    let Observer = null;
    switch (observerType) {
    case 'local':
        Observer = LocalObserver;
        break;
    case 'prometheus':
        Observer = PrometheusObserver;
        break;
    default:
        break;
    }
    const TestObserver = Observer;

    const testObserver = new TestObserver(absConfigFile);

    // Report
    const report = new Report(monitorOrchestrator);
    report.createReport(absConfigFile, absNetworkFile, adminClient.gettype());

    let skipStart = ConfigUtil.get(ConfigUtil.keys.CoreSkipStartScript, false);
    let skipEnd = ConfigUtil.get(ConfigUtil.keys.CoreSkipEndScript, false);

    try {
        // Run StartCommand if it exists
        // if (networkObject.hasOwnProperty('caliper') && networkObject.caliper.hasOwnProperty('command') && networkObject.caliper.command.hasOwnProperty('start')) {
        if (Object.prototype.hasOwnProperty.call(networkObject, 'caliper') && Object.prototype.hasOwnProperty.call(networkObject.caliper, 'command') && Object.prototype.hasOwnProperty.call(networkObject.caliper.command, 'start')) {
            if (!networkObject.caliper.command.start.trim()) {
                throw new Error('Start command is specified but it is empty');
            }
            if (!skipStart) {
                const cmd = 'cd ' + workspace + ';' + networkObject.caliper.command.start; // cd to the workspace cause all the network components are in there for configuration
                await CaliperUtils.execAsync(cmd);
            }
        }

        await adminClient.init(); // bug is in here! #1434 of fabric.js
        await adminClient.installSmartContract();
        let numberOfClients = await clientOrchestrator.init();
        let clientArgs = await adminClient.prepareWorkerArguments(numberOfClients);

        try {
            await monitorOrchestrator.startAllMonitors();
            logger.info('Started monitors successfully');
        } catch (err) {
            logger.error('Could not start monitors, ' + (err.stack ? err.stack : err));
        }

        let testIdx = 0;
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

        const date = new Date().toISOString().replace(/-/g, '').replace(/:/g, '').substr(0, 15);
        const outFile = path.join(process.cwd(), `report-${date}.html`);
        await report.finalize(outFile);

        clientOrchestrator.stop();

    } catch (err) {
        logger.error(`Error: ${err.stack ? err.stack : err}`);
        errorStatus = 1;
    } finally {
        testObserver.stopWatch();

        // if (networkObject.hasOwnProperty('caliper') && networkObject.caliper.hasOwnProperty('command') && networkObject.caliper.command.hasOwnProperty('end')) {
        if (Object.prototype.hasOwnProperty.call(networkObject, 'caliper') && Object.prototype.hasOwnProperty.call(networkObject.caliper, 'command') && Object.prototype.hasOwnProperty.call(networkObject.caliper.command, 'end')) {
            if (!networkObject.caliper.command.end.trim()) {
                logger.error('End command is specified but it is empty');
            } else {
                if (!skipEnd) {
                    const cmd = 'cd ' + workspace + ';' + networkObject.caliper.command.end;
                    await CaliperUtils.execAsync(cmd);
                }
            }
        }

        // NOTE: keep the below multi-line formatting intact, otherwise the indents will interfere with the template literal
        let testSummary = `# Test summary: ${successes} succeeded, ${failures} failed #`;
        logger.info(`

${'#'.repeat(testSummary.length)}
${testSummary}
${'#'.repeat(testSummary.length)}
`);
    }

    return errorStatus;
};
