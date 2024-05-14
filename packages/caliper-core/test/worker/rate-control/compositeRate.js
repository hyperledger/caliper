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
const CompositeRate = rewire('../../../lib/worker/rate-control/compositeRate');
const TestMessage = require('../../../lib/common/messages/testMessage');
const chai = require('chai');
chai.should();
const sinon = require('sinon');
const TransactionStatisticsCollector = require('../../../lib/common/core/transaction-statistics-collector');

describe('CompositeRateController', () => {
    describe('Applying Composite Rate Control', () => {
        it('should switch controller and apply rate control', async () => {
            const msgContent = {
                label: 'test',
                rateControl: {
                    type: "composite-rate",
                    opts: {
                        weights: [2, 1, 2],
                        rateControllers: [{
                            type: "zero-rate",
                            opts: {}
                        },
                        {
                            type: "fixed-rate",
                            opts: { "tps": 300 }
                        },
                        {
                            type: "fixed-rate",
                            opts: { "tps": 200 }
                        }],
                        logChange: true
                    }
                },
                testRound: 0,
                txDuration: 250,
                totalWorkers: 2
            };

            const testMessage = new TestMessage('test', [], msgContent);
            const stats = sinon.createStubInstance(TransactionStatisticsCollector);
            const controller = new CompositeRate.createRateController(testMessage, stats, 0);
            controller.controllerSwitch = sinon.stub().resolves();
            const rateControlStub = {
                applyRateControl: sinon.stub().resolves()
            };
            const controllerDataStub = {
                controller: rateControlStub
            };
            controller.controllers = [controllerDataStub];
            await controller.applyRateControl();

            sinon.assert.calledOnce(controller.controllerSwitch);
            sinon.assert.calledOnce(rateControlStub.applyRateControl);
        });
    });
});