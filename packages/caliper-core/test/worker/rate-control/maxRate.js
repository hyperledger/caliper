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
const MaxRate = rewire('../../../lib/worker/rate-control/maxRate');
const TestMessage = require('../../../lib/common/messages/testMessage');
const TransactionStatisticsCollector = require('../../../lib/common/core/transaction-statistics-collector');

const chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('maxRate controller implementation', () => {

    describe('#constructor', () => {

        let sandbox, controller, testMessage;
        beforeEach(() => {
            sandbox = sinon.createSandbox();

            const msgContent = {
                label: 'query2',
                rateControl: {
                    type: 'maximum-rate',
                    opts: {}
                },
                workload: {
                    module:'./../queryByChannel.js'
                },
                testRound:0,
                txDuration:250,
                totalWorkers:1
            };
            testMessage = new TestMessage('test', [], msgContent);
        });

        afterEach( () => {
            sandbox.restore();
        });

        it('should set a default starting TPS for single or multiple workers', () => {

            controller = new MaxRate.createRateController(testMessage, {}, 0);
            controller.tpsSettings.current.should.equal(5);

            testMessage.content.totalWorkers = 2;
            controller = new MaxRate.createRateController(testMessage, {}, 0);
            controller.tpsSettings.current.should.equal(2.5);
        });

        it('should set a starting TPS for single or multiple workers', () => {
            testMessage.content.rateControl.opts = {
                tps: 10
            };
            controller = new MaxRate.createRateController(testMessage, {}, 0);
            controller.tpsSettings.current.should.equal(10);

            testMessage.content.totalWorkers = 2;
            controller = new MaxRate.createRateController(testMessage, {}, 0);
            controller.tpsSettings.current.should.equal(5);
        });

        it('should set a default step size for single or multiple workers', () => {
            controller = new MaxRate.createRateController(testMessage, {}, 0);
            controller.step.should.equal(5);

            testMessage.content.totalWorkers = 2;
            controller = new MaxRate.createRateController(testMessage, {}, 0);
            controller.step.should.equal(2.5);
        });

        it('should set a specified step size for single or multiple workers', () => {
            testMessage.content.rateControl.opts = {
                step: 10
            };
            controller = new MaxRate.createRateController(testMessage, {}, 0);
            controller.step.should.equal(10);

            testMessage.content.totalWorkers = 2;
            controller = new MaxRate.createRateController(testMessage, {}, 0);
            controller.step.should.equal(5);
        });

        it('should set a default sample interval for single or multiple workers', () => {
            controller = new MaxRate.createRateController(testMessage, {}, 0);
            controller.sampleInterval.should.equal(10000);

            testMessage.content.totalWorkers = 2;
            controller = new MaxRate.createRateController(testMessage, {}, 0);
            controller.sampleInterval.should.equal(10000);
        });

        it('should set a sample interval if specified for single or multiple workers', () => {
            testMessage.content.rateControl.opts = {
                sampleInterval: 20
            };
            controller = new MaxRate.createRateController(testMessage, {}, 0);
            controller.sampleInterval.should.equal(20000);

            testMessage.content.totalWorkers = 2;
            controller = new MaxRate.createRateController(testMessage, {}, 0);
            controller.sampleInterval.should.equal(20000);
        });

    });

    describe('#applyRateControl', async () => {

        let sandbox;
        let sleepStub;
        let controller;
        let txnStats;
        let clock;

        beforeEach(() => {

            sandbox = sinon.createSandbox();
            const msgContent = {
                label: 'query2',
                rateControl: {
                    type: 'maximum-rate',
                    opts: { startingTps: 20, finishingTps: 80 }
                },
                workload: {
                    module:'./../queryByChannel.js'
                },
                testRound:0,
                txDuration:250,
                totalWorkers: 1
            };

            sleepStub = sinon.stub();

            const testMessage = new TestMessage('test', [], msgContent);
            txnStats = new TransactionStatisticsCollector();
            controller = new MaxRate.createRateController(testMessage, txnStats, 0);

            sleepStub = sandbox.stub(controller, 'applySleepInterval');
            clock = sinon.useFakeTimers();
        });

        afterEach( () => {
            sandbox.restore();
            clock.restore();
        });

        it('should sleep if no completed transactions',async  () => {
            let exceededSpy = sandbox.spy(controller, 'exceededSampleInterval');
            await controller.applyRateControl();

            sinon.assert.notCalled(exceededSpy);
            sinon.assert.calledOnce(sleepStub);
        });

        it('should initialize internal stats on first pass', async () => {
            sandbox.stub(controller, 'exceededSampleInterval').returns(false);

            txnStats.stats.txCounters.totalFinished = 500;

            controller.internalStats.lastUpdate.should.equal(0);
            clock.tick(5);
            await controller.applyRateControl();

            // should have internal values
            controller.internalStats.lastUpdate.should.equal(5);
        });

        it('should ramp the driven TPS if current TPS > previous TPS, including failed', async () => {

            txnStats.stats.txCounters.totalFinished = 500;
            txnStats.stats.txCounters.totalSuccessful = 400;
            txnStats.stats.txCounters.totalFailed = 100;
            txnStats.stats.latency.successful.total = 10;
            txnStats.stats.latency.failed.total = 5;
            sandbox.stub(controller, 'exceededSampleInterval').returns(true);
            sandbox.stub(controller, 'retrieveIntervalTPS').returns(100);

            controller.tpsSettings.current = 10;
            await controller.applyRateControl();

            controller.tpsSettings.current.should.equal(15);
            controller.internalStats.currentCompletedTotal = 500;
            controller.internalStats.currentElapsedTime = 15;
        });

        it('should ramp the driven TPS if current TPS > previous TPS, not including failed', async () => {
            txnStats.stats.txCounters.totalFinished = 500;
            txnStats.stats.txCounters.totalSuccessful = 400;
            txnStats.stats.txCounters.totalFailed = 100;
            txnStats.stats.latency.successful.total = 10;
            txnStats.stats.latency.failed.total = 5;
            sandbox.stub(controller, 'exceededSampleInterval').returns(true);
            sandbox.stub(controller, 'retrieveIntervalTPS').returns(100);

            controller.tpsSettings.current = 10;
            controller.includeFailed = false;
            await controller.applyRateControl();

            controller.tpsSettings.current.should.equal(15);
            controller.internalStats.currentCompletedTotal = 400;
            controller.internalStats.currentElapsedTime = 10;
        });

        it('should drop the driven TPS and halve the step size if current TPS < previous TPS, including failed', async () => {
            txnStats.stats.txCounters.totalFinished = 500;
            txnStats.stats.txCounters.totalSuccessful = 400;
            txnStats.stats.txCounters.totalFailed = 100;
            txnStats.stats.latency.successful.total = 10;
            txnStats.stats.latency.failed.total = 5;

            sandbox.stub(controller, 'exceededSampleInterval').returns(true);
            sandbox.stub(controller, 'retrieveIntervalTPS').returns(100);

            controller.tpsSettings.current = 200;
            controller.observedTPS.current = 250;
            await controller.applyRateControl();

            controller.tpsSettings.current.should.equal(195);
            controller.internalStats.currentCompletedTotal = 500;
            controller.internalStats.currentElapsedTime = 15;
            controller.step.should.equal(2.5);
        });

        it('should drop the driven TPS and halve the step size if current TPS < previous TPS, not including failed', async () => {
            txnStats.stats.txCounters.totalFinished = 500;
            txnStats.stats.txCounters.totalSuccessful = 400;
            txnStats.stats.txCounters.totalFailed = 100;
            txnStats.stats.latency.successful.total = 10;
            txnStats.stats.latency.failed.total = 5;

            sandbox.stub(controller, 'exceededSampleInterval').returns(true);
            sandbox.stub(controller, 'retrieveIntervalTPS').returns(100);

            controller.tpsSettings.current = 200;
            controller.observedTPS.current = 250;
            controller.includeFailed = false;
            await controller.applyRateControl();

            controller.tpsSettings.current.should.equal(195);
            controller.internalStats.currentCompletedTotal = 400;
            controller.internalStats.currentElapsedTime = 10;
            controller.step.should.equal(2.5);
        });

    });

    describe('#exceededSampleInterval', () => {

        let sandbox, txnStats, controller, clock;

        beforeEach(() => {

            sandbox = sinon.createSandbox();

            clock = sinon.useFakeTimers();

            const msgContent = {
                label: 'query2',
                rateControl: {
                    type: 'maximum-rate',
                    opts: { startingTps: 20, finishingTps: 80 }
                },
                workload: {
                    module:'./../queryByChannel.js'
                },
                testRound:0,
                txDuration:250,
                totalWorkers: 1
            };

            const testMessage = new TestMessage('test', [], msgContent);
            txnStats = new TransactionStatisticsCollector();
            controller = new MaxRate.createRateController(testMessage, txnStats, 0);
        });

        afterEach( () => {
            sandbox.restore();
            clock.restore();
        });

        it('should return true if the elapsed time exceeds the configured sample interval', () => {
            clock.tick(100);
            controller.internalStats.lastUpdate = 1;
            controller.sampleInterval = 1;
            controller.exceededSampleInterval().should.equal(true);
        });

        it('should return false if the elapsed time is less than the configured sample interval', () => {
            clock.tick(100);
            controller.internalStats.lastUpdate = 1;
            controller.sampleInterval = 10000;
            controller.exceededSampleInterval().should.equal(false);
        });

    });

    describe('#retrieveIntervalTPS', () => {

        let sandbox, txnStats, controller;

        beforeEach(() => {

            sandbox = sinon.createSandbox();

            const msgContent = {
                label: 'query2',
                rateControl: {
                    type: 'maximum-rate',
                    opts: { startingTps: 20, finishingTps: 80 }
                },
                workload: {
                    module:'./../queryByChannel.js'
                },
                testRound:0,
                txDuration:250,
                totalWorkers: 1
            };

            const testMessage = new TestMessage('test', [], msgContent);
            txnStats = new TransactionStatisticsCollector();
            controller = new MaxRate.createRateController(testMessage, txnStats, 0);
        });

        afterEach( () => {
            sandbox.restore();
        });

        it('should return the TPS from internalStats', () => {

            controller.internalStats.currentCompletedTotal = 10;
            controller.internalStats.currentElapsedTime = 5;
            controller.retrieveIntervalTPS().should.equal(2000);
        });

    });

    describe('#applySleepInterval', () => {

        let sandbox;
        let sleepStub;
        let controller;
        let txnStats;

        beforeEach(() => {

            sandbox = sinon.createSandbox();
            const msgContent = {
                label: 'query2',
                rateControl: {
                    type: 'maximum-rate',
                    opts: { startingTps: 20, finishingTps: 80 }
                },
                workload: {
                    module:'./../queryByChannel.js'
                },
                testRound:0,
                txDuration:250,
                totalWorkers: 1
            };

            sleepStub = sinon.stub();

            const testMessage = new TestMessage('test', [], msgContent);
            txnStats = new TransactionStatisticsCollector();

            MaxRate.__set__('Sleep', sleepStub);
            controller = new MaxRate.createRateController(testMessage, txnStats, 0);
        });

        afterEach( () => {
            sandbox.restore();
        });

        it('should apply the global TPS setting as a sleep interval', async () => {
            await controller.applySleepInterval();
            // 200 = 1000/default
            sinon.assert.calledOnceWithExactly(sleepStub, 200);
        });

    });

});
