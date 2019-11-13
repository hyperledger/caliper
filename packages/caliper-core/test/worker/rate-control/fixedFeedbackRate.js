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

const chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('fixedFeedbackRate controller implementation', () => {

    describe('#init', () => {
        let controller;
        let opts = {
            tps: 100,
            unfinished_per_client: 100
        };

        beforeEach(() => {
            controller = new FixedFeedbackRate.createRateController(opts);
        });

        it('should set the sleepTime for a single client if no clients are specified', () => {
            let msg = {};
            controller.init(msg);

            // if the tps per client is is 100, then the sleep time is (1000/100) = 10
            controller.sleepTime.should.equal(10);
        });

        it('should set the sleepTime for a single client to 0 if no clients are specified and tps is 0', () => {
            let msg = {};
            let opts = {
                tps: 0,
                unfinished_per_client: 100
            };
            controller = new FixedFeedbackRate.createRateController(opts);

            controller.init(msg);
            controller.sleepTime.should.equal(0);
        });

        it('should set the sleepTime for multiple clients', () => {
            let msg = {totalClients: 4};
            controller.init(msg);

            // if the number of clients is 4, then the tps per client is (100/4) = 25 and the sleeptime is (1000/25) = 40
            controller.sleepTime.should.equal(40);
        });

        it('should set the sleepTime to zero if 0 tps is specified', () => {
            controller = new FixedFeedbackRate.createRateController({tps: 0});
            let msg = {totalClients: 1};
            controller.init(msg);
            controller.sleepTime.should.equal(0);
        });

        it ('should set the sleep_time if specified', () => {
            controller = new FixedFeedbackRate.createRateController({sleep_time: 50});
            let msg = {totalClients: 1};
            controller.init(msg);
            controller.sleep_time.should.equal(50);
        });

        it ('should set a default sleep_time if not specified', () => {
            let msg = {totalClients: 1};
            controller.init(msg);
            controller.sleep_time.should.equal(100);
        });

        it ('should set the transaction backlog for multiple clients if specified', () => {
            let msg = {totalClients: 1};
            controller.init(msg);
            controller.unfinished_per_client.should.equal(100);
        });

        it ('should set a default transaction backlog for multiple clients if not specified', () => {
            controller = new FixedFeedbackRate.createRateController({});
            let msg = {totalClients: 1};
            controller.init(msg);
            controller.unfinished_per_client.should.equal(7000);
        });

        it ('should set zero_succ_count to 0', () => {
            let msg = {totalClients: 1};
            controller.init(msg);
            controller.zero_succ_count.should.equal(0);
        });

        it ('should set the total sleep time to 0', () => {
            let msg = {totalClients: 1};
            controller.init(msg);
            controller.total_sleep_time.should.equal(0);
        });

    });

    describe('#applyRateController', () => {
        let controller, sleepStub, clock;

        let opts = {
            tps: 100,
            unfinished_per_client: 100
        }

        beforeEach(() => {
            clock = sinon.useFakeTimers();
            sleepStub = sinon.stub();
            FixedFeedbackRate.__set__('util.sleep', sleepStub);

            controller = new FixedFeedbackRate.createRateController(opts);
            controller.unfinished_per_client = 100;
            controller.sleepTime = 50;
            controller.sleep_time = 100;
            controller.zero_succ_count = 0;
        });

        it ('should not sleep if the sleepTime is 0', () => {
            let start = 0;
            let idx = 100;
            let resultStats = [
                {
                    succ: 15,
                    fail: 5
                }
            ];
            controller.sleepTime = 0;
            controller.applyRateControl(start, idx, [], resultStats);

            // should have not called the sleep method
            sinon.assert.notCalled(sleepStub);
        });

        it ('should not sleep if id < unfinished_per_client', () => {
            let start = 0;
            let idx = 50;
            let resultStats = [
                {
                    succ: 15,
                    fail: 5
                }
            ];
            controller.applyRateControl(start, idx, [], resultStats);

            // should have not called the sleep method
            sinon.assert.notCalled(sleepStub);
        });

        it ('should sleep if the elapsed time difference is greater than 5ms', () => {
            let start = 0;
            let idx = 100;
            controller.sleepTime = 10;
            controller.total_sleep_time = 50;
            clock.tick(100);

            let diff = (10 * idx - ((Date.now() - 50) - start));

            controller.applyRateControl(start, idx, null, []);

            // should have called the sleep method with a value equal to diff
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, diff);
        });

        it ('should not sleep if there are no aggregated stats from the previous round', () => {
            let start = 0;
            let idx = 100;
            let resultStats = [];
            controller.applyRateControl(start, idx, [], resultStats);

            // should have not called the sleep method
            sinon.assert.notCalled(sleepStub);
        });

        it ('should not sleep if backlog transaction is below half the target', () => {
            let start = 50;
            let idx = 100;
            let resultStats = [
                {
                    succ: 50,
                    fail: 4
                }
            ];
            controller.applyRateControl(start, idx, [], resultStats);

            // should have not called the sleep method
            sinon.assert.notCalled(sleepStub);
        });

        it ('should determine the sleeptime for waiting until successful transactions occur', () => {
            let start = 0;
            let idx = 2;
            let resultStats = [
                {
                    succ: 1, fail: 0
                },
                {
                    succ: 0, fail: 1
                }
            ];
            controller.unfinished_per_client = 2;
            controller.sleepTime = 1;
            controller.total_sleep_time = 2;

            controller.applyRateControl(start, idx, [], resultStats);

            // should have called the sleep method with a value equal to sleep_time
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, controller.sleep_time);
        });

        it ('should determines the sleep time according to the current number of unfinished transactions with the configure one', () => {
            let start = 0;
            let idx = 2;
            let resultStats = [
                {
                    succ: 0, fail: 0
                },
                {
                    succ: 2, fail: 0
                }
            ];

            controller.unfinished_per_client = 2;
            controller.sleepTime = 1;
            controller.total_sleep_time = 2;

            controller.applyRateControl(start, idx, [], resultStats);

            // should have called the sleep method with a value equal to sleep_time
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, controller.sleep_time);
        });
    });
});
