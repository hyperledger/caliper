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
    });

    describe('#applyRateControl', () => {

        let controller, sleepStub, txnStats, clock;

        beforeEach(() => {
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

        it('should sleep based on the difference between the required increment time, and the elapsed time', () => {
            txnStats.stats.txCounters.totalSubmitted = 100;
            controller.applyRateControl();
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, 20000);
        });
    });

});
