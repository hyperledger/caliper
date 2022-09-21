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
     * @return {boolean} the fake path
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
            debug: sinon.stub(),
            error: sinon.stub()
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

    it('should set managerUuid passed through constructor', () => {
        const observer = new PrometheusManagerTxObserver.createTxObserver(undefined, undefined, undefined, 'fakeUuid');
        observer.managerUuid.should.equal('fakeUuid');
    });


    it('should send update message when TXs are submitted', () => {
        const senderUuid = 'senderUuid';
        const messenger = {
            getUUID: sinon.stub().returns(senderUuid),
            send: sinon.spy()
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

        observer.txSubmitted(txCount);

        sinon.assert.calledWith(messenger.send, sinon.match({
            content: sinon.match({
                event: 'txSubmitted',
                roundIndex: roundIndex,
                roundLabel: roundLabel,
                count: txCount,
            }),
            sender: senderUuid,
            recipients: sinon.match.array.contains([managerUuid])
        }));
    });

    it('should send update message when single TX is finished', () => {
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

        const observer = new PrometheusManagerTxObserver.createTxObserver(undefined, messenger, workerIndex, managerUuid);
        observer.messenger = messenger;
        observer.currentRound = roundIndex;
        observer.roundLabel = roundLabel;

        observer.txFinished(result);

        sinon.assert.calledWith(messenger.send, sinon.match({
            content: sinon.match({
                event: 'txFinished',
                roundIndex: roundIndex,
                roundLabel: roundLabel,
                status: 'success',
                latency: (timeFinal - timeCreate) / 1000,
            }),
            sender: senderUuid,
            recipients: sinon.match.array.contains([managerUuid])
        }));
    });

    it('should send update message when multiple TXs are finished', () => {
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

        const observer = new PrometheusManagerTxObserver.createTxObserver(undefined, messenger, workerIndex, managerUuid);
        observer.messenger = messenger;
        observer.currentRound = roundIndex;
        observer.roundLabel = roundLabel;

        observer.txFinished([result, result]);

        sinon.assert.calledWith(messenger.send, sinon.match({
            content: sinon.match({
                event: 'txFinished',
                roundIndex: roundIndex,
                roundLabel: roundLabel,
                status: 'success',
                latency: (timeFinal - timeCreate),
            }),
            sender: senderUuid,
            recipients: sinon.match.array.contains([managerUuid])
        }));
        sinon.assert.calledWith(messenger.send, sinon.match({
            content: sinon.match({
                event: 'txFinished',
                roundIndex: roundIndex,
                roundLabel: roundLabel,
                status: 'success',
                latency: (timeFinal - timeCreate),
            }),
            sender: senderUuid,
            recipients: sinon.match.array.contains([managerUuid])
        }));
    });
});
