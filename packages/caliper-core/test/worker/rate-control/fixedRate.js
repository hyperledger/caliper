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
const FixedRate = rewire('../../../lib/worker/rate-control/fixedRate');
const TestMessage = require('../../../lib/common/messages/testMessage');
const TransactionStatisticsCollector = require('../../../lib/common/core/transaction-statistics-collector');

const chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('fixedRate controller implementation', () => {

    describe('#constructor', () => {

        let controller;
        let testMessage;
        beforeEach( () => {
            const msgContent = {
                label: 'query2',
                rateControl: {
                    type: 'fixed-rate',
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

        it('should set a default sleep time if no options passed', () => {
            testMessage.content.totalWorkers = 1;
            controller = new FixedRate.createRateController(testMessage, {}, 0);
            controller.sleepTime.should.equal(100);
        });

        it('should set the sleep time for a single worker', () => {
            testMessage.content.totalWorkers = 1;
            testMessage.content.rateControl.opts = { tps: 50 };
            controller = new FixedRate.createRateController(testMessage, {}, 0);
            controller.sleepTime.should.equal(20);
        });

        it('should set the sleep time for multiple workers', () => {
            testMessage.content.totalWorkers = 2;
            testMessage.content.rateControl.opts = { tps: 50 };
            controller = new FixedRate.createRateController(testMessage, {}, 0);
            controller.sleepTime.should.equal(40);
        });

        it('should set sleepTime to 0 when numberOfWorkers is 0', () => {
            testMessage.content.totalWorkers = 0;
            testMessage.content.rateControl.opts = { tps: 50 };
            controller = new FixedRate.createRateController(testMessage, {}, 0);
            controller.sleepTime.should.equal(0);
        });

        it('should set sleepTime to 0 when numberOfWorkers is negative', () => {
            testMessage.content.totalWorkers = -1;
            testMessage.content.rateControl.opts = { tps: 50 };
            controller = new FixedRate.createRateController(testMessage, {}, 0);
            controller.sleepTime.should.equal(0);
        });

        it('should set sleepTime to 0 when tps is 0', () => {
            testMessage.content.rateControl.opts = { tps: 0 };
            controller = new FixedRate.createRateController(testMessage, {}, 0);
            controller.sleepTime.should.equal(0);
        });

        it('should set sleepTime to 0 when tps is negative', () => {
            testMessage.content.rateControl.opts = { tps: -10 };
            controller = new FixedRate.createRateController(testMessage, {}, 0);
            controller.sleepTime.should.equal(0);
        });

        it('should set a default sleep time when tps option is undefined', () => {
            testMessage.content.rateControl.opts = {};
            controller = new FixedRate.createRateController(testMessage, {}, 0);
            controller.sleepTime.should.equal(100);
        });
        
        it('should set a default sleep time when tps option is null', () => {
            testMessage.content.rateControl.opts = { tps: null };
            controller = new FixedRate.createRateController(testMessage, {}, 0);
            controller.sleepTime.should.equal(100);
        });

    });

    describe('#applyRateControl', () => {

        let controller, sleepStub, txnStats, clock;

        beforeEach(() => {
            const msgContent = {
                label: 'query2',
                rateControl: {
                    type: 'fixed-rate',
                    opts: { tps: 10 } // Adjust as needed
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
            FixedRate.__set__('Sleep', sleepStub);

            const testMessage = new TestMessage('test', [], msgContent);
            txnStats = new TransactionStatisticsCollector();
            controller = new FixedRate.createRateController(testMessage, txnStats, 0);
        });

        afterEach(() => {
            clock.restore();
        });

        it('should not sleep if the sleepTime is zero', () => {
            controller.sleepTime = 0;
            controller.applyRateControl();
            sinon.assert.notCalled(sleepStub);
        });

        it('should sleep based on the difference between the required increment time and the elapsed time (positive decimal)', () => {
            txnStats.stats.txCounters.totalSubmitted = 100;
            controller.sleepTime = 0.5;
            controller.applyRateControl();
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, 20000);
        });

        it('should sleep based on the difference between the required increment time and the elapsed time (positive integer)', () => {
            txnStats.stats.txCounters.totalSubmitted = 100;
            controller.sleepTime = 1;
            controller.applyRateControl();
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, 20000);
        });
    
        it('should not sleep if the sleepTime is NaN', () => {
            controller.sleepTime = NaN;
            controller.applyRateControl();
            sinon.assert.notCalled(sleepStub);
        });
    
        it('should not sleep if the sleepTime is negative', () => {
            controller.sleepTime = -100;
            controller.applyRateControl();
            sinon.assert.notCalled(sleepStub);
        });
    
        it('should throw an error if totalSubmitted is not a number', () => {
            txnStats.stats.txCounters.totalSubmitted = 'not a number';
            (() => controller.applyRateControl()).should.throw(Error);
        });
    
        it('should throw an error if totalSubmitted is negative', () => {
            txnStats.stats.txCounters.totalSubmitted = -1;
            (() => controller.applyRateControl()).should.throw(Error);
        });
    
        it('should not sleep if totalSubmitted is zero', () => {
            txnStats.stats.txCounters.totalSubmitted = 0;
            controller.applyRateControl();
            sinon.assert.notCalled(sleepStub);
        });
    
        it('should not sleep if totalSubmitted equals the required TPS', () => {
            txnStats.stats.txCounters.totalSubmitted = 10; // Assuming TPS is set to 10
            controller.sleepTime = 1;
            controller.applyRateControl();
            sinon.assert.notCalled(sleepStub);
        });
    
        it('should handle a high TPS rate', () => {
            txnStats.stats.txCounters.totalSubmitted = 10000; // Assuming TPS is set to 10000
            controller.sleepTime = 0.001;
            controller.applyRateControl();
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, 0);
        });

        it('should handle NaN totalSubmitted gracefully', () => {
            txnStats.stats.txCounters.totalSubmitted = NaN;
            controller.sleepTime = 1;
            (() => controller.applyRateControl()).should.not.throw();
            sinon.assert.notCalled(sleepStub);
        });

        it('should handle Infinity totalSubmitted gracefully', () => {
            txnStats.stats.txCounters.totalSubmitted = Infinity;
            controller.sleepTime = 1;
            (() => controller.applyRateControl()).should.not.throw();
            sinon.assert.notCalled(sleepStub);
        });

        it('should not throw an error if getTotalSubmittedTx() returns an invalid value', () => {
            const getTotalSubmittedTxStub = sinon.stub(txnStats, 'getTotalSubmittedTx').returns('invalid');
            controller.applyRateControl().should.not.throw();
            getTotalSubmittedTxStub.restore();
        });
        
        it('should not throw an error if getTotalSubmittedTx() throws an error', () => {
            const getTotalSubmittedTxStub = sinon.stub(txnStats, 'getTotalSubmittedTx').throws(new Error('Test error'));
            controller.applyRateControl().should.not.throw();
            getTotalSubmittedTxStub.restore();
        });
    });

    describe('#end', () => {
        it('should not throw an error', async () => {
            const controller = new FixedRate(new TestMessage(), new TransactionStatisticsCollector(), 0);
            await controller.end().should.not.be.rejected;
        });

        it('should not throw an error when end() is called', async () => {
            const controller = new FixedRate.createRateController(testMessage, {}, 0);
            await controller.end().should.not.be.rejected;
        });
    });
});
