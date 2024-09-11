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
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
chai.use(require('sinon-chai'));
const sinon = require('sinon');
const expect = chai.expect;
const mockery = require('mockery');

const warnLogger = sinon.stub();
const errorLogger = sinon.stub();

/**
 * Mock implementation of CaliperUtils for testing purposes.
 */
class CaliperUtils {
    /**
     * Mocked version of the resolvePath method.
     * Resolves the provided relative or absolute path and returns a fake path for testing.
     *
     * @param {string} path - The relative or absolute path to resolve.
     * @returns {string} - Returns a hardcoded fake path, 'fake/path'.
     */
    static resolvePath(path) {
        return 'fake/path';
    }

    /**
     * Mocked version of the sleep method.
     * Simulates a sleep by immediately resolving the promise.
     *
     * @param {number} ms - The number of milliseconds to sleep (ignored in the mock).
     * @returns {Promise<void>} - A resolved promise, simulating the sleep.
     */
    static sleep(ms) {
        return Promise.resolve();
    }

    /**
     *
     * @param {*} yaml res
     * @return {string} the fake yaml
     */
    static parseYaml(yaml) {
        return 'yaml';
    }

    /**
     * Mocked version of the getLogger method.
     * Returns a logger object with warn and error stubs for logging testing.
     *
     * @returns {{warn: function, error: function}} - A mocked logger with stubs for `warn` and `error` methods.
     */
    static getLogger() {
        return {
            warn: warnLogger,
            error: errorLogger
        };
    }
}


mockery.enable({
    warnOnReplace: false,
    warnOnUnregistered: false
});
mockery.registerMock('../../common/utils/caliper-utils', CaliperUtils);

describe('When using Internal Transaction Observer', () => {
    const TxUpdateMessage = require('../../../lib/common/messages/txUpdateMessage');
    const InternalTxObserver = require('../../../lib/worker/tx-observers/internal-tx-observer');
    const TxResetMessage = require('../../../lib/common/messages/txResetMessage');
    const ConfigUtil = require('../../../lib/common/config/config-util');


    let messengerMock, managerUuid, workerIndex;
    let clock;
    const defaultInterval = 1000; // in milliseconds

    beforeEach(() => {
        // Mocking dependencies
        messengerMock = {
            getUUID: sinon.stub().returns('mocked-messenger-uuid'),
            send: sinon.stub().resolves()
        };
        managerUuid = 'mocked-manager-uuid';
        workerIndex = 0;
        clock = sinon.useFakeTimers();
        warnLogger.reset();
        errorLogger.reset();
    });

    afterEach(() => {
        sinon.restore();
        mockery.deregisterAll();
        mockery.disable();
        clock.restore();
    });

    describe('Construction', () => {
        it('should initialize with correct properties', () => {
            const TEST_UPDATE_INTERVAL = 6000;
            sinon.stub(ConfigUtil, 'get').withArgs(ConfigUtil.keys.Observer.Internal.Interval).returns(TEST_UPDATE_INTERVAL);

            const observer = new InternalTxObserver(messengerMock, managerUuid, workerIndex);

            expect(observer.messengerUUID).to.equal('mocked-messenger-uuid');
            expect(observer.managerUuid).to.equal(managerUuid);
            expect(observer.updateInterval).to.equal(TEST_UPDATE_INTERVAL);
            expect(observer.intervalObject).to.be.undefined;
        });

        it('should log warning if interval is invalid and use default value', async () => {
            sinon.stub(ConfigUtil, 'get').withArgs(ConfigUtil.keys.Observer.Internal.Interval).returns(-1);
            const observer = new InternalTxObserver(messengerMock, managerUuid, workerIndex);

            // Check if default interval was used
            expect(observer.updateInterval).to.equal(defaultInterval);
            sinon.assert.calledOnce(warnLogger);
        });

    });

    describe('Activating and scheduling updates', () => {
        it('should activate the observer and start sending periodic updates', async () => {
            const observer = new InternalTxObserver(messengerMock, managerUuid, workerIndex);

            await observer.activate(1, 'round1');

            // Fast forward the clock to simulate intervals
            clock.tick(defaultInterval);
            expect(messengerMock.send).to.have.been.calledOnce;

            clock.tick(defaultInterval);
            expect(messengerMock.send).to.have.been.calledTwice;

            sinon.assert.notCalled(warnLogger);
            sinon.assert.notCalled(errorLogger);
        });

        it('should not accumulate transactions finished before activation gracefully', async () => {
            const observer = new InternalTxObserver(messengerMock, managerUuid, workerIndex);
            observer.txFinished({ totalFinished: 1 });

            await observer.activate(1, 'round1');

            // Fast forward the clock
            clock.tick(defaultInterval);

            // Check that the finished transactions are included in the update
            const messageSent = messengerMock.send.getCall(0).args[0];
            expect(messageSent.content.stats.txCounters.totalFinished).to.equal(0);
            // Clean up
            await observer.deactivate();
        });

        it('should handle concurrent transaction submissions correctly', async () => {
            const observer = new InternalTxObserver(messengerMock, managerUuid, workerIndex);

            await observer.activate(1, 'round1');

            // Simulate concurrent transaction submissions
            for (let i = 0; i < 100; i++) {
                observer.txSubmitted(1);
            }

            // Fast forward the clock to trigger the periodic update
            clock.tick(defaultInterval);

            // Check that the totalSubmitted is 100
            const messageSent = messengerMock.send.getCall(0).args[0];
            expect(messageSent.content.stats.txCounters.totalSubmitted).to.equal(100);

            // Clean up
            await observer.deactivate();
        });

        it('should send the correct update message with the correct transaction count during periodic updates', async () => {
            const observer = new InternalTxObserver(messengerMock, managerUuid, workerIndex);
            await observer.activate(1, 'round1');
            observer.txSubmitted(12);

            clock.tick(defaultInterval);
            sinon.assert.calledOnce(messengerMock.send);

            const messageSent = messengerMock.send.getCall(0).args[0];
            expect(messageSent).to.be.instanceOf(TxUpdateMessage);

            expect(messageSent.sender).to.equal('mocked-messenger-uuid');
            expect(messageSent.recipients).to.deep.equal([managerUuid]);
            expect(messageSent.content.stats.txCounters.totalSubmitted).to.equal(12);
            expect(messageSent.content.type).to.equal('txUpdate');
        });

        it('should handle very large updateInterval without sending updates prematurely', async () => {
            const HOUR_INTERVAL = 60 * 60 * 1000;
            const VERY_LARGE_INTERVAL = 24 * HOUR_INTERVAL; // 24 hours in milliseconds
            sinon.stub(ConfigUtil, 'get').returns(VERY_LARGE_INTERVAL);
            const observer = new InternalTxObserver(messengerMock, managerUuid, workerIndex);

            await observer.activate(1, 'round1');
            clock.tick(HOUR_INTERVAL);

            // Since updateInterval is very large, it should not have sent any updates yet
            expect(messengerMock.send).to.not.have.been.called;
            await observer.deactivate();
        });
    });

    describe('Deactivating and stopping updates', () => {
        it('should deactivate the observer, stop updates and send final messages', async () => {
            const observer = new InternalTxObserver(messengerMock, managerUuid, workerIndex);
            await observer.activate(1, 'round1');
            clock.tick(defaultInterval);

            await observer.deactivate();
            expect(observer.intervalObject).to.be.null;

            expect(messengerMock.send).to.have.been.calledThrice; // Once during activate, twice during deactivate

            // Ensure the first two messages were TxUpdateMessages
            const firstCallArg = messengerMock.send.getCall(0).args[0];
            const secondCallArg = messengerMock.send.getCall(1).args[0];
            expect(firstCallArg).to.be.instanceOf(TxUpdateMessage);
            expect(secondCallArg).to.be.instanceOf(TxUpdateMessage);

            // Ensure the third message is a TxResetMessage
            const txResetMessage = new TxResetMessage('mocked-messenger-uuid', [managerUuid]);
            sinon.assert.calledWith(messengerMock.send, txResetMessage);

            // Ensure the error logger was not called
            sinon.assert.notCalled(errorLogger);
        });


        it('should log error if deactivation fails due to message sending', async () => {
            messengerMock.send.rejects(new Error('Send error'));
            const observer = new InternalTxObserver(messengerMock, managerUuid, workerIndex);

            await observer.activate(1, 'round1');
            clock.tick(defaultInterval);

            await expect(observer.deactivate()).to.be.rejectedWith('Send error');
            sinon.assert.calledOnce(errorLogger);
        });

        it('should handle deactivation without prior activation gracefully', async () => {
            const observer = new InternalTxObserver(messengerMock, managerUuid, workerIndex);

            await observer.deactivate();

            // The observer should handle this without errors
            expect(observer.intervalObject).to.be.undefined;
            sinon.assert.notCalled(errorLogger);
        });

    });

    describe('Concurency', () => {
        it('should handle concurrent activation and deactivation calls gracefully', async () => {
            const observer = new InternalTxObserver(messengerMock, managerUuid, workerIndex);

            const activatePromise = observer.activate(1, 'round1');
            const deactivatePromise = observer.deactivate();
            await Promise.all([activatePromise, deactivatePromise]);
            expect(observer.intervalObject).to.be.null;
            await observer.deactivate();
        });
    });

});
