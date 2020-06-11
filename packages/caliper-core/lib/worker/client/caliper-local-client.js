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

const Config = require('../../common/config/config-util.js');
const CaliperUtils = require('../../common/utils/caliper-utils.js');
const CircularArray = require('../../common/utils/circular-array');
const bc   = require('../../common/core/blockchain.js');
const RateControl = require('../rate-control/rateControl.js');
const PrometheusClient = require('../../common/prometheus/prometheus-push-client');

const Logger = CaliperUtils.getLogger('caliper-local-client');

/**
 * Class for Client Interaction
 */
class CaliperLocalClient {

    /**
     * Create the test client
     * @param {Object} bcClient blockchain client
     * @param {number} clientIndex the client index
     * @param {Messenger} messenger a configured Messenger instance used to communicate with the orchestrator
     */
    constructor(bcClient, clientIndex, messenger) {
        this.blockchain = new bc(bcClient);
        this.clientIndex = clientIndex;
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
            newStats = bc.createNullDefaultTxStats();
            publish = false; // no point publishing nothing!!
        } else {
            newStats = this.blockchain.getDefaultTxStats(newResults, false);
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
            // client-orchestrator based update
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
                    newStats = this.blockchain.getDefaultTxStats(newResults, false);
                    this.resultStats[0] = newStats;
                    this.trim = 0;
                } else {
                    this.trim -= newResults.length;
                }
                break;
            }
        } else {
            this.resultStats[1] = newStats;
            bc.mergeDefaultTxStats(this.resultStats);
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
            // - set target for this round test/round/client
            this.prometheusClient.configureTarget(msg.label, msg.testRound, this.clientIndex);
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
     * @param {Object} cb callback module
     * @param {Object} number number of transactions to submit
     * @param {Object} rateController rate controller object
     * @async
     */
    async runFixedNumber(cb, number, rateController) {
        Logger.info('Info: client ' + this.clientIndex +  ' start test runFixedNumber()' + (cb.info ? (':' + cb.info) : ''));
        this.startTime = Date.now();

        const circularArray = new CircularArray(this.maxTxPromises);
        while (this.txNum < number) {
            // If this function calls cb.run() too quickly, micro task queue will be filled with unexecuted promises,
            // and I/O task(s) will get no chance to be execute and fall into starvation, for more detail info please visit:
            // https://snyk.io/blog/nodejs-how-even-quick-async-functions-can-block-the-event-loop-starve-io/
            await this.setImmediatePromise(() => {
                circularArray.add(cb.run().then((result) => {
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
     * @param {Object} cb callback module
     * @param {Object} duration duration to run for
     * @param {Object} rateController rate controller object
     * @async
     */
    async runDuration(cb, duration, rateController) {
        Logger.info('Info: client ' + this.clientIndex +  ' start test runDuration()' + (cb.info ? (':' + cb.info) : ''));
        this.startTime = Date.now();

        // Use a circular array of Promises so that the Promise.all() call does not exceed the maximum permissable Array size
        const circularArray = new CircularArray(this.maxTxPromises);
        while ((Date.now() - this.startTime)/1000 < duration) {
            // If this function calls cb.run() too quickly, micro task queue will be filled with unexecuted promises,
            // and I/O task(s) will get no chance to be execute and fall into starvation, for more detail info please visit:
            // https://snyk.io/blog/nodejs-how-even-quick-async-functions-can-block-the-event-loop-starve-io/
            await this.setImmediatePromise(() => {
                circularArray.add(cb.run().then((result) => {
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
     *              args:   user defined arguments,
     *              cb  :   path of the callback js file,
     *              config: path of the blockchain config file
     *              totalClients = total number of clients,
     *              pushUrl = the url for the push gateway
     *            };
     * @async
     */
    async prepareTest(test) {
        Logger.debug('prepareTest() with:', test);
        let cb = require(CaliperUtils.resolvePath(test.cb));

        const self = this;
        let initUpdateInter = setInterval( () => { self.initUpdate();  } , self.txUpdateTime);

        try {
            // Retrieve context for this round
            this.context = await this.blockchain.getContext(test.label, test.clientArgs);
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
            Logger.info(`Info: client ${this.clientIndex} prepare test ${(cb.info ? (':' + cb.info + 'phase starting...') : 'phase starting...')}`);
            await cb.init(this.blockchain, this.context, test.args);
            await CaliperUtils.sleep(this.txUpdateTime);
        } catch (err) {
            Logger.info(`Client[${this.clientIndex}] encountered an error during prepare test phase: ${(err.stack ? err.stack : err)}`);
            throw err;
        } finally {
            clearInterval(initUpdateInter);
            Logger.info(`Info: client ${this.clientIndex} prepare test ${(cb.info ? (':' + cb.info + 'phase complete') : 'phase complete')}`);
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
     *              args:   user defined arguments,
     *              cb  :   path of the callback js file,
     *              config: path of the blockchain config file
     *              totalClients = total number of clients,
     *              pushUrl = the url for the push gateway
     *            };
     * @return {Promise} promise object
     */
    async doTest(test) {
        Logger.debug('doTest() with:', test);
        let cb = require(CaliperUtils.resolvePath(test.cb));

        this.beforeTest(test);

        Logger.info('txUpdateTime: ' + this.txUpdateTime);
        const self = this;
        let txUpdateInter = setInterval( () => { self.txUpdate();  } , self.txUpdateTime);

        try {

            // Configure
            let rateController = new RateControl(test.rateControl, this.clientIndex, test.testRound);
            await rateController.init(test);

            // Run the test loop
            if (test.txDuration) {
                const duration = test.txDuration; // duration in seconds
                await this.runDuration(cb, duration, rateController);
            } else {
                const number = test.numb;
                await this.runFixedNumber(cb, number, rateController);
            }

            // Clean up
            await rateController.end();
            await cb.end();
            await this.blockchain.releaseContext(this.context);
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
                    results: this.blockchain.createNullDefaultTxStats(),
                    start: this.startTime,
                    end: this.endTime
                };
            }
        } catch (err) {
            this.clearUpdateInter();
            Logger.info(`Client[${this.clientIndex}] encountered an error: ${(err.stack ? err.stack : err)}`);
            throw err;
        } finally {
            this.txReset();
        }
    }
}

module.exports = CaliperLocalClient;
