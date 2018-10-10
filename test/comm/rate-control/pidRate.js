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
const PidRate = rewire('../../../src/comm/rate-control/pidRate');

const chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('pidRate controller implementation', () => {

    let controller;
    let baseOpts;

    beforeEach(() => {
        baseOpts = {
            targetLoad: 10,
            proportional: 1,
            integral: 2,
            derrivative: 3,
            initialTPS: 1000
        };
    });

    describe('#init', () => {

        it('should set all gain values from constructor options', () => {
            controller = new PidRate({}, baseOpts);
            controller.init();
            controller.Kp.should.equal(1);
            controller.Ki.should.equal(2);
            controller.Kd.should.equal(3);
            controller.sleep.should.equal(1);
            controller.showVars.should.equal(false);
        });

        it('should set a default sleep if no starting tps is provided', () => {
            let opts = {};
            controller = new PidRate({}, opts);
            controller.init();
            controller.sleep.should.equal(100);
        });

        it('should set logging if showVars option is provided', () => {
            let opts = {
                showVars: true
            };
            controller = new PidRate({}, opts);
            controller.init();
            controller.showVars.should.equal(true);
        });

        it('should not set logging if no log option is provided', () => {
            let opts = {};
            controller = new PidRate({}, opts);
            controller.init();
            controller.showVars.should.equal(false);
        });

    });

    describe('#applyRateControl', () => {

        describe('logging actions', () => {

            let logStub = sinon.stub();
            PidRate.__set__('Log', logStub);

            beforeEach(() => {
                logStub.resetHistory();
            });

            it('should provide logging if log option is set to be true', () => {
                baseOpts.showVars = true;
                controller = new PidRate({}, baseOpts);
                controller.init();

                controller.applyRateControl(Date.now(), 0, []);
                sinon.assert.callCount(logStub, 5);

            });

            it('should not provide logging if log option is not set', () => {
                controller = new PidRate({}, baseOpts);
                controller.init();

                controller.applyRateControl(Date.now(), 0, []);
                sinon.assert.notCalled(logStub);
            });

            it('should not provide logging if log option is set to be false', () => {
                baseOpts.showVars = false;
                controller = new PidRate({}, baseOpts);
                controller.init();

                controller.applyRateControl(Date.now(), 0, []);
                sinon.assert.notCalled(logStub);
            });
        });

        describe('sleep actions', () => {

            let clock = sinon.useFakeTimers();

            let sleepStub = sinon.stub();
            PidRate.__set__('Sleep', sleepStub);

            afterEach(() => {
                clock.restore();
                sleepStub.resetHistory();
            });

            it('should not modify sleep time if no load error and isolated proportional gain', () => {
                // Remove integral/derivative control action
                baseOpts.integral = 0;
                baseOpts.derrivative = 0;

                controller = new PidRate({}, baseOpts);
                controller.init();

                // Initial sleep time
                let initialSleep = controller.sleep;

                controller.applyRateControl(Date.now(), 10, new Array(10));

                // Sleep time after control application
                let finalSleep = controller.sleep;

                // Change due to control action
                let deltaSleep = initialSleep - finalSleep;

                deltaSleep.should.equal(0);
            });

            it('should reduce sleep time if negative load error and isolated proportional gain', () => {
                // Remove integral/derivative control action
                baseOpts.integral = 0;
                baseOpts.derrivative = 0;

                controller = new PidRate({}, baseOpts);
                controller.init();

                // Initial sleep time
                let initialSleep = controller.sleep;

                controller.applyRateControl(Date.now(), 0, new Array(11));

                // Sleep time after control application
                let finalSleep = controller.sleep;

                // Change due to control action
                let deltaSleep = initialSleep - finalSleep;

                deltaSleep.should.be.below(0);
            });

            it('should increase sleep time if positive load error and isolated proportional gain', () => {
                // Remove integral/derivative control action
                baseOpts.integral = 0;
                baseOpts.derrivative = 0;

                controller = new PidRate({}, baseOpts);
                controller.init();

                // Initial sleep time
                let initialSleep = controller.sleep;

                controller.applyRateControl(Date.now(), 9, []);

                // Sleep time after control application
                let finalSleep = controller.sleep;

                // Change due to control action
                let deltaSleep = initialSleep - finalSleep;

                deltaSleep.should.be.above(0);
            });

            it('should not modify sleep time if no integral error and isolated integral gain', () => {
                // Remove proportional/derivative control action
                baseOpts.proportional = 0;
                baseOpts.derrivative = 0;

                controller = new PidRate({}, baseOpts);
                controller.init();

                // Set integral error accumulation to zero
                controller.integral = 0;

                // Initial sleep time
                let initialSleep = controller.sleep;

                controller.applyRateControl(Date.now(), 10, new Array(10));

                // Sleep time after control application
                let finalSleep = controller.sleep;

                // Change due to control action
                let deltaSleep = initialSleep - finalSleep;

                deltaSleep.should.equal(0);
            });

            it('should reduce sleep time if negative integral error and isolated integral gain', () => {
                // Remove proportional/derivative control action
                baseOpts.proportional = 0;
                baseOpts.derrivative = 0;

                controller = new PidRate({}, baseOpts);
                controller.init();

                // Set integral error accumulation to zero
                controller.integral = 0;

                // Initial sleep time
                let initialSleep = controller.sleep;

                controller.applyRateControl(Date.now(), 11, new Array(11));

                // Sleep time after control application
                let finalSleep = controller.sleep;

                // Change due to control action
                let deltaSleep = initialSleep - finalSleep;

                deltaSleep.should.be.below(0);
            });

            it('should increase sleep time if positive integral error and isolated integral gain', () => {
                // Remove proportional/derivative control action
                baseOpts.proportional = 0;
                baseOpts.derrivative = 0;

                controller = new PidRate({}, baseOpts);
                controller.init();

                // Set integral error accumulation to zero
                controller.integral = 0;

                // Initial sleep time
                let initialSleep = controller.sleep;

                controller.applyRateControl(Date.now(), 9, []);

                // Sleep time after control application
                let finalSleep = controller.sleep;

                // Change due to control action
                let deltaSleep = initialSleep - finalSleep;

                deltaSleep.should.be.above(0);
            });

            it('should not modify sleep time if no derivative error and isolated derivative gain', () => {
                // Remove proportional/integral control action
                baseOpts.proportional = 0;
                baseOpts.integral = 0;

                controller = new PidRate({}, baseOpts);
                controller.init();

                // zero initial error
                controller.previousError = 0;

                // Initial sleep time
                let initialSleep = controller.sleep;

                controller.applyRateControl(Date.now(), 10, new Array(10));

                // Sleep time after control application
                let finalSleep = controller.sleep;

                // Change due to control action
                let deltaSleep = initialSleep - finalSleep;

                deltaSleep.should.equal(0);
            });

            it('should reduce sleep time if negative derivative error and isolated derivative gain', () => {
                // Remove proportional/integral control action
                baseOpts.proportional = 0;
                baseOpts.integral = 0;

                controller = new PidRate({}, baseOpts);
                controller.init();

                // zero initial error
                controller.previousError = 0;

                // Initial sleep time
                let initialSleep = controller.sleep;

                controller.applyRateControl(Date.now(), 11, new Array(11));

                // Sleep time after control application
                let finalSleep = controller.sleep;

                // Change due to control action
                let deltaSleep = initialSleep - finalSleep;

                deltaSleep.should.be.below(0);
            });

            it('should increase sleep time if positive derivative error and isolated derivative gain', () => {
                // Remove proportional/integral control action
                baseOpts.proportional = 0;
                baseOpts.integral = 0;

                controller = new PidRate({}, baseOpts);
                controller.init();

                // zero initial error
                controller.previousError = 0;

                // Initial sleep time
                let initialSleep = controller.sleep;

                controller.applyRateControl(Date.now(), 9, []);

                // Sleep time after control application
                let finalSleep = controller.sleep;

                // Change due to control action
                let deltaSleep = initialSleep - finalSleep;

                deltaSleep.should.be.above(0);
            });

            it('should sleep if above the 5ms threshold', () => {
                baseOpts.proportional = 0;
                baseOpts.integral = 0;
                baseOpts.derrivative = 0;

                controller = new PidRate({}, baseOpts);
                controller.init();
                controller.sleep = 10;

                controller.applyRateControl(Date.now(), 0, []);
                clock.tick(99996);
                sinon.assert.called(sleepStub);
            });

            it('should not sleep if below the 5ms threshold', () => {
                baseOpts.proportional = 0;
                baseOpts.integral = 0;
                baseOpts.derrivative = 0;

                controller = new PidRate({}, baseOpts);
                controller.init();
                controller.sleep = 0;

                controller.applyRateControl(Date.now(), 0, []);
                clock.tick(99996);
                sinon.assert.notCalled(sleepStub);
            });
        });

    });
});