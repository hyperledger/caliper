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
const ChartBuilder = require('../../../lib/manager/charts/chart-builder');
const ChartBuilderRewire = rewire('../../../lib/manager/charts/chart-builder');

const chai = require('chai');
chai.should();

const sinon = require('sinon');

describe('chart builder implementation', () => {

    let sandbox;
    let revert;
    let FakeLogger;

    const defaultType = 'bar';
    const testMonitor = 'CallingMonitor';

    const resource0 = new Map();
    resource0.set('Name', 'resource0');
    resource0.set('item0 [MB]', '510');
    resource0.set('item1 [MB]', '1e4');

    const resource1 = new Map();
    resource1.set('Name', 'resource1');
    resource1.set('item0 [MB]', '4.77e-8');
    resource1.set('item1 [MB]', '23');

    const resource2 = new Map();
    resource2.set('Name', 'resource2');
    resource2.set('item0 [MB]', '100');
    resource2.set('item1 [MB]', '24');

    describe('#retrieveIncludedMetrics', () => {

        const resource0 = new Map();
        resource0.set('Name', 'resource0');
        resource0.set('item0 [MB]', '53');
        resource0.set('item1 [MB]', '876');

        beforeEach(() => {
            revert = [];
            sandbox = sinon.createSandbox();

            FakeLogger = {
                debug: () => {
                },
                error: () => {
                },
                warn: () => {
                }
            };
            sandbox.stub(FakeLogger);
        });

        afterEach(() => {
            if (revert.length) {
                revert.forEach(Function.prototype.call, Function.prototype.call);
            }
            sandbox.restore();
        });

        it('should log an error and return an empty array if not provided any metrics', () => {
            revert.push(ChartBuilderRewire.__set__('Logger', FakeLogger));
            const all = ChartBuilderRewire.retrieveIncludedMetrics(testMonitor, defaultType, undefined, resource0);

            // all should be empty
            all.length.should.equal(0);
            sinon.assert.called(FakeLogger.error);
            sinon.assert.calledWith(FakeLogger.error, 'Required "metrics" not provided for bar chart generation for monitor CallingMonitor');

        });

        it('should log an error and return an empty array if the "all" option is listed with other metrics', () => {
            revert.push(ChartBuilderRewire.__set__('Logger', FakeLogger));
            const all = ChartBuilderRewire.retrieveIncludedMetrics(testMonitor, defaultType, ['all', 'anotherMetric'], resource0);

            // all should be empty
            all.length.should.equal(0);
            sinon.assert.called(FakeLogger.error);
            sinon.assert.calledWith(FakeLogger.error, 'Cannot list "all" option with other metrics for bar chart generation for monitor CallingMonitor');
        });

        it('should provide all metrics if the `all` option is provided', () => {
            const all = ChartBuilder.retrieveIncludedMetrics(testMonitor, defaultType, ['all'], resource0);
            all.should.deep.equal(['item0 [MB]', 'item1 [MB]']);

        });

        it('should provide filtered metrics if a named list is provided option is provided', () => {
            const all = ChartBuilder.retrieveIncludedMetrics(testMonitor, defaultType, ['item1'], resource0);
            all.should.deep.equal(['item1 [MB]']);

        });
    });

    describe('ChartBuilder.retrieveChartStats', () => {

        beforeEach(() => {
            revert = [];
            sandbox = sinon.createSandbox();

            FakeLogger = {
                debug: () => {
                },
                error: () => {
                },
                warn: () => {
                }
            };
            sandbox.stub(FakeLogger);
        });

        afterEach(() => {
            if (revert.length) {
                revert.forEach(Function.prototype.call, Function.prototype.call);
            }
            sandbox.restore();
        });

        it('should call "barChart" if requested', () => {
            const myBarStub = sinon.stub().returns([]);
            sandbox.replace(ChartBuilder, 'barChart', myBarStub);
            const myPolarStub = sinon.stub().returns([]);
            sandbox.replace(ChartBuilder, 'polarChart', myPolarStub);

            const resources = [resource0, resource1, resource2];
            const chartTypes = {bar: {metrics: ['all']}};
            ChartBuilder.retrieveChartStats(testMonitor, chartTypes, 'TEST', resources);

            sinon.assert.calledOnce(myBarStub);
            sinon.assert.notCalled(myPolarStub);
        });

        it('should call "polarChart" if requested', () => {
            const myBarStub = sinon.stub().returns([]);
            sandbox.replace(ChartBuilder, 'barChart', myBarStub);
            const myPolarStub = sinon.stub().returns([]);
            sandbox.replace(ChartBuilder, 'polarChart', myPolarStub);

            const resources = [resource0, resource1, resource2];
            const chartTypes = {polar: {metrics: ['all']}};
            ChartBuilder.retrieveChartStats(testMonitor, chartTypes, 'TEST', resources);

            sinon.assert.calledOnce(myPolarStub);
            sinon.assert.notCalled(myBarStub);

        });

        it('should call all chart types passed', () => {
            const myBarStub = sinon.stub().returns([]);
            sandbox.replace(ChartBuilder, 'barChart', myBarStub);
            const myPolarStub = sinon.stub().returns([]);
            sandbox.replace(ChartBuilder, 'polarChart', myPolarStub);

            const resources = [resource0, resource1, resource2];
            const chartTypes = {bar: {metrics: ['all']}, polar: {metrics: ['all']}};
            ChartBuilder.retrieveChartStats(testMonitor, chartTypes, 'TEST', resources);

            sinon.assert.calledOnce(myBarStub);
            sinon.assert.calledOnce(myPolarStub);

        });
        it('should call log error and return empty array if unknown chart type', () => {
            revert.push(ChartBuilderRewire.__set__('Logger', FakeLogger));

            const resources = [resource0, resource1, resource2];
            const chartTypes = {unknown: {metrics: ['all']}};

            const output = ChartBuilderRewire.retrieveChartStats(testMonitor, chartTypes, 'TEST', resources);

            output.length.should.equal(0);
            sinon.assert.called(FakeLogger.error);
            sinon.assert.calledWith(FakeLogger.error, 'Unknown chart type named "unknown" requested');

        });

        it('should return an array of all items when the `all` option is specified', () => {

            const resources = [resource0, resource1, resource2];
            const chartTypes = {bar: {metrics: ['all']}};
            const chart = ChartBuilder.retrieveChartStats(testMonitor, chartTypes, 'TEST', resources);

            // expect 2 metric charts
            chart.length.should.equal(2);

            // chart should have correct structure
            chart[0]['chart-id'].should.equal('CallingMonitor_TEST_horizontalBar0');
            const chartData0 = JSON.parse(chart[0]['chart-data']);
            chartData0.type.should.equal('horizontalBar');
            chartData0.title.should.equal('item0 [MB]');
            chartData0.legend.should.equal(false);
            chartData0.labels.should.deep.equal(['resource0','resource1','resource2']);
            chartData0.datasets[0].data.should.deep.equal(['510','4.77e-8','100']);


            chart[1]['chart-id'].should.equal('CallingMonitor_TEST_horizontalBar1');
            const chartData1 = JSON.parse(chart[1]['chart-data']);
            chartData1.type.should.equal('horizontalBar');
            chartData1.title.should.equal('item1 [MB]');
            chartData1.legend.should.equal(false);
            chartData1.labels.should.deep.equal(['resource0','resource1','resource2']);
            chartData1.datasets[0].data.should.deep.equal(['1e4','23','24']);
        });

        it('should return an array of filtered items when named options are specified', () => {

            const resources = [resource0, resource1, resource2];
            const chartTypes = {bar: {metrics: ['item1']}};
            const chart = ChartBuilder.retrieveChartStats(testMonitor, chartTypes, 'TEST', resources);

            // one metric chart
            chart.length.should.equal(1);

            // chart should have correct structure
            chart[0]['chart-id'].should.equal('CallingMonitor_TEST_horizontalBar0');
            const chartData0 = JSON.parse(chart[0]['chart-data']);
            chartData0.type.should.equal('horizontalBar');
            chartData0.title.should.equal('item1 [MB]');
            chartData0.legend.should.equal(false);
            chartData0.labels.should.deep.equal(['resource0','resource1','resource2']);
            chartData0.datasets[0].data.should.deep.equal(['1e4','23','24']);
        });
    });

    describe('ChartBuilder.barChart', () => {

        const testLabel = 'testLabel';
        const include = {};

        beforeEach(() => {
            sandbox = sinon.createSandbox();
        });

        afterEach(() => {
            sandbox.restore();
        });

        it('should call through to _basicChart with "horizontalBar" and no labels', () => {
            const myStub = sinon.stub().returns([]);
            sandbox.replace(ChartBuilder, '_basicChart', myStub);

            const resources = [resource0, resource1, resource2];
            ChartBuilder.barChart(testMonitor, testLabel, include, resources);


            sinon.assert.calledOnce(myStub);
            myStub.getCall(0).args.should.deep.equal([testMonitor, testLabel, include, resources, 'horizontalBar', false]);
        });
    });

    describe('ChartBuilder.polarChart', () => {

        const testLabel = 'testLabel';
        const include = {};

        beforeEach(() => {
            sandbox = sinon.createSandbox();
        });

        afterEach(() => {
            sandbox.restore();
        });

        it('should call through to _basicChart with "polarArea" and labels', () => {
            const myStub = sinon.stub().returns([]);
            sandbox.replace(ChartBuilder, '_basicChart', myStub);

            const resources = [resource0, resource1, resource2];
            ChartBuilder.polarChart(testMonitor, testLabel, include, resources);


            sinon.assert.calledOnce(myStub);
            myStub.getCall(0).args.should.deep.equal([testMonitor, testLabel, include, resources, 'polarArea', true]);
        });
    });
});
