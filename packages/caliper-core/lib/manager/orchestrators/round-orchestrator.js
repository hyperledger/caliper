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

const WorkerOrchestrator  = require('./worker-orchestrator');
const MonitorOrchestrator = require('./monitor-orchestrator');
const Report = require('../report/report');
const TestObserver = require('../test-observers/test-observer');
const CaliperUtils = require('../../common/utils/caliper-utils');
const logger = CaliperUtils.getLogger('round-orchestrator');

/**
 * Schedules and drives the configured benchmark rounds.
 */
class RoundOrchestrator {

    /**
     * Initialize the RoundOrchestrator instance.
     * @param {object} benchmarkConfig The benchmark configuration object.
     * @param {object} networkConfig The network configuration object.
     * @param {object[]} workerArguments List of connector specific arguments to pass for each worker processes.
     */
    constructor(benchmarkConfig, networkConfig, workerArguments) {
        this.networkConfig = networkConfig;
        this.benchmarkConfig = benchmarkConfig;

        this.workerOrchestrator = new WorkerOrchestrator(this.benchmarkConfig, workerArguments);
        this.monitorOrchestrator = new MonitorOrchestrator(this.benchmarkConfig);
        this.report = new Report(this.monitorOrchestrator, this.benchmarkConfig, this.networkConfig);
        this.testObserver = new TestObserver();
    }

    /**
     * Validates a round configuration entry.
     * @param {object} round The round configuration.
     * @param {number} index The index of the round configuration, used in the error message.
     * @private
     */
    static _validateRoundConfig(round, index) {
        // TODO: this should be converted to a joi validation
        try {
            if (!round.label) {
                throw new Error('Missing "label" attribute');
            }

            if (typeof round.label !== 'string') {
                throw new Error('"label" attribute must be a string');
            }

            if (round.txNumber) {
                // excludes arrays
                if (typeof round.txNumber !== 'number') {
                    throw new Error('"txNumber" attribute must be a number');
                }
            }

            if (round.txDuration) {
                // excludes arrays
                if (typeof round.txDuration !== 'number') {
                    throw new Error('"txDuration" attribute must be a number');
                }
            }

            if (round.txNumber && round.txDuration) {
                throw new Error('The "txDuration" and "txNumber" attributes are mutually exclusive');
            }

            if (!round.txNumber && !round.txDuration) {
                throw new Error('either the "txDuration" or the "txNumber" attribute must be specified');
            }

            if (!round.rateControl) {
                throw new Error('Missing "rateControl" attribute');
            }

            if (typeof round.rateControl !== 'object') {
                throw new Error('"rateControl" attribute must be an object');
            }

            if (Array.isArray(round.rateControl)) {
                throw new Error('"rateControl" attribute must not be an array');
            }

            if (!round.workload) {
                throw new Error('Missing "workload" attribute');
            }

            if (typeof round.workload !== 'object') {
                throw new Error('"workload" attribute must be an object');
            }

            if (!round.workload.module) {
                throw new Error('Missing "workload.module" attribute');
            }

            if (typeof round.workload.module !== 'string') {
                throw new Error('"workload.module" attribute must be a string');
            }

            // noinspection JSAnnotator
            if (round.workload.arguments && typeof round.workload.arguments !== 'object') {
                throw new Error('"workload.arguments" attribute must be an object');
            }

            if (round.trim && typeof round.trim !== 'number') {
                throw new Error('"trim" attribute must be a number');
            }
        } catch (err) {
            let msg = `Round ${index + 1} configuration validation error: ${err.message}`;
            logger.error(msg);
            throw new Error(msg);
        }
    }

    /**
     * Validates and schedules the defined rounds.
     */
    async run() {
        if (!(this.benchmarkConfig.test && this.benchmarkConfig.test.rounds)) {
            let msg = 'Benchmark configuration file is missing the "test.rounds" attribute';
            logger.error(msg);
            throw new Error(msg);
        }

        let rounds = this.benchmarkConfig.test.rounds;
        if (!Array.isArray(rounds)) {
            let msg = 'Benchmark configuration attribute "test.rounds" must be an array';
            logger.error(msg);
            throw new Error(msg);
        }

        // validate each round before starting any
        rounds.forEach((round, index) => RoundOrchestrator._validateRoundConfig(round, index));

        // create messages for workers from each round config
        let roundConfigs = rounds.map((round, index) => {
            let config = {
                label: round.label,
                rateControl: round.rateControl,
                trim: round.trim || 0,
                workload: round.workload,
                testRound: index
            };

            if (round.txNumber) {
                config.numb = round.txNumber;
            } else {
                config.txDuration = round.txDuration;
            }

            return config;
        });

        let success = 0;
        let failed = 0;

        this.report.createReport();

        // Prepare worker connections
        try {
            logger.info('Preparing worker connections');
            await this.workerOrchestrator.prepareWorkerConnections();
        } catch (err) {
            logger.error(`Could not prepare worker connections: ${err.stack || err}`);
        }

        let benchStartTime = Date.now();

        for (const [index, roundConfig] of roundConfigs.entries()) {
            logger.info(`Started round ${index + 1} (${roundConfig.label})`);
            this.testObserver.setBenchmark(roundConfig.label);
            this.testObserver.setRound(index);

            try {
                // Run test preparation (cb.init() function if specified)
                await this.workerOrchestrator.prepareTestRound(roundConfig);

                // Run main test round
                // - Start observer and monitors so that only the main round is considered in retrieved metrics
                this.testObserver.startWatch(this.workerOrchestrator);
                try {
                    await this.monitorOrchestrator.startAllMonitors();
                    logger.info('Monitors successfully started');
                } catch (err) {
                    logger.error(`Could not start monitors: ${err.stack || err}`);
                }
                // - Run main test
                const {results, start, end} = await this.workerOrchestrator.startTest(roundConfig);
                await this.testObserver.stopWatch();

                // Build the report
                // - TPS
                const idx = await this.report.processTPSResults(results, roundConfig);
                // - Resource utilization
                await this.report.buildRoundResourceStatistics(idx, roundConfig.label);

                success++;
                logger.info(`Finished round ${index + 1} (${roundConfig.label}) in ${CaliperUtils.millisToSeconds(end - start)} seconds`);

                // Stop all monitors so that they can be reset between rounds
                await this.monitorOrchestrator.stopAllMonitors();

                // sleep some between the rounds
                if (index !== roundConfigs.length - 1) {
                    logger.info('Waiting 5 seconds for the next round...');
                    await CaliperUtils.sleep(5000);
                }
            } catch (err) {
                await this.testObserver.stopWatch();
                failed++;
                logger.error(`Failed round ${index + 1} (${roundConfig.label}): ${err.stack || err}`);
            }
        }

        // clean up, with "silent" failure handling
        try {
            this.report.printResultsByRound();
            await this.report.finalize();
        } catch (err) {
            logger.error(`Error while finalizing the report: ${err.stack || err}`);
        }

        try {
            await this.monitorOrchestrator.stopAllMonitors();
        } catch (err) {
            logger.error(`Error while stopping monitors: ${err.stack || err}`);
        }

        try {
            await this.workerOrchestrator.stop();
        } catch (err) {
            logger.error(`Error while stopping workers: ${err.stack || err}`);
        }

        let benchEndTime = Date.now();
        logger.info(`Benchmark finished in ${(benchEndTime - benchStartTime)/1000.0} seconds. Total rounds: ${success + failed}. Successful rounds: ${success}. Failed rounds: ${failed}.`);
    }
}

module.exports = RoundOrchestrator;
