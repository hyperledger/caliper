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
const MaxRate = rewire('../../../lib/worker/rate-control/maxRate');

const chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('maxRate controller implementation', () => {

    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach( () => {
        sandbox.restore();
    });

    describe('#init', () => {
        it('should set a default starting TPS for single or multiple workers', () => {

            let opts = {};
            let msg = {};
            let controller = new MaxRate.createRateController(opts);
            controller.init(msg);
            controller.tpsSettings.current.should.equal(5);

            msg.totalClients = 2;
            controller.init(msg);
            controller.tpsSettings.current.should.equal(2.5);
        });

        it('should set a starting TPS for single or multiple workers', () => {
            let opts = {
                tps: 10
            };
            let msg = {};
            let controller = new MaxRate.createRateController(opts);
            controller.init(msg);
            controller.tpsSettings.current.should.equal(10);

            msg.totalClients = 2;
            controller.init(msg);
            controller.tpsSettings.current.should.equal(5);
        });

        it('should set a default step size for single or multiple workers', () => {
            let opts = {};
            let msg = {};
            let controller = new MaxRate.createRateController(opts);
            controller.init(msg);
            controller.step.should.equal(5);

            msg.totalClients = 2;
            controller.init(msg);
            controller.step.should.equal(2.5);
        });

        it('should set a specified step size for single or multiple workers', () => {
            let opts = {
                step: 10
            };
            let msg = {};
            let controller = new MaxRate.createRateController(opts);
            controller.init(msg);
            controller.step.should.equal(10);

            msg.totalClients = 2;
            controller.init(msg);
            controller.step.should.equal(5);
        });

        it('should set a default sample interval for single or multiple workers', () => {
            let opts = {};
            let msg = {};
            let controller = new MaxRate.createRateController(opts);
            controller.init(msg);
            controller.sampleInterval.should.equal(10);

            msg.totalClients = 2;
            controller.init(msg);
            controller.sampleInterval.should.equal(10);
        });

        it('should set a sample interval if specified for single or multiple workers', () => {
            let opts = {
                sampleInterval: 20
            };
            let msg = {};
            let controller = new MaxRate.createRateController(opts);
            controller.init(msg);
            controller.sampleInterval.should.equal(20);

            msg.totalClients = 2;
            controller.init(msg);
            controller.sampleInterval.should.equal(20);
        });

    });

    describe('#applyRateControl', async () => {

        let sleepStub;
        let controller;
        let opts = {};

        beforeEach(() => {
            controller = new MaxRate.createRateController(opts);
            sleepStub = sandbox.stub(controller, 'applySleepInterval');
        });

        it('should sleep if resultStats.length < 2',async  () => {
            let updateSpy = sandbox.spy(controller, 'updateOccurred');
            await controller.applyRateControl(null, 1, [], [{}]);

            sinon.assert.notCalled(updateSpy);
            sinon.assert.calledOnce(sleepStub);
        });

        it('should sleep if no successful results are available', async () => {
            let updateSpy = sandbox.spy(controller, 'updateOccurred');
            await controller.applyRateControl(null, 1, [], [{}, {}]);

            sinon.assert.notCalled(updateSpy);
            sinon.assert.calledOnce(sleepStub);
        });

        it('should sleep if no successful results are available', async () => {
            let updateSpy = sandbox.spy(controller, 'updateOccurred');
            await controller.applyRateControl(null, 1, [], [{ucc: 12}, {}]);

            sinon.assert.notCalled(updateSpy);
            sinon.assert.calledOnce(sleepStub);
        });

        it('should initialize internal stats and tps maps on first pass', async () => {
            let idx = 50;
            let currentResults = [];
            let item = {
                succ: 5,
                create: {
                    min: 100
                },
                final: {
                    last: 200
                }
            };
            const resultStats = [];
            resultStats.push(item);
            resultStats.push(item);

            let exceededSampleIntervalSpy = sandbox.spy(controller, 'exceededSampleInterval');
            sandbox.stub(controller, 'updateOccurred').returns(false);
            sandbox.stub(controller, 'retrieveIntervalTPS').returns(123);

            controller.init({});
            await controller.applyRateControl(null, idx, currentResults, resultStats);

            // should have internal values
            controller.statistics.previous.should.deep.equal(item);
            controller.statistics.current.should.deep.equal(item);
            controller.statistics.sampleStart.should.equal(100);

            controller.observedTPS.current.should.equal(123);

            // Should not have processed update
            sinon.assert.notCalled(exceededSampleIntervalSpy);
        });

        it('should ramp the driven TPS if current TPS > previous TPS', async () => {
            let idx = 50;
            let currentResults = [];
            let item = {
                succ: 5,
                create: {
                    min: 100
                },
                final: {
                    last: 200
                }
            };
            const resultStats = [];
            resultStats.push(item);
            resultStats.push(item);

            sandbox.stub(controller, 'updateOccurred').returns(true);
            sandbox.stub(controller, 'exceededSampleInterval').returns(true);
            sandbox.stub(controller, 'retrieveIntervalTPS').returns(10);

            controller.init({});
            controller.statistics.current = {};
            controller.observedTPS.current = 5;

            await controller.applyRateControl(null, idx, currentResults, resultStats);

            controller.tpsSettings.current.should.equal(10);
        });

        it('should drop the driven TPS and halve the step size if current TPS < previous TPS', async () => {
            let idx = 50;
            let currentResults = [];
            let item = {
                succ: 5,
                create: {
                    min: 100
                },
                final: {
                    last: 200
                }
            };
            const resultStats = [];
            resultStats.push(item);
            resultStats.push(item);

            sandbox.stub(controller, 'updateOccurred').returns(true);
            sandbox.stub(controller, 'exceededSampleInterval').returns(true);
            sandbox.stub(controller, 'retrieveIntervalTPS').returns(10);

            controller.init({});
            controller.statistics.current = {};
            controller.observedTPS.current = 11;
            controller.step = 5;
            controller.tpsSettings.current = 20;
            await controller.applyRateControl(null, idx, currentResults, resultStats);

            controller.tpsSettings.current.should.equal(15);
            controller.step.should.equal(2.5);
        });

        it('should drop the driven TPS only if current TPS < previous TPS and the step is below a threshold', async () => {
            let idx = 50;
            let currentResults = [];
            let item = {
                succ: 5,
                create: {
                    min: 100
                },
                final: {
                    last: 200
                }
            };
            const resultStats = [];
            resultStats.push(item);
            resultStats.push(item);

            sandbox.stub(controller, 'updateOccurred').returns(true);
            sandbox.stub(controller, 'exceededSampleInterval').returns(true);
            sandbox.stub(controller, 'retrieveIntervalTPS').returns(10);

            controller.init({});
            controller.statistics.current = {};
            controller.observedTPS.current = 11;
            controller.step = 0.1;
            controller.tpsSettings.current= 20;
            await controller.applyRateControl(null, idx, currentResults, resultStats);

            controller.tpsSettings.current.should.equal(19.9);
            controller.step.should.equal(0.1);
        });

    });

    describe('#updateOccurred', () => {

        let item = {
            succ: 5,
            create: {
                min: 100
            },
            final: {
                last: 200
            }
        };
        const resultStats = [];
        resultStats.push(item);
        resultStats.push(item);

        it('should return true if the stored stats "create.min" differs from the passed', () => {

            let opts = {};
            let msg = {};
            let controller = new MaxRate.createRateController(opts);
            controller.init(msg);
            controller.statistics.current = {
                create: {
                    min: 123
                }
            };

            controller.updateOccurred(resultStats).should.equal(true);
        });

        it('should return false if the stored stats "create.min" is the same as the passed', () => {

            let opts = {};
            let msg = {};
            let controller = new MaxRate.createRateController(opts);
            controller.init(msg);
            controller.statistics.current = {
                create: {
                    min: 100
                }
            };
            controller.updateOccurred(resultStats).should.equal(false);
        });

    });

    describe('#exceededSampleInterval', () => {

        let item = {
            succ: 5,
            create: {
                min: 100
            },
            final: {
                last: 2000
            }
        };
        const resultStats = [];
        resultStats.push(item);
        resultStats.push(item);

        it('should return true if the sample time is less than the elapsed time', () => {

            let opts = {};
            let msg = {};
            let controller = new MaxRate.createRateController(opts);
            controller.init(msg);
            controller.statistics.sampleStart = 0;

            controller.exceededSampleInterval(resultStats).should.equal(true);
        });

        it('should return false if the sample time is greater than the elapsed time', () => {

            let opts = {};
            let msg = {};
            let controller = new MaxRate.createRateController(opts);
            controller.init(msg);
            controller.statistics.sampleStart = 1999;
            controller.exceededSampleInterval(resultStats).should.equal(false);
        });

    });

    describe('#retrieveIntervalTPS', () => {

        let item = {
            succ: 50,
            fail: 50,
            create: {
                min: 10
            },
            final: {
                last: 20
            }
        };
        const resultStats = [];
        resultStats.push(item);
        resultStats.push(item);

        it('should return the TPS from the interval including failed transactions', () => {

            let opts = {
                includeFailed: true
            };
            let msg = {};
            let controller = new MaxRate.createRateController(opts);
            controller.init(msg);
            controller.statistics.sampleStart = 0;

            controller.retrieveIntervalTPS(resultStats).should.equal(10);
        });

        it('should return the TPS from the interval excluding failed transactions', () => {

            let opts = {
                includeFailed: false
            };
            let msg = {};
            let controller = new MaxRate.createRateController(opts);
            controller.init(msg);
            controller.statistics.sampleStart = 0;

            controller.retrieveIntervalTPS(resultStats).should.equal(10);
        });

    });

    describe('#applySleepInterval', () => {

        it('should apply the global TPS setting as a sleep interval', () => {

            let opts = {};
            let msg = {};
            let sleepStub = sinon.stub();
            MaxRate.__set__('Sleep', sleepStub);
            let controller = new MaxRate.createRateController(opts);
            controller.init(msg);
            controller.statistics.sampleStart = 0;

            controller.applySleepInterval();
            // 200 = 1000/default
            sinon.assert.calledOnceWithExactly(sleepStub, 200);
        });

    });

});
