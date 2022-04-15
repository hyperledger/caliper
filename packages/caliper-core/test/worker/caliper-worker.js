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
            error: sinon.stub(),
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
loggerSandbox.replace(CaliperUtils, "getLogger", MockCaliperUtils.getLogger);

const CaliperWorker = require('../../lib/worker/caliper-worker');

describe('Caliper worker', () => {
    after(() => {
        loggerSandbox.restore();
    });

    describe('When executing a round', () => {
        let mockConnector, mockMessenger, mockTestMessage;
        const sandbox = sinon.createSandbox();

        beforeEach(() => {
            logwarningMethod.reset();
            mockRate.end.reset();
            mockWorkload.cleanupWorkloadModule.reset();
            mockWorkload.submitTransaction.reset();
            mockStats.getTotalSubmittedTx.resetHistory();
            deactivateMethod.reset();

            mockConnector = sinon.createStubInstance(ConnectorInterface);
            mockConnector.getContext.resolves(1);
            mockMessenger = sinon.createStubInstance(MessengerInterface);
            mockTestMessage = sinon.createStubInstance(TestMessage);
            mockTestMessage.getRateControlSpec.returns({type: '1zero-rate'});
            mockTestMessage.getWorkloadSpec.returns({module: 'test/workload'});
            mockTestMessage.getNumberOfTxs.returns(1);
            sandbox.replace(CaliperUtils, 'resolvePath', MockCaliperUtils.resolvePath);
            sandbox.replace(CaliperUtils, 'loadModuleFunction', MockCaliperUtils.loadModuleFunction);
            sandbox.replace(CaliperUtils, 'sleep', MockCaliperUtils.sleep);
        });

        afterEach(() => {
            sandbox.restore();
        })

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

            await worker.executeRound(mockTestMessage).should.be.rejectedWith(/failure/);
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
    });
});
