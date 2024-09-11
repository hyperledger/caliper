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
        let controller, sleepStub, txnStats, clock, testMessage;

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

            testMessage = new TestMessage('test', [], msgContent);
            txnStats = new TransactionStatisticsCollector();
            controller = new FixedFeedbackRate.createRateController(testMessage, txnStats, 0);
        });

        afterEach(() => {
            clock.restore();
        });

        it('should not sleep if the generalSleepTime is 0', async () => {
            controller.generalSleepTime = 0;
            txnStats.stats.txCounters.totalSubmitted = 2000;
            await controller.applyRateControl();

            // should have not called the sleep method
            sinon.assert.notCalled(sleepStub);
        });

        it('should not sleep if there are no unfinished transactions', async () => {
            // Stub methods if necessary
            sinon.stub(txnStats, 'getTotalSubmittedTx').returns(10);
            sinon.stub(txnStats, 'getTotalFinishedTx').returns(0);

            await controller.applyRateControl();

            // Ensure sleep was not called
            sinon.assert.notCalled(sleepStub);
        });

        it('should not sleep if backlog transaction is below half the target', async () => {
            txnStats.stats.txCounters.totalSubmitted = 1000;
            txnStats.stats.txCounters.totalFinished = 999;
            controller.generalSleepTime = 1;
            await controller.applyRateControl();

            // should have not called the sleep method
            sinon.assert.notCalled(sleepStub);
        });

        it ('should sleep if the elapsed time difference is greater than 5ms', async () => {
            txnStats.stats.txCounters.totalSubmitted = 100;
            txnStats.stats.txCounters.totalFinished = 2;
            await controller.applyRateControl();

            // should have called the sleep method with a value equal to diff
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, 20000);
        });

        it('should sleep for backOffTime when no successful transactions have occurred once', async () => {
            txnStats.stats.txCounters.totalSubmitted = 5;
            txnStats.stats.txCounters.totalFinished = 2;
            txnStats.stats.txCounters.totalSuccessful = 0;
            controller.generalSleepTime = 1;

            await controller.applyRateControl();

            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, 1 * controller.backOffTime);
        });

        it('should increase sleep time when no successful transactions have occurred multiple times', async () => {
            // Configure the rate controller with a high TPS value
            testMessage.content.rateControl.opts = {
                tps: 10000,
                sleepTime: 100,
                transactionLoad: 10
            };

            controller = new FixedFeedbackRate.createRateController(testMessage, txnStats, 0);
            txnStats.stats.txCounters.totalSubmitted = 5;
            txnStats.stats.txCounters.totalFinished = 2;
            txnStats.stats.txCounters.totalSuccessful = 0;

            controller.zeroSuccessfulCounter = 3;
            clock.tick(0); // Ensure clock starts at 0

            await controller.applyRateControl();

            sinon.assert.calledOnce(sleepStub);
            // Expected sleep time should be 4 * backOffTime = 400ms
            sinon.assert.calledWith(sleepStub, 4 * controller.backOffTime);
        });

        it('should cap the sleep time increase when zeroSuccessfulCounter exceeds threshold', async () => {
            // Configure the rate controller with a high TPS value
            testMessage.content.rateControl.opts = {
                tps: 10000,
                sleepTime: 100,
                transactionLoad: 10
            };

            // Re-instantiate the controller with the new configuration
            controller = new FixedFeedbackRate.createRateController(testMessage, txnStats, 0);

            // Simulate conditions where there are no successful transactions
            txnStats.stats.txCounters.totalSubmitted = 5;
            txnStats.stats.txCounters.totalFinished = 2;
            txnStats.stats.txCounters.totalSuccessful = 0;

            // Set zeroSuccessfulCounter to 31
            controller.zeroSuccessfulCounter = 31;

            // Use the fake timers to control Date.now()
            clock.tick(0); // Ensure clock starts at 0

            await controller.applyRateControl();

            sinon.assert.calledOnce(sleepStub);
            // Expected sleep time should be capped at 30 * backOffTime = 3000ms
            sinon.assert.calledWith(sleepStub, 30 * controller.backOffTime);
        });

        it('should sleep to adjust rate when expected time exceeds actual elapsed time', async () => {
            txnStats.stats.txCounters.totalSubmitted = 44;
            txnStats.stats.txCounters.totalFinished = 40;

            // Simulate time progression
            const elapsedTime = 1000; // e.g., 1000ms since start
            clock.tick(elapsedTime);

            await controller.applyRateControl();

            sinon.assert.calledOnce(sleepStub);
            // Calculate expected adjustment time
            const expectedTime = controller.generalSleepTime * txnStats.getTotalSubmittedTx();
            const actualElapsedTime = (Date.now() - controller.totalSleepTime) - txnStats.getRoundStartTime();
            const adjustmentTime = expectedTime - actualElapsedTime;

            sinon.assert.calledWith(sleepStub, adjustmentTime);
        });

        it('should sleep correctly based on the number of unfinished transactions', async () => {
            // Configure the rate controller
            testMessage.content.rateControl.opts = {
                tps: 10000,
                sleepTime: 100,
                transactionLoad: 10
            };

            for (let i = 10; i > 0; --i) {
                // Re-instantiate the controller for each iteration
                controller = new FixedFeedbackRate.createRateController(testMessage, txnStats, 0);
                const unfinishedPerWorker = controller.unfinishedPerWorker; // Should be 5

                // Reset sleep stub
                sleepStub.resetHistory();

                // Ensure there are successful transactions
                sinon.stub(txnStats, 'getTotalSuccessfulTx').returns(5);

                // Stub getRoundStartTime
                sinon.stub(txnStats, 'getRoundStartTime').returns(0);

                // Stub getTotalSubmittedTx and getTotalFinishedTx
                const unfinished = i * unfinishedPerWorker;
                const totalFinished = 10;
                const totalSubmitted = totalFinished + unfinished;

                sinon.stub(txnStats, 'getTotalSubmittedTx').returns(totalSubmitted);
                sinon.stub(txnStats, 'getTotalFinishedTx').returns(totalFinished);

                // Control time
                clock.reset();
                clock.tick(12);

                await controller.applyRateControl();

                const expectedSleepTime = i * controller.backOffTime;

                sinon.assert.calledOnce(sleepStub);
                sinon.assert.calledWith(sleepStub, expectedSleepTime);

                // Restore stubs
                txnStats.getTotalSubmittedTx.restore();
                txnStats.getTotalFinishedTx.restore();
                txnStats.getTotalSuccessfulTx.restore();
                txnStats.getRoundStartTime.restore();
            }
        });
    });
});
