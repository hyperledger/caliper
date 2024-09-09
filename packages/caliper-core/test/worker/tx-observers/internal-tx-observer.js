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

    it('should initialize with correct properties', () => {
        sinon.stub(ConfigUtil, 'get').returns(1000);
        const observer = new InternalTxObserver(messengerMock, managerUuid, workerIndex);

        expect(observer.messengerUUID).to.equal('mocked-messenger-uuid');
        expect(observer.managerUuid).to.equal(managerUuid);
        expect(observer.updateInterval).to.equal(1000);
        expect(observer.intervalObject).to.be.undefined;
    });

    describe('Activating and scheduling updates', () => {
        it('should activate the observer and start sending periodic updates', async () => {
            sinon.stub(ConfigUtil, 'get').returns(1000);
            const observer = new InternalTxObserver(messengerMock, managerUuid, workerIndex);

            await observer.activate(1, 'round1');

            // Fast forward the clock to simulate intervals
            clock.tick(1000);
            expect(messengerMock.send).to.have.been.calledOnce;

            clock.tick(1000);
            expect(messengerMock.send).to.have.been.calledTwice;

            sinon.assert.notCalled(warnLogger);
            sinon.assert.notCalled(errorLogger);
        });

        it('should log warning if interval is invalid and use default value', async () => {
            sinon.stub(ConfigUtil, 'get').returns(-1); // Invalid interval
            const observer = new InternalTxObserver(messengerMock, managerUuid, workerIndex);

            await observer.activate(1, 'round1');

            // Check if default interval was used
            expect(observer.updateInterval).to.equal(1000);
            sinon.assert.calledOnce(warnLogger);
        });
    });

    describe('Deactivating and stopping updates', () => {
        it('should deactivate the observer, stop updates and send final messages', async () => {
            sinon.stub(ConfigUtil, 'get').returns(1000);
            const observer = new InternalTxObserver(messengerMock, managerUuid, workerIndex);

            await observer.activate(1, 'round1');
            clock.tick(1000);

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
            sinon.stub(ConfigUtil, 'get').returns(1000);
            messengerMock.send.rejects(new Error('Send error'));
            const observer = new InternalTxObserver(messengerMock, managerUuid, workerIndex);

            await observer.activate(1, 'round1');
            clock.tick(1000);

            await expect(observer.deactivate()).to.be.rejectedWith('Send error');
            sinon.assert.calledOnce(errorLogger);
        });
    });

    it('should send the correct update message with the correct transaction count when activated', async () => {
        const observer = new InternalTxObserver(messengerMock, managerUuid, workerIndex);

        await observer.activate(1, 'round1');

        // Simulate 12 transactions being submitted
        observer.txSubmitted(12);
        clock.tick(1000);

        // Check if messenger.send was called
        sinon.assert.calledOnce(messengerMock.send);

        const messageSent = messengerMock.send.getCall(0).args[0];
        expect(messageSent).to.be.instanceOf(TxUpdateMessage);

        // Check the properties of the message
        expect(messageSent.sender).to.equal('mocked-messenger-uuid');
        expect(messageSent.recipients).to.deep.equal([managerUuid]);

        // Check the actual transaction counters after submission
        expect(messageSent.content.stats.txCounters.totalSubmitted).to.equal(12);
        expect(messageSent.content.type).to.equal('txUpdate');
    });
});
