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

const fs = require('fs');
const path = require('path');
const ReplayRate = require('../../../lib/worker/rate-control/replayRate');
const TestMessage = require('../../../lib/common/messages/testMessage');
const TransactionStatisticsCollector = require('../../../lib/common/core/transaction-statistics-collector');

const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
chai.use(sinonChai);
const should = chai.should();

describe('ReplayRateController', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should throw an error when pathTemplate is not provided', () => {
        const msgContent = {
            label: 'test',
            rateControl: {
                type: 'replay-rate',
                opts: {}
            },
            workload: { module: 'module.js' },
            testRound: 0,
            txDuration: 250,
            totalWorkers: 2
        };
        const testMessage = new TestMessage('test', [], msgContent);
        const stubStatsCollector = sinon.createStubInstance(TransactionStatisticsCollector);

        should.throw(() => {
            ReplayRate.createRateController(testMessage, stubStatsCollector, 0);
        }, 'The path to load the recording from is undefined');
    });

    it('should throw an error when the trace file does not exist', () => {
        const msgContent = {
            label: 'test',
            rateControl: {
                type: 'replay-rate',
                opts: {
                    pathTemplate: './non-existent-file.txt'
                }
            },
            workload: { module: 'module.js' },
            testRound: 0,
            txDuration: 250,
            totalWorkers: 2
        };
        const testMessage = new TestMessage('test', [], msgContent);
        const stubStatsCollector = sinon.createStubInstance(TransactionStatisticsCollector);

        should.throw(() => {
            ReplayRate.createRateController(testMessage, stubStatsCollector, 0);
        }, `Trace file does not exist: ${path.resolve('./non-existent-file.txt')}`);
    });

    it('should correctly import transaction timings from text format', () => {
        const tempFilePath = path.join(__dirname, 'temp-replay-trace.txt');
        const transactionTimings = [100, 200, 300, 400];
        fs.writeFileSync(tempFilePath, transactionTimings.join('\n'), 'utf-8');

        const msgContent = {
            label: 'test',
            rateControl: {
                type: 'replay-rate',
                opts: {
                    pathTemplate: tempFilePath,
                    inputFormat: 'TEXT'
                }
            },
            workload: { module: 'module.js' },
            testRound: 0,
            txDuration: 250,
            totalWorkers: 2
        };
        const testMessage = new TestMessage('test', [], msgContent);
        const stubStatsCollector = sinon.createStubInstance(TransactionStatisticsCollector);
        const replayRateController = ReplayRate.createRateController(testMessage, stubStatsCollector, 0);

        replayRateController.records.should.deep.equal(transactionTimings);
    });

    it('should correctly apply rate control and log warning when running out of transaction timings', async () => {
        const tempFilePath = path.join(__dirname, 'temp-replay-trace.txt');
        const transactionTimings = [100, 200, 300, 400];
        fs.writeFileSync(tempFilePath, transactionTimings.join('\n'), 'utf-8');

        const msgContent = {
            label: 'test',
            rateControl: {
                type: 'replay-rate',
                opts: {
                    pathTemplate: tempFilePath,
                    inputFormat: 'TEXT',
                    defaultSleepTime: 50,
                    logWarnings: true
                }
            },
            workload: { module: 'module.js' },
            testRound: 0,
            txDuration: 250,
            totalWorkers: 2
        };
        const testMessage = new TestMessage('test', [], msgContent);
        const stubStatsCollector = sinon.createStubInstance(TransactionStatisticsCollector);
        stubStatsCollector.getTotalSubmittedTx.returns(0);
        stubStatsCollector.getRoundStartTime.returns(Date.now());

        const sleepStub = sandbox.stub(caliper_utils, 'sleep');
        const loggerWarnStub = sandbox.stub(console, 'warn');

        const replayRateController = ReplayRate.createRateController(testMessage, stubStatsCollector, 0);

        // Test the first few transactions
        for (let i = 0; i < transactionTimings.length; i++) {
            await replayRateController.applyRateControl();
            sleepStub.should.have.been.calledWithExactly(transactionTimings[i]);
            stubStatsCollector.getTotalSubmittedTx.returns(i + 1);
            sleepStub.resetHistory();
        }

        loggerWarnStub.should.not.have.been.called;

        // Test the case when running out of transaction timings
        await replayRateController.applyRateControl();
        sleepStub.should.have.been.calledWithExactly(50);
        loggerWarnStub.should.have.been.calledWithMatch(/Using default sleep time of 50 ms/);

        // Clean up the temporary file
        fs.unlinkSync(tempFilePath);
    });

    it('should call end() method without any errors', async () => {
        const tempFilePath = path.join(__dirname, 'temp-replay-trace.txt');
        const transactionTimings = [100, 200, 300, 400];
        fs.writeFileSync(tempFilePath, transactionTimings.join('\n'), 'utf-8');

        const msgContent = {
            label: 'test',
            rateControl: {
                type: 'replay-rate',
                opts: {
                    pathTemplate: tempFilePath,
                    inputFormat: 'TEXT'
                }
            },
            workload: { module: 'module.js' },
            testRound: 0,
            txDuration: 250,
            totalWorkers: 2
        };
        const testMessage = new TestMessage('test', [], msgContent);
        const stubStatsCollector = sinon.createStubInstance(TransactionStatisticsCollector);
        const replayRateController = ReplayRate.createRateController(testMessage, stubStatsCollector, 0);

        await replayRateController.end();

        // Clean up the temporary file
        fs.unlinkSync(tempFilePath);
    });
});
