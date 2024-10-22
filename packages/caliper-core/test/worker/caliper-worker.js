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

const chai = require('chai');
chai.should();
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const sinon = require('sinon');
const mockery = require('mockery');

const MessengerInterface = require('../../lib/common/messengers/messenger-interface');
const ConnectorInterface = require('../../lib/common/core/connector-interface');
const TestMessage = require('../../lib/common/messages/testMessage');
const RateInterface = require('../../lib/worker/rate-control/rateInterface');
const WorkloadInterface = require('../../lib/worker/workload/workloadModuleInterface');
const TransactionStatisticsCollector = require('../../lib/common/core/transaction-statistics-collector');

const mockRate = sinon.createStubInstance(RateInterface);
const mockWorkload = sinon.createStubInstance(WorkloadInterface);
const mockStats = sinon.createStubInstance(TransactionStatisticsCollector);
mockStats.getTotalSubmittedTx.onFirstCall().returns(0);
mockStats.getTotalSubmittedTx.onSecondCall().returns(1);
const deactivateMethod = sinon.stub();
let logwarningMethod = sinon.stub();
let logerrorMethod =  sinon.stub();

class MockCaliperUtils {
    static resolvePath(path) {
        return 'fake/path';
    }

    static loadModuleFunction(map, a,b,c,d) {
        let mock = mockWorkload;
        if (map.size > 0) {
            mock = mockRate;
        }
        return () => {
            return mock;
        };
    }

    static getLogger() {
        return {
            debug: sinon.stub(),
            error: logerrorMethod,
            warn: logwarningMethod,
            info: sinon.stub()
        };
    }

    static sleep() {}
}

class MockInternalTxObserver {
    getCurrentStatistics() {
        return mockStats;
    }
}

class MockTxObserverDispatch {
    activate() {}
}


MockTxObserverDispatch.prototype.deactivate = deactivateMethod;

mockery.enable({
    warnOnReplace: false,
    warnOnUnregistered: false,
    useCleanCache: true
});
mockery.registerMock('./tx-observers/internal-tx-observer', MockInternalTxObserver);
mockery.registerMock('./tx-observers/tx-observer-dispatch', MockTxObserverDispatch);

const loggerSandbox = sinon.createSandbox();
const CaliperUtils = require('../../lib/common/utils/caliper-utils');
loggerSandbox.replace(CaliperUtils, 'getLogger', MockCaliperUtils.getLogger);

const CaliperWorker = require('../../lib/worker/caliper-worker');

describe('Caliper worker', () => {
    after(() => {
        loggerSandbox.restore();
        sinon.reset();
    });

    describe('When executing a round', () => {
        let mockConnector, mockMessenger, mockTestMessage;
        const sandbox = sinon.createSandbox();

        beforeEach(() => {
            mockConnector = sinon.createStubInstance(ConnectorInterface);
            mockConnector.getContext.resolves(1);
            mockMessenger = sinon.createStubInstance(MessengerInterface);
            mockTestMessage = sinon.createStubInstance(TestMessage);
            mockTestMessage.getRateControlSpec.returns({type: '1zero-rate'});
            mockTestMessage.getWorkloadSpec.returns({module: 'test/workload'});
            mockWorkload.initializeWorkloadModule.resolves()
            mockTestMessage.getNumberOfTxs.returns(1);
            sandbox.replace(CaliperUtils, 'resolvePath', MockCaliperUtils.resolvePath);
            sandbox.replace(CaliperUtils, 'loadModuleFunction', MockCaliperUtils.loadModuleFunction);
            sandbox.replace(CaliperUtils, 'sleep', MockCaliperUtils.sleep);
        });

        afterEach(() => {
            sandbox.restore();
            logwarningMethod.reset();
            mockRate.end.reset();
            mockWorkload.cleanupWorkloadModule.reset();
            mockWorkload.submitTransaction.reset();
            mockStats.getTotalSubmittedTx.resetHistory();
            deactivateMethod.reset();
            mockWorkload.initializeWorkloadModule.resetHistory();
            logerrorMethod.resetHistory();
        });

        const validateCallsAndWarnings = (warnings) => {
            sinon.assert.calledOnce(mockWorkload.submitTransaction);
            sinon.assert.calledOnce(deactivateMethod);
            sinon.assert.calledOnce(mockRate.end);
            sinon.assert.calledOnce(mockWorkload.cleanupWorkloadModule);
            sinon.assert.calledTwice(mockConnector.releaseContext);
            sinon.assert.callCount(logwarningMethod, warnings);
        };

        it('should clean up all resources if a connector does not throw an error', async () => {
            const worker = new CaliperWorker(mockConnector, 1, mockMessenger, 'uuid');
            await worker.prepareTest(mockTestMessage);
            mockWorkload.submitTransaction.resolves();

            await worker.executeRound(mockTestMessage);
            validateCallsAndWarnings(0);
        });


        it('should clean up all resources if a connector throws an error', async () => {
            const worker = new CaliperWorker(mockConnector, 1, mockMessenger, 'uuid');
            await worker.prepareTest(mockTestMessage);
            mockWorkload.submitTransaction.rejects(new Error('failure'));

            await worker.executeRound(mockTestMessage).should.be.rejected;
            validateCallsAndWarnings(0);
        });

        it('should warn if any of the cleanup tasks fail', async () => {
            const worker = new CaliperWorker(mockConnector, 1, mockMessenger, 'uuid');
            await worker.prepareTest(mockTestMessage);
            mockWorkload.submitTransaction.resolves();
            deactivateMethod.rejects(new Error('deactivate error'));
            mockRate.end.rejects(new Error('rate end error'));
            mockWorkload.cleanupWorkloadModule.rejects(new Error('cleanup error'));
            mockConnector.releaseContext.rejects(new Error('release error'));

            await worker.executeRound(mockTestMessage);
            validateCallsAndWarnings(4);
        });

        [5, 10].forEach(numberOfTxs => {
            it(`should run ${numberOfTxs} transactions and wait for completion when no errors occur`, async () => {
                const worker = new CaliperWorker(mockConnector, 1, mockMessenger, 'uuid');
                await worker.prepareTest(mockTestMessage);

                mockTestMessage.getNumberOfTxs.returns(numberOfTxs);
                mockTestMessage.getRoundDuration.returns(null);

                mockWorkload.submitTransaction.resetHistory();
                mockStats.getTotalSubmittedTx.resetHistory();
                mockStats.getTotalFinishedTx.resetHistory();
                mockStats.getCumulativeTxStatistics.resetHistory();

                let submittedTx = 0;
                let finishedTx = 0;

                // Stub the methods
                mockStats.getTotalSubmittedTx.callsFake(() => submittedTx);
                mockStats.getTotalFinishedTx.callsFake(() => finishedTx);
                mockStats.getCumulativeTxStatistics.returns({});

                worker.internalTxObserver.getCurrentStatistics = () => mockStats;

                mockWorkload.submitTransaction.callsFake(async () => {
                    submittedTx += 1;
                    finishedTx += 1;
                    return Promise.resolve();
                });

                await worker.executeRound(mockTestMessage);

                sinon.assert.callCount(mockWorkload.submitTransaction, numberOfTxs);
                sinon.assert.calledOnce(deactivateMethod);
                sinon.assert.calledOnce(mockRate.end);
                sinon.assert.calledOnce(mockWorkload.cleanupWorkloadModule);
                sinon.assert.called(mockConnector.releaseContext);
            });
        });

        [5, 10].forEach(numberOfTxs => {
            it(`should stop the round when an error occurs while running ${numberOfTxs} transactions`, async () => {
                const worker = new CaliperWorker(mockConnector, 1, mockMessenger, 'uuid');
                await worker.prepareTest(mockTestMessage);

                mockTestMessage.getNumberOfTxs.returns(numberOfTxs);
                mockTestMessage.getRoundDuration.returns(null);

                let submittedTx = 0;

                mockWorkload.submitTransaction.resetHistory();

                // Stub the methods
                mockStats.getTotalSubmittedTx.callsFake(() => submittedTx);
                mockStats.getTotalFinishedTx.callsFake(() => submittedTx)


                mockWorkload.submitTransaction.callsFake(async () => {
                    submittedTx += 1;
                    if (submittedTx === 3) {
                        return Promise.reject(new Error('Transaction submission failed'));
                    }
                    return Promise.resolve();
                });

                await worker.executeRound(mockTestMessage).should.be.rejectedWith('Transaction submission failed');

                // Ensure transactions stop after the error and resources are cleaned up
                sinon.assert.callCount(mockWorkload.submitTransaction, 4);
                sinon.assert.calledOnce(deactivateMethod);
                sinon.assert.calledOnce(mockRate.end);
                sinon.assert.calledOnce(mockWorkload.cleanupWorkloadModule);
                sinon.assert.called(mockConnector.releaseContext);

                mockTestMessage.getRoundDuration.reset();
                mockWorkload.submitTransaction.reset();
                mockStats.getTotalFinishedTx.reset();
            });
        });

        it('should execute the round for a specified duration', async function() {
            this.timeout(5000);

            const worker = new CaliperWorker(mockConnector, 1, mockMessenger, 'uuid');
            await worker.prepareTest(mockTestMessage);

            mockWorkload.submitTransaction.resolves();

            mockTestMessage.getRoundDuration.returns(1);
            mockTestMessage.getNumberOfTxs.returns(null);

            const startTime = Date.now();
            const mockStats = {
                getRoundStartTime: () => startTime,
                getTotalSubmittedTx: sinon.stub(),
                getTotalFinishedTx: sinon.stub(),
                getCumulativeTxStatistics: sinon.stub().returns({})
            };
            worker.internalTxObserver.getCurrentStatistics = () => mockStats;

            await worker.executeRound(mockTestMessage);

            const endTime = Date.now();
            const elapsedTime = endTime - startTime;

            elapsedTime.should.be.within(900, 1200);

            const callCount = mockWorkload.submitTransaction.callCount;
            callCount.should.be.greaterThan(0);

            sinon.assert.calledOnce(deactivateMethod);
            sinon.assert.calledOnce(mockWorkload.cleanupWorkloadModule);
            sinon.assert.called(mockConnector.releaseContext);
        });

        it('should stop the round and perform cleanup when an error occurs during a duration-based round', async function() {
            this.timeout(5000); // Allow enough time for the test to run

            const worker = new CaliperWorker(mockConnector, 1, mockMessenger, 'uuid');
            await worker.prepareTest(mockTestMessage);

            mockTestMessage.getRoundDuration.returns(1); // Set duration to 1 second
            mockTestMessage.getNumberOfTxs.returns(null); // Ensure we're using duration, not a fixed number

            const startTime = Date.now();

            // Mock statistics object to simulate submitted and finished transactions
            const mockStats = {
                getRoundStartTime: () => startTime,
                getTotalSubmittedTx: sinon.stub(),
                getTotalFinishedTx: sinon.stub(),
                getCumulativeTxStatistics: sinon.stub().returns({})
            };

            // Inject mock stats into the worker
            worker.internalTxObserver.getCurrentStatistics = () => mockStats;

            let submittedTx = 0;

            // Simulate an error after 2 successful transaction submissions
            mockWorkload.submitTransaction.callsFake(async () => {
                submittedTx += 1;
                if (submittedTx === 2) {  // After 2 transactions, simulate an error
                    throw new Error('Transaction error during duration round');
                }
                return Promise.resolve(); // Successful submission before the error
            });

            // Expect the round to be rejected with the error that occurs during the transaction submission
            await worker.executeRound(mockTestMessage).should.be.rejectedWith('Transaction error during duration round');

            // Ensure that 2 transactions were submitted before the error was thrown
            sinon.assert.callCount(mockWorkload.submitTransaction, 2);

            // Ensure that cleanup operations were performed despite the error
            sinon.assert.calledOnce(deactivateMethod);
            sinon.assert.calledOnce(mockWorkload.cleanupWorkloadModule);
            sinon.assert.called(mockConnector.releaseContext);
        });

        it('should log a warning and propagate the error when an error occurs during prepareTest', async () => {
            const worker = new CaliperWorker(mockConnector, 1, mockMessenger, 'uuid');
            const errorMessage = 'Initialization error';
            mockConnector.getContext.rejects(new Error(errorMessage));
            mockTestMessage.getRoundIndex.returns(1);
            mockTestMessage.getWorkloadSpec.returns({ module: 'test/workload' });
            mockTestMessage.getWorkerArguments.returns([]);

            await worker.prepareTest(mockTestMessage).should.be.rejectedWith(errorMessage);

            sinon.assert.calledOnce(mockConnector.getContext);
            sinon.assert.calledOnce(logwarningMethod);
        });

        it('should call initializeWorkloadModule and releaseContext during successful prepareTest execution', async () => {
            // Arrange
            const worker = new CaliperWorker(mockConnector, 1, mockMessenger, 'uuid');

            // Set up the mocks to resolve successfully
            mockConnector.getContext.resolves(1);
            mockConnector.releaseContext.resolves();
            mockWorkload.initializeWorkloadModule.resolves();

            // Set up test message
            mockTestMessage.getRoundIndex.returns(1);
            mockTestMessage.getWorkloadSpec.returns({ module: 'test/workload', arguments: { arg1: 'value1' } });
            mockTestMessage.getWorkersNumber.returns(3);
            mockTestMessage.getWorkerArguments.returns([]);

            // Act
            await worker.prepareTest(mockTestMessage);

            // Assert
            // Ensure getContext was called once with correct arguments
            sinon.assert.calledOnce(mockConnector.getContext);
            sinon.assert.calledWithExactly(mockConnector.getContext, 1, []);

            // Ensure initializeWorkloadModule was called once with correct arguments
            sinon.assert.calledOnce(mockWorkload.initializeWorkloadModule);
            sinon.assert.calledWithExactly(
                mockWorkload.initializeWorkloadModule,
                1,                                  // workerIndex
                3,                                  // totalWorkers
                1,                                  // roundIndex
                { arg1: 'value1' },                 // workload arguments
                mockConnector,                      // connector
                1                                   // context
            );

            // Ensure releaseContext was called once with the correct context
            sinon.assert.calledOnce(mockConnector.releaseContext);
            sinon.assert.calledWithExactly(mockConnector.releaseContext, 1);

            // Ensure no warnings or errors were logged
            sinon.assert.notCalled(logwarningMethod);
            sinon.assert.notCalled(logerrorMethod);

            // Reset mocks if necessary
            mockTestMessage.getWorkloadSpec.reset();
        });

        it('should handle errors during initializeWorkloadModule and ensure releaseContext is called', async () => {
            // Arrange
            const worker = new CaliperWorker(mockConnector, 1, mockMessenger, 'uuid');
            const errorMessage = 'Workload module initialization error';

            // Set up the mocks
            mockConnector.getContext.resolves(1);
            mockConnector.releaseContext.resolves();
            mockWorkload.initializeWorkloadModule.rejects(new Error(errorMessage));

            // Set up test message
            mockTestMessage.getRoundIndex.returns(1);
            mockTestMessage.getWorkloadSpec.returns({ module: 'test/workload', arguments: {} });
            mockTestMessage.getWorkersNumber.returns(1);
            mockTestMessage.getWorkerArguments.returns([]);

            // Act & Assert
            await worker.prepareTest(mockTestMessage).should.be.rejectedWith(errorMessage);

            // Assert
            // Ensure getContext was called once with correct arguments
            sinon.assert.calledOnce(mockConnector.getContext);
            sinon.assert.calledWithExactly(mockConnector.getContext, 1, []);

            // Ensure initializeWorkloadModule was called once
            sinon.assert.calledOnce(mockWorkload.initializeWorkloadModule);

            // Ensure releaseContext was called once with the correct context
            sinon.assert.calledOnce(mockConnector.releaseContext);
            sinon.assert.calledWithExactly(mockConnector.releaseContext, 1);

            // Ensure a warning was logged with the correct error message
            sinon.assert.calledOnce(logwarningMethod);
            sinon.assert.calledWithMatch(logwarningMethod, sinon.match(errorMessage));
            // Ensure no errors were logged
            sinon.assert.notCalled(logerrorMethod);

            // Reset mocks if necessary
            mockTestMessage.getWorkloadSpec.reset();
        });

        it('should not submit transactions after the duration ends', async function() {
            this.timeout(5000);

            const startTime = 0;
            const worker = new CaliperWorker(mockConnector, 1, mockMessenger, 'uuid');
            await worker.prepareTest(mockTestMessage);

            const clock = sinon.useFakeTimers();
            mockWorkload.submitTransaction.resolves();

            const mockStats = {
                getRoundStartTime: () => startTime,
                getTotalSubmittedTx: sinon.stub(),
                getTotalFinishedTx: sinon.stub(),
                getCumulativeTxStatistics: sinon.stub().returns({})
            };
            worker.internalTxObserver.getCurrentStatistics = () => mockStats;

            mockTestMessage.getRoundDuration.returns(1);
            mockTestMessage.getNumberOfTxs.returns(null);

            const executePromise = worker.executeRound(mockTestMessage);

            await clock.tickAsync(1000); // Advance time by 1 second
            // Yield to the event loop to allow pending microtasks to complete
            await Promise.resolve();

            const callCountAtDurationEnd = mockWorkload.submitTransaction.callCount;

            await clock.tickAsync(1000); // Advance time by another second
            await executePromise;

            clock.restore();

            sinon.assert.callCount(mockWorkload.submitTransaction, callCountAtDurationEnd);
        });
    });
});
