/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file, definition of the interface class for all monitors
*/


'use strict'

// todo: now we record the performance information in local variable, should use db later
class MonitorInterface{
    constructor(filter, interval) {
        this.filter       = filter;
        this.interval     = interval*1000; // ms
    }

    /**
    * start monitoring
    * @return {Promise}
    */
    start() {
        throw new Error('start is not implemented for this monitor');
    }

    /**
    * restart monitoring
    * @return {Promise}
    */
    restart() {
        throw new Error('restart is not implemented for this monitor');
    }

    /**
    * stop monitoring
    * @return {Promise}
    */
    stop() {
        throw new Error('stop is not implemented for this monitor');
    }

    /**
    * Get peer list and predefined readable information
    * @return {Array}, [{'key': peer's key which should be identical, the key can be used to fetch a peer's history data
    *                'info' : {
    *                    'TYPE' : type of the peer, e.g. 'Docker',
    *                    'NAME' : readable name of the peer
    *                }
    */
    getPeers() {
        throw new Error('getPeers is not implemented for this monitor');
    }

    /**
    * Get peer's history of memory usage, byte
    * @key {string}, peer's key
    * @return {Array}
    */
    getMemHistory(key) {
        throw new Error('getMemHistory is not implemented for this monitor');
    }

    /**
    * Get peer's history of cpu percent, %
    * @key {string}, peer's key
    * @return {Array}
    */
    getCpuHistory(key) {
        throw new Error('getCpuHistory is not implemented for this monitor');
    }

    /**
    * Get peer's history of network io usage, byte
    * @key {string}, peer's key
    * @return {Array}, [{in: inflow traffic, out: outflow traffic}]
    */
    getNetworkHistory(key) {
        throw new Error('getCpuHistory is not implemented for this monitor');
    }
};
module.exports = MonitorInterface;
