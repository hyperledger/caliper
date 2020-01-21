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
const FixedBacklog = rewire('../../../lib/worker/rate-control/fixedBacklog');

const chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('fixedBacklog controller implementation', () => {

    let controller;

    describe('#init', () => {

        let msg = {totalClients: 1};
        let opts = {
            unfinished_per_client: 30,
            startingTps: 10
        };

        it('should set the sleep time for a single client if no clients are specified and the startingTps is specified', () => {
            let msg = {};
            controller = new FixedBacklog.createRateController(opts);
            controller.init(msg);
            controller.sleepTime.should.equal(100);
        });

        it('should set the sleep time for a single client if no clients are specified and the startingTps is not specified', () => {
            let msg = {};
            let opts = {
                unfinished_per_client: 30
            };
            controller = new FixedBacklog.createRateController(opts);
            controller.init(msg);
            controller.sleepTime.should.equal(1000);
        });

        it('should set the sleep time for a multiple clients it the startingTps is specified', () => {
            controller = new FixedBacklog.createRateController(opts);
            controller.init(msg);
            controller.sleepTime.should.equal(100);
        });

        it('should set the sleep time for a multiple clients it the startingTps is not specified', () => {
            let opts = {
                unfinished_per_client: 30
            };
            controller = new FixedBacklog.createRateController(opts);
            controller.init(msg);
            controller.sleepTime.should.equal(1000);
        });

        it('should set a default transaction backlog for multiple clients if not specified', () => {
            controller = new FixedBacklog.createRateController({});
            controller.init(msg);
            controller.unfinished_per_client.should.equal(10);
        });

        it('should set the transaction backlog for multiple clients if specified', () => {
            controller = new FixedBacklog.createRateController(opts);
            controller.init(msg);
            controller.unfinished_per_client.should.equal(30);
        });

    });

    describe('#applyRateControl', async () => {

        let sleepStub;
        let opts = {
            unfinished_per_client: 30,
            startingTps: 10
        };

        beforeEach(() => {
            sleepStub = sinon.stub();
            FixedBacklog.__set__('Sleep', sleepStub);

            controller = new FixedBacklog.createRateController(opts);
            controller.sleepTime = 1000;
            controller.unfinished_per_client = 30;
        });

        it('should sleep if resultStats.length < 2', () => {
            controller.applyRateControl(null, 1, [], []);
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, 1000);
        });

        it ('should sleep if no successful results are available', () => {
            controller.applyRateControl(null, 1, [], [{}]);
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, 1000);
        });

        it ('should sleep if no delay results are available', () => {
            controller.applyRateControl(null, 1, [], [{}]);
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, 1000);
        });

        it ('should not sleep if backlog transaction is below target', () => {
            let idx = 50;
            let currentResults = [];
            let item = {
                succ: 5,
                length: 30,
                delay: {
                    sum: 5
                }
            };
            const resultStats = [];
            resultStats.push(item);
            resultStats.push(item);

            controller.applyRateControl(null, idx, currentResults, resultStats);
            sinon.assert.notCalled(sleepStub);
        });

        it ('should sleep if backlog transaction is at or above target', () => {
            let idx = 50;
            let currentResults = [];
            let item = {
                succ: 5,
                length: 5,
                delay: {
                    sum: 5
                }
            };
            const resultStats = [];
            resultStats.push(item);
            resultStats.push(item);

            controller.applyRateControl(null, idx, currentResults, resultStats);

            sinon.assert.calledOnce(sleepStub);
        });

        it ('should sleep for a count of the load error and the current average delay', () => {
            let idx = 50;
            let currentResults = [];
            let item = {
                succ: 5,
                length: 5,
                delay: {
                    sum: 5
                }
            };
            const resultStats = [];
            resultStats.push(item);
            resultStats.push(item);

            controller.applyRateControl(null, idx, currentResults, resultStats);

            const completeTransactions = resultStats[0].length - currentResults.length;
            const unfinshed = idx - completeTransactions;

            const error = unfinshed - 30;
            const avDelay = ((resultStats[0].delay.sum)/completeTransactions)*1000;

            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, error*avDelay);
        });

        it('should log the backlog error as a debug message', () => {

            const FakeLogger = {
                debug : () => {},
                error: () => {}
            };

            let debugStub = sinon.stub(FakeLogger, 'debug');
            FixedBacklog.__set__('Logger', FakeLogger);

            let idx = 50;
            let currentResults = [];
            let item = {
                succ: 5,
                length: 5,
                delay: {
                    sum: 5
                }
            };
            const resultStats = [];
            resultStats.push(item);
            resultStats.push(item);

            controller.applyRateControl(null, idx, currentResults, resultStats);

            const completeTransactions = resultStats[0].length - currentResults.length;
            const unfinshed = idx - completeTransactions;

            const error = unfinshed - 30;
            const message = 'Difference between current and desired transaction backlog: ' + error;

            sinon.assert.calledOnce(debugStub);
            sinon.assert.calledWith(debugStub, message);

        });

    });

});
