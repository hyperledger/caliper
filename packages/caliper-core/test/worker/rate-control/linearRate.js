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
const LinearRate = rewire('../../../lib/worker/rate-control/linearRate');

const chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('linearRate controller implementation', () => {

    let controller;
    let opts = {
        startingTps: 20,
        finishingTps: 80
    };

    describe('#_interpolateFromIndex', () => {
        it('should return value interpolated from index', () => {
            controller = new LinearRate.createRateController();
            controller.startingSleepTime = 3;
            controller.gradient = 2;
            const idx = 5;

            // If the starting sleeptime is 3ms, the gradient is 2 and the index is 5, the returned interpolated value should be ((3 + (5*2)) = 13
            const value = controller._interpolateFromIndex(null, idx);
            value.should.equal(13);
        });
    });

    describe('#_interpolateFromTime', () => {
        let clock;

        it('should return value interpolated from time', () => {
            clock = sinon.useFakeTimers();
            controller = new LinearRate.createRateController(opts);
            controller.startingSleepTime = 3;
            controller.gradient = 2;

            const start = 5;
            clock.tick(5);

            // If the starting sleeptime is 3ms, the gradient is 2 and start is 5ms, the returned interpolated value should be ((3 + (5-5)*2)) = 3
            const value = controller._interpolateFromTime(start, null);
            value.should.equal(3);

            clock.restore();
        });
    });

    describe('#init', () => {
        let clock;

        beforeEach(() => {
            clock = sinon.useFakeTimers();
            controller = new LinearRate.createRateController(opts);
        });

        afterEach(() => {
            clock.restore();
        });

        
        it('should set the starting sleep time based on starting tps and total number of clients', () => {
            let msg = {totalClients: 6};
            controller.init(msg);

            // If there are 6 clients with an initial 20 TPS goal, the starting sleep time should be (1000/(20/6)) = 300ms
            controller.startingSleepTime.should.equal(300);
        });

        it('should set the gradient based on linear interpolation between two points with index and sleep time axis', () => {
            let msg = {
                totalClients: 6,
                numb: 5
            };
            controller.init(msg);

            // if there are 6 clients with a starting sleep time of (1000/(20/6) = 300, a finishing sleep time of (1000/(80/6)) = 75, and a duration of 5,
            // the gradient should be ((75 - 300) / 5) = -45
            controller.gradient.should.equal(-45);
        });

        it('should set the gradient based on linear interpolation between two points with time and sleep time axis', () => {
            let msg = {
                totalClients: 6,
                txDuration: 5,
            };
            controller.init(msg);

            // If there are 6 clients with a starting sleep time of (1000/(20/6) = 300, a finishing sleep time of (1000/(80/6)) = 75, and a duration of (5*1000) = 5000, 
            // the gradient should be ((75 - 300) / 5000) = -0.045
            controller.gradient.should.equal(-0.045);
        });

        it('should determine the interpolated value when the number of transactions generated in the round is specified', () => {
            let msg = {
                totalClients: 6,
                numb: 5
            };
            const idx = 5;
            controller.init(msg);

            // if there are 5 transactions to be generated in the round with an index of 5, a starting sleep time of (1000/(20/6)) = 300ms and a gradient of (((1000/(80/6)) - 300) / 5) = -45
            // then the value interpolated (300 + 5*-45) = 75
            controller._interpolateFromIndex(null, idx).should.equal(75); 
        });

        it('should determine the interpolated value when the number of transactions generated in the round is not specified', () => {
            let msg = {
                totalClients: 6,
                txDuration: 5
            };
            const start = 5;
            clock.tick(5);
            controller.init(msg);

            // if the number of transaction generated in the round is 5, the start is 5, the starting sleep time is (1000/(20/6)) = 300ms and the gradient is (((1000/(80/6)) - 300) / 5) = -0.045,
            // then the value interpolated (300 + (5-5)*-0.045) = 300
            controller._interpolateFromTime(start, null).should.equal(300);
        });

    });

    describe('#applyRateController', () => {

        let sleepStub;

        beforeEach(() => {
            sleepStub = sinon.stub();
            LinearRate.__set__('util.sleep', sleepStub);

            controller = new LinearRate.createRateController(opts);
        });
  
        it('should sleep for a duration of current sleep time if greater than 5ms', () => {
            const currentSleepTime = 6;
            let interpolateStub = sinon.stub().returns(currentSleepTime);
            controller._interpolateFromIndex = interpolateStub;

            let msg = {
                totalClients: 6,
                numb: 5
            };
            controller.init(msg);
            const idx = 5;

            controller.applyRateControl(null, idx, null, null);

            // should have called the sleep method with current sleep time of 6ms
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, currentSleepTime);
        });

        it('should do nothing where current sleep time is less than or equal to 5ms', () => {
            let currentSleepTime = 4;
            let interpolateStub = sinon.stub().returns(currentSleepTime);
            controller._interpolateFromTime = interpolateStub;

            let msg = {
                totalClients: 6,
                txDuration: 5
            };
            controller.init(msg);
            const start = 5;

            controller.applyRateControl(start, null, null, null);

            // should not have called the sleep method
            sinon.assert.notCalled(sleepStub);
        });
    });
});
