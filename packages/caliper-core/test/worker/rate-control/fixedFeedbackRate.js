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
const FixedFeedbackRate = rewire('../../../lib/worker/rate-control/fixedFeedbackRate');
const TestMessage = require('../../../lib/common/messages/testMessage');
const TransactionStatisticsCollector = require('../../../lib/common/core/transaction-statistics-collector');

const chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('fixedFeedbackRate controller implementation', () => {

    describe('#constructor', () => {
        let controller;
        let testMessage;
        beforeEach( () => {
            const msgContent = {
                label: 'query2',
                rateControl: {
                    type: 'fixed-feedback-rate',
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

        it('should set the sleepTime for a single worker if no options are specified', () => {
            testMessage.content.totalWorkers = 1;
            controller = new FixedFeedbackRate.createRateController(testMessage, {}, 0);
            controller.generalSleepTime.should.equal(100);
        });

        it('should set unfinishedPerWorker for multiple workers if specified', () => {
            testMessage.content.rateControl.opts = { transactionLoad: 50 };
            controller = new FixedFeedbackRate.createRateController(testMessage, {}, 0);
            controller.unfinishedPerWorker.should.equal(25);
        });

        it('should set unfinishedPerWorker for multiple workers if not specified', () => {
            testMessage.content.rateControl.opts = { };
            controller = new FixedFeedbackRate.createRateController(testMessage, {}, 0);
            controller.unfinishedPerWorker.should.equal(5);
        });

        it('should set zeroSuccessfulCounter to 0', () => {
            testMessage.content.rateControl.opts = { };
            controller = new FixedFeedbackRate.createRateController(testMessage, {}, 0);
            controller.zeroSuccessfulCounter.should.equal(0);
        });

        it ('should set the total sleep time to 0', () => {
            testMessage.content.rateControl.opts = { };
            controller = new FixedFeedbackRate.createRateController(testMessage, {}, 0);
            controller.totalSleepTime.should.equal(0);
        });

    });

    describe('#applyRateController', () => {
        let controller, sleepStub, txnStats, clock;

        beforeEach( () => {
            const msgContent = {
                label: 'query2',
                rateControl: {
                    type: 'fixed-feedback-rate',
                    opts: {}
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
            FixedFeedbackRate.__set__('util.sleep', sleepStub);

            const testMessage = new TestMessage('test', [], msgContent);
            txnStats = new TransactionStatisticsCollector();
            controller = new FixedFeedbackRate.createRateController(testMessage, txnStats, 0);
        });

        afterEach(() => {
            clock.restore();
        });

        it('should not sleep if the generalSleepTime is 0', () => {
            controller.generalSleepTime = 0;
            txnStats.stats.txCounters.totalSubmitted = 2000;
            controller.applyRateControl();

            // should have not called the sleep method
            sinon.assert.notCalled(sleepStub);
        });

        it('should not sleep if there are no unfinished transactions', () => {
            txnStats.stats.txCounters.totalSubmitted = 0;
            controller.applyRateControl();

            // should have not called the sleep method
            sinon.assert.notCalled(sleepStub);
        });

        it('should not sleep if backlog transaction is below half the target', () => {
            txnStats.stats.txCounters.totalSubmitted = 1000;
            txnStats.stats.txCounters.totalFinished = 999;
            controller.generalSleepTime = 1;
            controller.applyRateControl();

            // should have not called the sleep method
            sinon.assert.notCalled(sleepStub);
        });

        it ('should sleep if the elapsed time difference is greater than 5ms', () => {
            txnStats.stats.txCounters.totalSubmitted = 100;
            txnStats.stats.txCounters.totalFinished = 2;
            controller.applyRateControl();

            // should have called the sleep method with a value equal to diff
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, 20000);
        });
    });
});
