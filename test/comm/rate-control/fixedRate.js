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
const FixedRate = rewire('../../../src/comm/rate-control/fixedRate');

const chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('fixedRate controller implementation', () => {

    let controller;
    let opts = {tps: 40};

    describe('#init', () => {

        beforeEach(() => {
            controller = new FixedRate({}, opts);
        });

        it('should set the sleep time for a single client if no clients are specified', () => {
            let msg = {};
            controller.init(msg);
            controller.sleepTime.should.equal(25);
        });

        it('should set the sleep time for a single client', () => {
            let msg = {totalClients: 1};
            controller.init(msg);
            controller.sleepTime.should.equal(25);
        });

        it('should set the sleep time for multiple clients', () => {
            let msg = {totalClients: 4};
            controller.init(msg);
            controller.sleepTime.should.equal(100);
        });

        it('should set the sleep time to zero if 0 tps specified', () => {
            controller = new FixedRate({}, {tps: 0});
            let msg = {totalClients: 1};
            controller.init(msg);
            controller.sleepTime.should.equal(0);
        });
    });

    describe('#applyRateControl', () => {

        let sleepStub;
        let clock;

        beforeEach(() => {
            clock = sinon.useFakeTimers();

            sleepStub = sinon.stub();
            FixedRate.__set__('Sleep', sleepStub);

            controller = new FixedRate({}, opts);
            controller.sleepTime = 10000;
        });

        afterEach(() => {
            clock.restore();
        });

        it('should sleep for the full ammount of time if there is zero elapsed time', () => {
            controller.applyRateControl(Date.now(), 1, []);
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, 10000);
        });

        it('should reduce the sleep time based on the elapsed time difference', () => {
            let startTime = Date.now();
            clock.tick(5000);
            controller.applyRateControl(startTime, 1, []);
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, 5000);
        });

        it('should not sleep if the elapsed time difference is below the 5ms threshold', () => {
            let startTime = Date.now();
            clock.tick(99996);
            controller.applyRateControl(startTime, 1, []);
            sinon.assert.notCalled(sleepStub);
        });

        it('should not sleep if the sleepTime is zero', () => {
            controller.sleepTime = 0;
            controller.applyRateControl(Date.now(), 1, []);
            sinon.assert.notCalled(sleepStub);
        });

    });

});