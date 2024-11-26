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

const mockery = require('mockery');
const path = require('path');
const RecordRate = require('../../../lib/worker/rate-control/recordRate');
const fs = require('fs');
const TestMessage = require('../../../lib/common/messages/testMessage');
const MockRate = require('./mockRate');
const TransactionStatisticsCollector = require('../../../lib/common/core/transaction-statistics-collector');
const util = require('../../../lib/common/utils/caliper-utils');

const { expect } = require('chai');
const sinon = require('sinon');

describe('RecordRate controller', () => {
    let msgContent;
    let stubStatsCollector;
    let sandbox;

    before(() => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            useCleanCache: true
        });

        mockery.registerMock(path.join(__dirname, '../../../lib/worker/rate-control/noRate.js'), MockRate);
        sandbox = sinon.createSandbox();
    });

    after(() => {
        mockery.deregisterAll();
        mockery.disable();
        if (fs.existsSync('../tx_records_client0_round0.txt')) {
            fs.unlinkSync('../tx_records_client0_round0.txt');
        }
    });

    beforeEach(() => {
        msgContent = {
            label: 'test',
            rateControl: {
                type: 'record-rate',
                opts: {
                    rateController: {
                        type: 'zero-rate'
                    },
                    pathTemplate: '../tx_records_client<C>_round<R>.txt',
                    outputFormat: 'TEXT',
                    logEnd: true
                }
            },
            workload: {
                module: 'module.js'
            },
            testRound: 0,
            txDuration: 250,
            totalWorkers: 2
        };

        stubStatsCollector = new TransactionStatisticsCollector();
        stubStatsCollector.getTotalSubmittedTx = sandbox.stub();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('Export Formats', () => {
        it('should default outputFormat to TEXT if undefined', () => {
            msgContent.rateControl.opts.outputFormat = undefined;
            const testMessage = new TestMessage('test', [], msgContent);
            const controller = RecordRate.createRateController(testMessage, stubStatsCollector, 0);
            controller.outputFormat.should.equal('TEXT');
        });


        it('should set outputFormat to TEXT if invalid format is provided', () => {
            msgContent.rateControl.opts.outputFormat = 'INVALID_FORMAT';
            const testMessage = new TestMessage('test', [], msgContent);
            const controller = RecordRate.createRateController(testMessage, stubStatsCollector, 0);

            controller.outputFormat.should.equal('TEXT');
        });

        const formats = ['TEXT', 'BIN_BE', 'BIN_LE'];
        const recordScenarios = [
            {
                description: 'with gaps (sparse records)',
                records: { 1: 100, 3: 200, 7: 300 },
                expectedLength: 8
            },
            {
                description: 'fully populated (sequential records)',
                records: { 0: 50, 1: 100, 2: 150, 3: 200, 4: 250 },
                expectedLength: 5
            }
        ];

        formats.forEach(format => {
            recordScenarios.forEach(scenario => {
                it(`should export records to ${format} format ${scenario.description}`, async () => {
                // Prepare message content with the specific output format
                    const msgContentCopy = JSON.parse(JSON.stringify(msgContent));
                    msgContentCopy.rateControl.opts.outputFormat = format;
                    const testMessage = new TestMessage('test', [], msgContentCopy);
                    const controller = RecordRate.createRateController(testMessage, stubStatsCollector, 0);

                    sinon.stub(controller.recordedRateController, 'end').resolves();
                    Object.keys(scenario.records).forEach(index => {
                        controller.records[index] = scenario.records[index];
                    });

                    const fsWriteSyncStub = sandbox.stub(fs, 'writeFileSync');
                    const fsAppendSyncStub = sandbox.stub(fs, 'appendFileSync');

                    await controller.end();

                    if (format === 'TEXT') {
                        sinon.assert.calledOnce(fsWriteSyncStub);
                        sinon.assert.callCount(fsAppendSyncStub, scenario.expectedLength);
                        expect(controller.records.length).to.equal(scenario.expectedLength);

                        for (let i = 0; i < controller.records.length; i++) {
                            const time = controller.records[i] !== undefined ? controller.records[i] : 0;
                            const expectedValue = `${time}\n`;
                            sinon.assert.calledWith(fsAppendSyncStub.getCall(i), sinon.match.string, expectedValue);
                        }
                    } else {
                        sinon.assert.calledOnce(fsWriteSyncStub);
                        const buffer = fsWriteSyncStub.getCall(0).args[1];

                        // Determine the read method based on format
                        const readUInt32 = format === 'BIN_BE' ? Buffer.prototype.readUInt32BE : Buffer.prototype.readUInt32LE;

                        // Verify that the buffer starts with the length of the records array
                        const length = readUInt32.call(buffer, 0);
                        length.should.equal(controller.records.length);

                        // Verify each value in the buffer
                        for (let i = 0; i < controller.records.length; i++) {
                            const expectedValue = controller.records[i] !== undefined ? controller.records[i] : 0;
                            const actualValue = readUInt32.call(buffer, 4 + i * 4);
                            actualValue.should.equal(expectedValue);
                        }
                    }

                    // Restore stubs
                    fsWriteSyncStub.restore();
                    fsAppendSyncStub.restore();
                });
            });
        });
    });

    describe('When Applying Rate Control', () => {
        it('should apply rate control to the recorded rate controller', async () => {
            const testMessage = new TestMessage('test', [], msgContent);
            const rateController = RecordRate.createRateController(testMessage, stubStatsCollector, 0);
            const mockRate = MockRate.createRateController();
            mockRate.reset();
            mockRate.isApplyRateControlCalled().should.equal(false);
            await rateController.applyRateControl();
            mockRate.isApplyRateControlCalled().should.equal(true);
        });
    });

    describe('When Creating a RecordRate Controller', () => {
        it('should initialize records array if the number of transactions is provided', () => {
            const testMessage = new TestMessage('test', [], msgContent);
            sinon.stub(testMessage, 'getNumberOfTxs').returns(5);

            const controller = RecordRate.createRateController(testMessage, stubStatsCollector, 0);

            controller.records.should.be.an('array').that.has.lengthOf(6);
            controller.records.every(record => {
                expect(record).to.equal(0);
            });
        });

        it('should throw an error if the rate controller to record is unknown', async () => {
            msgContent.rateControl.opts.rateController.type = 'nonexistent-rate';
            msgContent.rateControl.opts.logEnd = true;
            const testMessage = new TestMessage('test', [], msgContent);

            (() => {
                RecordRate.createRateController(testMessage, stubStatsCollector, 0);
            }).should.throw(/Module "nonexistent-rate" could not be loaded/);
        });


        it('should throw an error if rateController is undefined', () => {
            msgContent.rateControl.opts.rateController = undefined;
            const testMessage = new TestMessage('test', [], msgContent);

            (() => {
                RecordRate.createRateController(testMessage, stubStatsCollector, 0);
            }).should.throw('The rate controller to record is undefined');
        });

        it('should replace path template placeholders for various worker and round indices', () => {
            const testCases = [
                { testRound: 0, workerIndex: 0, expectedPath: '../tx_records_client0_round0.txt' },
                { testRound: 1, workerIndex: 2, expectedPath: '../tx_records_client2_round1.txt' },
                { testRound: 5, workerIndex: 3, expectedPath: '../tx_records_client3_round5.txt' },
                { testRound: 10, workerIndex: 7, expectedPath: '../tx_records_client7_round10.txt' },
            ];

            testCases.forEach(({ testRound, workerIndex, expectedPath }) => {
                const content = JSON.parse(JSON.stringify(msgContent));
                content.testRound = testRound;
                const testMessage = new TestMessage('test', [], content);
                const controller = RecordRate.createRateController(testMessage, stubStatsCollector, workerIndex);
                controller.pathTemplate.should.equal(util.resolvePath(expectedPath));
            });
        });

        it('should throw an error if pathTemplate is undefined', () => {
            msgContent.rateControl.opts.pathTemplate = undefined;
            const testMessage = new TestMessage('test', [], msgContent);

            (() => {
                RecordRate.createRateController(testMessage, stubStatsCollector, 0);
            }).should.throw('The path to save the recording to is undefined');
        });
    });
});
