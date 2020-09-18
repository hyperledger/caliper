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

const Util = require('../../common/utils/caliper-utils');
const Logger = Util.getLogger('monitor-docker');
const MonitorInterface = require('./monitor-interface');
const MonitorUtilities = require('./monitor-utilities');
const ChartBuilder = require('../charts/chart-builder');

const URL = require('url');
const Docker = require('dockerode');
const SystemInformation = require('systeminformation');

/**
 * Resource monitor for local/remote docker containers
 */
class MonitorDocker extends MonitorInterface {
    /**
     * Constructor
     * @param {JSON} resourceMonitorOptions Configuration options for the monitor
     */
    constructor(resourceMonitorOptions) {
        super(resourceMonitorOptions);
        this.containers = null;
        this.isReading = false;
        this.intervalObj = null;
        this.stats = { 'time': [] };
        /* this.stats : used to record statistics of each container
            {
                'time' : [] // time slot
                'container_id" : {              // refer to https://www.npmjs.com/package/systeminformation
                    'mem_usage'   : [],
                    'mem_percent' : [],
                    'cpu_percent' : [],
                    'netIO_rx'    : [],
                    'netIO_tx'    : [],
                    'blockIO_rx'  : [],
                    'blockIO_wx'  : []
                }
                next container
                .....
            }
        */
    }

    /**
     * Find local containers according to searching filters and persist in local memory
     * @async
     */
    async findContainers() {
        this.containers = [];
        let filterName = { local: [], remote: {} };
        // Split docker items that are local or remote
        if (this.options.hasOwnProperty('containers')) {
            for (let key in this.options.containers) {
                let container = this.options.containers[key];
                if (container.indexOf('http://') === 0) {
                    // Is remote
                    let remote = URL.parse(container, true);
                    if (remote.hostname === null || remote.port === null || remote.pathname === '/') {
                        Logger.warn('unrecognized host, ' + container);
                    } else if (filterName.remote.hasOwnProperty(remote.hostname)) {
                        filterName.remote[remote.hostname].containers.push(remote.pathname);
                    } else {
                        filterName.remote[remote.hostname] = { port: remote.port, containers: [remote.pathname] };
                    }
                } else {
                    // Is local
                    filterName.local.push(container);
                }
            }
        }

        // Filter local containers by name
        if (filterName.local.length > 0) {
            try {
                const containers = await SystemInformation.dockerContainers('active');
                let size = containers.length;
                if (size === 0) {
                    Logger.error('Could not find any active local containers');
                } else {
                    if (filterName.local.indexOf('all') !== -1) {
                        // Add all containers
                        for (let i = 0; i < size; i++) {
                            this.containers.push({ id: containers[i].id, name: containers[i].name, remote: null });
                            this.stats[containers[i].id] = this.newContainerStat();
                        }
                    } else {
                        // Filter containers
                        for (let i = 0; i < size; i++) {
                            if (filterName.local.indexOf(containers[i].name) !== -1) {
                                this.containers.push({ id: containers[i].id, name: containers[i].name, remote: null });
                                this.stats[containers[i].id] = this.newContainerStat();
                            }
                        }
                    }
                }
            } catch (error) {
                Logger.error(`Error retrieving local containers: ${error}`);
            }
        }
        // Filter remote containers by name
        for (let h in filterName.remote) {
            try {
                // Instantiate for the host/port
                let docker = new Docker({
                    host: h,
                    port: filterName.remote[h].port
                });

                // Retrieve and filter containers
                const containers = await docker.listContainers();
                if (containers.length === 0) {
                    Logger.error('monitor-docker: could not find remote container at ' + h);
                } else {
                    if (filterName.remote[h].containers.indexOf('/all') !== -1) {
                        for (let i = 0; i < containers.length; i++) {
                            let container = docker.getContainer(containers[i].Id);
                            this.containers.push({ id: containers[i].Id, name: h + containers[i].Names[0], remote: container });
                            this.stats[containers[i].Id] = this.newContainerStat();
                        }
                    } else {
                        for (let i = 0; i < containers.length; i++) {
                            if (filterName.remote[h].containers.indexOf(containers[i].Names[0]) !== -1) {
                                let container = docker.getContainer(containers[i].Id);
                                this.containers.push({ id: containers[i].Id, name: h + containers[i].Names[0], remote: container });
                                this.stats[containers[i].Id] = this.newContainerStat();
                            }
                        }
                    }
                }
            } catch (error) {
                Logger.error(`Error retrieving remote containers: ${error}`);
            }
        }
    }

    /**
     * Create and return a containerStat object
     * @return {JSON} containerStat object
     */
    newContainerStat() {
        return {
            mem_usage: [],
            mem_percent: [],
            cpu_percent: [],
            netIO_rx: [],
            netIO_tx: [],
            blockIO_rx: [],
            blockIO_wx: []
        };
    }

    /**
     * Callback for reading containers' resource usage
     * @async
     */
    async readContainerStats() {
        // Prevent overlapping read of stats
        if (this.isReading) {
            return;
        } else {
            this.isReading = true;
            let startPromises = [];
            try {
                for (let i = 0; i < this.containers.length; i++) {
                    if (this.containers[i].remote === null) {
                        // local
                        startPromises.push(SystemInformation.dockerContainerStats(this.containers[i].id));
                    } else {
                        // remote
                        startPromises.push(this.containers[i].remote.stats({ stream: false }));
                    }
                }

                const results = await Promise.all(startPromises);
                this.stats.time.push(Date.now() / 1000);
                for (let i = 0; i < results.length; i++) {
                    let stat = results[i];
                    let id = stat.id;
                    if (this.containers.length <= i) {
                        break;
                    }
                    if (id !== this.containers[i].id) {
                        Logger.warn('inconsistent id within statistics gathering');
                        continue;
                    }
                    if (this.containers[i].remote === null) {
                        // local
                        this.stats[id].mem_usage.push(stat.mem_usage);
                        this.stats[id].mem_percent.push(stat.mem_percent);
                        let cpuDelta = stat.cpu_stats.cpu_usage.total_usage - stat.precpu_stats.cpu_usage.total_usage;
                        let sysDelta = stat.cpu_stats.system_cpu_usage - stat.precpu_stats.system_cpu_usage;
                        if (cpuDelta > 0 && sysDelta > 0) {
                            if (stat.cpu_stats.cpu_usage.hasOwnProperty('percpu_usage') && stat.cpu_stats.cpu_usage.percpu_usage !== null) {
                                this.stats[id].cpu_percent.push(cpuDelta / sysDelta * this.coresInUse(stat.cpu_stats) * 100.0);
                            } else {
                                this.stats[id].cpu_percent.push(cpuDelta / sysDelta * 100.0);
                            }
                        } else {
                            this.stats[id].cpu_percent.push(0);
                        }
                        this.stats[id].netIO_rx.push(stat.netIO.rx);
                        this.stats[id].netIO_tx.push(stat.netIO.tx);
                        this.stats[id].blockIO_rx.push(stat.blockIO.r);
                        this.stats[id].blockIO_wx.push(stat.blockIO.w);
                    } else {
                        // remote
                        this.stats[id].mem_usage.push(stat.memory_stats.usage);
                        this.stats[id].mem_percent.push(stat.memory_stats.usage / stat.memory_stats.limit);
                        //this.stats[id].cpu_percent.push((stat.cpu_stats.cpu_usage.total_usage - stat.precpu_stats.cpu_usage.total_usage) / (stat.cpu_stats.system_cpu_usage - stat.precpu_stats.system_cpu_usage) * 100);
                        let cpuDelta = stat.cpu_stats.cpu_usage.total_usage - stat.precpu_stats.cpu_usage.total_usage;
                        let sysDelta = stat.cpu_stats.system_cpu_usage - stat.precpu_stats.system_cpu_usage;
                        if (cpuDelta > 0 && sysDelta > 0) {
                            if (stat.cpu_stats.cpu_usage.hasOwnProperty('percpu_usage') && stat.cpu_stats.cpu_usage.percpu_usage !== null) {
                                // this.stats[id].cpu_percent.push(cpuDelta / sysDelta * stat.cpu_stats.cpu_usage.percpu_usage.length * 100.0);
                                this.stats[id].cpu_percent.push(cpuDelta / sysDelta * this.coresInUse(stat.cpu_stats) * 100.0);
                            } else {
                                this.stats[id].cpu_percent.push(cpuDelta / sysDelta * 100.0);
                            }
                        } else {
                            this.stats[id].cpu_percent.push(0);
                        }
                        let ioRx = 0, ioTx = 0;
                        for (let eth in stat.networks) {
                            ioRx += stat.networks[eth].rx_bytes;
                            ioTx += stat.networks[eth].tx_bytes;
                        }
                        this.stats[id].netIO_rx.push(ioRx);
                        this.stats[id].netIO_tx.push(ioTx);
                        let diskR = 0, diskW = 0;
                        if (stat.blkio_stats && stat.blkio_stats.hasOwnProperty('io_service_bytes_recursive')) {
                            //Logger.debug(stat.blkio_stats.io_service_bytes_recursive);
                            let temp = stat.blkio_stats.io_service_bytes_recursive;
                            for (let dIo = 0; dIo < temp.length; dIo++) {
                                if (temp[dIo].op.toLowerCase() === 'read') {
                                    diskR += temp[dIo].value;
                                }
                                if (temp[dIo].op.toLowerCase() === 'write') {
                                    diskW += temp[dIo].value;
                                }
                            }
                        }
                        //Logger.debug(diskR+'  W: '+diskW);
                        this.stats[id].blockIO_rx.push(diskR);
                        this.stats[id].blockIO_wx.push(diskW);
                    }
                }
                this.isReading = false;
            } catch (error) {
                Logger.error(`Error reading monitor statistics: ${error}`);
                this.isReading = false;
            }
        }
    }

    /**
     * Start the monitor
     * @async
     */
    async start() {
        // Conditionally build monitored containers, these are persisted between rounds and restart action
        if (!this.containers) {
            await this.findContainers();
        }
        // Read stats immediately, then kick off monitor refresh at interval
        await this.readContainerStats();
        let self = this;
        this.intervalObj = setInterval(async () => { await self.readContainerStats(); }, this.interval);
    }

    /**
     * Restart the monitor
     * @async
     */
    async restart() {
        clearInterval(this.intervalObj);
        for (let key in this.stats) {
            if (key === 'time') {
                this.stats[key] = [];
            } else {
                for (let v in this.stats[key]) {
                    this.stats[key][v] = [];
                }
            }
        }

        await this.start();
    }

    /**
     * Stop the monitor
     * @async
     */
    async stop() {
        clearInterval(this.intervalObj);
        this.containers = [];
        this.stats = { 'time': [] };
        await Util.sleep(100);
    }

    /**
     * Get a Map of result items
     * @return {Map} Map of items to build results for, with default null entries
     */
    getResultColumnMap() {
        const columns = ['Name', 'Memory(max)', 'Memory(avg)', 'CPU%(max)', 'CPU%(avg)', 'Traffic In', 'Traffic Out', 'Disc Read', 'Disc Write'];
        const resultMap = new Map();

        for (const item of columns) {
            resultMap.set(item, 'N/A');
        }

        return resultMap;
    }

    /**
     * Get statistics from the monitor in the form of an Array containing Map<string, string> detailing key/value pairs
     * @param {string} testLabel the current test label
     * @return {Object} an object containing an array of resource maps for watched containers, and a possible array of charting information
     * @async
     */
    async getStatistics(testLabel) {

        const resourceStats = [];
        let chartStats = [];
        try {
            // Build a statistic for each monitored container and push into watchItems array
            for (const container of this.containers) {
                if (container.hasOwnProperty('id')) {

                    // Grab the key
                    const key = container.id;

                    // retrieve stats for the key
                    let mem = this.getMemHistory(key);
                    let cpu = this.getCpuHistory(key);
                    let net = this.getNetworkHistory(key);
                    let disc = this.getDiscHistory(key);
                    let mem_stat = MonitorUtilities.getStatistics(mem);
                    let cpu_stat = MonitorUtilities.getStatistics(cpu);

                    // Store in a Map
                    const watchItemStat = this.getResultColumnMap();
                    watchItemStat.set('Name', container.name);
                    watchItemStat.set('Memory(max)', mem_stat.max);
                    watchItemStat.set('Memory(avg)', mem_stat.avg);
                    watchItemStat.set('CPU%(max)', cpu_stat.max.toFixed(2));
                    watchItemStat.set('CPU%(avg)', cpu_stat.avg.toFixed(2));
                    watchItemStat.set('Traffic In', (net.in[net.in.length - 1] - net.in[0]));
                    watchItemStat.set('Traffic Out', (net.out[net.out.length - 1] - net.out[0]));
                    watchItemStat.set('Disc Write', (disc.write[disc.write.length - 1] - disc.write[0]));
                    watchItemStat.set('Disc Read', (disc.read[disc.read.length - 1] - disc.read[0]));

                    // append return array
                    resourceStats.push(watchItemStat);
                }
            }

            // Normalize the resource stats to a single unit
            const normalizeStats = ['Memory(max)', 'Memory(avg)', 'Traffic In', 'Traffic Out', 'Disc Write', 'Disc Read'];
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
     * @param {String} key key of the container
     * @return {Array} array of memory usage
     */
    getMemHistory(key) {
        return this.stats[key].mem_usage;
    }

    /**
     * Get history of CPU usage
     * @param {String} key key of the container
     * @return {Array} array of CPU usage
     */
    getCpuHistory(key) {
        return this.stats[key].cpu_percent;
    }

    /**
     * Get history of network IO usage as {in, out}
     * @param {String} key key of the container
     * @return {Array} array of network IO usage
     */
    getNetworkHistory(key) {
        return { 'in': this.stats[key].netIO_rx, 'out': this.stats[key].netIO_tx };
    }

    /**
     * Get history of disc usage as {read, write}
     * @param {String} key key of the container
     * @return {Array} array of disc usage
     */
    getDiscHistory(key) {
        return { 'read': this.stats[key].blockIO_rx, 'write': this.stats[key].blockIO_wx };
    }

    /**
     * count the cpu core in real use
     * @param {json} cpu_stats the statistics of cpu
     * @return {number}  the number core in real use
     */
    coresInUse(cpu_stats) {
        return cpu_stats.online_cpus || this.findCoresInUse(cpu_stats.cpu_usage.percpu_usage || []);
    }

    /**
     * count the cpu core in real use
     * @param {array} percpu_usage the usage cpu array
     * @return {number} the the percpu_usage.length
     */
    findCoresInUse(percpu_usage) {
        percpu_usage = percpu_usage.filter((coreUsage) => {
            if (coreUsage > 0) {
                return (coreUsage);
            }
        });
        return percpu_usage.length;
    }
}
module.exports = MonitorDocker;
