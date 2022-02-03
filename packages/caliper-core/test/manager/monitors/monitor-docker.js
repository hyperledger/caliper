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


const rewire = require('rewire');
const os = require('os');
const chai = require('chai');
const should = chai.should();
const sinon = require('sinon');
const DockerMonitorRewire = rewire('../../../lib/manager/monitors/monitor-docker');
const ConfigUtil = require('../../../lib/common/config/config-util.js');

const SystemInformation = require('systeminformation');

describe('A Docker monitor', () => {

    //stub docker stub
    const dockerStats = {
        id: "118",
        mem_usage: 10000,
        mem_limit: 10000,
        mem_percent: 10000,
        cpu_percent: 10000,
        netIO: {
          rx: 10000,
          wx: 10000,
        },
        blockIO: {
          r: 10000,
          w: 10000,
        },
        cpu_stats: {"cpu_usage":{"total_usage":1000000,"usage_in_kernelmode":10000,"usage_in_usermode":10000},"system_cpu_usage":100000,"online_cpus":8,"throttling_data":{"periods":0,"throttled_periods":0,"throttled_time":0}},
        precpu_stats: {"cpu_usage":{"total_usage":0,"usage_in_kernelmode":0,"usage_in_usermode":0},"throttling_data":{"periods":0,"throttled_periods":0,"throttled_time":0},"system_cpu_usage":0},
        memory_stats: {"usage":46100480,"stats":{"cache": 500,"active_anon":0,"active_file":0,"anon":32440320,"anon_thp":0,"file":11624448,"file_dirty":0,"file_mapped":10407936,"file_writeback":0,"inactive_anon":29007872,"inactive_file":15003648,"kernel_stack":147456,"pgactivate":0,"pgdeactivate":0,"pgfault":10065,"pglazyfree":759,"pglazyfreed":0,"pgmajfault":66,"pgrefill":0,"pgscan":0,"pgsteal":0,"shmem":0,"slab":0,"slab_reclaimable":0,"slab_unreclaimable":0,"sock":0,"thp_collapse_alloc":0,"thp_fault_alloc":0,"unevictable":0,"workingset_activate":0,"workingset_nodereclaim":0,"workingset_refault":0},"limit":2081312768},
        networks: {"eth0":{"rx_bytes":10000,"rx_packets":10000,"rx_errors":0,"rx_dropped":0,"tx_bytes":10000,"tx_packets":10000,"tx_errors":0,"tx_dropped":0}},
    };

    //create System information stub
    const SystemInformationStub = {
        dockerContainers : sinon.stub(),
        dockerContainerStats : sinon.stub()
    };
    
    SystemInformationStub.dockerContainers.returns([{
        id:"118",
        name:"peer0.org1.example.com"
    }]);

    SystemInformationStub.dockerContainerStats.withArgs("118").returns(dockerStats);

    DockerMonitorRewire.__set__("SystemInformation", SystemInformationStub)
    let dockerMonitor;

    before(() => {
    });

    // Before/After
    beforeEach( () => {
        
    });

    afterEach( () => {
    });

    // Test data
    const monitorOptions = {
        interval: 5,
        containers: ["peer0.org1.example.com"],
        cpuUsageNormalization: true  
    };

    const emptyOptions = {};

    describe('when being created', () => {
        
        it('should set options list if provided', () => {
            dockerMonitor = new DockerMonitorRewire(monitorOptions);
            dockerMonitor.options.should.be.an('object').that.deep.equals(monitorOptions);
        });

        it('should set interval if provided', () => {
            dockerMonitor = new DockerMonitorRewire(monitorOptions);
            dockerMonitor.interval.should.equal(monitorOptions.interval*1000);
        });

        it('should set interval to default if not provided in options', () => {
            dockerMonitor = new DockerMonitorRewire(emptyOptions);
            dockerMonitor.interval.should.equal(ConfigUtil.get(ConfigUtil.keys.Monitor.Interval));
        });
    });

    describe('when finding containers', () => {

        beforeEach( () => {
            dockerMonitor = new DockerMonitorRewire(monitorOptions);
        });

        it('should add containers objects to container field if exitents', async () => {
            dockerMonitor.SystemInformation = SystemInformation;
            await dockerMonitor.findContainers().then(()=>{
                dockerMonitor.containers.should.be.an('array').that.have.lengthOf(monitorOptions.containers.length);
            });
        });

        it('should add and label containers as local', async () => {
            const containers = [
                {
                    id:"118",
                    name:"peer0.org1.example.com",
                    remote:null
                }
            ]
            await dockerMonitor.findContainers().then(()=>{
                dockerMonitor.containers.should.be.an('array').that.deep.equals(containers);
            });
        });

        /*it('should add and label containers as remote', async () => {
            await dockerMonitor.findContainers().then(()=>{
                for(let key in this.options.containers){
                    dockerMonitor.containers[i].name
                }
            });
        });*/
    });

    describe('whan reading statistics', () => {

        //memory test values
        const mem_usage = dockerStats.memory_stats.usage - dockerStats.memory_stats.stats.cache;
        const mem_percent = mem_usage / dockerStats.mem_limit;

        beforeEach( () => {
            dockerMonitor = new DockerMonitorRewire(monitorOptions);
        });

        it('should set isReading to false', async () => {
            await dockerMonitor.findContainers().then(async () => {
                await dockerMonitor.readContainerStats()
            }).then(async () => {
                dockerMonitor.isReading.should.be.false;
            });
        });

        it('should read and add stats for each target container', async () => {

            await dockerMonitor.findContainers().then(async () => {
                await dockerMonitor.readContainerStats()
            }).then(async () => {
                dockerMonitor.stats["118"].mem_usage.should.be.an('array').that.deep.equals([mem_usage]);
            });
        });

    });

    describe('when getting statistics', () => {

        beforeEach( () => {
            dockerMonitor = new DockerMonitorRewire(monitorOptions);
        });

        const cpuCores = os.cpus().length;

        //cpu percentage test metric calculation
        let cpuDelta = dockerStats.cpu_stats.cpu_usage.total_usage - dockerStats.precpu_stats.cpu_usage.total_usage;
        let sysDelta = dockerStats.cpu_stats.system_cpu_usage - dockerStats.precpu_stats.system_cpu_usage;
        let cpu_percent;
        if (cpuDelta > 0 && sysDelta > 0) {
            if (dockerStats.cpu_stats.cpu_usage.hasOwnProperty('percpu_usage') && dockerStats.cpu_stats.cpu_usage.percpu_usage !== null) {
                cpu_percent = (cpuDelta / sysDelta * cpuCores * 100.0);
            } else {
                cpu_percent = (cpuDelta / sysDelta * 100.0);
            }
        } else {
            cpu_percent = 0;
        }

        it('should normalize cpuUsage if cpuUsageNormalization property is present', async () => {

            await dockerMonitor.findContainers().then(async () => {
                await dockerMonitor.readContainerStats()
            }).then(async () => {
                return await dockerMonitor.getStatistics()
            }).then(function(result) {
                result.resourceStats[0].get("CPU%(max)").should.equal(cpu_percent/cpuCores);
            });
        });
    });


    describe.skip('when stopping', () => {

        it('should set the start time with the current time', async () => {
            await dockerMonitor.stop()
        });

    });
});
