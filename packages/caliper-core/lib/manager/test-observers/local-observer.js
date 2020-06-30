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
const Utils = require('../../common/utils/caliper-utils');
const Logger = Utils.getLogger('local-observer');

/**
 * LocalObserver class used to observe test statistics via terminal
 */
class LocalObserver extends TestObserverInterface {

    /**
     * Constructor
     * @param {object} benchmarkConfig The benchmark configuration object.
     */
    constructor(benchmarkConfig) {
        super(benchmarkConfig);

        // set the observer interval
        const interval = (this.benchmarkConfig.observer && this.benchmarkConfig.observer.interval) ? this.benchmarkConfig.observer.interval : 1;
        this.observeInterval = interval * 1000;
        Logger.info(`Observer interval set to ${interval} seconds`);
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
    addThroughput(sub, suc, fail) {
        this.testData.throughput.submitted.push(sub/this.observeInterval);
        this.testData.throughput.succeeded.push(suc/this.observeInterval);
        this.testData.throughput.failed.push(fail/this.observeInterval);
        if (this.testData.throughput.x.length < this.testData.throughput.submitted.length) {
            let last = this.testData.throughput.x[this.testData.throughput.x.length - 1];
            this.testData.throughput.x.push(last + this.observeInterval);
        }
        if (this.testData.throughput.submitted.length > this.testData.maxlen) {
            this.testData.throughput.submitted.shift();
            this.testData.throughput.succeeded.shift();
            this.testData.throughput.failed.shift();
            this.testData.throughput.x.shift();
        }
        this.testData.summary.txSub  += sub;
        this.testData.summary.txSucc += suc;
        this.testData.summary.txFail += fail;
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
        if(this.testData.latency.x.length < this.testData.latency.max.length) {
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
        this.testData.throughput = {
            x: [],
            submitted: [0],
            succeeded: [0],
            failed: [0]
        };
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
            this.addThroughput(0,0,0);
            this.addLatency(0,0,0);
        } else {
            let sub = 0, suc = 0, fail = 0;
            let deMax = -1, deMin = -1, deAvg = 0;
            for(let i = 0 ; i < updates.length ; i++) {
                let data = updates[i];
                if (data.type.localeCompare('txReset') === 0) {
                    // Resetting values
                    Logger.info('Resetting txCount indicator count');
                    this.resetTestData();
                    continue;
                }
                sub += data.submitted;
                suc += data.committed.succ;
                fail += data.committed.fail;

                if(data.committed.succ > 0) {
                    if(deMax === -1 || deMax < data.committed.delay.max) {
                        deMax = data.committed.delay.max;
                    }
                    if(deMin === -1 || deMin > data.committed.delay.min) {
                        deMin = data.committed.delay.min;
                    }
                    deAvg += data.committed.delay.sum;
                }
            }
            if(suc > 0) {
                deAvg /= suc;
            }
            this.addThroughput(sub, suc, fail);

            if(isNaN(deMax) || isNaN(deMin) || deAvg === 0) {
                this.addLatency(0,0,0);
            }
            else {
                this.addLatency(deMax, deMin, deAvg);
            }

        }

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
        if (typeof this.clientOrchestrator === 'undefined') {
            this.refreshData([]);
            return;
        }
        let updates = this.clientOrchestrator.getUpdates();
        if(updates.id > this.updateID) { // new buffer
            this.updateTail = 0;
            this.updateID   = updates.id;
        }
        let data = [];
        let len  = updates.data.length;
        if(len > this.updateTail) {
            data = updates.data.slice(this.updateTail, len);
            this.updateTail = len;
        }
        this.refreshData(data);
    }

    /**
     * Start watching the test output of the orchestrator
     * @param {ClientOrchestrator} clientOrchestrator  the client orchestrator
     */
    startWatch(clientOrchestrator) {
        this.clientOrchestrator  = clientOrchestrator;
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
}

/**
 * Creates a new LocalObserver instance.
 * @param {object} benchmarkConfig The benchmark configuration object.
 * @return {TestObserverInterface} The LocalObserver instance.
 */
function createTestObserver(benchmarkConfig) {
    return new LocalObserver(benchmarkConfig);
}

module.exports.createTestObserver = createTestObserver;
