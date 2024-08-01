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
const fs = require('fs');
const RecordRate = require('../../../lib/worker/rate-control/recordRate');
const TestMessage = require('../../../lib/common/messages/testMessage');
const MockRate = require('./mockRate');
const TransactionStatisticsCollector = require('../../../lib/common/core/transaction-statistics-collector');
const util = require('../../../lib/common/utils/caliper-utils');
const logger = util.getLogger('record-rate-controller');

const chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('RecordRate controller', () => {
    let defaultMsgContent;
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
        defaultMsgContent = {
            label: 'test',
            rateControl: {
                type: 'record-rate',
                opts: {
                    rateController: {
                        type: 'zero-rate'
                    },
                    pathTemplate: '../tx_records_client<C>_round<R>.txt',
                    outputFormat: 'TEXT'
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
            const msgContent = { ...defaultMsgContent };
            msgContent.rateControl.opts.outputFormat = undefined;
            const testMessage = new TestMessage('test', [], msgContent);
            const controller = RecordRate.createRateController(testMessage, stubStatsCollector, 0);
            controller.outputFormat.should.equal('TEXT');
        });


        it('should set outputFormat to TEXT if invalid format is provided', () => {
            const msgContent = { ...defaultMsgContent };
            msgContent.rateControl.opts.outputFormat = 'INVALID_FORMAT';
            const testMessage = new TestMessage('test', [], msgContent);
            const controller = RecordRate.createRateController(testMessage, stubStatsCollector, 0);

            controller.outputFormat.should.equal('TEXT');
        });

        it('should export records to text format', async () => {
            const msgContent = { ...defaultMsgContent };
            const testMessage = new TestMessage('test', [], msgContent);
            const controller = RecordRate.createRateController(testMessage, stubStatsCollector, 0);
            sinon.stub(controller.recordedRateController, 'end').resolves();

            controller.records = [100, 200, 300];
            const fsWriteSyncStub = sandbox.stub(fs, 'writeFileSync');
            const fsAppendSyncStub = sandbox.stub(fs, 'appendFileSync');

            await controller.end();

            sinon.assert.calledOnce(fsWriteSyncStub);
            sinon.assert.calledThrice(fsAppendSyncStub);

            // Verify the content written to the file
            sinon.assert.calledWith(fsWriteSyncStub, sinon.match.string, '', 'utf-8');
            sinon.assert.calledWith(fsAppendSyncStub.getCall(0), sinon.match.string, '100\n');
            sinon.assert.calledWith(fsAppendSyncStub.getCall(1), sinon.match.string, '200\n');
            sinon.assert.calledWith(fsAppendSyncStub.getCall(2), sinon.match.string, '300\n');


            fsWriteSyncStub.restore();
            fsAppendSyncStub.restore();
        });

        it('should export records to binary big endian format', async () => {
            const msgContent = {
                label: 'test',
                rateControl: {
                    type: 'record-rate',
                    opts: {
                        rateController: {
                            type: 'zero-rate'
                        },
                        pathTemplate: '../tx_records_client<C>_round<R>.txt',
                        outputFormat: 'BIN_BE'
                    }
                },
                testRound: 0,  // Ensure roundIndex is set
                txDuration: 250,
                totalWorkers: 2
            };
            const testMessage = new TestMessage('test', [], msgContent);
            const controller = RecordRate.createRateController(testMessage, stubStatsCollector, 0);
            sinon.stub(controller.recordedRateController, 'end').resolves();

            controller.records = [100, 200, 300];
            const fsWriteSyncStub = sandbox.stub(fs, 'writeFileSync');

            await controller.end();

            sinon.assert.calledOnce(fsWriteSyncStub);
            const buffer = fsWriteSyncStub.getCall(0).args[1];
            buffer.readUInt32BE(0).should.equal(3);
            buffer.readUInt32BE(4).should.equal(100);
            buffer.readUInt32BE(8).should.equal(200);
            buffer.readUInt32BE(12).should.equal(300);

            fsWriteSyncStub.restore();
        });

        it('should export records to binary little endian format', async () => {
            const msgContent = { ...defaultMsgContent };
            msgContent.rateControl.opts.outputFormat = 'BIN_LE';
            const testMessage = new TestMessage('test', [], msgContent);
            const controller = RecordRate.createRateController(testMessage, stubStatsCollector, 0);

            sandbox.stub(controller.recordedRateController, 'end').resolves();

            controller.records = [100, 200, 300];
            const fsWriteSyncStub = sandbox.stub(fs, 'writeFileSync');

            await controller.end();

            sinon.assert.calledOnce(fsWriteSyncStub);
            const buffer = fsWriteSyncStub.getCall(0).args[1];
            buffer.readUInt32LE(0).should.equal(3);
            buffer.readUInt32LE(4).should.equal(100);
            buffer.readUInt32LE(8).should.equal(200);
            buffer.readUInt32LE(12).should.equal(300);

            fsWriteSyncStub.restore();
        });

        it('should export to text format when output format is TEXT', async () => {
            const msgContent = { ...defaultMsgContent };
            const testMessage = new TestMessage('test', [], msgContent);
            const controller = RecordRate.createRateController(testMessage, stubStatsCollector, 0);

            const mockController = {
                end: sinon.stub().resolves(),
                applyRateControl: sinon.stub().resolves(),
            };
            controller.recordedRateController.controller = mockController;

            const exportToTextSpy = sinon.spy(controller, '_exportToText');
            const exportToBinaryLittleEndianSpy = sinon.spy(controller, '_exportToBinaryLittleEndian');
            const exportToBinaryBigEndianSpy = sinon.spy(controller, '_exportToBinaryBigEndian');

            await controller.end();

            sinon.assert.calledOnce(exportToTextSpy);
            sinon.assert.notCalled(exportToBinaryLittleEndianSpy);
            sinon.assert.notCalled(exportToBinaryBigEndianSpy);
            sinon.assert.notCalled(logger.error);

            exportToTextSpy.restore();
            exportToBinaryLittleEndianSpy.restore();
            exportToBinaryBigEndianSpy.restore();
        });

        it('should export to binary little endian format when output format is BIN_LE', async () => {
            const msgContent = { ...defaultMsgContent };
            msgContent.rateControl.opts.outputFormat = 'BIN_LE';
            const testMessage = new TestMessage('test', [], msgContent);
            const controller = RecordRate.createRateController(testMessage, stubStatsCollector, 0);

            const mockController = {
                end: sinon.stub().resolves(),
                applyRateControl: sinon.stub().resolves(),
            };
            controller.recordedRateController.controller = mockController;

            const exportToTextSpy = sinon.spy(controller, '_exportToText');
            const exportToBinaryLittleEndianSpy = sinon.spy(controller, '_exportToBinaryLittleEndian');
            const exportToBinaryBigEndianSpy = sinon.spy(controller, '_exportToBinaryBigEndian');

            await controller.end();

            sinon.assert.notCalled(exportToTextSpy);
            sinon.assert.calledOnce(exportToBinaryLittleEndianSpy);
            sinon.assert.notCalled(exportToBinaryBigEndianSpy);
            sinon.assert.notCalled(logger.error);

            exportToTextSpy.restore();
            exportToBinaryLittleEndianSpy.restore();
            exportToBinaryBigEndianSpy.restore();
        });


        it('should export to binary big endian format when output format is BIN_BE', async () => {
            const msgContent = { ...defaultMsgContent };
            msgContent.rateControl.opts.outputFormat = 'BIN_BE';
            const testMessage = new TestMessage('test', [], msgContent);
            const controller = RecordRate.createRateController(testMessage, stubStatsCollector, 0);

            const mockController = {
                end: sinon.stub().resolves(),
                applyRateControl: sinon.stub().resolves(),
            };
            controller.recordedRateController.controller = mockController;

            const exportToTextSpy = sinon.spy(controller, '_exportToText');
            const exportToBinaryLittleEndianSpy = sinon.spy(controller, '_exportToBinaryLittleEndian');
            const exportToBinaryBigEndianSpy = sinon.spy(controller, '_exportToBinaryBigEndian');

            await controller.end();

            sinon.assert.notCalled(exportToTextSpy);
            sinon.assert.notCalled(exportToBinaryLittleEndianSpy);
            sinon.assert.calledOnce(exportToBinaryBigEndianSpy);
            sinon.assert.notCalled(logger.error);

            exportToTextSpy.restore();
            exportToBinaryLittleEndianSpy.restore();
            exportToBinaryBigEndianSpy.restore();
        });

        it('should throw an error if pathTemplate is undefined', () => {
            const msgContent = { ...defaultMsgContent };
            msgContent.rateControl.opts.pathTemplate = undefined;
            const testMessage = new TestMessage('test', [], msgContent);

            (() => {
                RecordRate.createRateController(testMessage, stubStatsCollector, 0);
            }).should.throw('The path to save the recording to is undefined');
        });
    });

    describe('Rate Control', () => {
        it('should apply rate control to the recorded rate controller', async () => {
            const testMessage = new TestMessage('test', [], defaultMsgContent);
            const rateController = RecordRate.createRateController(testMessage, stubStatsCollector, 0);
            const mockRate = MockRate.createRateController();
            mockRate.reset();
            mockRate.isApplyRateControlCalled().should.equal(false);
            await rateController.applyRateControl();
            mockRate.isApplyRateControlCalled().should.equal(true);
        });

        it('should initialize records array if the number of transactions is provided', () => {
            const msgContent = {...defaultMsgContent };

            const testMessage = new TestMessage('test', [], msgContent);
            sinon.stub(testMessage, 'getNumberOfTxs').returns(5);

            const controller = RecordRate.createRateController(testMessage, stubStatsCollector, 0);

            controller.records.should.be.an('array').that.has.lengthOf(5);
            controller.records.every(record => record.should.equal(0));
        });

        it('should replace path template placeholders', () => {
            const msgContent = { ...defaultMsgContent };
            const testMessage = new TestMessage('test', [], msgContent);
            const controller = RecordRate.createRateController(testMessage, stubStatsCollector, 0);

            controller.pathTemplate.should.equal(util.resolvePath('../tx_records_client0_round0.txt'));
        });

        it('should throw an error if the rate controller to record is unknown', async () => {
            const msgContent = {...defaultMsgContent };
            msgContent.rateControl.opts.rateController.type = 'nonexistent-rate';
            msgContent.rateControl.opts.logEnd = true;
            const testMessage = new TestMessage('test', [], msgContent);

            (() => {
                RecordRate.createRateController(testMessage, stubStatsCollector, 0);
            }).should.throw(/Module "nonexistent-rate" could not be loaded/);
        });

        it('should throw an error if rateController is undefined', () => {
            const msgContent = { ...defaultMsgContent };
            msgContent.rateControl.opts.rateController = undefined;
            const testMessage = new TestMessage('test', [], msgContent);

            (() => {
                RecordRate.createRateController(testMessage, stubStatsCollector, 0);
            }).should.throw('The rate controller to record is undefined');
        });
    });
});
