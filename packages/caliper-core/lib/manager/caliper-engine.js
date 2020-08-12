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

const CaliperUtils = require('../common/utils/caliper-utils');
const ConfigUtils = require('../common/config/config-util');
const RoundOrchestrator = require('./orchestrators/round-orchestrator');
const BenchValidator = require('../common/utils/benchmark-validator');

const logger = CaliperUtils.getLogger('caliper-engine');

/**
 * Encapsulates the high-level control flow of a benchmark execution.
 */
class CaliperEngine {
    /**
     * Initializes the CaliperEngine instance.
     * @param {object} benchmarkConfig The benchmark configuration object.
     * @param {object} networkConfig The network configuration object.
     * @param {function} adapterFactory The factory function for creating an adapter instance.
     */
    constructor(benchmarkConfig, networkConfig, adapterFactory) {
        this.benchmarkConfig = benchmarkConfig;
        this.networkConfig = networkConfig;
        this.workspace = ConfigUtils.get(ConfigUtils.keys.Workspace);
        this.returnCode = -1;

        this.adapterFactory = adapterFactory;
    }

    /**
     * Executes the given start/end command with proper checking and error handling.
     * @param {string} commandName Either "start" or "end". Used in the error messages.
     * @param {number} errorStatusStart The last taken error status code. Execution errors will use the next 3 status code.
     * @private
     */
    async _executeCommand(commandName, errorStatusStart) {
        if (this.networkConfig.caliper && this.networkConfig.caliper.command && this.networkConfig.caliper.command[commandName]) {
            let command = this.networkConfig.caliper.command[commandName];
            if (typeof command !== 'string') {
                let msg = `Network configuration attribute "caliper.command.${commandName}" is not a string`;
                logger.error(msg, command);
                this.returnCode = errorStatusStart + 1;
                throw new Error(msg);
            }
            else if (!command.trim()) {
                let msg = `Network configuration attribute "caliper.command.${commandName}" is specified, but it is empty`;
                logger.error(msg);
                this.returnCode = errorStatusStart + 2;
                throw new Error(msg);
            } else {
                let startTime = Date.now();
                try {
                    await CaliperUtils.execAsync(`cd ${this.workspace}; ${command}`);
                } catch (err) {
                    let msg = `An error occurred while executing the ${commandName} command: ${err}`;
                    logger.error(msg);
                    this.returnCode = errorStatusStart + 3;
                    throw new Error(msg);
                } finally {
                    let endTime = Date.now();
                    logger.info(`Executed ${commandName} command in ${(endTime - startTime)/1000.0} seconds`);
                }
            }
        } else {
            logger.info(`Network configuration attribute "caliper.command.${commandName}" is not present, skipping ${commandName} command`);
        }
    }

    /**
     * Run the benchmark based on passed arguments
     * @returns {number} the error status of the run
     */
    async run() {
        // Retrieve flow conditioning options
        const flowOpts = CaliperUtils.getFlowOptions();
        // Validate configObject (benchmark configuration file)
        BenchValidator.validateObject(this.benchmarkConfig);

        logger.info('Starting benchmark flow');
        let connector = await this.adapterFactory(-1);

        try {

            // Conditional running of 'start' commands
            if (!flowOpts.performStart)  {
                logger.info('Skipping start commands due to benchmark flow conditioning');
            } else {
                await this._executeCommand('start', 0);
            }

            // Conditional network initialization
            if (!flowOpts.performInit) {
                logger.info('Skipping initialization phase due to benchmark flow conditioning');
            } else {
                let initStartTime = Date.now();
                try {
                    await connector.init();
                } catch (err) {
                    let msg = `Error while performing "init" step: ${err}`;
                    logger.error(msg);
                    this.returnCode = 4;
                    throw new Error(msg);
                } finally {
                    let initEndTime = Date.now();
                    logger.info(`Executed "init" step in ${(initEndTime - initStartTime)/1000.0} seconds`);
                }
            }

            // Conditional smart contract installation
            if (!flowOpts.performInstall) {
                logger.info('Skipping install smart contract phase due to benchmark flow conditioning');
            } else {
                let installStartTime = Date.now();
                try {
                    await connector.installSmartContract();
                } catch (err) {
                    let msg = `Error while performing "install" step: ${err}`;
                    logger.error(msg);
                    this.returnCode = 5;
                    throw new Error(msg);
                } finally {
                    let installEndTime = Date.now();
                    logger.info(`Executed "install" step in ${(installEndTime - installStartTime)/1000.0} seconds`);
                }
            }

            // Conditional test phase
            if (!flowOpts.performTest) {
                logger.info('Skipping benchmark test phase due to benchmark flow conditioning');
            } else {
                let numberSet = this.benchmarkConfig.test && this.benchmarkConfig.test.workers && this.benchmarkConfig.test.workers.number;
                let numberOfWorkers = numberSet ? this.benchmarkConfig.test.workers.number : 1;
                let workerArguments = await connector.prepareWorkerArguments(numberOfWorkers);

                const roundOrchestrator = new RoundOrchestrator(this.benchmarkConfig, this.networkConfig, workerArguments);
                await roundOrchestrator.run();
            }
        } catch (err) {
            // this means that we haven't handled/logged this failure yet
            if (this.returnCode < 0) {
                // log full stack
                let msg = `Error while performing "test" step: ${err.stack}`;
                logger.error(msg);
                this.returnCode = 6;
            }
        } finally {
            // Conditional running of 'end' commands
            if (!flowOpts.performEnd) {
                logger.info('Skipping end command due to benchmark flow conditioning');
            } else {
                try {
                    await this._executeCommand('end', 6);
                } catch (err) {
                    // the error was already handled/logged, so ignore it
                }
            }
        }

        // we haven't encountered any error
        if (this.returnCode < 0) {
            this.returnCode = 0;
        }

        return this.returnCode;
    }
}

module.exports = CaliperEngine;
