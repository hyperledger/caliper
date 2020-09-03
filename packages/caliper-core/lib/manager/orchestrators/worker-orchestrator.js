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

const childProcess = require('child_process');

const CaliperUtils = require('../../common/utils/caliper-utils');
const ConfigUtils = require('../../common/config/config-util');
const Constants = require('./../../common/utils/constants');

const MessageTypes = require('./../../common/utils/constants').Messages.Types;
const TransactionStatisticsCollector = require('./../../common/core/transaction-statistics-collector');

const RegisterMessage = require('./../../common/messages/registerMessage');
const AssignIdMessage = require('./../../common/messages/assignIdMessage');
const InitializeMessage = require('./../../common/messages/initializeMessage');
const PrepareMessage = require('./../../common/messages/prepareMessage');
const TestMessage = require('./../../common/messages/testMessage');
const ExitMessage = require('./../../common/messages/exitMessage');

const logger = CaliperUtils.getLogger('worker-orchestrator');

/**
 * Class for Worker Orchestration
 */
class WorkerOrchestrator {
    /**
     * Constructor
     * @param {object} benchmarkConfig The benchmark configuration object.
     * @param {object[]} workerArguments List of connector specific arguments to pass for each worker processes.
     */
    constructor(benchmarkConfig, workerArguments) {
        this.config = benchmarkConfig.test.workers;
        this.workerArguments = workerArguments;

        this.workers = {};
        this.workerObjects = [];        // used in the process communications
        this.updates = {id:0, data:[]}; // contains txUpdated messages
        this.results = [];              // cumulative results

        // Messenger information
        let messagingMethod = ConfigUtils.get(ConfigUtils.keys.Worker.Communication.Method);
        const messengerFactory = CaliperUtils.loadModuleFunction(CaliperUtils.getBuiltinMessengers(), messagingMethod,
            Constants.Factories.ManagerMessenger, require);

        /**
         * @type {MessengerInterface}
         */
        this.messenger = messengerFactory({});
        this.messengerConfigured = false;
        this.workerPollingInterval = ConfigUtils.get(ConfigUtils.keys.Worker.PollInterval);

        // Worker information
        this.workersRemote = ConfigUtils.get(ConfigUtils.keys.Worker.Remote);
        this.workersConnected = false;
        this.workersAssigned = false;
        this.workersReady = false;

        if (this.config.hasOwnProperty('number')) {
            this.number = this.config.number;
        } else {
            this.number = 1;
        }

        // Global promises used for setup
        this.brokerConnectedPromise = {};
        this.workersConnectedPromise = {};
        this.workersReadyPromise = {};
    }

    /**
     * Configure the messaging service implementation
     * @async
     */
    async configureMessenger() {
        // to regain the context of the message handler
        // "this" would point to the messenger instance
        const self = this;
        this.messenger.on(MessageTypes.Connected, async (message) => {
            logger.debug(`Dealing with connected message ${message.stringify()}`);
            self.updateWorkerPhase(message.getSender(), message.getType(), message.getContent(), message.getError());
        });

        this.messenger.on(MessageTypes.Assigned, async (message) => {
            logger.debug(`Dealing with assigned message ${JSON.stringify(message)}`);
            self.updateWorkerPhase(message.getSender(), message.getType(), message.getContent(), message.getError());
        });

        this.messenger.on(MessageTypes.Ready, async (message) => {
            logger.debug(`Dealing with ready message ${JSON.stringify(message)}`);
            self.updateWorkerPhase(message.getSender(), message.getType(), message.getContent(), message.getError());
        });

        this.messenger.on(MessageTypes.Prepared, async (message) => {
            logger.debug(`Dealing with prepared message ${JSON.stringify(message)}`);
            self.updateWorkerPhase(message.getSender(), message.getType(), message.getContent(), message.getError());
        });

        this.messenger.on(MessageTypes.TxUpdate, async (message) => {
            logger.debug('Dealing with txUpdate message');
            self.pushUpdate(message.getSender(), message.getContent());
        });

        this.messenger.on(MessageTypes.TestResult, async (message) => {
            logger.debug('Dealing with testResult message');
            self.pushResult(message.getSender(), message.getContent());
            self.updateWorkerPhase(message.getSender(), message.getType(), {}, message.getError());
        });

        this.messenger.on(MessageTypes.TxReset, async (message) => {
            logger.debug('Dealing with txReset message');
            self.pushUpdate(message.getSender(), message.getContent());
        });

        await this.messenger.initialize();
        await this.messenger.configureProcessInstances(this.workerObjects);
    }

    /**
     * Prepare all worker connections for further rounds.
     */
    async prepareWorkerConnections() {
        // conditionally launch workers - they might exist in containers and not launched as processes
        if (!this.workersRemote && !this.workersLaunched) {
            for (let number = 1 ; number <= this.number ; number++) {
                this.launchWorker(number);
            }
            this.workersLaunched = true;
        }

        // Conditionally configure the messenger
        if (!this.messengerConfigured) {
            logger.info('Messenger not configured, entering configure phase...');
            await this.configureMessenger();
            this.messengerConfigured = true;
        }

        // Conditionally connect to workers
        if (!this.workersConnected) {
            logger.info('No existing workers detected, entering worker launch phase...');
            // Use promise array to await all worker connection operations
            const workersConnectedPromise = new Promise((resolve, reject) => {
                this.workersConnectedPromise = {
                    resolve: resolve,
                    reject:  reject
                };
            });

            // Since we cannot always guarantee that workers are being spawned by the orchestrator; the orchestrator should poll for workers to register. Interval is cleared once all workers have registered
            const self = this;
            this.pollingInterval = setInterval( () => { self.pollForWorkers();  } , self.workerPollingInterval);

            // wait for all workers to have initialized
            logger.info(`Waiting for ${this.number} workers to be connected...`);

            await workersConnectedPromise;
            this.workersConnected = true;

            logger.info(`${this.number} workers connected, progressing to worker assignment phase.`);
        } else {
            logger.info(`Existing ${Object.keys(this.workers).length} connected workers detected, progressing to worker assignment phase.`);
        }

        // Make sure the workers have been assigned an index
        if(!this.workersAssigned) {
            logger.info('Workers currently unassigned, awaiting index assignment...');
            // Use promise array to await all worker init operations
            const workersAssignedPromise = new Promise((resolve, reject) => {
                this.workersAssignedPromise = {
                    resolve: resolve,
                    reject:  reject
                };
            });

            // Inform connected worker of their workerIndex (!== mqttClientId)
            // worker index is integer based, and maps to worker arguments passed by a user
            const workerArray = Object.keys(this.workers);
            for (let workerId of workerArray) {
                const worker = this.workers[workerId];
                worker.workerId = workerArray.indexOf(workerId);
                const msg = new AssignIdMessage(this.messenger.getUUID(), [workerId], { workerIndex: worker.workerId });
                this.messenger.send(msg);
            }

            // wait for all workers to have initialized
            logger.info(`Waiting for ${this.number} workers to be assigned...`);

            await workersAssignedPromise;
            this.workersAssigned = true;

            logger.info(`${this.number} workers assigned, progressing to worker initialization phase.`);
        } else {
            logger.info(`Existing ${Object.keys(this.workers).length} connected workers detected are assigned, progressing to worker initialization phase.`);
        }

        // Make sure the workers are ready
        if (!this.workersReady) {
            // Use promise array to await all worker init operations
            const workersReadyPromise = new Promise((resolve, reject) => {
                this.workersReadyPromise = {
                    resolve: resolve,
                    reject:  reject
                };
            });

            // wait for all workers to have initialized
            logger.info(`Waiting for ${this.number} workers to be ready...`);
            const msg = new InitializeMessage(this.messenger.getUUID());
            this.messenger.send(msg);

            await workersReadyPromise;
            this.workersReady = true;

            logger.info(`${this.number} workers ready, progressing to test preparation phase.`);
        } else {
            logger.info(`Existing ${Object.keys(this.workers).length} prepared workers detected, progressing to test preparation phase.`);
        }
    }

    /**
     * Send a global message to all workers, indicating that orchestrator is pending worker registration
     */
    pollForWorkers() {
        const message = new RegisterMessage(this.messenger.getUUID());
        this.messenger.send(message);
    }

    /**
     * Update a worker readiness phase
     * @param {number} workerId the worker identifier
     * @param {string} phase the phase the update relates to
     * @param {object} data data object passed within the worker message
     * @param {string} error The error associated with the message.
     */
    updateWorkerPhase(workerId, phase, data, error) {

        logger.debug(`Handling ${phase} message from ${workerId} with data ${JSON.stringify(data)}`);
        switch (phase) {
        case MessageTypes.Connected:{
            if (error) {
                this.workersConnectedPromise.reject(new Error(error));
            } else {
                const phases = {};
                phases[MessageTypes.Assigned] = false;
                phases[MessageTypes.Ready] = false;
                phases[MessageTypes.Prepared] = {};
                phases[MessageTypes.TestResult] = {};

                // Add worker to this.workers
                //  - updates array to save txUpdate results
                //  - results array to save the test results
                //  - phases used to track worker object status
                this.workers[workerId] = {results: this.results, updates: this.updates, phases};

                // Only check if all workers are connected
                if (this.allWorkersReachedPhase(phase)) {
                    clearInterval(this.pollingInterval);
                    this.workersConnectedPromise.resolve();
                }
            }
            break;
        }
        case MessageTypes.Assigned:
            if (!this.workers[workerId]) {
                logger.warn(`Discarding ${phase} message from unregistered worker ${workerId}`);
            } else if (error) {
                this.workersAssignedPromise.reject(new Error(error));
            } else {
                this.workers[workerId].phases[phase] = true;
                // Only check if all workers are connected
                if (this.allWorkersReachedPhase(phase)) {
                    this.workersAssignedPromise.resolve();
                }
            }
            break;
        case MessageTypes.Ready:
            if (!this.workers[workerId]) {
                logger.warn(`Discarding ${phase} message from unregistered worker ${workerId}`);
            } else if (error) {
                this.workersReadyPromise.reject(new Error(error));
            } else {
                this.workers[workerId].phases[phase] = true;
                // Only check if all workers are connected
                if (this.allWorkersReachedPhase(phase)) {
                    this.workersReadyPromise.resolve();
                }
            }
            break;
        case MessageTypes.Prepared:
            if (!this.workers[workerId]) {
                logger.warn(`Discarding ${phase} message from unregistered worker ${workerId}`);
            } else if (error) {
                this.workers[workerId].phases[phase].reject(new Error(error));
            } else {
                this.workers[workerId].phases[phase].resolve();
            }
            break;
        case MessageTypes.TestResult:
            if (!this.workers[workerId]) {
                logger.warn(`Discarding ${phase} message from unregistered worker ${workerId}`);
            } else if (error) {
                this.workers[workerId].phases[phase].reject(new Error(error));
            } else {
                this.workers[workerId].phases[phase].resolve();
            }
            break;
        default:
            throw new Error(`updateWorkerPhase passed unknown phase ${phase} by worker ${workerId}`);
        }
    }

    /**
     * Check if all workers have notified that they are ready
     * @param {string} phase the worker phase to be checked
     * @returns {boolean} boolean true if all worker processes have notified of being ready; otherwise false
     */
    allWorkersReachedPhase(phase) {
        switch (phase) {
        case MessageTypes.Connected:
            return this.number === Object.keys(this.workers).length;
        case MessageTypes.Assigned:
        case MessageTypes.Ready: {
            const pendingWorkers = [];
            for (const workerId in this.workers) {
                const worker = this.workers[workerId];
                if (!worker.phases[phase]) {
                    pendingWorkers.push(workerId);
                }
            }
            // Debug logging of notifications
            if (pendingWorkers.length === 0) {
                logger.debug(`All workers completed phase ${phase}`);
            } else {
                logger.debug(`Pending ready messages from workers: [${pendingWorkers}]`);
            }
            return pendingWorkers.length === 0;
        }
        default:
            throw new Error(`allWorkersReachedPhase passed unknown phase ${phase}`);
        }

    }

    /**
    * Prepare the test
    * message = {
    *              type: 'test',
    *              label : label name,
    *              numb:   total number of simulated txs,
    *              txDuration: time duration of test,
    *              rateControl: rate controller to use,
    *              trim:   trim options,
    *              args:   user defined arguments,
    *              cb  :   path of the callback js file,
    *              config: path of the blockchain config file
    *            };
    * @param {JSON} test test specification
    * @async
    */
    async prepareTestRound(test) {
        // Work with a cloned message as we need to transform the passed message
        const prepSpec = JSON.parse(JSON.stringify(test));

        // send test preparation specification to each worker
        let preparePromises = [];
        for (let index in this.workers) {
            let worker = this.workers[index];
            let p = new Promise((resolve, reject) => {
                worker.phases[MessageTypes.Prepared] = {
                    resolve: resolve,
                    reject:  reject
                };
            });
            preparePromises.push(p);
            prepSpec.workerArgs = this.workerArguments[worker.workerId];
            prepSpec.totalWorkers = this.number;

            // Send to worker
            const msg = new PrepareMessage(this.messenger.getUUID(), [index], prepSpec);
            this.messenger.send(msg);
        }

        await Promise.all(preparePromises);
        logger.info(`${this.number} workers prepared, progressing to test phase.`);

        // clear worker prepare promises so they can be reused
        for (let worker in this.workers) {
            this.workers[worker].phases[MessageTypes.Prepared] = {};
        }
    }

    /**
    * Start the test
    * message = {
    *              label: label name,
    *              numb:   total number of simulated txs,
    *              txDuration: time duration of test,
    *              rateControl: rate controller to use,
    *              trim:   trim options,
    *              args:   user defined arguments,
    *              cb  :   path of the callback js file,
    *              config: path of the blockchain config file
    *            };
    * @param {JSON} test test specification
    * @returns {Object[]} the test results array
    * @async
    */
    async startTest(test) {
        this.updates.data = [];
        this.updates.id++;

        await this._startTest(test);
        const testOutput = this.formatResults(this.results);
        return testOutput;
    }

    /**
     * Start a test
     * @param {JSON} testSpecification test specification
     * @param {Array} updates array to save txUpdate results
     * @param {Array} results array to save the test results
     * @async
     */
    async _startTest(testSpecification) {

        let txPerWorker;
        if (testSpecification.numb) {
            // Run specified number of transactions
            txPerWorker  = Math.floor(testSpecification.numb / this.number);

            // trim should be based on number of workers, if specified with txNumber
            if (testSpecification.trim) {
                testSpecification.trim = Math.floor(testSpecification.trim / this.number);
            }

            if (txPerWorker < 1) {
                txPerWorker = 1;
            }
            testSpecification.numb = txPerWorker;
        } else if (testSpecification.txDuration) {
            // Run for time specified txDuration based on workers
            // Do nothing, we run for the time specified within testSpecification.txDuration
        } else {
            throw new Error('Unconditioned transaction rate driving mode');
        }

        // Ensure results are reset
        this.results = [];

        let testPromises = [];
        for (let index in this.workers) {
            let worker = this.workers[index];
            let p = new Promise((resolve, reject) => {
                worker.phases[MessageTypes.TestResult] = {
                    resolve: resolve,
                    reject:  reject
                };
            });
            testPromises.push(p);
            worker.results = this.results;
            worker.updates = this.updates.data;
            testSpecification.workerArgs = this.workerArguments[worker.workerId];
            testSpecification.totalWorkers = this.number;

            // Publish to worker
            const msg = new TestMessage(this.messenger.getUUID(), [index], testSpecification);
            this.messenger.send(msg);
        }

        await Promise.all(testPromises);
        // clear worker test promises so they can be reused
        for (let worker in this.workers) {
            this.workers[worker].phases[MessageTypes.TestResult] = {};
        }
    }

    /**
     * Stop all test workers and disconnect from messenger
     */
    async stop() {
        logger.info('Sending exit message to connected workers');
        const msg = new ExitMessage(this.messenger.getUUID());
        this.messenger.send(msg);

        // Internally spawned workers are killed within the messenger handling of 'exit', but clean the array of processes here
        this.workerObjects = [];

        // dispose of manager messenger
        await this.messenger.dispose();
    }

    /**
     * Get the update array
     * @return {Array} update array
     */
    getUpdates() {
        return this.updates;
    }

    /**
     * Push test result from a worker into the global array
     * @param {String} uuid uuid of the worker
     * @param {Object} data test result
     */
    pushResult(uuid, data) {
        let p = this.workers[uuid];
        if (p && p.results && typeof p.results !== 'undefined') {
            p.results.push(data);
        }
    }

    /**
     * Push update value from a worker into the global array
     * @param {String} uuid uuid of the worker
     * @param {Object} data update value
     */
    pushUpdate(uuid, data) {
        let p = this.workers[uuid];
        if (p && p.updates && typeof p.updates !== 'undefined') {
            p.updates.push(data);
        }
    }

    /**
     * Launch a worker process to do the test
     * @param {number} index the worker index
     */
    launchWorker(index) {
        logger.info(`Launching worker ${index} of ${this.number}`);

        // Spawn the worker. The index is assigned upon connection
        const cliPath = process.argv[1];
        const workerCommands = ['launch', 'worker'];
        const remainingArgs = process.argv.slice(4);

        const nodeArgs = workerCommands.concat(remainingArgs);

        const worker = childProcess.fork(cliPath, nodeArgs, {
            env: process.env,
            cwd: process.cwd()
        });

        // Collect the launched process so it can be killed later
        this.workerObjects.push(worker);
    }

    /**
     * Format the final test results for subsequent consumption by the round orchestrator
     * to {results: TransactionStatisticsCollector, start: val, end: val}
     * @param {TransactionStatisticsCollector[]} workerResults an Array of TransactionStatisticsCollector objects
     * @return {JSON} an appropriately formatted result
     */
    formatResults(workerResults) {
        logger.debug(`Entering formatResults with ${JSON.stringify(workerResults)}`);

        const txnCollectorArray = [];
        for (const workerResult of workerResults) {
            // Start building the array of all worker stats
            const stats = workerResult.stats;
            const txnCollector = TransactionStatisticsCollector.loadFromObject(stats);
            txnCollectorArray.push(txnCollector);
        }

        const results = TransactionStatisticsCollector.mergeCollectorResults(txnCollectorArray);

        return {
            results,
            start: results.getRoundStartTime(),
            end: results.getRoundFinishTime()
        };
    }

}

module.exports = WorkerOrchestrator;
