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
const PrometheusMonitorRewire = rewire('../../../lib/manager/monitors/monitor-prometheus');

const chai = require('chai');
const should = chai.should();
const sinon = require('sinon');

describe('Prometheus monitor implementation', () => {

    const fakeQueryClient = sinon.stub();
    PrometheusMonitorRewire.__set__('PrometheusQueryClient', fakeQueryClient);

    // Before/After
    let clock;
    beforeEach( () => {
        clock = sinon.useFakeTimers();
    });

    afterEach( () => {
        clock.restore();
    });

    // Test data
    const monitorOptions = {
        metrics : {
            include: ['peer', 'pushgateway', 'dev.*'],
            queries: [
                {
                    query: 'sum(rate(container_cpu_usage_seconds_total{name=~".+"}[$interval])) by (name) * 100',
                    statistic: 'average'
                },
                {
                    query: 'sum(rate(container_cpu_usage_seconds_total{name=~".+"}[$interval])) by (name) * 100',
                    statistic: 'maximum'
                }
            ]
        }
    };

    const emptyOptions = {};

    describe('#constructor', () => {

        it('should set include list if provided', () => {
            const prometheusMonitor = new PrometheusMonitorRewire(monitorOptions);
            prometheusMonitor.include.should.be.an('array').that.deep.equals(monitorOptions.metrics.include);
        });

        it('should not set include list if missing', () => {
            const prometheusMonitor = new PrometheusMonitorRewire(emptyOptions);
            should.not.exist(prometheusMonitor.include);
        });

        it('should set queries list if provided', () => {
            const prometheusMonitor = new PrometheusMonitorRewire(monitorOptions);
            prometheusMonitor.queries.should.be.an('array').that.deep.equals(monitorOptions.metrics.queries);
        });

        it('should not set queries list if missing', () => {
            const prometheusMonitor = new PrometheusMonitorRewire(emptyOptions);
            should.not.exist(prometheusMonitor.queries);
        });
    });

    describe('#getQueryClient', ()=>{

        it('should return the internal Query Client', () => {
            const mon = new PrometheusMonitorRewire({});
            const test = 'penguin';
            mon.prometheusQueryClient = test;
            mon.getQueryClient().should.equal(test);
        });
    });

    describe('#start', () => {

        it('should set the start time with the current time', () => {
            clock.tick(42);
            const mon = new PrometheusMonitorRewire({push_url: '123'});
            mon.start();
            mon.startTime.should.equal(0.042);
        });

    });

    describe('#stop', () => {
        it('should remove startTime if it exists', () => {
            clock.tick(42);
            const mon = new PrometheusMonitorRewire({push_url: '123'});
            mon.start();
            mon.startTime.should.equal(0.042);
            mon.stop();
            should.not.exist(mon.startTime);
        });
    });

    describe('#restart', () => {

        it('should reset the start time', () => {
            clock.tick(42);
            const mon = new PrometheusMonitorRewire({push_url: '123'});
            mon.start();
            clock.tick(42);
            mon.restart();
            mon.startTime.should.equal(0.084);
        });

    });

    describe('#getResultColumnMapForQueryTag', () => {


        it('should return a map with keys that correspond to the passed `include` keys, with default entries populated', () => {

            const mon = new PrometheusMonitorRewire(monitorOptions);
            const map = mon.getResultColumnMapForQueryTag('query', 'MyTag');

            // Three keys
            map.size.should.equal(3);

            // Tags, and Type should contain the correct information
            map.get('Prometheus Query').should.equal('query');
            map.get('Name').should.equal('N/A');
            map.get('Metric').should.equal('MyTag');
        });
    });

    describe('checking if a statistic should be included in the report', () => {


        it('should identify user requested components', () => {

            const mon = new PrometheusMonitorRewire(monitorOptions);
            mon.includeStatistic('peer0.org0.example.com').should.equal(true);

            mon.includeStatistic('pushgateway').should.equal(true);

            mon.includeStatistic('dev-org0.example.com').should.equal(true);

            mon.includeStatistic('penuin').should.equal(false);

            mon.includeStatistic('orderer0.example.com').should.equal(false);
        });
    });


});
