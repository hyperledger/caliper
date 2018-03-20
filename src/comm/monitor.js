/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file, definition of the Monitor class, which is used to start/stop a monitor to watch the resource consumption
*/


'use strict'

var table         = require('table');

var Monitor = class {
    constructor(config_path) {
        this.configPath = config_path;
        this.started = false;
        this.peers = [];
        this.monitors = [];
    }

    /**
    * start monitoring
    * @return {Promise}
    */
    start() {
        var config = require(this.configPath);
        var m = config.monitor;
        if(typeof m === 'undefined') {
            return Promise.reject(new Error('Failed to find monitor in config file'));
        }

        var monitorTypes = m.type;
        if(typeof m === 'undefined') {
            return Promise.reject(new Error('Failed to find monitor type in config file'));
        }
        if(!Array.isArray(monitorTypes)) {
            monitorTypes = [monitorTypes];
        }

        var p;
        if(this.started === true) {
            p = this.stop();
        }
        else {
            p = Promise.resolve();
        }

        return p.then(() => {
            var promises = [];
            monitorTypes.forEach( (type) => {
                promises.push(new Promise((resolve, reject) => {
                    let p = null;
                    if(type === 'docker') {     // monitor for local docker containers
                        p = this._startDockerMonitor(m.docker, m.interval);
                    }
                    else if(type === 'process') {
                        p = this._startProcessMonitor(m.process, m.interval);
                    }
                    else {
                        console.log('undefined monitor type: ' + type);
                        return resolve();
                    }
                    p.then((monitor)=>{
                        this.monitors.push(monitor);
                        resolve();
                    })
                    .catch((err)=>{
                        console.log('start monitor ' + type + ' failed: ' + err);
                        resolve();  // always return resolve for Promsie.all
                    });
                }));
            });
            return Promise.all(promises);
        })
        .then(() => {
            this.started = true;
            return Promise.resolve();
        })
        .catch((err) => {
            return Promise.reject(err);
        })
    }

    /**
    * stop monitoring
    * @return {Promise}
    */
    stop() {
        if( this.monitors.length > 0 && this.started === true) {
            var promises = [];
            this.monitors.forEach((monitor)=>{
                promises.push(new Promise((resolve, reject) => {
                    monitor.stop().then(() => {
                        resolve();
                    })
                    .catch((err) => {
                        console.log('stop monitor failed: ' + err);
                        resolve();
                    });
                }));
            });
            return Promise.all(promises).then(()=>{
                this.monitors = [];
                this.peers = [];
                this.started  = false;
                return Promise.resolve();
            })
            .catch((err)=>{
                console.log('stop monitor failed: ' + err);
                this.monitors = [];
                this.peers = [];
                this.started  = false;
                return Promise.resolve();
            });
        }

        return Promise.resolve();
    }

    /**
    * restart monitoring, all the data recorded before will be cleared
    * @return {Promise}
    */
    restart() {
        if(this.monitors.length > 0 && this.started === true){
            this._readDefaultStats(false);
            var promises = [];
            this.monitors.forEach((monitor)=>{
                promises.push(new Promise((resolve, reject) => {
                    monitor.restart().then(() => {
                        resolve();
                    })
                    .catch((err) => {
                        console.log('restart monitor failed: ' + err);
                        resolve();
                    });
                }));
            });
            return Promise.all(promises);
        }

        return start();
    }

    /**
    * print the default statistics
    * @return {Array}, statistics table
    */
    getDefaultStats() {
        try {
            this._readDefaultStats(true);

            if(this.peers === null || this.peers.length === 0) {
                console.log('Failed to read monitoring data');
                return;
            }

            var defaultTable = [];
            var tableHead    = [];
            for(let i in this.peers[0].info) {
                tableHead.push(i);
            }
            var historyItems = this._getDefaultItems();
            tableHead.push.apply(tableHead, historyItems);

            defaultTable.push(tableHead);
            for(let i in this.peers){
                let row = [];
                for(let j in this.peers[i].info) {
                    row.push(strNormalize(this.peers[i].info[j]));
                }

                let historyValues = this._getLastHistoryValues(historyItems, i);
                row.push.apply(row, historyValues);
                defaultTable.push(row);
            }

            return defaultTable;
/*            var t = table.table(defaultTable, {border: table.getBorderCharacters('ramac')});
            console.log('### resource stats ###');
            console.log(t);*/
        }
        catch(err) {
            console.log('Failed to read monitoring data, ' + (err.stack ? err.stack : err));
            return [];
        }
    }

    printMaxStats() {
        try {
            this._readDefaultStats(true);

            if(this.peers === null || this.peers.length === 0) {
                console.log('Failed to read monitoring data');
                return;
            }

            var defaultTable = [];
            var tableHead    = [];
            for(let i in this.peers[0].info) {
                tableHead.push(i);
            }
            var historyItems = this._getMaxItems();
            tableHead.push.apply(tableHead, historyItems);

            defaultTable.push(tableHead);
            for(let i in this.peers){
                let row = [];
                for(let j in this.peers[i].info) {
                    row.push(strNormalize(this.peers[i].info[j]));
                }

                let historyValues = this._getMaxHistoryValues(historyItems, i);
                row.push.apply(row, historyValues);
                defaultTable.push(row);
            }

            var t = table.table(defaultTable, {border: table.getBorderCharacters('ramac')});
            console.log('### resource stats (maximum) ###');
            console.log(t);
        }
        catch(err) {
            console.log('Failed to read monitoring data, ' + (err.stack ? err.stack : err));
        }
    }

    /**
    * pseudo private functions
    */

    /**
    * read current statistics from monitor object and push the data into peers.history object
    * the history data will not be cleared until stop() is called, in other words, calling restart will not vanish the data
    * @tmp {boolean}, =true, the data should only be stored in history temporarily
    */
    _readDefaultStats(tmp) {
        if (this.peers.length === 0) {
            for(let i = 0 ; i < this.monitors.length ; i++)
            {
                let newPeers = this.monitors[i].getPeers();
                newPeers.forEach((peer) => {
                     peer['history'] = {
                        'Memory(max)' : [],
                        'Memory(avg)' : [],
                        'CPU(max)' : [],
                        'CPU(avg)' : [],
                        'Traffic In'  : [],
                        'Traffic Out' : []
                    };
                    peer['isLastTmp'] = false;
                    peer['monitor'] = this.monitors[i];
                    this.peers.push(peer);
                });
            }
        }

        this.peers.forEach((peer) => {
            let key = peer.key;
            let mem = peer.monitor.getMemHistory(key);
            let cpu = peer.monitor.getCpuHistory(key);
            let net = peer.monitor.getNetworkHistory(key);
            let mem_stat = getStatistics(mem);
            let cpu_stat = getStatistics(cpu);
            if(peer.isLastTmp) {
                let lastIdx = peer.history['Memory(max)'].length - 1;
                peer.history['Memory(max)'][lastIdx] = mem_stat.max;
                peer.history['Memory(avg)'][lastIdx] = mem_stat.avg;
                peer.history['CPU(max)'][lastIdx] = cpu_stat.max;
                peer.history['CPU(avg)'][lastIdx] = cpu_stat.avg;
                peer.history['Traffic In'][lastIdx] = net.in[net.in.length-1] - net.in[0];
                peer.history['Traffic Out'][lastIdx] = net.out[net.out.length-1] - net.out[0];
            }
            else {
                peer.history['Memory(max)'].push(mem_stat.max);
                peer.history['Memory(avg)'].push(mem_stat.avg);
                peer.history['CPU(max)'].push(cpu_stat.max);
                peer.history['CPU(avg)'].push(cpu_stat.avg);
                peer.history['Traffic In'].push(net.in[net.in.length-1] - net.in[0]);
                peer.history['Traffic Out'].push(net.out[net.out.length-1] - net.out[0]);
            }
            peer.isLastTmp = tmp;
        });
    }

    /**
    * get names of default historical data
    * @return {Array}
    */
    _getDefaultItems() {
        var items = [];
        for(let key in this.peers[0].history) {
            if(this.peers[0].history.hasOwnProperty(key)) {
                items.push(key);
            }
        }
        return items;
    }

    /**
    * get names of maximum related historical data
    * @return {Array}
    */
    _getMaxItems() {
        return ['Memory(max)', 'CPU(max)', 'Traffic In','Traffic Out'];
    }


    /**
    * get the last value of specific historical data
    * @items {Array}, name of items
    * @idx {Number}, peer index
    * return {Array}, the normalized string values
    */
    _getLastHistoryValues(items, idx) {
        var values = [];
        for(let i = 0 ; i < items.length ; i++) {
            let key = items[i];
            if (!this.peers[idx].history.hasOwnProperty(key)) {
                console.log('could not find history object named ' + key);
                values.push('-');
                continue;
            }
            let length = this.peers[idx].history[key].length;
            if(length === 0) {
                console.log('could not find history data of ' + key);
                values.push('-');
                continue;
            }
            let value = this.peers[idx].history[key][length - 1];
            if(key.indexOf('Memory') === 0 || key.indexOf('Traffic') === 0) {
                values.push(byteNormalize(value));
            }
            else if(key.indexOf('CPU') === 0) {
                values.push(value.toFixed(2) + '%');
            }
            else{
                values.push(value.toString());
            }
        }

        return values;
    }

     /**
    * get the maximum value of specific historical data
    * @items {Array}, name of items
    * @idx {Number}, peer index
    * return {Array}, the normalized string values
    */
    _getMaxHistoryValues(items, idx) {
        var values = [];
        for(let i = 0 ; i < items.length ; i++) {
            let key = items[i];
            if (!this.peers[idx].history.hasOwnProperty(key)) {
                console.log('could not find history object named ' + key);
                values.push('-');
                continue;
            }
            let length = this.peers[idx].history[key].length;
            if(length === 0) {
                console.log('could not find history data of ' + key);
                values.push('-');
                continue;
            }
            let stats = getStatistics(this.peers[idx].history[key]);
            if(key.indexOf('Memory') === 0 || key.indexOf('Traffic') === 0) {
                values.push(byteNormalize(stats.max));
            }
            else if(key.indexOf('CPU') === 0) {
                values.push(stats.max.toFixed(2) + '%');
            }
            else{
                values.push(stats.max.toString());
            }
        }

        return values;
    }

    _startDockerMonitor(args, interval) {
        if(typeof args === 'undefined') {
            args = {'name': ["all"]};
        }
        if(typeof interval === 'undefined') {
            interval = 1;
        }

        var DockerMonitor = require('./monitor-docker.js');
        var monitor = new DockerMonitor(args, interval);
        return monitor.start().then(()=>{
            return Promise.resolve(monitor);
        })
        .catch((err)=>{
            return Promise.reject(err);
        });
    }

    _startProcessMonitor(args, interval) {
        var ProcessMonitor = require('./monitor-process.js');
        var monitor = new ProcessMonitor(args, interval);
        return monitor.start().then(()=>{
            return Promise.resolve(monitor);
        })
        .catch((err)=>{
            return Promise.reject(err);
        });
    }
}

module.exports = Monitor;

/**
* get the maximum,minimum,total, average value from a number array
* @arr {Array}
* @return {Object}
*/
function getStatistics(arr) {
    if(arr.length === 0) {
        return {max : NaN, min : NaN, total : NaN, avg : NaN};
    }

    var max = arr[0], min = arr[0], total = arr[0];
    for(let i = 1 ; i< arr.length ; i++) {
        let value = arr[i];
        if(value > max) {
            max = value;
        }
        if(value < min) {
            min = value;
        }
        total += value;
    }

    return {max : max, min : min, total : total, avg : total/arr.length};
}

/**
* Normalize the byte number
* @data {Number}
* @return {string}
*/
function byteNormalize(data) {
    if(isNaN(data)) {
        return '-';
    }
    var kb = 1024;
    var mb = kb * 1024;
    var gb = mb * 1024;
    if(data < kb) {
        return data.toString() + 'B';
    }
    else if(data < mb) {
        return (data / kb).toFixed(1) + 'KB';
    }
    else if(data < gb) {
        return (data / mb).toFixed(1) + 'MB';
    }
    else{
        return (data / gb).toFixed(1) + 'GB';
    }
}

/**
* Cut down the string in case it's too long
* @data {string}
* @return {string}
*/
function strNormalize(data) {
    if(typeof data !== 'string' || data === null) {
        return '-';
    }

    const maxLen = 30;
    if(data.length <= maxLen) {
        return data;
    }

    var newstr = data.slice(0,25) + '...' + data.slice(-5);
    return newstr;
}