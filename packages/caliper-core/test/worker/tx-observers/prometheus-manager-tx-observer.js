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
const mockery = require('mockery');
const sinon = require('sinon');
const expect = chai.expect;

const warnLogger = sinon.stub();
const errorLogger = sinon.stub();

/**
 * simulate Util
 */
class Utils {
    /**
     *
     * @param {*} path path
     * @return {string} the fake path
     */
    static resolvePath(path) {
        return 'fake/path';
    }

    /**
     *
     * @return {boolean} if the process is a forked process
     */
    static isForkedProcess() {
        return false;
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
     * @returns {*} logger stub
     */
    static getLogger() {
        return {
            warn: warnLogger,
            error: errorLogger
        };
    }

    /**
     * @param {*} url url
     * @returns {*} url
     */
    static augmentUrlWithBasicAuth(url) {
        return url;
    }
}

mockery.enable({
    warnOnReplace: false,
    warnOnUnregistered: false
});
mockery.registerMock('../../common/utils/caliper-utils', Utils);


describe('When using a PrometheusManagerTxObserver', () => {

    // Require here to enable mocks to be established
    const PrometheusManagerTxObserver = require('../../../lib/worker/tx-observers/prometheus-manager-tx-observer');

    after(()=> {
        mockery.deregisterAll();
        mockery.disable();
    });

    beforeEach(() => {
        warnLogger.reset();
        errorLogger.reset();
    });

    it('should set managerUuid passed through constructor', () => {
        const observer = new PrometheusManagerTxObserver.createTxObserver(undefined, undefined, undefined, 'fakeUuid');
        expect(observer.managerUuid).to.equal('fakeUuid');
    });

    it('should set the correct parameters when method is periodic', () => {
        const options = {
            method: 'periodic',
            interval: 1000,
        };
        const observer = new PrometheusManagerTxObserver.createTxObserver(options, undefined, undefined, 'fakeUuid');
        expect(observer.method).to.equal('periodic');
        expect(observer.updateInterval).to.equal(1000);
        expect(observer.intervalObject).to.equal(undefined);
    });

    it('should set the correct parameters when method is collate', () => {
        const options = {
            method: 'collate',
            collationCount: 10,
        };
        const observer = new PrometheusManagerTxObserver.createTxObserver(options, undefined, undefined, 'fakeUuid');
        expect(observer.method).to.equal('collate');
        expect(observer.collationCount).to.equal(10);
    });

    it('should set the default method when options are not provided', () => {
        const observer = new PrometheusManagerTxObserver.createTxObserver(undefined, undefined, undefined, 'fakeUuid');
        expect(observer.method).to.equal('periodic');
        expect(observer.updateInterval).to.equal(1000);
        expect(observer.intervalObject).to.equal(undefined);
    });

    it('should throw an error if an unknown method is specified', () => {
        const options = {
            method: 'profjgd'
        };
        expect(() => {
            new PrometheusManagerTxObserver.createTxObserver(options, undefined, undefined, 'fakeUuid');
        }).to.throw(/Unrecognised method 'profjgd' specified for prometheus manager, must be either 'collate' or 'periodic'/);
    });

    it('should use default update interval and print warning when method is periodic and interval is invalid', () => {
        const options = {
            method: 'periodic',
            interval: -1,
        };
        const observer = new PrometheusManagerTxObserver.createTxObserver(options, undefined, undefined, 'fakeUuid');
        expect(observer.method).to.equal('periodic');
        expect(observer.updateInterval).to.equal(1000);
        expect(observer.intervalObject).to.equal(undefined);
        sinon.assert.calledOnce(warnLogger);
    });

    it('should warn when collationCount is specified but method is periodic', () => {
        const options = {
            method: 'periodic',
            collationCount: 10,
        };
        const observer = new PrometheusManagerTxObserver.createTxObserver(options, undefined, undefined, 'fakeUuid');
        expect(observer.method).to.equal('periodic');
        sinon.assert.calledOnce(warnLogger);
    });

    it('should use default collationCount and print warning when method is collate and collationCount is invalid', () => {
        const options = {
            method: 'collate',
            collationCount: -1,
        };
        const observer = new PrometheusManagerTxObserver.createTxObserver(options, undefined, undefined, 'fakeUuid');
        expect(observer.method).to.equal('collate');
        expect(observer.collationCount).to.equal(10);
        sinon.assert.calledOnce(warnLogger);
    });

    it('should warn when interval is specified but method is collate', () => {
        const options = {
            method: 'collate',
            interval: 1000,
        };
        const observer = new PrometheusManagerTxObserver.createTxObserver(options, undefined, undefined, 'fakeUuid');
        expect(observer.method).to.equal('collate');
        sinon.assert.calledOnce(warnLogger);
    });


    it('should update the pending messages array when TXs are submitted', async () => {
        const senderUuid = 'senderUuid';
        const messenger = {
            getUUID: sinon.stub().returns(senderUuid),
            send: sinon.stub()
        };
        const workerIndex = 0;
        const roundIndex = 1;
        const roundLabel = 'roundLabel';
        const managerUuid = 'managerUuid';
        const txCount = 1;

        const observer = new PrometheusManagerTxObserver.createTxObserver(undefined, messenger, workerIndex, managerUuid);
        observer.messenger = messenger;
        observer.currentRound = roundIndex;
        observer.roundLabel = roundLabel;

        await observer.txSubmitted(txCount);

        expect(observer.pendingMessages).to.have.lengthOf(1);
    });

    it('should update the pending messages array when single TX is finished', async () => {
        const senderUuid = 'senderUuid';
        const messenger = {
            getUUID: sinon.stub().returns(senderUuid),
            send: sinon.stub()
        };
        const workerIndex = 0;
        const roundIndex = 1;
        const roundLabel = 'roundLabel';
        const managerUuid = 'managerUuid';
        const timeFinal = 1000;
        const timeCreate = 0;

        const result = {
            GetStatus: sinon.stub().returns('success'),
            GetTimeFinal: sinon.stub().returns(timeFinal),
            GetTimeCreate: sinon.stub().returns(timeCreate),
        };

        const observer = new PrometheusManagerTxObserver.createTxObserver(undefined, messenger, workerIndex, managerUuid);
        observer.messenger = messenger;
        observer.currentRound = roundIndex;
        observer.roundLabel = roundLabel;

        await observer.txFinished(result);

        expect(observer.pendingMessages).to.have.lengthOf(1);
    });

    it('should update the pending messages array when multiple TXs are finished', async () => {
        const senderUuid = 'senderUuid';
        const messenger = {
            getUUID: sinon.stub().returns(senderUuid),
            send: sinon.stub()
        };
        const workerIndex = 0;
        const roundIndex = 1;
        const roundLabel = 'roundLabel';
        const managerUuid = 'managerUuid';
        const timeFinal = 1000;
        const timeCreate = 0;

        const result = {
            GetStatus: sinon.stub().returns('success'),
            GetTimeFinal: sinon.stub().returns(timeFinal),
            GetTimeCreate: sinon.stub().returns(timeCreate),
        };

        const observer = new PrometheusManagerTxObserver.createTxObserver(undefined, messenger, workerIndex, managerUuid);
        observer.messenger = messenger;
        observer.currentRound = roundIndex;
        observer.roundLabel = roundLabel;

        await observer.txFinished([result, result]);

        expect(observer.pendingMessages).to.have.lengthOf(2);
    });

    it('should trigger update when collationCount is crossed with the collate method', async () => {
        const senderUuid = 'senderUuid';
        const messenger = {
            getUUID: sinon.stub().returns(senderUuid),
            send: sinon.stub()
        };
        const workerIndex = 0;
        const roundIndex = 1;
        const roundLabel = 'roundLabel';
        const managerUuid = 'managerUuid';
        const timeFinal = 1000;
        const timeCreate = 0;

        const result = {
            GetStatus: sinon.stub().returns('success'),
            GetTimeFinal: sinon.stub().returns(timeFinal),
            GetTimeCreate: sinon.stub().returns(timeCreate),
        };

        const options = {
            method: 'collate',
            collationCount: 2,
        };

        const observer = new PrometheusManagerTxObserver.createTxObserver(options, messenger, workerIndex, managerUuid);
        observer.messenger = messenger;
        observer.currentRound = roundIndex;
        observer.roundLabel = roundLabel;

        observer._sendUpdate = sinon.spy();

        await observer.txFinished([result, result]);

        expect(observer._sendUpdate).to.have.been.calledOnce;
    });

    it('should not trigger update until collation count is reached with method collate', async () => {
        const senderUuid = 'senderUuid';
        const messenger = {
            getUUID: sinon.stub().returns(senderUuid),
            send: sinon.stub()
        };
        const workerIndex = 0;
        const roundIndex = 1;
        const roundLabel = 'roundLabel';
        const managerUuid = 'managerUuid';
        const timeFinal = 1000;
        const timeCreate = 0;

        const result = {
            GetStatus: sinon.stub().returns('success'),
            GetTimeFinal: sinon.stub().returns(timeFinal),
            GetTimeCreate: sinon.stub().returns(timeCreate),
        };

        const options = {
            method: 'collate',
            collationCount: 2,
        };

        const observer = new PrometheusManagerTxObserver.createTxObserver(options, messenger, workerIndex, managerUuid);
        observer.messenger = messenger;
        observer.currentRound = roundIndex;
        observer.roundLabel = roundLabel;

        observer._sendUpdate = sinon.spy();

        await observer.txFinished(result);

        expect(observer._sendUpdate).to.not.have.been.called;
    });

    it('should send pending messages when collation count is reached with method collate', async () => {
        const senderUuid = 'senderUuid';
        const messenger = {
            getUUID: sinon.stub().returns(senderUuid),
            send: sinon.spy()
        };
        const workerIndex = 0;
        const roundIndex = 1;
        const roundLabel = 'roundLabel';
        const managerUuid = 'managerUuid';
        const timeFinal = 1000;
        const timeCreate = 0;

        const result = {
            GetStatus: sinon.stub().returns('success'),
            GetTimeFinal: sinon.stub().returns(timeFinal),
            GetTimeCreate: sinon.stub().returns(timeCreate),
        };

        const options = {
            method: 'collate',
            collationCount: 2,
        };

        const observer = new PrometheusManagerTxObserver.createTxObserver(options, messenger, workerIndex, managerUuid);
        observer.messenger = messenger;
        observer.currentRound = roundIndex;
        observer.roundLabel = roundLabel;

        await observer.txFinished([result, result]);

        expect(messenger.send).to.have.been.calledTwice;
    });

    it('should clear pending messages when collation count is reached with method collate', async () => {
        const senderUuid = 'senderUuid';
        const messenger = {
            getUUID: sinon.stub().returns(senderUuid),
            send: sinon.stub()
        };
        const workerIndex = 0;
        const roundIndex = 1;
        const roundLabel = 'roundLabel';
        const managerUuid = 'managerUuid';
        const timeFinal = 1000;
        const timeCreate = 0;

        const result = {
            GetStatus: sinon.stub().returns('success'),
            GetTimeFinal: sinon.stub().returns(timeFinal),
            GetTimeCreate: sinon.stub().returns(timeCreate),
        };

        const options = {
            method: 'collate',
            collationCount: 2,
        };

        const observer = new PrometheusManagerTxObserver.createTxObserver(options, messenger, workerIndex, managerUuid);
        observer.messenger = messenger;
        observer.currentRound = roundIndex;
        observer.roundLabel = roundLabel;

        await observer.txFinished([result, result]);

        expect(observer.pendingMessages).to.have.lengthOf(0);
    });

    it('should setup interval timer with method periodic', async () => {
        const senderUuid = 'senderUuid';
        const messenger = {
            getUUID: sinon.stub().returns(senderUuid),
            send: sinon.stub()
        };
        const workerIndex = 0;
        const roundIndex = 1;
        const roundLabel = 'roundLabel';
        const managerUuid = 'managerUuid';

        const options = {
            method: 'periodic',
            interval: 1000,
        };

        const observer = new PrometheusManagerTxObserver.createTxObserver(options, messenger, workerIndex, managerUuid);
        observer.messenger = messenger;
        observer.currentRound = roundIndex;
        observer.roundLabel = roundLabel;

        await observer.activate(roundIndex, roundLabel);

        expect(observer.intervalObject).to.not.be.undefined;
    });

    it('should trigger update when interval is exceeded with method periodic', async () => {
        const clock = sinon.useFakeTimers();

        const senderUuid = 'senderUuid';
        const messenger = {
            getUUID: sinon.stub().returns(senderUuid),
            send: sinon.stub()
        };
        const workerIndex = 0;
        const roundIndex = 1;
        const roundLabel = 'roundLabel';
        const managerUuid = 'managerUuid';
        const timeFinal = 1000;
        const timeCreate = 0;

        const result = {
            GetStatus: sinon.stub().returns('success'),
            GetTimeFinal: sinon.stub().returns(timeFinal),
            GetTimeCreate: sinon.stub().returns(timeCreate),
        };

        const options = {
            method: 'periodic',
            interval: 1000,
        };

        const observer = new PrometheusManagerTxObserver.createTxObserver(options, messenger, workerIndex, managerUuid);
        observer.messenger = messenger;
        observer.currentRound = roundIndex;
        observer.roundLabel = roundLabel;

        observer._sendUpdate = sinon.spy();

        await observer.activate(roundIndex, roundLabel);
        await observer.txFinished(result);

        expect(observer._sendUpdate).to.not.have.been.called;

        clock.tick(1000);

        expect(observer._sendUpdate).to.have.been.calledOnce;

        clock.restore();
    });

    it('should send pending messages when interval is exceeded with method periodic', async () => {
        const clock = sinon.useFakeTimers();

        const senderUuid = 'senderUuid';
        const messenger = {
            getUUID: sinon.stub().returns(senderUuid),
            send: sinon.spy()
        };
        const workerIndex = 0;
        const roundIndex = 1;
        const roundLabel = 'roundLabel';
        const managerUuid = 'managerUuid';
        const timeFinal = 1000;
        const timeCreate = 0;

        const result = {
            GetStatus: sinon.stub().returns('success'),
            GetTimeFinal: sinon.stub().returns(timeFinal),
            GetTimeCreate: sinon.stub().returns(timeCreate),
        };

        const options = {
            method: 'periodic',
            interval: 1000,
        };

        const observer = new PrometheusManagerTxObserver.createTxObserver(options, messenger, workerIndex, managerUuid);
        observer.messenger = messenger;
        observer.currentRound = roundIndex;
        observer.roundLabel = roundLabel;

        await observer.activate(roundIndex, roundLabel);
        await observer.txFinished(result);

        expect(messenger.send).to.not.have.been.called;

        clock.tick(1000);

        expect(messenger.send).to.have.been.calledOnce;

        clock.restore();
    });

    it('should clear pending messages when interval is exceeded with method periodic', async () => {
        const clock = sinon.useFakeTimers();

        const senderUuid = 'senderUuid';
        const messenger = {
            getUUID: sinon.stub().returns(senderUuid),
            send: sinon.stub()
        };
        const workerIndex = 0;
        const roundIndex = 1;
        const roundLabel = 'roundLabel';
        const managerUuid = 'managerUuid';
        const timeFinal = 1000;
        const timeCreate = 0;

        const result = {
            GetStatus: sinon.stub().returns('success'),
            GetTimeFinal: sinon.stub().returns(timeFinal),
            GetTimeCreate: sinon.stub().returns(timeCreate),
        };

        const options = {
            method: 'periodic',
            interval: 1000,
        };

        const observer = new PrometheusManagerTxObserver.createTxObserver(options, messenger, workerIndex, managerUuid);
        observer.messenger = messenger;
        observer.currentRound = roundIndex;
        observer.roundLabel = roundLabel;

        await observer.activate(roundIndex, roundLabel);
        await observer.txFinished(result);

        expect(observer.pendingMessages).to.have.lengthOf(1);

        clock.tick(1000);

        expect(observer.pendingMessages).to.have.lengthOf(0);

        clock.restore();
    });

    it('should clear interval timer when deactivated with method periodic', async () => {
        const clock = sinon.useFakeTimers();

        const senderUuid = 'senderUuid';
        const messenger = {
            getUUID: sinon.stub().returns(senderUuid),
            send: sinon.stub()
        };
        const workerIndex = 0;
        const roundIndex = 1;
        const roundLabel = 'roundLabel';
        const managerUuid = 'managerUuid';

        const options = {
            method: 'periodic',
            interval: 1000,
        };

        const observer = new PrometheusManagerTxObserver.createTxObserver(options, messenger, workerIndex, managerUuid);
        observer.messenger = messenger;
        observer.currentRound = roundIndex;
        observer.roundLabel = roundLabel;

        await observer.activate(roundIndex, roundLabel);
        await observer.deactivate();

        expect(observer.intervalObject).to.be.undefined;

        clock.restore();
    });

    it('should send pending messages when deactivated', async () => {
        const clock = sinon.useFakeTimers();

        const senderUuid = 'senderUuid';
        const messenger = {
            getUUID: sinon.stub().returns(senderUuid),
            send: sinon.spy()
        };
        const workerIndex = 0;
        const roundIndex = 1;
        const roundLabel = 'roundLabel';
        const managerUuid = 'managerUuid';
        const timeFinal = 1000;
        const timeCreate = 0;

        const result = {
            GetStatus: sinon.stub().returns('success'),
            GetTimeFinal: sinon.stub().returns(timeFinal),
            GetTimeCreate: sinon.stub().returns(timeCreate),
        };

        const options = {
            method: 'periodic',
            interval: 1000,
        };

        const observer = new PrometheusManagerTxObserver.createTxObserver(options, messenger, workerIndex, managerUuid);
        observer.messenger = messenger;
        observer.currentRound = roundIndex;
        observer.roundLabel = roundLabel;

        await observer.activate(roundIndex, roundLabel);
        await observer.txFinished(result);

        expect(messenger.send).to.not.have.been.called;

        await observer.deactivate();

        expect(messenger.send).to.have.been.calledOnce;

        clock.restore();
    });
});
