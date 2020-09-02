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
const NoRate = rewire('../../../lib/worker/rate-control/noRate');
const TestMessage = require('../../../lib/common/messages/testMessage');
const TransactionStatisticsCollector = require('../../../lib/common/core/transaction-statistics-collector');

const chai = require('chai');
chai.should();
const sinon = require('sinon');
const assert = require('assert');

describe('noRate controller implementation', () => {

    describe('#constructor', () => {

        let controller, testMessage;
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


        it ('should throw an error if a value for the number of transactions is set', async () => {
            try {
                testMessage.content.numb = 6;
                controller = new NoRate.createRateController(testMessage, {}, 0);
                assert.fail(null, null, 'Exception expected');
            } catch (error) {
                if (error.constructor.name === 'AssertionError') {
                    throw error;
                }
                error.message.should.equal('The no-rate controller can only be applied for duration-based rounds');
            }
        });

        it ('should set the sleep time based on the length of the round in seconds', () => {
            testMessage.content.txDuration = 6;
            controller = new NoRate.createRateController(testMessage, {}, 0);

            controller.sleepTime.should.equal(6000);
        });
    });

    describe('#applyRateControl', () => {

        let controller, sleepStub, msgContent, clock;

        beforeEach(() => {
            msgContent = {
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
            NoRate.__set__('Sleep', sleepStub);
        });

        afterEach(() => {
            clock.restore();
        });

        it('should sleep for the set sleep time', () => {
            const txnStats = new TransactionStatisticsCollector();

            const testMessage = new TestMessage('test', [], msgContent);
            testMessage.content.txDuration = 5;
            controller = new NoRate.createRateController(testMessage, txnStats, 0);

            controller.applyRateControl();
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, 5000);
        });
    });
});
