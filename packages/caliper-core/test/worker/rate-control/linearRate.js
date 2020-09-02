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
const LinearRateRewire = rewire('../../../lib/worker/rate-control/linearRate');
const LinearRate = rewire('../../../lib/worker/rate-control/linearRate');
const TestMessage = require('../../../lib/common/messages/testMessage');
const TransactionStatisticsCollector = require('../../../lib/common/core/transaction-statistics-collector');

const chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('linearRate controller implementation', () => {

    describe('#_interpolateFromIndex', () => {

        let controller, testMessage, txnStats;
        beforeEach( () => {
            const msgContent = {
                label: 'query2',
                rateControl: {
                    type: 'linear-rate',
                    opts: {}
                },
                workload: {
                    module:'./../queryByChannel.js'
                },
                testRound:0,
                txDuration:250,
                totalWorkers:2
            };
            testMessage = new TestMessage('test', [], msgContent);
        });

        it('should return value interpolated from index', () => {
            txnStats = new TransactionStatisticsCollector();
            txnStats.stats.txCounters.totalSubmitted = 5;
            controller = new LinearRate.createRateController(testMessage, txnStats, 0);
            controller.startingSleepTime = 3;
            controller.gradient = 2;

            // If the starting sleeptime is 3ms, the gradient is 2 and the index is 5, the returned interpolated value should be ((3 + (5*2)) = 13
            controller._interpolateFromIndex().should.equal(13);
        });
    });

    describe('#_interpolateFromTime', () => {
        let clock, controller, testMessage, txnStats;

        beforeEach( () => {
            clock = sinon.useFakeTimers();
            const msgContent = {
                label: 'query2',
                rateControl: {
                    type: 'linear-rate',
                    opts: {}
                },
                workload: {
                    module:'./../queryByChannel.js'
                },
                testRound:0,
                txDuration:250,
                totalWorkers:2
            };
            testMessage = new TestMessage('test', [], msgContent);
        });

        afterEach(() => {
            clock.restore();
        });

        it('should return value interpolate from time', () => {
            txnStats = new TransactionStatisticsCollector();
            txnStats.stats.metadata.roundStartTime = 5;
            controller = new LinearRate.createRateController(testMessage, txnStats, 0);
            controller.startingSleepTime = 3;
            controller.gradient = 2;

            clock.tick(5);

            // If the starting sleeptime is 3ms, the gradient is 2 and start is 5ms, the returned interpolated value should be ((3 + (5-5)*2)) = 3
            controller._interpolateFromTime().should.equal(3);
        });
    });

    describe('#constructor', () => {
        let clock, controller, testMessage;

        beforeEach( () => {
            clock = sinon.useFakeTimers();
            const msgContent = {
                label: 'query2',
                rateControl: {
                    type: 'linear-rate',
                    opts: {}
                },
                workload: {
                    module:'./../queryByChannel.js'
                },
                testRound:0,
                txDuration:250,
                totalWorkers:2
            };
            testMessage = new TestMessage('test', [], msgContent);
        });

        afterEach(() => {
            clock.restore();
        });

        it('should set the starting sleep time based on starting tps and total number of workers', () => {
            testMessage.content.totalWorkers = 6;
            testMessage.content.rateControl.opts = { startingTps: 20 };
            controller = new LinearRate.createRateController(testMessage, {}, 0);

            // If there are 6 workers with an initial 20 TPS goal, the starting sleep time should be (1000/(20/6)) = 300ms
            controller.startingSleepTime.should.equal(300);
        });

        it('should set the gradient based on linear interpolation between two points separated based on a txn count', () => {
            testMessage.content.totalWorkers = 6;
            testMessage.content.rateControl.opts = { startingTps: 20, finishingTps: 80 };
            testMessage.content.numb = 5;
            controller = new LinearRate.createRateController(testMessage, {}, 0);

            // if there are 6 workers with a starting sleep time of (1000/(20/6) = 300, a finishing sleep time of (1000/(80/6)) = 75, and a duration of 5,
            // the gradient should be ((75 - 300) / 5) = -45
            controller.gradient.should.equal(-45);
        });

        it('should set the gradient based on linear interpolation between two points separated based on a duration count', () => {
            testMessage.content.totalWorkers = 6;
            testMessage.content.rateControl.opts = { startingTps: 20, finishingTps: 80 };
            testMessage.content.txDuration = 5;
            controller = new LinearRate.createRateController(testMessage, {}, 0);

            // If there are 6 workers with a starting sleep time of (1000/(20/6) = 300, a finishing sleep time of (1000/(80/6)) = 75, and a duration of (5*1000) = 5000,
            // the gradient should be ((75 - 300) / 5000) = -0.045
            controller.gradient.should.equal(-0.045);
        });

        it('should assign _interpolateFromIndex to _interpolate if txCount based', () => {
            testMessage.content.totalWorkers = 6;
            testMessage.content.rateControl.opts = { startingTps: 20, finishingTps: 80 };
            testMessage.content.numb = 5;

            const txnStats = new TransactionStatisticsCollector();
            const mySpy = sinon.spy(txnStats, 'getTotalSubmittedTx');
            controller = new LinearRate.createRateController(testMessage, txnStats, 0);

            controller._interpolate();
            sinon.assert.called(mySpy);
        });

        it('should assign _interpolateFromTime to _interpolate if txCount based', () => {
            testMessage.content.totalWorkers = 6;
            testMessage.content.rateControl.opts = { startingTps: 20, finishingTps: 80 };
            testMessage.content.txDuration = 5;

            const txnStats = new TransactionStatisticsCollector();
            const mySpy = sinon.spy(txnStats, 'getRoundStartTime');
            controller = new LinearRate.createRateController(testMessage, txnStats, 0);

            controller._interpolate();
            sinon.assert.called(mySpy);
        });

    });

    describe('#applyRateController', () => {

        let controller, sleepStub, txnStats, clock;

        beforeEach(() => {
            const msgContent = {
                label: 'query2',
                rateControl: {
                    type: 'linear-feedback-rate',
                    opts: { startingTps: 20, finishingTps: 80 }
                },
                workload: {
                    module:'./../queryByChannel.js'
                },
                testRound:0,
                txDuration:250,
                totalWorkers:2
            };

            clock = sinon.useFakeTimers();

            sleepStub = sinon.stub();
            LinearRateRewire.__set__('Sleep', sleepStub);

            const testMessage = new TestMessage('test', [], msgContent);
            txnStats = new TransactionStatisticsCollector();
            controller = new LinearRateRewire.createRateController(testMessage, txnStats, 0);
        });

        afterEach(() => {
            clock.restore();
        });

        it('should sleep for a duration of current sleep time if greater than 5ms', () => {
            txnStats.stats.txCounters.totalSubmitted = 1000;
            txnStats.stats.metadata.roundStartTime = 0;
            controller.startingSleepTime = 50;
            controller.applyRateControl();

            // should have called the sleep method with current sleep time of 6ms
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, 50);
        });

        it('should do nothing where current sleep time is less than or equal to 5ms', () => {
            txnStats.stats.txCounters.totalSubmitted = 0;
            txnStats.stats.metadata.roundStartTime = 0;
            controller.startingSleepTime = 0;
            controller.applyRateControl();

            // should not have called the sleep method
            sinon.assert.notCalled(sleepStub);
        });
    });
});
