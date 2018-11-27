/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict';

const ps = require('ps-node');
const usage = require('pidusage');
const MonitorInterface = require('./monitor-interface');
const Util = require('../util.js');
const logger = Util.getLogger('monitor-process.js');

/**
 * Initialise a state object
 * @return {JSON} state object
 */
function newStat() {
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
function getId(proc) {
    let id = proc.command;
    if(proc.hasOwnProperty('arguments')) {
        id += ' ' + proc.arguments;
    }

    if(proc.hasOwnProperty('multiOutput')) {
        id += '(' + proc.multiOutput + ')';
    }
    else {
        id += '(sum)';
    }

    return id;
}


/**
* Find processes according to the lookup filter
* @param {JSON} item lookup filter, must contains the 'command' element. Refer to https://www.npmjs.com/package/ps-node to learn more details.
* @return {Promise} array of pids of found processes
*/
function findProcs(item) {
    return new Promise((resolve, reject) => {
        let pids = [];
        ps.lookup(item, (err, resultList) => {
            if (err) {
                logger.error('failed looking the process up: ' + err);
            }
            else {
                for(let i = 0 ; i < resultList.length ; i++) {
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
* @return {Promise} JSON object as {cpu, memory}
*/
function getProcUsage(pid) {
    return new Promise((resolve, reject) => {
        usage.stat(pid, (err, stat) => {
            if(err) {
                resolve({memory:0, cpu:0});
            }
            else {
                resolve(stat);
            }
        });
    });
}

/**
* Get the memory and cpu usage of multiple processes
* @param {Array} pids  pids of specified processes
* @param {String} type = avg, return the average usage of all processes; = sum(default), return the summing usage of all processes
* @return {Promise} JSON object as {cpu, memory}
*/
function getUsage(pids, type) {
    return new Promise((resolve, reject) => {
        let res = {memory: 0, cpu: 0};
        if(pids.length === 0) {
            return resolve(res);
        }

        let promises = pids.map((pid, idx) => {
            return getProcUsage(pid);
        });

        Promise.all(promises).then((stats) => {
            for(let i = 0 ; i< stats.length ; i++) {
                res.memory += stats[i].memory;
                res.cpu    += stats[i].cpu;
            }
            if(type === 'avg') {
                res.memory /= stats.length;
                res.cpu    /= stats.length;
            }
            resolve(res);
        }).catch((err) => {
            logger.error('Exception encountered when fetching resource usage: ' + err);
            resolve(res);
        });
    });
}
/**
 * * Resource monitor for local processes
 */
class MonitorProcess extends MonitorInterface {
    /**
     * Constructor
     * @param {JSON} filter lookup filter
     * @param {*} interval resource fetching interval
     */
    constructor(filter, interval) {
        super(filter, interval);
        this.isReading    = false;
        this.intervalObj  = null;
        this.pids = {}; // pid history array

        /* this.stats : record statistics of each process
            {
                'id' : {                    // 'command args'
                    'mem_usage'   : [],
                    'cpu_percent' : [],
                }
                .....
            }
        */
        this.stats  = {'time': []};
        this.filter = [];
        for(let i = 0 ; i < filter.length ; i++) {
            if(filter[i].hasOwnProperty('command')) {
                let id = getId(filter[i]);
                this.stats[id] = newStat();
                this.filter.push(filter[i]);
            }
        }


    }

    /**
     * Start the monitor
     * @return {Promise} promise object
     */
    start() {
        let self = this;
        /**
         * Read statistics of watched items
         */
        function readStats() {
            if(self.isReading) {
                return;
            }
            self.isReading = true;

            let promises = [];
            self.filter.forEach((item) => {
                promises.push(new Promise((resolve, reject) => {
                    // processes may be up/down during the monitoring, so should look for processes every time
                    findProcs(item).then((pids)=>{
                        if(pids.length === 0) {
                            throw new Error('Not found any item');
                        }
                        // record pids for later use (clear data)
                        for(let i = 0 ; i < pids.length ; ++i) {
                            self.pids[pids[i]] = 0;
                        }
                        // get usage for all processes
                        return getUsage(pids, item.multiOutput);
                    }).then((stat) => {
                        self.stats[getId(item)].mem_usage.push(stat.memory);
                        self.stats[getId(item)].cpu_percent.push(stat.cpu);
                        resolve();
                    }).catch((err) => {
                        resolve();
                    });
                }));
            });


            Promise.all(promises).then(() => {
                self.isReading = false;
            }).catch((err) => {
                logger.error('Exception occurred when looking the process up: ' + err);
            });
        }
        readStats();
        this.intervalObj = setInterval(readStats, this.interval);
        return Promise.resolve();
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

        for(let key in this.pids) {
            usage.unmonitor(key);
        }
        this.pids = [];

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

        for(let key in this.pids) {
            usage.unmonitor(key);
        }
        this.pids = [];

        return Util.sleep(100);
    }

    /**
     * Get information of watched processes
     * info = {
     *     key: lookup key of the process
     *     info: {
     *         TYPE: 'Process',
     *         NAME: name of the process
     *     }
     * }
     * @return {Array} array of processes' information
     */
    getPeers() {
        let info = [];
        for(let i in this.filter) {
            let proc = this.filter[i];
            let name = getId(proc);
            info.push({
                'key'  : name,
                'info' : {
                    'TYPE' : 'Process',
                    'NAME' : name
                }
            });
        }

        return info;
    }

    /**
     * Get history of memory usage
     * @param {String} key lookup key
     * @return {Array} array of memory usage
     */
    getMemHistory(key) {
        //  just to keep the same length as getCpuHistory
        return this.stats[key].mem_usage.slice(1);
    }

    /**
     * Get history of CPU usage
     * @param {String} key key of the container
     * @return {Array} array of CPU usage
     */
    getCpuHistory(key) {
        // the first element is an average from the starting time of the process
        // it does not correctly reflect the current CPU usage, so just ignore it
        return this.stats[key].cpu_percent.slice(1);
    }

    /**
     * Get history of network IO usage as {in, out}
     * @param {String} key key of the container
     * @return {Array} array of network IO usage
     */
    getNetworkHistory(key) {
        // not supported now return {'in': this.stats[key].netIO_rx, 'out':this.stats[key].netIO_tx};
        return {'in': [], 'out': []};
    }

    /**
     * Get history of disc usage as {read, wrtie}
     * @param {String} key key of the container
     * @return {Array} array of disc usage
     */
    getDiscHistory(key) {
        // not supported now return {'in': this.stats[key].netIO_rx, 'out':this.stats[key].netIO_tx};
        return {'read': [], 'write': []};
    }
}
module.exports = MonitorProcess;