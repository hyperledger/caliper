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

const TestObserverInterface = require('./observer-interface');
const TransactionStatisticsCollector = require('../../common/core/transaction-statistics-collector');
const Utils = require('../../common/utils/caliper-utils');
const ConfigUtil = require('../../common/config/config-util');
const Logger = Utils.getLogger('default-observer');

/**
 * DefaultObserver class used to observe test statistics via terminal
 */
class DefaultObserver extends TestObserverInterface {

    /**
     * Constructor
     */
    constructor() {
        super();

        // set the observer interval
        this.observeInterval = ConfigUtil.get(ConfigUtil.keys.Progress.Reporting.Interval);
        Logger.info(`Observer interval set to ${this.observeInterval} seconds`);
        this.observeIntervalObject = null;
        this.updateTail = 0;
        this.updateID   = 0;
        this.testData =  {
            maxlen : 300,
            throughput: {
                x: [],
                submitted: [0],
                succeeded: [0],
                failed: [0]
            },
            latency: {
                x: [],
                max: [0],
                min: [0],
                avg: [0]
            },
            summary: {
                txSub: 0,
                txSucc: 0,
                txFail: 0,
                round: 0,
            },
            report: ''
        };
    }

    /**
     * Add Throughput
     * @param {*} sub submitted
     * @param {*} suc successful
     * @param {*} fail fail
     */
    setThroughput(sub, suc, fail) {
        this.testData.summary.txSub  = sub;
        this.testData.summary.txSucc = suc;
        this.testData.summary.txFail = fail;
    }

    /**
     * Add Latency
     * @param {*} max the maximum
     * @param {*} min the minimum
     * @param {*} avg the average
     */
    addLatency(max, min, avg) {
        this.testData.latency.max.push(max);
        this.testData.latency.min.push(min);
        this.testData.latency.avg.push(avg);
        if (this.testData.latency.x.length < this.testData.latency.max.length) {
            let last = this.testData.latency.x[this.testData.latency.x.length - 1];
            this.testData.latency.x.push(last + this.observeInterval);
        }
        if (this.testData.latency.max.length > this.testData.maxlen) {
            this.testData.latency.max.shift();
            this.testData.latency.min.shift();
            this.testData.latency.avg.shift();
            this.testData.latency.x.shift();
        }
    }

    /**
     * Reset test data
     */
    resetTestData() {
        this.testData.latency = {
            x: [],
            max: [0],
            min: [0],
            avg: [0]
        };
        this.testData.summary = {
            txSub: 0,
            txSucc: 0,
            txFail: 0,
            round: this.testData.summary.round,
        };
    }

    /**
     * Refresh data
     * @param {*} updates updates to use
     */
    refreshData(updates) {
        if (updates.length === 0 || Object.entries(updates[0]).length === 0) {
            // Nothing to update with, set zero
            this.setThroughput(0,0,0);
            this.addLatency(0,0,0);
        } else {
            let deMax = -1, deMin = -1, deAvg = 0;

            // Updates may come from multiple workers, and may get more than one update per worker in an interval
            // - We need to sum the transaction counts, and evaluate the min/max/average of latencies
            const txnCollectionMap = new Map();
            for (let i = 0 ; i < updates.length ; i++) {
                const data = updates[i];
                if (data.type.localeCompare('txReset') === 0) {
                    // Resetting internal store
                    // - return once reset to prevent printing unrequired values
                    Logger.info('Resetting txCount indicator count');
                    this.resetTestData();
                    return;
                }

                // Work on the stats object
                const stats = data.stats;
                const txnCollector = TransactionStatisticsCollector.loadFromObject(stats);
                const workerIndex = txnCollector.getWorkerIndex();

                txnCollectionMap.set(workerIndex, txnCollector);
            }

            if (txnCollectionMap.size > 0) {
                let txnCollectorArray = Array.from( txnCollectionMap.values() );
                const txnCollection = TransactionStatisticsCollector.mergeCollectorResults(txnCollectorArray);

                // Base transaction counters
                this.setThroughput(txnCollection.getTotalSubmittedTx(), txnCollection.getTotalSuccessfulTx(), txnCollection.getTotalFailedTx());

                // Latencies calculated on successful transactions
                if (txnCollection.getTotalSuccessfulTx() > 0) {
                    if (deMax === -1 || deMax < txnCollection.getMaxLatencyForSuccessful()) {
                        deMax = txnCollection.getMaxLatencyForSuccessful();
                    }
                    if (deMin === -1 || deMin > txnCollection.getMinLatencyForSuccessful()) {
                        deMin = txnCollection.getMinLatencyForSuccessful();
                    }
                    deAvg += txnCollection.getTotalLatencyForSuccessful();
                }

                if (txnCollection.getTotalSuccessfulTx() > 0) {
                    deAvg /= txnCollection.getTotalSuccessfulTx();
                }
            }

            if (isNaN(deMax) || isNaN(deMin) || deAvg === 0) {
                this.addLatency(0,0,0);
            } else {
                this.addLatency(deMax, deMin, deAvg);
            }
        }

        // Log current statistics using global observer store as above update might not have occurred
        Logger.info('[' + this.testName + ' Round ' + this.testRound + ' Transaction Info] - Submitted: ' + this.testData.summary.txSub +
        ' Succ: ' + this.testData.summary.txSucc +
        ' Fail:' +  this.testData.summary.txFail +
        ' Unfinished:' + (this.testData.summary.txSub - this.testData.summary.txSucc - this.testData.summary.txFail));
    }

    /**
     * Perform an update
     * @async
     */
    async update() {
        if (typeof this.workerOrchestrator === 'undefined') {
            this.refreshData([]);
            return;
        }
        let updates = this.workerOrchestrator.getUpdates();
        if (updates.id > this.updateID) {
            // new buffer
            this.updateTail = 0;
            this.updateID = updates.id;
        }
        let data = [];
        let len = updates.data.length;
        if (len > this.updateTail) {
            data = updates.data.slice(this.updateTail, len);
            this.updateTail = len;
        }
        this.refreshData(data);
    }

    /**
     * Start watching the test output of the orchestrator
     * @param {WorkerOrchestrator} workerOrchestrator  the worker orchestrator
     */
    startWatch(workerOrchestrator) {
        this.workerOrchestrator  = workerOrchestrator;
        if(this.observeIntervalObject === null) {
            this.updateTail = 0;
            this.updateID   = 0;
            // start an interval to query updates
            const self = this;
            this.observeIntervalObject = setInterval(async() => { await self.update(); }, this.observeInterval);
        }
    }

    /**
     * Stop watching the test output of the orchestrator
     * @async
     */
    async stopWatch() {
        if(this.observeIntervalObject) {
            clearInterval(this.observeIntervalObject);
            this.observeIntervalObject = null;
            await Utils.sleep(this.observeInterval);
            await this.update();
        }
    }

    /**
     * Set the test name to be reported
     * @param {String} name the benchmark name
     */
    setBenchmark(name) {
        this.testName = name;
    }

    /**
     * Set the test round for the watcher
     * @param{*} roundIdx the round index
     */
    setRound(roundIdx) {
        this.testRound = roundIdx;
    }

    /**
     * Called when new TX stats are available.
     * @param {TransactionStatisticsCollector} stats The TX stats collector instance.
     */
    txUpdateArrived(stats) {
        // TODO: push model instead of pull
    }
}

/**
 * Creates a new DefaultObserver instance.
 * @return {TestObserverInterface} The DefaultObserver instance.
 */
function createTestObserver() {
    return new DefaultObserver();
}

module.exports.createTestObserver = createTestObserver;
