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
const PrometheusQueryClient = require('../../common/prometheus/prometheus-query-client');
const PrometheusQueryHelper = require('../../common/prometheus/prometheus-query-helper');
const Utils = require('../../common/utils/caliper-utils');
const Logger = Utils.getLogger('prometheus-observer');

/**
 * PrometheusObserver class used to observe test statistics via terminal
 */
class PrometheusObserver extends TestObserverInterface {

    /**
     * Constructor
     * @param {object} benchmarkConfig The benchmark configuration object.
     */
    constructor(benchmarkConfig) {
        super(benchmarkConfig);

        // determine interval
        const interval = (this.benchmarkConfig.observer && this.benchmarkConfig.observer.interval) ? this.benchmarkConfig.observer.interval : 1;
        this.observeInterval = interval * 1000;

        // Define the query client
        const queryUrl = this.benchmarkConfig.monitor.prometheus.url;
        this.queryClient = new PrometheusQueryClient(queryUrl);
        Logger.info(`Configured observer to query URL ${queryUrl} every ${interval} seconds`);
    }

    /**
     * Perform an update
     */
    async update() {
        // Update using Prometheus Query
        // -Successful transactions
        const txSuccessQuery = `sum(caliper_txn_success{instance="${this.testName}", round="${this.testRound}"})`;
        const txSuccessCountResponse = await this.queryClient.query(txSuccessQuery, Date.now()/1000);
        const txSuccessCount = txSuccessCountResponse ? PrometheusQueryHelper.extractFirstValueFromQueryResponse(txSuccessCountResponse) : '-';

        // -Failed transactions
        const txFailQuery = `sum(caliper_txn_failure{instance="${this.testName}", round="${this.testRound}"})`;
        const txFailCountResponse = await this.queryClient.query(txFailQuery, Date.now()/1000);
        const txFailCount = txFailCountResponse ? PrometheusQueryHelper.extractFirstValueFromQueryResponse(txFailCountResponse) : '-';

        // -Pending transactions
        const txPendingQuery = `sum(caliper_txn_pending{instance="${this.testName}", round="${this.testRound}"})`;
        const txPendingCountResponse = await this.queryClient.query(txPendingQuery, Date.now()/1000);
        const txPendingCount = txPendingCountResponse ? PrometheusQueryHelper.extractFirstValueFromQueryResponse(txPendingCountResponse) : '-';

        // Could use query on submitted, but quicker to do addition here than use query service
        Logger.info('[' + this.testName + ' Round ' + this.testRound + ' Transaction Info] - Submitted: ' + (txSuccessCount + txFailCount + txPendingCount) +
        ' Succ: ' + txSuccessCount +
        ' Fail:' +  txFailCount +
        ' Unfinished:' + txPendingCount);
    }

    /**
     * Start observing the test output
     * @param {ClientOrchestrator} clientOrchestrator  the client orchestrator
     */
    startWatch(clientOrchestrator) {
        Logger.info(`Starting observer cycle with interval ${this.observeInterval} ms`);
        this.clientOrchestrator  = clientOrchestrator;
        if(!this.observeIntervalObject) {
            // start an interval to query updates
            const self = this;
            this.observeIntervalObject = setInterval(async() => { await self.update(); }, this.observeInterval);
        }
    }

    /**
     * Stop watching the test output
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
 * Creates a new PrometheusObserver instance.
 * @param {object} benchmarkConfig The benchmark configuration object.
 * @return {TestObserverInterface} The PrometheusObserver instance.
 */
function createTestObserver(benchmarkConfig) {
    return new PrometheusObserver(benchmarkConfig);
}

module.exports.createTestObserver = createTestObserver;
