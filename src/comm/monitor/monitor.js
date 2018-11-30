/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict';

const table = require('table');
const Util  = require('../util');
const logger= Util.getLogger('monitor.js');

/**
* Get statistics(maximum, minimum, summation, average) of a number array
* @param {Array} arr array of numbers
* @return {JSON} JSON object as {max, min, total, avg}
*/
function getStatistics(arr) {
    if(arr.length === 0) {
        return {max : NaN, min : NaN, total : NaN, avg : NaN};
    }

    let max = arr[0], min = arr[0], total = arr[0];
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
* Normalize the value in byte
* @param {Number} data value in byte
* @return {String} value in string
*/
function byteNormalize(data) {
    if(isNaN(data)) {
        return '-';
    }
    let kb = 1024;
    let mb = kb * 1024;
    let gb = mb * 1024;
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
* @param {String} data input string
* @return {String} normalized string
*/
function strNormalize(data) {
    if(typeof data !== 'string' || data === null) {
        return '-';
    }

    const maxLen = 30;
    if(data.length <= maxLen) {
        return data;
    }

    let newstr = data.slice(0,25) + '...' + data.slice(-5);
    return newstr;
}

/**
 * Monitor class, containing operations to watch resource consumption of specific destinations
 */
class Monitor {
    /**
     * Constructor
     * @param {String} configPath path of the configuration file
     */
    constructor(configPath) {
        this.configPath = configPath;
        this.started = false;
        this.peers = [];
        this.monitors = [];
    }

    /**
    * start the monitor
    * @return {Promise} promise object
    */
    start() {
        //const config = require(this.configPath);
        const config = Util.parseYaml(this.configPath);
        const m = config.monitor;
        if(typeof m === 'undefined') {
            return Promise.reject(new Error('Failed to find monitor in config file'));
        }

        let monitorTypes = m.type;
        if(typeof monitorTypes === 'undefined') {
            return Promise.reject(new Error('Failed to find monitor type in config file'));
        }
        if(!Array.isArray(monitorTypes)) {
            monitorTypes = [monitorTypes];
        }

        let p;
        if(this.started === true) {
            p = this.stop();
        }
        else {
            p = Promise.resolve();
        }

        return p.then(() => {
            let promises = [];
            monitorTypes.forEach( (type) => {
                promises.push(new Promise((resolve, reject) => {
                    let promise = null;
                    if(type === 'docker') {     // monitor for local docker containers
                        promise = this._startDockerMonitor(m.docker, m.interval);
                    }
                    else if(type === 'process') {
                        promise = this._startProcessMonitor(m.process, m.interval);
                    }
                    else {
                        logger.error('undefined monitor type: ' + type);
                        return resolve();
                    }
                    promise.then((monitor)=>{
                        this.monitors.push(monitor);
                        resolve();
                    }).catch((err)=>{
                        logger.error('start monitor ' + type + ' failed: ' + err);
                        resolve();  // always return resolve for Promsie.all
                    });
                }));
            });
            return Promise.all(promises);
        }).then(() => {
            this.started = true;
            return Promise.resolve();
        }).catch((err) => {
            return Promise.reject(err);
        });
    }

    /**
    * stop the monitor
    * @return {Promise} promise object
    */
    stop() {
        if( this.monitors.length > 0 && this.started === true) {
            let promises = [];
            this.monitors.forEach((monitor)=>{
                promises.push(new Promise((resolve, reject) => {
                    monitor.stop().then(() => {
                        resolve();
                    }).catch((err) => {
                        logger.error('stop monitor failed: ' + err);
                        resolve();
                    });
                }));
            });
            return Promise.all(promises).then(()=>{
                this.monitors = [];
                this.peers = [];
                this.started  = false;
                return Promise.resolve();
            }).catch((err)=>{
                logger.error('stop monitor failed: ' + err);
                this.monitors = [];
                this.peers = [];
                this.started  = false;
                return Promise.resolve();
            });
        }

        return Promise.resolve();
    }

    /**
    * restart the monitor, all data recorded internally will be cleared
    * @return {Promise} promise object
    */
    restart() {
        if(this.monitors.length > 0 && this.started === true){
            this._readDefaultStats(false);
            let promises = [];
            this.monitors.forEach((monitor)=>{
                promises.push(new Promise((resolve, reject) => {
                    monitor.restart().then(() => {
                        resolve();
                    }).catch((err) => {
                        logger.error('restart monitor failed: ' + err);
                        resolve();
                    });
                }));
            });
            return Promise.all(promises);
        }

        return this.start();
    }

    /**
    * Get the default statistics table
    * @return {Array} statistics table
    */
    getDefaultStats() {
        try {
            this._readDefaultStats(true);

            if(this.peers === null || this.peers.length === 0) {
                logger.error('Failed to read monitoring data');
                return [];
            }

            let defaultTable = [];
            let tableHead    = [];
            for(let i in this.peers[0].info) {
                tableHead.push(i);
            }
            let historyItems = this._getDefaultItems();
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
        }
        catch(err) {
            logger.error('Failed to read monitoring data, ' + (err.stack ? err.stack : err));
            return [];
        }
    }

    /**
     * Print the maximum values of all watched items
     */
    printMaxStats() {
        try {
            this._readDefaultStats(true);

            if(this.peers === null || this.peers.length === 0) {
                logger.error('Failed to read monitoring data');
                return;
            }

            let defaultTable = [];
            let tableHead    = [];
            for(let i in this.peers[0].info) {
                tableHead.push(i);
            }
            let historyItems = this._getMaxItems();
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

            let t = table.table(defaultTable, {border: table.getBorderCharacters('ramac')});
            logger.info('\n ### resource stats (maximum) ###');
            logger.info('\n' + t);
        }
        catch(err) {
            logger.error('Failed to read monitoring data, ' + (err.stack ? err.stack : err));
        }
    }

    /**
    * pseudo private functions
    */

    /**
    * read current statistics from monitor object and push the data into peers.history object
    * the history data will not be cleared until stop() is called, in other words, calling restart will not vanish the data
    * @param {Boolean} tmp =true, the data should only be stored in history temporarily
    */
    _readDefaultStats(tmp) {
        if (this.peers.length === 0) {
            for(let i = 0 ; i < this.monitors.length ; i++)
            {
                let newPeers = this.monitors[i].getPeers();
                newPeers.forEach((peer) => {
                    peer.history = {
                        'Memory(max)' : [],
                        'Memory(avg)' : [],
                        'CPU(max)' : [],
                        'CPU(avg)' : [],
                        'Traffic In'  : [],
                        'Traffic Out' : [],
                        'Disc Read'  : [],
                        'Disc Write' : []
                    };
                    peer.isLastTmp = false;
                    peer.monitor = this.monitors[i];
                    this.peers.push(peer);
                });
            }
        }

        this.peers.forEach((peer) => {
            let key = peer.key;
            let mem = peer.monitor.getMemHistory(key);
            let cpu = peer.monitor.getCpuHistory(key);
            let net = peer.monitor.getNetworkHistory(key);
            let disc = peer.monitor.getDiscHistory(key);
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
                peer.history['Disc Write'][lastIdx] = disc.write[disc.write.length-1] - disc.write[0];
                peer.history['Disc Read'][lastIdx] = disc.read[disc.read.length-1] - disc.read[0];
            }
            else {
                peer.history['Memory(max)'].push(mem_stat.max);
                peer.history['Memory(avg)'].push(mem_stat.avg);
                peer.history['CPU(max)'].push(cpu_stat.max);
                peer.history['CPU(avg)'].push(cpu_stat.avg);
                peer.history['Traffic In'].push(net.in[net.in.length-1] - net.in[0]);
                peer.history['Traffic Out'].push(net.out[net.out.length-1] - net.out[0]);
                peer.history['Disc Write'].push(disc.write[disc.write.length-1] - disc.write[0]);
                peer.history['Disc Read'].push(disc.read[disc.read.length-1] - disc.read[0]);
            }
            peer.isLastTmp = tmp;
        });
    }

    /**
    * Get names of default historical data
    * @return {Array} array of names
    */
    _getDefaultItems() {
        let items = [];
        for(let key in this.peers[0].history) {
            if(this.peers[0].history.hasOwnProperty(key)) {
                items.push(key);
            }
        }
        return items;
    }

    /**
    * Get names of maximum related historical data
    * @return {Array} array of names
    */
    _getMaxItems() {
        return ['Memory(max)', 'CPU(max)', 'Traffic In','Traffic Out', 'Disc Read', 'Disc Write'];
    }


    /**
    * Get last values of specific historical data
    * @param {Array} items names of the lookup items
    * @param {Number} idx index of the lookup object
    * @return {Array} normalized string values
    */
    _getLastHistoryValues(items, idx) {
        let values = [];
        for(let i = 0 ; i < items.length ; i++) {
            let key = items[i];
            if (!this.peers[idx].history.hasOwnProperty(key)) {
                logger.warn('could not find history object named ' + key);
                values.push('-');
                continue;
            }
            let length = this.peers[idx].history[key].length;
            if(length === 0) {
                logger.warn('could not find history data of ' + key);
                values.push('-');
                continue;
            }
            let value = this.peers[idx].history[key][length - 1];
            if(key.indexOf('Memory') === 0 || key.indexOf('Traffic') === 0 || key.indexOf('Disc') === 0) {
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
    * @param {Array} items names of the lookup items
    * @param {Number} idx index of the lookup object
    * @return {Array} array of normalized strings
    */
    _getMaxHistoryValues(items, idx) {
        let values = [];
        for(let i = 0 ; i < items.length ; i++) {
            let key = items[i];
            if (!this.peers[idx].history.hasOwnProperty(key)) {
                logger.warn('could not find history object named ' + key);
                values.push('-');
                continue;
            }
            let length = this.peers[idx].history[key].length;
            if(length === 0) {
                logger.warn('could not find history data of ' + key);
                values.push('-');
                continue;
            }
            let stats = getStatistics(this.peers[idx].history[key]);
            if(key.indexOf('Memory') === 0 || key.indexOf('Traffic') === 0 || key.indexOf('Disc') === 0) {
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

    /**
     * Start a monitor for docker containers
     * @param {JSON} args lookup filter
     * @param {Number} interval read interval, in second
     * @return {Promise} promise object
     */
    _startDockerMonitor(args, interval) {
        if(typeof args === 'undefined') {
            args = {'name': ['all']};
        }
        if(typeof interval === 'undefined') {
            interval = 1;
        }

        let DockerMonitor = require('./monitor-docker.js');
        let monitor = new DockerMonitor(args, interval);
        return monitor.start().then(()=>{
            return Promise.resolve(monitor);
        }).catch((err)=>{
            return Promise.reject(err);
        });
    }

    /**
     * Start a monitor for local processes
     * @param {JSON} args lookup filter
     * @param {Number} interval read interval, in second
     * @return {Promise} promise object
     */
    _startProcessMonitor(args, interval) {
        let ProcessMonitor = require('./monitor-process.js');
        let monitor = new ProcessMonitor(args, interval);
        return monitor.start().then(()=>{
            return Promise.resolve(monitor);
        }).catch((err)=>{
            return Promise.reject(err);
        });
    }
}

module.exports = Monitor;
