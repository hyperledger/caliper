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

const DockerMonitor = require('../monitors/monitor-docker.js');
const ProcessMonitor = require('../monitors/monitor-process.js');
const PrometheusMonitor = require('../monitors/monitor-prometheus.js');
const Util  = require('../../common/utils/caliper-utils');
const logger= Util.getLogger('monitor.js');

const NONE = 'none';
const DOCKER = 'docker';
const PROCESS = 'process';
const PROMETHEUS = 'prometheus';
const VALID_MONITORS = [NONE, DOCKER, PROCESS, PROMETHEUS];

/**
 * MonitorOrchestrator class, containing a map of user specified monitor types and operations to interact with the Monitor interface that they implement
 */
class MonitorOrchestrator {
    /**
     * Constructor
     * @param {object} benchmarkConfig The benchmark configuration object.
     */
    constructor(benchmarkConfig) {
        this.started = false;
        this.monitors = new Map();
        // Parse the config and retrieve the monitor types
        const monitorConfig = benchmarkConfig.monitor;
        if(typeof monitorConfig === 'undefined') {
            logger.info('No monitor specified, will default to "none"');
            return;
        }

        if(typeof monitorConfig.type === 'undefined') {
            throw new Error('Failed to find monitor types in config file');
        }

        let monitorTypes = Array.isArray(monitorConfig.type) ? monitorConfig.type : [monitorConfig.type];
        monitorTypes = Array.from(new Set(monitorTypes)); // remove duplicates
        for (let type of monitorTypes) {
            let monitor = null;
            if(type === DOCKER) {
                monitor = new DockerMonitor(monitorConfig.docker, monitorConfig.interval);
            } else if(type === PROCESS) {
                monitor = new ProcessMonitor(monitorConfig.process, monitorConfig.interval);
            } else if(type === PROMETHEUS) {
                monitor = new PrometheusMonitor(monitorConfig.prometheus, monitorConfig.interval);
            } else if(type === NONE) {
                continue;
            } else {
                const msg = `Unsupported monitor type ${type}, must be one of ${VALID_MONITORS}`;
                logger.error(msg);
                throw new Error(msg);
            }
            this.monitors.set(type, monitor);
        }
    }


    /**
     * Get all monitor types stored by the orchestrator
     * @returns {IterableIterator<string>} iterator of all monitor types
     */
    getAllMonitorTypes(){
        return this.monitors.keys();
    }

    /**
     * Check if a specific monitor exists
     * @param {String} type the type name of the monitor to retrieve
     * @returns {Boolean} true if a monitor of the named type exists
     */
    hasMonitor(type){
        return this.monitors.has(type);
    }

    /**
     * Retrieve a monitor with the passed name
     * @param {String} type the type name of the monitor to retrieve
     * @returns {Monitor} a monitor of the named type
     */
    getMonitor(type){
        if(this.hasMonitor(type)){
            return this.monitors.get(type);
        } else {
            throw new Error(`No monitor of type ${type} available for retrieval from orchestrator`);
        }
    }

    /**
    * Start the monitors held by the orchestrator
    * @async
    */
    async startAllMonitors() {

        if(this.started === false) {

            for (let key of this.monitors.keys()) {
                const monitor = this.monitors.get(key);
                await monitor.start();
            }

            this.started = true;
        } else {
            await this.restartAllMonitors();
        }
    }

    /**
    * stop the all the stored monitors
    * @async
    */
    async stopAllMonitors() {
        logger.info('Stopping all monitors');
        if(this.started === true) {

            for (let key of this.monitors.keys()) {
                const monitor = this.monitors.get(key);
                await monitor.stop();
            }

            this.started  = false;
        }
    }

    /**
    * Restart all monitors, all data recorded internally will be cleared
    * @async
    */
    async restartAllMonitors() {
        for (let key of this.monitors.keys()) {
            const monitor = this.monitors.get(key);
            await monitor.restart();
        }
    }

    /**
    * Get an Array of statistics maps for a named resource monitor
    * @param {String} type the monitor type
    * @param {String} testLabel the current test label
    * @return {Map<string, string>[]} an array of resource maps
    * @async
    */
    async getStatisticsForMonitor(type, testLabel) {
        return await this.monitors.get(type).getStatistics(testLabel);
    }
}

module.exports = MonitorOrchestrator;
