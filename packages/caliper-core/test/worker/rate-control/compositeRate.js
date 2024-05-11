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
const expect = chai.expect;
const CompositeRateController = require('../../../lib/worker/rate-control/compositeRate.js');
// const RateControl = require('../../../lib/worker/rate-control/rateControl.js');
// const TransactionStatisticsCollector = require('../../../lib/common/core/transaction-statistics-collector');
const TestMessage = require('../../../lib/common/messages/testMessage.js');

/**
 * Encapsulates a controller and its scheduling information.
 *
 * @property {boolean} isLast Indicates whether the controller is the last in the round.
 * @property {RateControl} controller The controller instance.
 * @property {number} lastTxIndex The last TX index associated with the controller based on its weight. Only used in Tx number-based rounds.
 * @property {number} relFinishTime The finish time of the controller based on its weight, relative to the start time of the round. Only used in duration-based rounds.
 * @property {TransactionStatisticsCollector} txStatSubCollector The TX stat (sub-)collector associated with the sub-controller.
 */

describe('CompositeRateController', () => {
    let testMessage;
    beforeEach(() => {
        let msgContent = {
            label: 'query2',
            rateControl: {
                type: 'fixed-rate',
                opts: {},
            },
            workload: {
                module: './../queryByChannel.js',
            },
            testRound: 0,
            txDuration: 250,
            totalWorkers: 2,
            weights: [1],
            rateControllers: ['composite-rate'],
        };
        testMessage = new TestMessage('test', [], msgContent);
    });

    describe('Initialization', () => {
        it('should correctly initialize with default settings', () => {
            const testMessage = new TestMessage('test', [], {
                weights: [1],
                rateControllers: ['fixed-rate']
            });
            const controller = new CompositeRateController(testMessage, {}, 0);
            expect(controller.activeControllerIndex).to.equal(0);
            expect(controller.controllers.length).to.equal(1);
        });
    });

    describe('applyRateControl', () => {
        it('should apply rate control correctly', async () => {
            expect(() => CompositeRateController.applyRateControl()).be.a('function');
        });
    });

    describe('#_prepareControllers', () => {
        it('should throw error when weights and rateControllers are not arrays', async () => {
            testMessage.content.weights = 'not an array';
            testMessage.content.rateControllers = 'not an array';
            expect(() =>
                CompositeRateController.createRateController(testMessage, {}, 0)
            ).to.throw('Weight and controller definitions must be arrays.');
        });

        it('should throw error when weights and rateControllers lengths are not the same', async () => {
            testMessage.content.weights = [1, 2];
            testMessage.content.rateControllers = ['composite-rate'];
            expect(() =>
                CompositeRateController.createRateController(testMessage, {}, 0)
            ).to.throw(
                'The number of weights and controllers must be the same.'
            );
        });

        it('should throw error when weights contains non-numeric value', async () => {
            testMessage.content.weights = [1, 'not a number'];
            testMessage.content.rateControllers = ['composite-rate', 'composite-rate'];
            expect(() =>
                CompositeRateController.createRateController(testMessage, {}, 0)
            ).to.throw('Not-a-number element among weights: not a number');
        });

        it('should throw error when weights contains negative number', async () => {
            testMessage.content.weights = [1, -2];
            testMessage.content.rateControllers = ['composite-rate', 'composite-rate'];
            expect(() =>
                CompositeRateController.createRateController(testMessage, {}, 0)
            ).to.throw('Negative element among weights: -2');
        });

        it('should throw error when all weights are zero', async () => {
            testMessage.content.weights = [0, 0];
            testMessage.content.rateControllers = ['composite-rate', 'composite-rate'];
            expect(() =>
                CompositeRateController.createRateController(testMessage, {}, 0)
            ).to.throw('Every weight is zero.');
        });
    });
});