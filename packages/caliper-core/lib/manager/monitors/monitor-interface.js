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

const ConfigUtil = require('../../common/config/config-util.js');

// TODO: now we record the performance information in local variable, it's better to use db later
/**
 * Interface of resource consumption monitor
 */
class MonitorInterface {
    /**
     * Constructor
     * @param {JSON} resourceMonitorOptions Configuration options for the monitor
     */
    constructor(resourceMonitorOptions) {
        this.options = resourceMonitorOptions;
        this.interval = resourceMonitorOptions.interval ? resourceMonitorOptions.interval*1000 : ConfigUtil.get(ConfigUtil.keys.Monitor.Interval);
    }

    /**
    * start monitoring
    */
    async start() {
        throw new Error('start is not implemented for this monitor');
    }

    /**
    * restart monitoring
    */
    async restart() {
        throw new Error('restart is not implemented for this monitor');
    }

    /**
    * stop monitoring
    */
    async stop() {
        throw new Error('stop is not implemented for this monitor');
    }

    /**
     * Get statistics from the monitor in the form of an Array containing Map<string, string> detailing key/value pairs
     * @async
     */
    async getStatistics() {
        throw new Error('getStatistics is not implemented for this monitor');
    }
}
module.exports = MonitorInterface;
