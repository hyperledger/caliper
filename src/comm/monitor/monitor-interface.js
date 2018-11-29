/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict';

// TODO: now we record the performance information in local variable, it's better to use db later
/**
 * Interface of resource consumption monitor
 */
class MonitorInterface{
    /**
     * Constructor
     * @param {JSON} filter Lookup filter
     * @param {*} interval Watching interval, in second
     */
    constructor(filter, interval) {
        this.filter       = filter;
        this.interval     = interval*1000; // ms
    }

    /**
    * start monitoring
    */
    start() {
        throw new Error('start is not implemented for this monitor');
    }

    /**
    * restart monitoring
    */
    restart() {
        throw new Error('restart is not implemented for this monitor');
    }

    /**
    * stop monitoring
    */
    stop() {
        throw new Error('stop is not implemented for this monitor');
    }

    /**
    * Get watching list
    */
    getPeers() {
        throw new Error('getPeers is not implemented for this monitor');
    }

    /**
    * Get history of memory usage, in byte
    * @param {String} key Lookup key
    */
    getMemHistory(key) {
        throw new Error('getMemHistory is not implemented for this monitor');
    }

    /**
    * Get history of cpu usage, %
    * @param {String} key Lookup key
    */
    getCpuHistory(key) {
        throw new Error('getCpuHistory is not implemented for this monitor');
    }

    /**
    * Get history of network IO usage, byte
    * @param {String} key Lookup key
    */
    getNetworkHistory(key) {
        throw new Error('getNetworkHistory is not implemented for this monitor');
    }

    /**
     * Get history of disc usage as {read, wrtie}
     * @param {String} key Lookup key
     */
    getDiscHistory(key) {
        throw new Error('getDiscHistory is not implemented for this monitor');
    }
}
module.exports = MonitorInterface;
