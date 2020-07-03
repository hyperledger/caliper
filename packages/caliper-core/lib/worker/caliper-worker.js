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

const Config = require('../common/config/config-util.js');
const CaliperUtils = require('../common/utils/caliper-utils.js');
const CircularArray = require('../common/utils/circular-array');
const RateControl = require('./rate-control/rateControl.js');
const PrometheusClient = require('../common/prometheus/prometheus-push-client');
const TransactionStatistics = require('../common/core/transaction-statistics');

const Logger = CaliperUtils.getLogger('caliper-worker');

/**
 * Class for Worker Interaction
 */
class CaliperWorker {

    /**
     * Create the test worker
     * @param {Object} connector blockchain worker connector
     * @param {number} workerIndex the worker index
     * @param {Messenger} messenger a configured Messenger instance used to communicate with the orchestrator
     */
    constructor(connector, workerIndex, messenger) {
        this.connector = connector;
        this.workerIndex = workerIndex;
        this.currentRoundIndex = -1;
        this.messenger = messenger;
        this.context = undefined;
        this.txUpdateTime = Config.get(Config.keys.TxUpdateTime, 5000);
        this.maxTxPromises = Config.get(Config.keys.Worker.MaxTxPromises, 100);

        // Internal stats
        this.results      = [];
        this.txNum        = 0;
        this.txLastNum    = 0;
        this.resultStats  = [];
        this.trimType = 0;
        this.trim = 0;
        this.startTime = 0;

        // Prometheus related
        this.prometheusClient = new PrometheusClient();
        this.totalTxCount = 0;
        this.totalTxDelay = 0;

        /**
         * The workload module instance associated with the current round, updated by {CaliperWorker.prepareTest}.
         * @type {WorkloadModuleInterface}
         */
        this.workloadModule = undefined;
    }

    /**
     * Initialization update
     */
    initUpdate() {
        Logger.info('Initialization ongoing...');
    }

    /**
     * Calculate real-time transaction statistics and send the txUpdated message
     */
    txUpdate() {
        let newNum = this.txNum - this.txLastNum;
        this.txLastNum += newNum;

        // get a copy to work from
        let newResults = this.results.slice(0);
        this.results = [];
        if (newResults.length === 0 && newNum === 0) {
            return;
        }
        let newStats;
        let publish = true;
        if (newResults.length === 0) {
            newStats = TransactionStatistics.createNullDefaultTxStats();
            publish = false; // no point publishing nothing!!
        } else {
            newStats = TransactionStatistics.getDefaultTxStats(newResults, false);
        }

        // Update monitor
        if (this.prometheusClient.gatewaySet() && publish){
            // Send to Prometheus push gateway

            // TPS and latency batch results for this current txUpdate limited set
            const batchTxCount = newStats.succ + newStats.fail;
            const batchTPS = (batchTxCount/this.txUpdateTime)*1000;  // txUpdate is in ms
            const batchLatency = newStats.delay.sum/batchTxCount;
            this.prometheusClient.push('caliper_tps', batchTPS);
            this.prometheusClient.push('caliper_latency', batchLatency);
            this.prometheusClient.push('caliper_txn_submit_rate', (newNum/this.txUpdateTime)*1000); // txUpdate is in ms

            // Numbers for test round only
            this.totalTxnSuccess += newStats.succ;
            this.totalTxnFailure += newStats.fail;
            this.prometheusClient.push('caliper_txn_success', this.totalTxnSuccess);
            this.prometheusClient.push('caliper_txn_failure', this.totalTxnFailure);
            this.prometheusClient.push('caliper_txn_pending', (this.txNum - (this.totalTxnSuccess + this.totalTxnFailure)));
        } else {
            // worker-orchestrator based update
            // send(to, type, data)
            this.messenger.send(['orchestrator'],'txUpdate', {submitted: newNum, committed: newStats});
        }

        if (this.resultStats.length === 0) {
            switch (this.trimType) {
            case 0: // no trim
                this.resultStats[0] = newStats;
                break;
            case 1: // based on duration
                if (this.trim < (Date.now() - this.startTime)/1000) {
                    this.resultStats[0] = newStats;
                }
                break;
            case 2: // based on number
                if (this.trim < newResults.length) {
                    newResults = newResults.slice(this.trim);
                    newStats = TransactionStatistics.getDefaultTxStats(newResults, false);
                    this.resultStats[0] = newStats;
                    this.trim = 0;
                } else {
                    this.trim -= newResults.length;
                }
                break;
            }
        } else {
            this.resultStats[1] = newStats;
            TransactionStatistics.mergeDefaultTxStats(this.resultStats);
        }
    }

    /**
     * Method to reset values
     */
    txReset(){

        // Reset txn counters
        this.results  = [];
        this.resultStats = [];
        this.txNum = 0;
        this.txLastNum = 0;

        if (this.prometheusClient.gatewaySet()) {
            // Reset Prometheus
            this.totalTxnSuccess = 0;
            this.totalTxnFailure = 0;
            this.prometheusClient.push('caliper_txn_success', 0);
            this.prometheusClient.push('caliper_txn_failure', 0);
            this.prometheusClient.push('caliper_txn_pending', 0);
        } else {
            // Reset Local
            // send(to, type, data)
            this.messenger.send(['orchestrator'],'txReset', {type: 'txReset'});
        }
    }

    /**
     * Add new test result into global array
     * @param {Object} result test result, should be an array or a single JSON object
     */
    addResult(result) {
        if (Array.isArray(result)) { // contain multiple results
            for(let i = 0 ; i < result.length ; i++) {
                this.results.push(result[i]);
            }
        } else {
            this.results.push(result);
        }
    }

    /**
     * Call before starting a new test
     * @param {JSON} msg start test message
     */
    beforeTest(msg) {
        this.txReset();

        // TODO: once prometheus is enabled, trim occurs as part of the retrieval query
        // conditionally trim beginning and end results for this test run
        if (msg.trim) {
            if (msg.txDuration) {
                this.trimType = 1;
            } else {
                this.trimType = 2;
            }
            this.trim = msg.trim;
        } else {
            this.trimType = 0;
        }

        // Prometheus is specified if msg.pushUrl !== null
        if (msg.pushUrl !== null) {
            // - ensure counters reset
            this.totalTxnSubmitted = 0;
            this.totalTxnSuccess = 0;
            this.totalTxnFailure = 0;
            // - Ensure gateway base URL is set
            if (!this.prometheusClient.gatewaySet()){
                this.prometheusClient.setGateway(msg.pushUrl);
            }
            // - set target for this round test/round/worker
            this.prometheusClient.configureTarget(msg.label, msg.testRound, this.workerIndex);
        }
    }

    /**
     * Callback for new submitted transaction(s)
     * @param {Number} count count of new submitted transaction(s)
     */
    submitCallback(count) {
        this.txNum += count;
    }

    /**
     * Put a task to immediate queue of NodeJS event loop
     * @param {function} func The function needed to be executed immediately
     * @return {Promise} Promise of execution
     */
    setImmediatePromise(func) {
        return new Promise((resolve) => {
            setImmediate(() => {
                func();
                resolve();
            });
        });
    }

    /**
     * Perform test with specified number of transactions
     * @param {Object} number number of transactions to submit
     * @param {Object} rateController rate controller object
     * @async
     */
    async runFixedNumber(number, rateController) {
        Logger.info(`Worker ${this.workerIndex} is starting TX number-based round ${this.currentRoundIndex + 1} (${number} TXs)`);
        this.startTime = Date.now();

        const circularArray = new CircularArray(this.maxTxPromises);
        const self = this;
        while (this.txNum < number) {
            // If this function calls this.workloadModule.submitTransaction() too quickly, micro task queue will be filled with unexecuted promises,
            // and I/O task(s) will get no chance to be execute and fall into starvation, for more detail info please visit:
            // https://snyk.io/blog/nodejs-how-even-quick-async-functions-can-block-the-event-loop-starve-io/
            await this.setImmediatePromise(() => {
                circularArray.add(self.workloadModule.submitTransaction()
                    .then((result) => {
                        this.addResult(result);
                        return Promise.resolve();
                    }));
            });
            await rateController.applyRateControl(this.startTime, this.txNum, this.results, this.resultStats);
        }

        await Promise.all(circularArray);
        this.endTime = Date.now();
    }

    /**
     * Perform test with specified test duration
     * @param {Object} duration duration to run for
     * @param {Object} rateController rate controller object
     * @async
     */
    async runDuration(duration, rateController) {
        Logger.info(`Worker ${this.workerIndex} is starting duration-based round ${this.currentRoundIndex + 1} (${duration} seconds)`);
        this.startTime = Date.now();

        // Use a circular array of Promises so that the Promise.all() call does not exceed the maximum permissable Array size
        const circularArray = new CircularArray(this.maxTxPromises);
        const self = this;
        while ((Date.now() - this.startTime)/1000 < duration) {
            // If this function calls this.workloadModule.submitTransaction() too quickly, micro task queue will be filled with unexecuted promises,
            // and I/O task(s) will get no chance to be execute and fall into starvation, for more detail info please visit:
            // https://snyk.io/blog/nodejs-how-even-quick-async-functions-can-block-the-event-loop-starve-io/
            await this.setImmediatePromise(() => {
                circularArray.add(self.workloadModule.submitTransaction()
                    .then((result) => {
                        this.addResult(result);
                        return Promise.resolve();
                    }));
            });
            await rateController.applyRateControl(this.startTime, this.txNum, this.results, this.resultStats);
        }

        await Promise.all(circularArray);
        this.endTime = Date.now();
    }

    /**
     * Clear the update interval
     * @param {Object} txUpdateInter the test transaction update interval
     */
    clearUpdateInter(txUpdateInter) {
        // stop reporter
        if (txUpdateInter) {
            clearInterval(txUpdateInter);
            txUpdateInter = null;
            this.txUpdate();
        }
    }

    /**
     * Perform test init within Benchmark
     * @param {JSON} test the test details
     * message = {
     *              label : label name,
     *              numb:   total number of simulated txs,
     *              rateControl: rate controller to use
     *              trim:   trim options
     *              workload:  the workload object from the config,
     *              config: path of the blockchain config file
     *              totalClients = total number of clients,
     *              pushUrl = the url for the push gateway
     *            };
     * @async
     */
    async prepareTest(test) {
        Logger.debug('prepareTest() with:', test);
        this.currentRoundIndex = test.testRound;

        const workloadModuleFactory = CaliperUtils.loadModuleFunction(new Map(), test.workload.module, 'createWorkloadModule');
        this.workloadModule = workloadModuleFactory();

        const self = this;
        let initUpdateInter = setInterval( () => { self.initUpdate();  } , self.txUpdateTime);

        try {
            // Retrieve context for this round
            this.context = await this.connector.getContext(this.currentRoundIndex, test.clientArgs);
            if (typeof this.context === 'undefined') {
                this.context = {
                    engine : {
                        submitCallback : (count) => { self.submitCallback(count); }
                    }
                };
            } else {
                this.context.engine = {
                    submitCallback : (count) => { self.submitCallback(count); }
                };
            }

            // Run init phase of callback
            Logger.info(`Info: worker ${this.workerIndex} prepare test phase for round ${this.currentRoundIndex + 1} is starting...`);
            await this.workloadModule.initializeWorkloadModule(this.workerIndex, test.totalClients, this.currentRoundIndex, test.workload.arguments, this.connector, this.context);
            await CaliperUtils.sleep(this.txUpdateTime);
        } catch (err) {
            Logger.info(`Worker [${this.workerIndex}] encountered an error during prepare test phase for round ${this.currentRoundIndex + 1}: ${(err.stack ? err.stack : err)}`);
            throw err;
        } finally {
            clearInterval(initUpdateInter);
            Logger.info(`Info: worker ${this.workerIndex} prepare test phase for round ${this.currentRoundIndex + 1} is completed`);
        }
    }

    /**
     * Perform the test
     * @param {JSON} test start test message
     * message = {
     *              label : label name,
     *              numb:   total number of simulated txs,
     *              rateControl: rate controller to use
     *              trim:   trim options
     *              workload:  the workload object from the config,
     *              config: path of the blockchain config file
     *              totalClients = total number of clients,
     *              pushUrl = the url for the push gateway
     *            };
     * @return {Promise} promise object
     */
    async doTest(test) {
        Logger.debug('doTest() with:', test);

        this.beforeTest(test);

        Logger.info('txUpdateTime: ' + this.txUpdateTime);
        const self = this;
        let txUpdateInter = setInterval( () => { self.txUpdate();  } , self.txUpdateTime);

        try {

            // Configure
            let rateController = new RateControl(test.rateControl, this.workerIndex, test.testRound);
            await rateController.init(test);

            // Run the test loop
            if (test.txDuration) {
                const duration = test.txDuration; // duration in seconds
                await this.runDuration(duration, rateController);
            } else {
                const number = test.numb;
                await this.runFixedNumber(number, rateController);
            }

            // Clean up
            await rateController.end();
            await this.workloadModule.cleanupWorkloadModule();
            await this.connector.releaseContext(this.context);
            this.clearUpdateInter(txUpdateInter);

            // Return the results and time stamps
            if (this.resultStats.length > 0) {
                return {
                    results: this.resultStats[0],
                    start: this.startTime,
                    end: this.endTime
                };
            } else {
                return {
                    results: TransactionStatistics.createNullDefaultTxStats(),
                    start: this.startTime,
                    end: this.endTime
                };
            }
        } catch (err) {
            this.clearUpdateInter();
            Logger.info(`Worker [${this.workerIndex}] encountered an error: ${(err.stack ? err.stack : err)}`);
            throw err;
        } finally {
            this.txReset();
        }
    }
}

module.exports = CaliperWorker;
