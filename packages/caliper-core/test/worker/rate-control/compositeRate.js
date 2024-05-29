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

const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;
// const CompositeRate = rewire('../../../lib/worker/rate-control/compositeRate.js');
const {createRateController} = require('../../../lib/worker/rate-control/compositeRate.js');
const TransactionStatisticsCollector = require('../../../lib/common/core/transaction-statistics-collector');
const TestMessage = require('../../../lib/common/messages/testMessage.js');

describe('CompositeRateController implementation', () => {
    let testMessage;
    let CompositeRateController;
    let stats;
    let clock;
    beforeEach(() => {
        let msgContent = {
            label: 'query2',
            rateControl: {
                type: 'composite-rate',
                opts: {
                    weights: [1],
                    rateControllers: [{ type: 'fixed-rate', opts: {} }]
                },
            },
            workload: {
                module: './../queryByChannel.js',
            },
            testRound: 0,
            txDuration: 250,
            totalWorkers: 2,
            workerArgs: 0,
            numb: 0,
        };
        testMessage = new TestMessage('test', [], msgContent);
        stats = new TransactionStatisticsCollector(0, 0, 'query2');
    });

    describe('#constructor', () => {
        it('should correctly initialize with default settings', () => {
            CompositeRateController = createRateController(testMessage, stats, 0);
            expect(CompositeRateController.activeControllerIndex).to.equal(0);
            expect(CompositeRateController.controllers.length).to.equal(1);
        });
    });


    describe('#_prepareControllers', () => {
        it('should throw error when weights and rateControllers are not arrays', async () => {
            testMessage.content.rateControl.opts.weights = 'not an array';
            testMessage.content.rateControl.opts.rateControllers = 'not an array';
            expect(() => createRateController(testMessage, stats, 0)).to.throw(
                'Weight and controller definitions must be arrays.'
            );
        });

        it('should throw error when weights and rateControllers lengths are not the same', async () => {
            testMessage.content.rateControl.opts.weights = [1, 2];
            testMessage.content.rateControl.opts.rateControllers = ['composite-rate'];
            expect(() => createRateController(testMessage, stats, 0)).to.throw(
                'The number of weights and controllers must be the same.'
            );
        });

        it('should throw error when weights contains non-numeric value', async () => {
            testMessage.content.rateControl.opts.weights = [1, 'not a number'];
            testMessage.content.rateControl.opts.rateControllers = [
                'composite-rate',
                'composite-rate',
            ];
            expect(() => createRateController(testMessage, stats, 0)).to.throw(
                'Not-a-number element among weights: not a number'
            );
        });

        it('should throw error when weights contains negative number', async () => {
            testMessage.content.rateControl.opts.weights = [1, -2];
            testMessage.content.rateControl.opts.rateControllers = [
                'composite-rate',
                'composite-rate',
            ];
            expect(() => createRateController(testMessage, stats, 0)).to.throw(
                'Negative element among weights: -2'
            );
        });

        it('should throw error when all weights are zero', async () => {
            testMessage.content.rateControl.opts.weights = [0, 0];
            testMessage.content.rateControl.opts.rateControllers = [
                'composite-rate',
                'composite-rate',
            ];
            expect(() => createRateController(testMessage, stats, 0)).to.throw(
                'Every weight is zero.'
            );
        });
    });

    describe('#_controllerSwitchForDuration', () => {
        beforeEach(() => {
            CompositeRateController.controllers = [
                { isLast: false, relFinishTime: 100, txStatSubCollector: { deactivate: () => {}, activate: () => {} }, controller: { end: async () => {} } },
                { isLast: true, relFinishTime: 200, txStatSubCollector: { deactivate: () => {}, activate: () => {} }, controller: { end: async () => {} } }
            ];
            CompositeRateController.activeControllerIndex = 0;
            CompositeRateController.stats = {
                getRoundStartTime: () => 1000,
                getTotalSubmittedTx: () => 10,
            };
            stats = new TransactionStatisticsCollector(0, 0, 'query2');
            clock = sinon.useFakeTimers();
        });

        afterEach(() => {
            clock.restore();
        });
        it('should not switch if current controller is last', async () => {
            CompositeRateController.activeControllerIndex = 1;
            await CompositeRateController._controllerSwitchForDuration();
            expect(CompositeRateController.activeControllerIndex).to.equal(1);
        });

        it('should not switch if it is not time yet', async () => {
            global.Date.now = () => 100;
            await CompositeRateController._controllerSwitchForDuration();
            expect(CompositeRateController.activeControllerIndex).to.equal(0);
        });
    });
});
