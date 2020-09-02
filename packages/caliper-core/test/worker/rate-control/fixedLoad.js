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
const FixedLoad = rewire('../../../lib/worker/rate-control/fixedLoad');
const TestMessage = require('../../../lib/common/messages/testMessage');
const TransactionStatisticsCollector = require('../../../lib/common/core/transaction-statistics-collector');

const chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('fixedLoad controller implementation', () => {

    describe('#constructor', () => {

        let controller;
        let testMessage;
        beforeEach( () => {
            const msgContent = {
                label: 'query2',
                rateControl: {
                    type: 'fixed-load',
                    opts: {
                        startTps:10,
                        transactionLoad:20
                    }
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

        it('should set the sleep time for a single worker if a single worker is specified and the startingTps is not specified', () => {
            testMessage.content.rateControl.opts = {};
            testMessage.content.totalWorkers = 1;
            controller = new FixedLoad.createRateController(testMessage, {}, 0);
            controller.sleepTime.should.equal(200);
        });

        it('should set the sleep time for a single worker if no workers are specified and the startingTps is specified', () => {
            testMessage.content.rateControl.opts = { startTps: 50 };
            testMessage.content.totalWorkers = 1;
            controller = new FixedLoad.createRateController(testMessage, {}, 0);
            controller.sleepTime.should.equal(20);
        });

        it('should set the sleep time for a multiple workers it the startingTps is not specified', () => {
            testMessage.content.rateControl.opts = {};
            testMessage.content.totalWorkers = 2;
            controller = new FixedLoad.createRateController(testMessage, {}, 0);
            controller.sleepTime.should.equal(400);
        });

        it('should set the sleep time for a multiple workers if the startingTps is specified', () => {
            testMessage.content.rateControl.opts = { startTps: 50 };
            testMessage.content.totalWorkers = 2;
            controller = new FixedLoad.createRateController(testMessage, {}, 0);
            controller.sleepTime.should.equal(40);
        });

        it('should set a default transaction backlog for multiple workers if not specified', () => {
            testMessage.content.rateControl.opts = { startTps: 50 };
            controller = new FixedLoad.createRateController(testMessage, {}, 0);
            controller.targetLoad.should.equal(5);
        });

        it('should set the transaction backlog for multiple workers if specified', () => {
            controller = new FixedLoad.createRateController(testMessage, {}, 0);
            controller.targetLoad.should.equal(10);
        });

    });

    describe('#applyRateControl', () => {

        let sleepStub;
        let txnStats;
        let controller;

        beforeEach(() => {
            sleepStub = sinon.stub();
            FixedLoad.__set__('Sleep', sleepStub);

            const msgContent = {
                label: 'query2',
                rateControl: {
                    type: 'fixed-load',
                    opts: {
                        startTps:10,
                        transactionLoad:20
                    }
                },
                workload: {
                    module:'./../queryByChannel.js'
                },
                testRound:0,
                txDuration:250,
                totalWorkers:2
            };
            const testMessage = new TestMessage('test', [], msgContent);
            txnStats = new TransactionStatisticsCollector();
            controller = new FixedLoad.createRateController(testMessage, txnStats, 0);
        });

        it ('should sleep if no successful results are available', async () => {
            await controller.applyRateControl();
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, 200);
        });

        it ('should not sleep if backlog transaction is below target', async () => {
            txnStats.stats.txCounters.totalSubmitted = 20;
            txnStats.stats.txCounters.totalFinished = 20;

            await controller.applyRateControl();
            sinon.assert.notCalled(sleepStub);
        });

        it ('should sleep if backlog transaction is at or above target', async () => {
            txnStats.stats.txCounters.totalSubmitted = 20;
            txnStats.stats.txCounters.totalFinished = 0;

            await controller.applyRateControl();
            sinon.assert.calledOnce(sleepStub);
        });

        it ('should sleep for a count of the load error and the current average delay', async () => {
            txnStats.stats.txCounters.totalSubmitted = 80;
            txnStats.stats.txCounters.totalFinished = 40;

            txnStats.stats.txCounters.totalSuccessful = 40;
            txnStats.stats.latency.successful.total = 10000;

            await controller.applyRateControl();
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, 7500);
        });

        it('should log the backlog error as a debug message', async () => {

            const FakeLogger = {
                debug : () => {},
                error: () => {}
            };

            let debugStub = sinon.stub(FakeLogger, 'debug');
            FixedLoad.__set__('Logger', FakeLogger);

            txnStats.stats.txCounters.totalSubmitted = 80;
            txnStats.stats.txCounters.totalFinished = 40;

            txnStats.stats.txCounters.totalSuccessful = 40;
            txnStats.stats.latency.successful.total = 10000;

            await controller.applyRateControl();
            const message = 'Difference between current and desired transaction backlog: 30';
            sinon.assert.calledOnce(debugStub);
            sinon.assert.calledWith(debugStub, message);

        });

    });

});
