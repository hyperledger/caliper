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

const loggerSandbox = sinon.createSandbox();
const CaliperUtils = require('../../lib/common/utils/caliper-utils');
loggerSandbox.replace(CaliperUtils, "getLogger", () => {
    return {
        debug: sinon.stub(),
        error: sinon.stub(),
        warn: sinon.stub(),
        info: sinon.stub()
    };
});

const { ConnectorBase, TxStatus } = require('../..');
const Events = require('../../lib/common/utils/constants').Events.Connector;

class MockConnector extends ConnectorBase {
    async _sendSingleRequest(request) {
        if (request instanceof Error) {
            throw request;
        }
        return request;
    }
}

describe('the base connector implementation', () => {
    after(() => {
        loggerSandbox.restore();
    });

    describe('on sending requests', () => {
        let mockConnector;
        let emitSpy;
        const txStatus = new TxStatus();
        const txStatus2 = new TxStatus();
        const txStatus3 = new TxStatus();
        beforeEach(() => {
            mockConnector = new MockConnector(1, 'mock');
            emitSpy = sinon.spy(mockConnector, 'emit');
        })

        it('should process a single request that returns a transaction status result', async() => {
            const result = await mockConnector.sendRequests(txStatus);

            result.should.equal(txStatus);
            sinon.assert.calledTwice(emitSpy);
            sinon.assert.calledWith(emitSpy.firstCall, Events.TxsSubmitted, 1);
            sinon.assert.calledWith(emitSpy.secondCall, Events.TxsFinished, txStatus);
        });

        it('should process a single request that throws an error', async() => {
            await mockConnector.sendRequests(new Error('some failure')).should.be.rejectedWith(/some failure/);

            sinon.assert.calledTwice(emitSpy);
            sinon.assert.calledWith(emitSpy.firstCall, Events.TxsSubmitted, 1);
            sinon.assert.calledWith(emitSpy.secondCall, Events.TxsFinished, sinon.match.instanceOf(TxStatus));
        });

        it('should process multiple requests that where they all return a transaction status result', async() => {
            const result = await mockConnector.sendRequests([txStatus, txStatus2, txStatus3]);
            result.should.deep.equal([txStatus, txStatus2, txStatus3]);
            sinon.assert.callCount(emitSpy, 4);
            sinon.assert.calledWith(emitSpy.firstCall, Events.TxsSubmitted, 1);
            sinon.assert.calledWith(emitSpy.secondCall, Events.TxsSubmitted, 1);
            sinon.assert.calledWith(emitSpy.thirdCall, Events.TxsSubmitted, 1);
            sinon.assert.calledWith(emitSpy.getCall(3), Events.TxsFinished, [txStatus, txStatus2, txStatus3]);
        });

        it('should process multiple requests where some return an error', async() => {
            await mockConnector.sendRequests([new Error('error 1'), txStatus2, new Error('error 4'), txStatus3]).should.be.rejectedWith(/error 1/);
            sinon.assert.callCount(emitSpy, 5);
            sinon.assert.calledWith(emitSpy.firstCall, Events.TxsSubmitted, 1);
            sinon.assert.calledWith(emitSpy.secondCall, Events.TxsSubmitted, 1);
            sinon.assert.calledWith(emitSpy.thirdCall, Events.TxsSubmitted, 1);
            sinon.assert.calledWith(emitSpy.getCall(3), Events.TxsSubmitted, 1);
            sinon.assert.calledWith(emitSpy.getCall(4), Events.TxsFinished, [sinon.match.instanceOf(TxStatus), sinon.match.instanceOf(TxStatus), sinon.match.instanceOf(TxStatus), sinon.match.instanceOf(TxStatus)]);
        });

        it('should process multiple requests where all return an error', async() => {
            await mockConnector.sendRequests([new Error('error 1'), new Error('error 2'), new Error('error 3')]).should.be.rejectedWith(/error 1/);
            sinon.assert.callCount(emitSpy, 4);
            sinon.assert.calledWith(emitSpy.firstCall, Events.TxsSubmitted, 1);
            sinon.assert.calledWith(emitSpy.secondCall, Events.TxsSubmitted, 1);
            sinon.assert.calledWith(emitSpy.thirdCall, Events.TxsSubmitted, 1);
            sinon.assert.calledWith(emitSpy.getCall(3), Events.TxsFinished, [sinon.match.instanceOf(TxStatus), sinon.match.instanceOf(TxStatus), sinon.match.instanceOf(TxStatus)]);
        });
    });
});
