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

const MonitorInterface = require('./monitor-interface');
const MonitorUtilities = require('./monitor-utilities');
const Util = require('../../common/utils/caliper-utils');
const ChartBuilder = require('../charts/chart-builder');
const Logger = Util.getLogger('monitor-process');

const ps = require('ps-node');
const usage = require('pidusage');

/**
 * * Resource monitor for local processes
 */
class MonitorProcess extends MonitorInterface {
    /**
     * Constructor
     * @param {JSON} resourceMonitorOptions Configuration options for the monitor
     */
    constructor(resourceMonitorOptions) {
        super(resourceMonitorOptions);
        this.isReading    = false;
        this.intervalObj  = null;
        this.pids = {}; // pid history array
    }

    /**
     * Initialise a state object
     * @return {JSON} state object
     */
    newStat() {
        return {
            mem_usage:   [],
            cpu_percent: []
        };
    }

    /**
     * Construct the identity of the process
     * @param {JSON} proc filter item of the process
     * @return {String} identity
     */
    getId(proc) {
        let id = proc.command;
        if (proc.hasOwnProperty('arguments')) {
            id += ' ' + proc.arguments;
        }

        if (proc.hasOwnProperty('multiOutput')) {
            id += '(' + proc.multiOutput + ')';
        } else {
            id += '(sum)';
        }

        return id;
    }


    /**
    * Find processes according to the lookup filter
    * @param {JSON} item lookup filter, must contains the 'command' element. Refer to https://www.npmjs.com/package/ps-node to learn more details.
    * @return {Promise} Array containing array of pids of found processes
    */
    findProcesses(item) {
        return new Promise((resolve, reject) => {
            let pids = [];
            ps.lookup(item, (err, resultList) => {
                if (err) {
                    Logger.error('failed looking the process up: ' + err);
                } else {
                    for (let i = 0 ; i < resultList.length ; i++) {
                        pids.push(resultList[i].pid);
                    }
                }
                resolve(pids);
            });
        });
    }

    /**
    * Get the memory and cpu usage of the specified process
    * @param {String} pid the process's pid
    * @return {JSON} JSON object as {cpu, memory}
    * @async
    */
    async getProcUsage(pid) {
        return new Promise((resolve, reject) => {
            usage.stat(pid, (error, stat) => {
                if (error) {
                    resolve({memory:0, cpu:0});
                } else {
                    resolve(stat);
                }
            });
        });
    }

    /**
    * Get the memory and cpu usage of multiple processes
    * @param {Array} pids  pids of specified processes
    * @param {String} type = avg, return the average usage of all processes; = sum(default), return the summing usage of all processes
    * @return {JSON} JSON object as {cpu, memory}
    * @async
    */
    async getUsage(pids, type) {
        try {
            let res = {memory: 0, cpu: 0};
            if(pids.length === 0) {
                return res;
            }

            let promises = pids.map((pid, idx) => {
                return this.getProcUsage(pid);
            });
            const stats = await Promise.all(promises);

            for(let i = 0 ; i< stats.length ; i++) {
                res.memory += stats[i].memory;
                res.cpu    += stats[i].cpu;
            }
            if(type === 'avg') {
                res.memory /= stats.length;
                res.cpu    /= stats.length;
            }
            return res;
        } catch (error) {
            Logger.warn(`Exception encountered when fetching resource usage of type ${type}`);
            return {memory: 0, cpu: 0};
        }
    }

    /**
     * Statistics read loop
     * @async
     */
    async readStats() {
        Logger.debug('Entering readStats()');
        if (!this.isReading) {
            try {
                this.isReading = true;
                for (let proc of this.watchItems) {
                    const pids = await this.findProcesses(proc);
                    if (!pids || pids.length === 0) {
                        // Does not exist
                        continue;
                    }
                    // record pids for later use (clear data)
                    for (let i = 0 ; i < pids.length ; ++i) {
                        this.pids[pids[i]] = 0;
                    }
                    // get usage for all processes
                    let name = this.getId(proc);
                    const stat = await this.getUsage(pids, proc.multiOutput);
                    this.stats[name].mem_usage.push(stat.memory);
                    this.stats[name].cpu_percent.push(stat.cpu);
                }
            } catch (error) {
                Logger.error('Exception occurred when reading process statistics: ' + error);
            } finally {
                this.isReading = false;
            }
        }
        Logger.debug('Exiting readStats()');
    }

    /**
     * Start the monitor
     * @async
     */
    async start() {
        // Configure items to be recorded
        this.stats  = {'time': []};
        this.watchItems = [];


        /* this.stats : record statistics of each process
            {
                'id' : {                    // 'command args'
                    'mem_usage'   : [],
                    'cpu_percent' : [],
                }
                .....
            }
        */
        for (let i = 0 ; i < this.options.processes.length ; i++) {
            if (this.options.processes[i].hasOwnProperty('command')) {
                let id = this.getId(this.options.processes[i]);
                Logger.info(`Registering ${id} within process monitor`);
                this.stats[id] = this.newStat();
                this.watchItems.push(this.options.processes[i]);
            }
        }

        // First read
        await this.readStats();

        // Start interval monitor
        const self = this;
        this.intervalObj = setInterval(async () => { await self.readStats(); } , this.interval);
        Logger.info(`Starting process monitor with update interval ${this.interval} ms`);
    }

    /**
     * Restart the monitor
     * @async
     */
    async restart() {
        await this.stop();
        await this.start();
    }

    /**
     * Stop the monitor
     * @async
     */
    async stop() {
        clearInterval(this.intervalObj);
        this.containers = [];
        this.stats      = {'time': []};

        for (let key in this.pids) {
            usage.unmonitor(key);
        }
        this.pids = [];

        await Util.sleep(100);
    }

    /**
     * Get a Map of result items
     * @return {Map} Map of items to build results for, with default null entries
     */
    getResultColumnMap() {
        const columns = ['Name', 'Memory(max)', 'Memory(avg)', 'CPU%(max)', 'CPU%(avg)'];
        const resultMap = new Map();

        for (const item of columns) {
            resultMap.set(item, 'N/A');
        }

        return resultMap;
    }

    /**
     * Get statistics from the monitor in the form of an Array containing Map<string, string> detailing key/value pairs
     * @param {string} testLabel the current test label
     * @return {Map<string, string>[]} an array of resource maps for watched containers
     * @async
     */
    async getStatistics(testLabel) {

        const resourceStats = [];
        let chartStats = [];
        try {
            for (const watchItem of this.watchItems) {
                const key = this.getId(watchItem);

                // retrieve stats for the key
                let mem = this.getMemHistory(key);
                let cpu = this.getCpuHistory(key);
                let mem_stat = MonitorUtilities.getStatistics(mem);
                let cpu_stat = MonitorUtilities.getStatistics(cpu);

                // Store in a Map
                const watchItemStat = this.getResultColumnMap();
                watchItemStat.set('Name', key);
                watchItemStat.set('Memory(max)', MonitorUtilities.byteNormalize(mem_stat.max));
                watchItemStat.set('Memory(avg)', MonitorUtilities.byteNormalize(mem_stat.avg));
                watchItemStat.set('CPU%(max)', cpu_stat.max.toFixed(2));
                watchItemStat.set('CPU%(avg)', cpu_stat.avg.toFixed(2));

                // append return array
                resourceStats.push(watchItemStat);
            }

            // Normalize the resource stats to a single unit
            const normalizeStats = ['Memory(max)', 'Memory(avg)'];
            for (const stat of normalizeStats) {
                MonitorUtilities.normalizeStats(stat, resourceStats);
            }

            // Retrieve Chart data
            const chartTypes = this.options.charting;
            if (chartTypes) {
                chartStats = ChartBuilder.retrieveChartStats(this.constructor.name, chartTypes, testLabel, resourceStats);
            }

        } catch (error) {
            Logger.error('Failed to read monitoring data, ' + (error.stack ? error.stack : error));
        }
        return { resourceStats, chartStats };
    }

    /**
     * Get history of memory usage
     * @param {String} key lookup key
     * @return {number[]} array of memory usage
     */
    getMemHistory(key) {
        //  just to keep the same length as getCpuHistory
        return this.stats[key].mem_usage.slice(1);
    }

    /**
     * Get history of CPU usage
     * @param {String} key key of the container
     * @return {number[]} array of CPU usage
     */
    getCpuHistory(key) {
        // the first element is an average from the starting time of the process
        // it does not correctly reflect the current CPU usage, so just ignore it
        return this.stats[key].cpu_percent.slice(1);
    }

}
module.exports = MonitorProcess;
