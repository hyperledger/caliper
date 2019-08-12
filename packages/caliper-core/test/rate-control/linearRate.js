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
const LinearRate = rewire('../../lib/rate-control/linearRate');

const chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('linearRate controller implementation', () => {

    let controller;
    let opts = {
        startingTps: 20,
        finishingTps: 80
    };

    describe('#init', () => {

        let clock;

        beforeEach(() => {
            clock = sinon.useFakeTimers();
            controller = new LinearRate.createRateController(opts);
        });

        afterEach(() => {
            clock.restore();
        })

        it('should set the starting sleep time based on starting tps and total number of clients', () => {
            let msg = {totalClients: 5};
            controller.init(msg);

            controller.startingSleepTime.should.equal(250);
        });

        it('should set the gradient based on linear inerpolation between two points with time and sleep time axis', () => {
            let msg = {
                totalClients: 5,
                txDuration: 5,
            };
            controller.init(msg);

            controller.gradient.should.equal(-0.0375);
        });

        it('should set the gradient based on linear interpolation between two points with index and sleep time axis', () => {
            let msg = {
                totalClients: 5,
                numb: 5
            };
            controller.init(msg);

            controller.gradient.should.equal(-37.5);
        });

        it('should determine the interpolated value based on the number of transactions generated during the round', () => {
            let msg = {
                totalClients: 6,
                numb: 5
            };
            controller.init(msg);
            const start = null;
            const idx = 5;

            controller._interpolateFromIndex(start, idx).should.equal(75);
        });

        it('should determine the interpolated value based on duration of the round', () => {
            let msg = {
                totalClients: 6,
                txDuration: 5
            };
            controller.init(msg);
            const start = 5;
            const idx = null;

            controller._interpolateFromTime(start, idx).should.equal(300.225);
        });

    });

    describe('#applyRateController', () => {

        let sleepStub;

        beforeEach(() => {
            sleepStub = sinon.stub();
            LinearRate.__set__('util.sleep', sleepStub);

            controller = new LinearRate.createRateController(opts);
        });

        it('should sleep for a duration of current sleep time, interpolated from index, if greater than 5ms', () => {
            const currentSleepTime = 6;
            let interpolateStub = sinon.stub().returns(currentSleepTime);
            controller._interpolateFromIndex = interpolateStub;

            let msg = {
                totalClients: 6,
                numb: 5
            };
            controller.init(msg);
            const start = null;
            const idx = 5;

            controller.applyRateControl(start, idx, null, null);
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, currentSleepTime);
        });
        
        it('should sleep for a duration of current sleep time, interpolated from time, if greater than 5ms', () => {
            const currentSleepTime = 6;
            let interpolateStub = sinon.stub().returns(currentSleepTime);
            controller._interpolateFromTime = interpolateStub;

            let msg = {
                totalClients: 5,
                txDuration: 5
            };
            controller.init(msg);
            const start = 5;
            const idx = null;

            controller.applyRateControl(start, idx, null, null);
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, currentSleepTime);
        });

        it('should do nothing where current sleep time, interpolated from index, is less than or equal to 5ms', () => {
            let currentSleepTime = 4;
            let interpolateStub = sinon.stub().returns(currentSleepTime);
            controller._interpolateFromIndex = interpolateStub;

            let msg = {
                totalClients: 5,
                numb: 5
            };
            controller.init(msg);
            const start = null;
            const idx = 5;

            controller.applyRateControl(start, idx, null, null);
            sinon.assert.notCalled(sleepStub);
        });

        it('should do nothing where current sleep time, interpolated from time, is less than or equal to 5ms', () => {
            let currentSleepTime = 4;
            let interpolateStub = sinon.stub().returns(currentSleepTime);
            controller._interpolateFromTime = interpolateStub;

            let msg = {
                totalClients: 6,
                txDuration: 5
            };
            controller.init(msg);
            const start = 5;
            const idx = null;

            controller.applyRateControl(start, idx, null, null);
            sinon.assert.notCalled(sleepStub);
        });

    });

});
