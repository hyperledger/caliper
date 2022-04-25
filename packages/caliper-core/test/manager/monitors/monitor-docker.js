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
const chai = require('chai');
const should = chai.should();
const sinon = require('sinon');
const DockerMonitorRewire = rewire('../../../lib/manager/monitors/monitor-docker');
const ConfigUtil = require('../../../lib/common/config/config-util.js');

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
        cpu_stats: {
            "cpu_usage":{"total_usage":1000000,"usage_in_kernelmode":10000,"usage_in_usermode":10000},
            "system_cpu_usage":100000,
            "online_cpus":8,
            "throttling_data":{"periods":0,"throttled_periods":0,"throttled_time":0}
        },
        precpu_stats: {
            "cpu_usage":{"total_usage":0,"usage_in_kernelmode":0,"usage_in_usermode":0},
            "throttling_data":{"periods":0,"throttled_periods":0,"throttled_time":0},
            "system_cpu_usage":0
        },
        memory_stats: {
            "usage":46100480,
            "stats":{"inactive_file": 500,"active_anon":0,"active_file":0,"anon":32440320,"anon_thp":0,"file":11624448,"file_dirty":0,"file_mapped":10407936,"file_writeback":0,"inactive_anon":29007872,"inactive_file":15003648,"kernel_stack":147456,"pgactivate":0,"pgdeactivate":0,"pgfault":10065,"pglazyfree":759,"pglazyfreed":0,"pgmajfault":66,"pgrefill":0,"pgscan":0,"pgsteal":0,"shmem":0,"slab":0,"slab_reclaimable":0,"slab_unreclaimable":0,"sock":0,"thp_collapse_alloc":0,"thp_fault_alloc":0,"unevictable":0,"workingset_activate":0,"workingset_nodereclaim":0,"workingset_refault":0},
            "limit":2081312768
        },
        networks: {
            "eth0":{"rx_bytes":10000,"rx_packets":10000,"rx_errors":0,"rx_dropped":0,"tx_bytes":10000,"tx_packets":10000,"tx_errors":0,"tx_dropped":0}
        },
    };


    //create os stub
    const osStub = {
        cpus : sinon.stub()
    }
    const returnValueCpus = [ 
    { 
        model: 'Intel(R) Core(TM) i5-7200U CPU @ 2.50GHz',
        speed: 2712,
        times: { user: 900000, nice: 0, sys: 940265, idle: 11928546, irq: 147046 } 
    },
    { 
        model: 'Intel(R) Core(TM) i5-7200U CPU @ 2.50GHz',
        speed: 2712,
        times: { user: 860875, nice: 0, sys: 507093, idle: 12400500, irq: 27062 } 
    }]
    
    osStub.cpus.returns(returnValueCpus);
    const revertOS = DockerMonitorRewire.__set__("os", osStub)


    //create dockerode stub
    const Docker = sinon.stub();

    const getStats = sinon.stub().returns(dockerStats); 
    Docker.prototype.listContainers = sinon.stub().resolves([{
        Id:"118",
        Names: ["peer0.org1.example.com"],
        stats: getStats
    }]);
    Docker.prototype.getContainer = sinon.stub().withArgs("118").returns({
        Id:"118",
        Names: ["peer0.org1.example.com"],
        stats: getStats
    });
    const revertDockerode = DockerMonitorRewire.__set__("Docker", Docker);


    // Test data
    const monitorOptions= {
        interval: 5,
        containers: ["peer0.org1.example.com"],
    };


    after( () => {
        revertOS(); 
        revertDockerode();
    });


    describe('when being created', () => {
        
        it('should set options list if provided', () => {
            let dockerMonitor = new DockerMonitorRewire(monitorOptions);
            dockerMonitor.options.should.be.an('object').that.deep.equals(monitorOptions);
        });

        it('should set interval if provided', () => {
            let dockerMonitor = new DockerMonitorRewire(monitorOptions);
            dockerMonitor.interval.should.equal(monitorOptions.interval*1000);
        });

        it('should set interval to default if not provided in options', () => {
            const emptyOptions = {};
            let dockerMonitor = new DockerMonitorRewire(emptyOptions);
            dockerMonitor.interval.should.equal(ConfigUtil.get(ConfigUtil.keys.Monitor.Interval));
        });
    });


    describe('when finding containers', () => {

        let dockerMonitor;

        beforeEach( () => {
            dockerMonitor = new DockerMonitorRewire(monitorOptions);
        });

        it('should add containers objects to container field if exitents', async () => {
            await dockerMonitor.findContainers();
            dockerMonitor.containers.should.be.an('array').that.have.lengthOf(monitorOptions.containers.length);
            const containers = [
                {
                    id:"118",
                    name:"peer0.org1.example.com",
                    container: {
                        Id:"118",
                        Names: ["peer0.org1.example.com"],
                        stats: getStats
                    }
                }
            ]
            dockerMonitor.containers.should.be.an('array').that.deep.equals(containers);
        });
    });


    describe('when retrieving container statistics', () => {

        //memory test values
        const mem_usage = dockerStats.memory_stats.usage - dockerStats.memory_stats.stats.inactive_file;
        const mem_percent = mem_usage / dockerStats.mem_limit;

        it('should set isReading to false', async () => {
            let dockerMonitor = new DockerMonitorRewire(monitorOptions);
            await dockerMonitor.findContainers(); 
            await dockerMonitor.readContainerStats(); 
            dockerMonitor.isReading.should.be.false;
        });

        it('should read and add stats for each target container', async () => {
            let dockerMonitor = new DockerMonitorRewire(monitorOptions);
            await dockerMonitor.findContainers();
            await dockerMonitor.readContainerStats();
            dockerMonitor.stats["118"].mem_usage.should.be.an('array').that.deep.equals([mem_usage]);
        });

        //cpu percentage test metric calculation
        let cpuDelta = dockerStats.cpu_stats.cpu_usage.total_usage - dockerStats.precpu_stats.cpu_usage.total_usage;
        let sysDelta = dockerStats.cpu_stats.system_cpu_usage - dockerStats.precpu_stats.system_cpu_usage;
        let cpu_percent;
        if (cpuDelta > 0 && sysDelta > 0) {
            if (dockerStats.cpu_stats.cpu_usage.hasOwnProperty('percpu_usage') && dockerStats.cpu_stats.cpu_usage.percpu_usage !== null) {
                cpu_percent = (cpuDelta / sysDelta * 2 * 100.0); // 2 -> number of cpus used in this test
            } else {
                cpu_percent = (cpuDelta / sysDelta * 100.0);
            }
        } else {
            cpu_percent = 0;
        }

        const monitorOptionsCpuNorm = {
            interval: 5,
            containers: ["peer0.org1.example.com"],
            cpuUsageNormalization: true
        };

        const monitorOptionsNotCpuNorm = {
            interval: 5,
            containers: ["peer0.org1.example.com"],
            cpuUsageNormalization: false
        };

        it('should normalize cpuUsage if cpuUsageNormalization property is set to true', async () => {
            let dockerMonitor = new DockerMonitorRewire(monitorOptionsCpuNorm);
            await dockerMonitor.findContainers();
            await dockerMonitor.readContainerStats();
            let result = await dockerMonitor.getStatistics();
            result.resourceStats[0].get("CPU%(max)").should.equal(cpu_percent / 2); // 2 -> number of cpus used in this test
        });

        it('should not normalize cpuUsage if cpuUsageNormalization property not provided', async () => {
            let dockerMonitor = new DockerMonitorRewire(monitorOptions);
            await dockerMonitor.findContainers();
            await dockerMonitor.readContainerStats();
            let result = await dockerMonitor.getStatistics();
            result.resourceStats[0].get("CPU%(max)").should.equal(cpu_percent);
        });

        it('should not normalize cpuUsage if cpuUsageNormalization property is set to false', async () => {
            let dockerMonitor = new DockerMonitorRewire(monitorOptionsNotCpuNorm);
            await dockerMonitor.findContainers();
            await dockerMonitor.readContainerStats();
            let result = await dockerMonitor.getStatistics();
            result.resourceStats[0].get("CPU%(max)").should.equal(cpu_percent);
        });
    });

});
