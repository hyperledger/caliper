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
    const ignore = {
        metrics : {
            ignore: ['prometheus', 'pushgateway', 'cadvisor']
        }
    };

    const includeOpts = {
        Tag0: {
            query: 'sum(rate(container_cpu_usage_seconds_total{name=~".+"}[$interval])) by (name) * 100',
            statistic: 'average'
        },
        Tag1: {
            query: 'sum(rate(container_cpu_usage_seconds_total{name=~".+"}[$interval])) by (name) * 100',
            statistic: 'maximum'
        },
        Tag2: {
            query: 'sum(container_memory_rss{name=~".+"}) by (name)',
            statistic: 'average'
        }
    };

    const include = {
        metrics: {
            include : includeOpts
        }
    };

    describe('#constructor', () => {

        it('should set ignore list if provided', () => {
            const mon = new PrometheusMonitorRewire(ignore);
            mon.ignore.should.be.an('array').that.deep.equals(['prometheus', 'pushgateway', 'cadvisor']);
        });

        it('should not set ignore list if missing', () => {
            const mon = new PrometheusMonitorRewire(include);
            should.not.exist(mon.ignore);
        });

        it('should set include list if provided', () => {
            const mon = new PrometheusMonitorRewire(include);
            mon.include.should.be.an('object').that.deep.equals(includeOpts);
        });

        it('should not set include list if missing', () => {
            const mon = new PrometheusMonitorRewire(ignore);
            should.not.exist(mon.include);
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

            const mon = new PrometheusMonitorRewire(include);
            const map = mon.getResultColumnMapForQueryTag('query', 'MyTag');

            // Three keys
            map.size.should.equal(3);

            // Tags, and Type should contain the correct information
            map.get('Prometheus Query').should.equal('query');
            map.get('Name').should.equal('N/A');
            map.get('Metric').should.equal('MyTag');
        });
    });



});
