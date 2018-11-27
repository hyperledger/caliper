/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict';

const Util = require('../util.js');
const logger = Util.getLogger('monitor-docker.js');
const MonitorInterface = require('./monitor-interface');

/**
 * create a containerStat object
 * @return {JSON} containerStat object
 */
function newContainerStat() {
    return {
        mem_usage:   [],
        mem_percent: [],
        cpu_percent: [],
        netIO_rx:    [],
        netIO_tx:    [],
        blockIO_rx:  [],
        blockIO_wx:  []
    };
}

/**
 * Find local containers according to searching filters
 * @return {Promise} promise object
 */
function findContainers() {
    let filterName = {local:[], remote:{}};
    let url = require('url');
    if(this.filter.hasOwnProperty('name')) {
        for(let key in this.filter.name) {
            let name = this.filter.name[key];
            if(name.indexOf('http://') === 0) {
                let remote = url.parse(name, true);
                if(remote.hostname === null || remote.port === null || remote.pathname === '/') {
                    logger.warn('monitor-docker: unrecognized host, ' + name);
                }
                else if(filterName.remote.hasOwnProperty(remote.hostname)) {
                    filterName.remote[remote.hostname].containers.push(remote.pathname);
                }
                else {
                    filterName.remote[remote.hostname] = {port: remote.port, containers: [remote.pathname]};
                }
            }
            else{
                filterName.local.push(name);
            }
        }
    }

    let promises = [];

    // find local containers by name
    if(filterName.local.length > 0) {
        let p = this.si.dockerContainers('active').then((containers) => {
            let size = containers.length;
            if(size === 0) {
                logger.error('monitor-docker: could not find active local container');
                return Promise.resolve();
            }
            if(filterName.local.indexOf('all') !== -1) {
                for(let i = 0 ; i < size ; i++){
                    this.containers.push({id: containers[i].id, name: containers[i].name, remote: null});
                    this.stats[containers[i].id] = newContainerStat();
                }
            }
            else {
                for(let i = 0 ; i < size ; i++){
                    if(filterName.local.indexOf(containers[i].name) !== -1) {
                        this.containers.push({id: containers[i].id, name: containers[i].name, remote: null});
                        this.stats[containers[i].id] = newContainerStat();
                    }
                }
            }

            return Promise.resolve();
        }).catch((err) => {
            logger.error('Error(monitor-docker):' + err);
            return Promise.resolve();
        });
        promises.push(p);
    }
    // find remote containers by name
    for(let h in filterName.remote) {
        let docker = new this.Docker({
            host: h,
            port: filterName.remote[h].port
            // version: 'v1.20'
        });
        let p = docker.listContainers().then((containers) => {
            let size = containers.length;
            if(size === 0) {
                logger.error('monitor-docker: could not find remote container at ' + h);
                return Promise.resolve();
            }

            if(filterName.remote[h].containers.indexOf('all') !== -1) {
                for(let i = 0 ; i < size ; i++) {
                    let container = docker.getContainer(containers[i].Id);
                    this.containers.push({id: containers[i].Id, name: h + containers[i].Names[0], remote: container});
                    this.stats[containers[i].Id] = newContainerStat();
                }
            }
            else {
                for(let i = 0 ; i < size ; i++) {
                    if(filterName.remote[h].containers.indexOf(containers[i].Names[0]) !== -1) {
                        let container = docker.getContainer(containers[i].Id);
                        this.containers.push({id: containers[i].Id, name: h + containers[i].Names[0], remote: container});
                        this.stats[containers[i].Id] = newContainerStat();
                    }
                }
            }
            return Promise.resolve();
        }).catch((err) => {
            logger.error('Error(monitor-docker):' + err);
            return Promise.resolve();
        });
        promises.push(p);
    }

    return Promise.all(promises);
}

/**
 * Resource monitor for local/remote docker containers
 */
class MonitorDocker extends MonitorInterface {
    /**
     * Constructor
     * @param {JSON} filter lookup filter for containers
     * @param {*} interval resource fetching interval
     */
    constructor(filter, interval) {
        super(filter, interval);
        this.si           = require('systeminformation');
        this.Docker       = require('dockerode');
        this.containers   = [];     // {id, name, obj}
        this.isReading    = false;
        this.intervalObj  = null;
        this.stats = {'time': []};
        this.hasContainters = findContainers.call(this);
        /* this.stats : record statistics of each container
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
     * Start the monitor
     * @return {Promise} promise object
     */
    start() {
        return this.hasContainters.then( () => {
            let self = this;
            /**
             * callback for reading containers' resouce usage
             */
            function readContainerStats() {
                if(self.isReading) {
                    return;
                }
                self.isReading = true;
                let statPromises = [];
                for(let i = 0 ;i < self.containers.length ; i++){
                    if(self.containers[i].remote === null) {   // local
                        statPromises.push(self.si.dockerContainerStats(self.containers[i].id));
                    }
                    else {        // remote
                        statPromises.push(self.containers[i].remote.stats({stream: false}));
                    }
                }
                Promise.all(statPromises).then((results) => {
                    self.stats.time.push(Date.now()/1000);
                    for(let i = 0 ; i < results.length ; i++) {
                        let stat = results[i];
                        let id = stat.id;
                        if(id !== self.containers[i].id) {
                            logger.warn('monitor-docker: inconsistent id');
                            continue;
                        }
                        if(self.containers[i].remote === null) {    // local
                            self.stats[id].mem_usage.push(stat.mem_usage);
                            self.stats[id].mem_percent.push(stat.mem_percent);
                            self.stats[id].cpu_percent.push(stat.cpu_percent);
                            self.stats[id].netIO_rx.push(stat.netIO.rx);
                            self.stats[id].netIO_tx.push(stat.netIO.tx);
                            self.stats[id].blockIO_rx.push(stat.blockIO.r);
                            self.stats[id].blockIO_wx.push(stat.blockIO.w);
                        }
                        else {  // remote
                            self.stats[id].mem_usage.push(stat.memory_stats.usage);
                            self.stats[id].mem_percent.push(stat.memory_stats.usage / stat.memory_stats.limit);
                            //self.stats[id].cpu_percent.push((stat.cpu_stats.cpu_usage.total_usage - stat.precpu_stats.cpu_usage.total_usage) / (stat.cpu_stats.system_cpu_usage - stat.precpu_stats.system_cpu_usage) * 100);
                            let cpuDelta = stat.cpu_stats.cpu_usage.total_usage - stat.precpu_stats.cpu_usage.total_usage;
                            let sysDelta = stat.cpu_stats.system_cpu_usage - stat.precpu_stats.system_cpu_usage;
                            if(cpuDelta > 0 && sysDelta > 0) {
                                if(stat.cpu_stats.cpu_usage.hasOwnProperty('percpu_usage') && stat.cpu_stats.cpu_usage.percpu_usage !== null) {
                                    // self.stats[id].cpu_percent.push(cpuDelta / sysDelta * stat.cpu_stats.cpu_usage.percpu_usage.length * 100.0);
                                    self.stats[id].cpu_percent.push(cpuDelta / sysDelta * MonitorDocker.coresInUse(stat.cpu_stats) * 100.0);
                                }
                                else {
                                    self.stats[id].cpu_percent.push(cpuDelta / sysDelta * 100.0);
                                }
                            }
                            else {
                                self.stats[id].cpu_percent.push(0);
                            }
                            let ioRx = 0, ioTx = 0;
                            for (let eth in stat.networks) {
                                ioRx += stat.networks[eth].rx_bytes;
                                ioTx += stat.networks[eth].tx_bytes;
                            }
                            self.stats[id].netIO_rx.push(ioRx);
                            self.stats[id].netIO_tx.push(ioTx);
                            self.stats[id].blockIO_rx.push(0);
                            self.stats[id].blockIO_wx.push(0);
                        }
                    }
                    self.isReading = false;
                }).catch((err) => {
                    logger.error(err);
                    self.isReading = false;
                });
            }

            readContainerStats();   // read stats  immediately
            this.intervalObj = setInterval(readContainerStats, this.interval);
            return Promise.resolve();
        }).catch((err) => {
            return Promise.reject(err);
        });
    }

    /**
     * Restart the monitor
     * @return {Promise} promise object
     */
    restart() {
        clearInterval(this.intervalObj);
        for(let key in this.stats) {
            if(key === 'time') {
                this.stats[key] = [];
            }
            else {
                for(let v in this.stats[key]) {
                    this.stats[key][v] = [];
                }
            }
        }

        return this.start();
    }

    /**
     * Stop the monitor
     * @return {Promise} promise object
     */
    stop() {
        clearInterval(this.intervalObj);
        this.containers = [];
        this.stats      = {'time': []};

        return Util.sleep(100);
    }

    /**
     * Get information of watched containers
     * info = {
     *     key: key of the container
     *     info: {
     *         TYPE: 'docker',
     *         NAME: name of the container
     *     }
     * }
     * @return {Array} array of containers' information
     */
    getPeers() {
        let info = [];
        for(let i in this.containers) {
            let c = this.containers[i];
            if(c.hasOwnProperty('id')) {
                info.push({
                    'key'  : c.id,
                    'info' : {
                        'TYPE' : 'Docker',
                        'NAME' : c.name
                    }
                });
            }
        }
        return info;
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
        return {'in': this.stats[key].netIO_rx, 'out':this.stats[key].netIO_tx};
    }

    /**
     * Get history of disc usage as {read, wrtie}
     * @param {String} key key of the container
     * @return {Array} array of disc usage
     */
    getDiscHistory(key) {
        return {'read': this.stats[key].blockIO_rx, 'write':this.stats[key].blockIO_wx};
    }

    /**
     * count the cpu core in real use
     * @param {json} cpu_stats the statistics of cpu
     * @return {number}  the number core in real use
     */
    static coresInUse(cpu_stats) {
        return cpu_stats.online_cpus || MonitorDocker.findCoresInUse(cpu_stats.cpu_usage.percpu_usage || []);
    }

    /**
     * count the cpu core in real use
     * @param {array} percpu_usage the usage cpu array
     * @return {number} the the percpu_usage.length
     */
    static findCoresInUse(percpu_usage) {
        percpu_usage = percpu_usage.filter((coreUsage) => {
            if (coreUsage > 0) {
                return (coreUsage);
            }
        });
        return percpu_usage.length;
    }


}
module.exports = MonitorDocker;
