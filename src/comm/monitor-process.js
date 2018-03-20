/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file, definition of the MonitorProcess class
*        which is used to watch the resource consumption of specific local process
*/


'use strict'

// todo: now we record the performance information in local variable, should use db later
var ps    = require('ps-node');
var usage = require('pidusage')
var MonitorInterface = require('./monitor-interface');
class MonitorProcess extends MonitorInterface {
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

    start() {
        var self = this;
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
                            throw null;
                        }
                        // record pids for later use (clear data)
                        for(let i = 0 ; i < pids.length ; ++i) {
                            self.pids[pids[i]] = 0;
                        }
                        // get usage for all processes
                        return getUsage(pids, item.multiOutput);
                    })
                    .then((stat) => {
                        self.stats[getId(item)]['mem_usage'].push(stat.memory);
                        self.stats[getId(item)]['cpu_percent'].push(stat.cpu);
                        resolve();
                    })
                    .catch((err) => {
                        resolve();
                    });
                }));
            });


            Promise.all(promises).then(() => {
                 self.isReading = false;
            })
            .catch((err) => {
                console.log('Exception occurred when looking the process up: ' + err);
            });
        }
        readStats();
        this.intervalObj = setInterval(readStats, this.interval);
        return Promise.resolve();
    }

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

    stop() {
        clearInterval(this.intervalObj);
        this.containers = [];
        this.stats      = {'time': []};

        for(let key in this.pids) {
            usage.unmonitor(key);
        }
        this.pids = [];

        return sleep(100);
    }

    getPeers() {
        var info = [];
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

    getMemHistory(key) {
        //  just to keep the same length as getCpuHistory
        return this.stats[key].mem_usage.slice(1);
    }

    getCpuHistory(key) {
        // the first element is an average from the starting time of the process
        // it does not correctly reflect the current CPU usage, so just ignore it
        return this.stats[key].cpu_percent.slice(1);
    }

    getNetworkHistory(key) {
        // not supported now return {'in': this.stats[key].netIO_rx, 'out':this.stats[key].netIO_tx};
        return {'in': [], 'out': []};
    }
};
module.exports = MonitorProcess;


function newStat() {
    return {
        mem_usage:   [],
        cpu_percent: []
    };
}

function getId(proc) {
    var id = proc.command;
    if(proc.hasOwnProperty('arguments')) {
        id += ' ' + proc.arguments;
    }

    if(proc.hasOwnProperty('multiOutput')) {
        id += '(' + proc.multiOutput + ')';
    }
    else {
        id += '(sum)'
    }

    return id;
}


/**
* Find processes according to the lookup filter
* @item {object}, lookup filter, must contains the 'command' element. Refer to https://www.npmjs.com/package/ps-node to learn more details.
* @return {Promise(array)}, return a array of pids of processes being found.
*/
function findProcs(item) {
    return new Promise((resolve, reject) => {
        var pids = [];
        ps.lookup(item, (err, resultList) => {
            let key = getId(item);
            if (err) {
                console.log('failed looking the process up: ' + err);
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
* Get the memory and cpu usage of the specific process
* @pid {string}, the process's pid
* @return {Promise(object)}, return a {cpu, memory} object
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
* Get the memory and cpu usage of all the specific processes
* @pids {array},  pids of all processes
* @type {string}, = avg, return the average usage of all processes
*                 = sum(default), return the summing usage of all processes
* @return {Promise(object)}, return a {cpu, memory} object
*/
function getUsage(pids, type) {
    return new Promise((resolve, reject) => {
        var res = {memory: 0, cpu: 0};
        if(pids.length === 0) {
            return resolve(res);
        }

        var promises = pids.map((pid, idx) => {
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
        })
        .catch((err) => {
            console.log('Exception encountered when fetching resource usage: ' + err);
            resolve(res);
        });
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}