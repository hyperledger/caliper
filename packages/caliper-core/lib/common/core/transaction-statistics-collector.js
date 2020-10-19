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

/**
 * Encapsulates TX statistics for a given worker node for a given round.
 *
 * @property {TransactionStatisticsCollector[]} subCollectors Collection of TX statistics collectors processing only a subset of TXs.
 * @property {boolean} active Indicates whether the collector is active, i.e. it processes TX events.
 * @property {{metadata: {workerIndex: number, roundIndex: number, roundStartTime: number, roundFinishTime: number}, txCounters: {totalSubmitted: number, totalFinished: number, totalSuccessful: number, totalFailed: number}, timestamps: {firstCreateTime: number, lastCreateTime: number, firstFinishTime: number, lastFinishTime: number}, latency: {successful: {min: number, max: number, total: number}, failed: {min: number, max: number, total: number}}}} stats The different cumulative TX statistics.
 */
class TransactionStatisticsCollector {
    /**
     * Initializes the instance.
     * @param {number} workerIndex The index of the worker process.
     * @param {number} roundIndex The index of the round.
     * @param {string} roundLabel The roundLabel name.
     */
    constructor(workerIndex, roundIndex, roundLabel) {
        this.subCollectors = [];
        this.active = false;

        this.stats = {
            metadata: {
                workerIndex,
                roundIndex,
                roundLabel,
                roundStartTime: 0, // deactivated
                roundFinishTime: 0
            },
            txCounters: {
                totalSubmitted: 0,
                totalFinished: 0,
                totalSuccessful: 0,
                totalFailed: 0
            },
            timestamps: {
                firstCreateTime: Number.MAX_SAFE_INTEGER, // best default value for min
                lastCreateTime: 0,
                firstFinishTime: Number.MAX_SAFE_INTEGER, // best default value for min
                lastFinishTime: 0
            },
            latency: {
                successful: {
                    min: Number.MAX_SAFE_INTEGER, // best default value for min
                    max: 0,
                    total: 0
                },
                failed: {
                    min: Number.MAX_SAFE_INTEGER, // best default value for min
                    max: 0,
                    total: 0
                }
            }
        };
    }

    /**
     * Updates the TX statistics with the new result.
     * @param {TxStatus} txResult The TX status/information.
     * @private
     */
    _updateStatistics(txResult) {
        this.stats.txCounters.totalFinished +=1;

        // updating create time stats
        let createTime = txResult.GetTimeCreate();
        this.stats.timestamps.firstCreateTime =
            Math.min(createTime, this.stats.timestamps.firstCreateTime);
        this.stats.timestamps.lastCreateTime =
            Math.max(createTime, this.stats.timestamps.lastCreateTime);

        // updating finish time stats
        let finishTime = txResult.GetTimeFinal();
        this.stats.timestamps.firstFinishTime =
            Math.min(finishTime, this.stats.timestamps.firstFinishTime);
        this.stats.timestamps.lastFinishTime =
            Math.max(finishTime, this.stats.timestamps.lastFinishTime);

        let latency = finishTime - createTime;

        // separate stats for successful and failed TXs
        if (txResult.IsCommitted()) {
            this.stats.txCounters.totalSuccessful += 1;

            // latency stats
            this.stats.latency.successful.min =
                Math.min(latency, this.stats.latency.successful.min);
            this.stats.latency.successful.max =
                Math.max(latency, this.stats.latency.successful.max);
            this.stats.latency.successful.total += latency;

        } else {
            this.stats.txCounters.totalFailed += 1;

            // latency stats
            this.stats.latency.failed.min =
                Math.min(latency, this.stats.latency.failed.min);
            this.stats.latency.failed.max =
                Math.max(latency, this.stats.latency.failed.max);
            this.stats.latency.failed.total += latency;
        }
    }

    ////////////
    // Getters
    ////////////

    /**
     * Get the 0-based worker node index.
     * @return {number} The worker node index.
     */
    getWorkerIndex() {
        return this.stats.metadata.workerIndex;
    }

    /**
     * Get the 0-based round index.
     * @return {number} The round index.
     */
    getRoundIndex() {
        return this.stats.metadata.roundIndex;
    }

    /**
     * Return the string round label name
     * @return {string} the round label name
     */
    getRoundLabel() {
        return this.stats.metadata.roundLabel;
    }

    /**
     * Get the start time of the round.
     * @return {number} The epoch in milliseconds when the round was started.
     */
    getRoundStartTime() {
        return this.stats.metadata.roundStartTime;
    }

    /**
     * Get the finish time of the round.
     * @return {number} The epoch in milliseconds when the round was finished.
     */
    getRoundFinishTime() {
        return this.stats.metadata.roundFinishTime;
    }

    /**
     * Get the total number of submitted TXs.
     * @return {number} The total number of submitted TXs.
     */
    getTotalSubmittedTx() {
        return this.stats.txCounters.totalSubmitted;
    }

    /**
     * Get the total number of finished TXs.
     * @return {number} The total number of finished TXs.
     */
    getTotalFinishedTx() {
        return this.stats.txCounters.totalFinished;
    }

    /**
     * Get the total number of successful TXs.
     * @return {number} The total number of successful TXs.
     */
    getTotalSuccessfulTx() {
        return this.stats.txCounters.totalSuccessful;
    }

    /**
     * Get the total number of failed TXs.
     * @return {number} The total number of failed TXs.
     */
    getTotalFailedTx() {
        return this.stats.txCounters.totalFailed;
    }

    /**
     * Get the create time of the first submitted TX.
     * @return {number} The epoch in milliseconds when the first TX was submitted.
     */
    getFirstCreateTime() {
        return this.stats.timestamps.firstCreateTime;
    }

    /**
     * Get the create time of the last submitted TX.
     * @return {number} The epoch in milliseconds when the last TX was submitted.
     */
    getLastCreateTime() {
        return this.stats.timestamps.lastCreateTime;
    }

    /**
     * Get the finish time of the first finished TX.
     * @return {number} The epoch in milliseconds when the first TX was finished.
     */
    getFirstFinishTime() {
        return this.stats.timestamps.firstFinishTime;
    }

    /**
     * Get the finish time of the last finished TX.
     * @return {number} The epoch in milliseconds when the last TX was finished.
     */
    getLastFinishTime() {
        return this.stats.timestamps.lastFinishTime;
    }

    /**
     * Get the shortest latency for successful TXs.
     * @return {number} The shortest latency for successful TXs.
     */
    getMinLatencyForSuccessful() {
        return this.stats.latency.successful.min;
    }

    /**
     * Get the longest latency for successful TXs.
     * @return {number} The longest latency for successful TXs.
     */
    getMaxLatencyForSuccessful() {
        return this.stats.latency.successful.max;
    }

    /**
     * Get the total/summed latency for successful TXs.
     * @return {number} The total/summed latency for successful TXs.
     */
    getTotalLatencyForSuccessful() {
        return this.stats.latency.successful.total;
    }

    /**
     * Get the shortest latency for failed TXs.
     * @return {number} The shortest latency for failed TXs.
     */
    getMinLatencyForFailed() {
        return this.stats.latency.failed.min;
    }

    /**
     * Get the longest latency for failed TXs.
     * @return {number} The longest latency for failed TXs.
     */
    getMaxLatencyForFailed() {
        return this.stats.latency.failed.max;
    }

    /**
     * Get the total/summed latency for failed TXs.
     * @return {number} The total/summed latency for failed TXs.
     */
    getTotalLatencyForFailed() {
        return this.stats.latency.failed.total;
    }

    /**
     * Get a copy of the cumulative TX statistics.
     * @return {{metadata: {workerIndex: number, roundIndex: number, roundStartTime: number, roundFinishTime: number}, txCounters: {totalSubmitted: number, totalFinished: number, totalSuccessful: number, totalFailed: number}, timestamps: {firstCreateTime: number, lastCreateTime: number, firstFinishTime: number, lastFinishTime: number}, latency: {successful: {min: number, max: number, total: number}, failed: {min: number, max: number, total: number}}}} The aggregated TX statistics at the time of the function call.
     */
    getCumulativeTxStatistics() {
        return JSON.parse(JSON.stringify(this.stats));
    }

    /**
     * Create a TX stat collector from the given object.
     * @param {{metadata: {workerIndex: number, roundIndex: number, roundStartTime: number, roundFinishTime: number}, txCounters: {totalSubmitted: number, totalFinished: number, totalSuccessful: number, totalFailed: number}, timestamps: {firstCreateTime: number, lastCreateTime: number, firstFinishTime: number, lastFinishTime: number}, latency: {successful: {min: number, max: number, total: number}, failed: {min: number, max: number, total: number}}}} obj The source object.
     * @return {TransactionStatisticsCollector} The TX stat collector instance.
     */
    static loadFromObject(obj) {
        let collector = new TransactionStatisticsCollector(obj.metadata.workerIndex, obj.metadata.roundIndex);
        collector.stats = JSON.parse(JSON.stringify(obj));
        return collector;
    }

    /**
     * Merge the given collector statistics into a single collector statistic.
     * @param {TransactionStatisticsCollector[]} collectors The collectors whose current results should be merged.
     * @return {TransactionStatisticsCollector} The collector containing the merged results.
     */
    static mergeCollectorResults(collectors) {
        // snapshot of current results
        let currentStats = collectors.map(c => c.getCumulativeTxStatistics());

        // NOTE: we have a 2D grid of stats, the axis are: "worker" and "round"
        // 1) If the stats are all from the same round, and from different workers, then we get a round-level summary
        // 2) If the stats are all from the same worker, and from different rounds, then we get a worker-level summary
        // 3) If the stats are from all rounds and from all workers, then we get a benchmark-level summary

        let uniqueWorkerIndices = Array.from(new Set(currentStats.map(s => s.metadata.workerIndex)));
        let uniqueRoundIndices = Array.from(new Set(currentStats.map(s => s.metadata.roundIndex)));

        // if everything is from the same worker, we can "merge" its index
        let workerIndex = uniqueWorkerIndices.length === 1 ? uniqueWorkerIndices[0] : -1;

        // if everything is from the same round, we can "merge" its index
        let roundIndex = uniqueRoundIndices.length === 1 ? uniqueRoundIndices[0] : -1;

        const sum = (prev, curr) => prev + curr;
        const sumStats = (selector) => currentStats.map(stat => selector(stat)).reduce(sum, 0);
        const minStat = (selector) => Math.min(...currentStats.map(stat => selector(stat)));
        const maxStat = (selector) => Math.max(...currentStats.map(stat => selector(stat)));

        let mergedStats = {
            metadata: {
                workerIndex: workerIndex,
                roundIndex: roundIndex,
                roundStartTime: minStat(stat => stat.metadata.roundStartTime), // Remark 1
                roundFinishTime: maxStat(stat => stat.metadata.roundFinishTime), // Remark 2
            },
            txCounters: {
                totalSubmitted: sumStats(stat => stat.txCounters.totalSubmitted),
                totalFinished: sumStats(stat => stat.txCounters.totalFinished),
                totalSuccessful: sumStats(stat => stat.txCounters.totalSuccessful),
                totalFailed: sumStats(stat => stat.txCounters.totalFailed),
            },
            timestamps: {
                firstCreateTime: minStat(stat => stat.timestamps.firstCreateTime),
                lastCreateTime: maxStat(stat => stat.timestamps.lastCreateTime),
                firstFinishTime: minStat(stat => stat.timestamps.firstFinishTime),
                lastFinishTime: maxStat(stat => stat.timestamps.lastFinishTime)
            },
            latency: {
                successful: {
                    min: minStat(stat => stat.latency.successful.min),
                    max: maxStat(stat => stat.latency.successful.max),
                    total: sumStats(stat => stat.latency.successful.total),
                },
                failed: {
                    min: minStat(stat => stat.latency.failed.min),
                    max: maxStat(stat => stat.latency.failed.max),
                    total: sumStats(stat => stat.latency.failed.total),
                }
            }
        };

        return TransactionStatisticsCollector.loadFromObject(mergedStats);
    }

    /**
     * Add a sub-collector to monitor the subset of TX events.
     * @param {TransactionStatisticsCollector} collector The sub-collector instance.
     */
    addSubCollector(collector) {
        this.subCollectors.push(collector);
    }

    //////////////
    // TX events
    //////////////

    /**
     * Activates the collector and marks the round starting time.
     * NOTE: the sub-collectors are not activated.
     */
    activate() {
        this.stats.metadata.roundStartTime = Date.now();
        this.active = true;
    }

    /**
     * Called when TXs are submitted. Updates the related statistics.
     * @param {number} count The number of submitted TXs. Can be greater than one for a batch of TXs.
     */
    txSubmitted(count) {
        if (!this.active) {
            return;
        }

        this.stats.txCounters.totalSubmitted += count;
        for (let subcollector of this.subCollectors) {
            subcollector.txSubmitted(count);
        }
    }

    /**
     * Called when TXs are finished. Updates the related statistics.
     * @param {TxStatus | TxStatus[]} results The result information of the finished TXs. Can be a collection of results for a batch of TXs.
     */
    txFinished(results) {
        if (!this.active) {
            return;
        }

        if (Array.isArray(results)) {
            let relevantResults = results.filter(r => r.GetTimeCreate() > this.getRoundStartTime());
            for (let result of relevantResults) {
                this._updateStatistics(result);
            }
            for (let subcollector of this.subCollectors) {
                subcollector.txFinished(relevantResults);
            }
        } else if (results.GetTimeCreate() > this.getRoundStartTime()) {
            this._updateStatistics(results);
            for (let subcollector of this.subCollectors) {
                subcollector.txFinished(results);
            }
        }
    }

    /**
     * Deactivates the collector and marks the round finish time.
     * NOTE: the sub-collectors are not deactivated.
     */
    deactivate() {
        this.stats.metadata.roundFinishTime = Date.now();
        this.active = false;
    }
}

module.exports = TransactionStatisticsCollector;
