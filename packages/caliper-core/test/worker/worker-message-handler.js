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
const sinon = require('sinon');
const chai = require('chai');
chai.should();
const EventEmitter = require('events');
const mockery = require('mockery');

const MessageTypes = require('../../lib/common/utils/constants').Messages.Types;
const ConnectedMessage = require('../../lib/common/messages/connectedMessage');
const AssignedMessage = require('../../lib/common/messages/assignedMessage');
const ReadyMessage = require('../../lib/common/messages/readyMessage');
const PreparedMessage = require('../../lib/common/messages/preparedMessage');
const TestResultMessage = require('../../lib/common/messages/testResultMessage');
const WorkerMessageHandler = require('../../lib/worker/worker-message-handler');
const CaliperWorker = require('../../lib/worker/caliper-worker');

describe('When receiving messages', () => {
    let messengerMock, connectorFactoryMock, workerMock, sandbox;
    beforeEach(() => {
        sandbox = sinon.createSandbox();
        messengerMock = new EventEmitter();
        messengerMock.on = sandbox.spy(messengerMock.on.bind(messengerMock));
        messengerMock.send = sandbox.stub();
        messengerMock.getUUID = sandbox.stub().returns('worker-uuid');

        connectorFactoryMock = sandbox.stub();

        workerMock = sinon.createStubInstance(CaliperWorker);

        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            useCleanCache: true
        });

        mockery.registerMock('./caliper-worker', {
            CaliperWorker: () => workerMock
        });
    });

    afterEach(() => {
        mockery.deregisterAll();
        mockery.disable();
        sandbox.restore();
    });

    it('should register the worker when receiving a "register" message', async () => {
        const handler = new WorkerMessageHandler(messengerMock, connectorFactoryMock);
        const message = {
            getType: () => MessageTypes.Register,
            getSender: () => 'manager-uuid',
            stringify: () => 'register message'
        };

        messengerMock.emit(MessageTypes.Register, message);
        await new Promise(setImmediate);

        sinon.assert.calledOnce(messengerMock.send);
        sinon.assert.calledWith(messengerMock.send, sinon.match.instanceOf(ConnectedMessage));
    });

    it('should assign the worker ID when receiving an "assignId" message', async () => {
        const handler = new WorkerMessageHandler(messengerMock, connectorFactoryMock);
        const message = {
            getType: () => MessageTypes.AssignId,
            getWorkerIndex: () => 1,
            stringify: () => 'assignId message'
        };
        messengerMock.emit(MessageTypes.AssignId, message);
        await new Promise(setImmediate);
        sinon.assert.calledOnce(messengerMock.send);
        sinon.assert.calledWith(messengerMock.send, sinon.match.instanceOf(AssignedMessage));
    });

    it('should initialize the worker when receiving an "initialize" message', async () => {
        connectorFactoryMock.resolves('connector-instance');
        const handler = new WorkerMessageHandler(messengerMock, connectorFactoryMock);
        const message = {
            getType: () => MessageTypes.Initialize,
            stringify: () => 'initialize message'
        };
        messengerMock.emit(MessageTypes.Initialize, message);
        await new Promise(setImmediate);
        sinon.assert.calledOnce(connectorFactoryMock);
        sinon.assert.calledOnce(messengerMock.send);
        sinon.assert.calledWith(messengerMock.send, sinon.match.instanceOf(ReadyMessage));
    });

    it('should prepare the test when receiving a "prepare" message', async () => {
        const handler = new WorkerMessageHandler(messengerMock, connectorFactoryMock);
        handler.worker = workerMock;
        const message = {
            getType: () => MessageTypes.Prepare,
            getRoundIndex: () => 0,
            stringify: () => 'prepare message'
        };

        workerMock.prepareTest.resolves();
        messengerMock.emit(MessageTypes.Prepare, message);
        await new Promise(setImmediate);
        sinon.assert.calledOnce(workerMock.prepareTest);
        sinon.assert.calledOnce(messengerMock.send);
        sinon.assert.calledWith(messengerMock.send, sinon.match.instanceOf(PreparedMessage));
    });

    it('should execute the test round when receiving a "test" message', async () => {
        const handler = new WorkerMessageHandler(messengerMock, connectorFactoryMock);
        handler.worker = workerMock;
        const message = {
            getType: () => MessageTypes.Test,
            getRoundIndex: () => 0,
            stringify: () => 'test message'
        };

        workerMock.executeRound.resolves();
        messengerMock.emit(MessageTypes.Test, message);
        await new Promise(setImmediate);
        sinon.assert.calledOnce(workerMock.executeRound);
        sinon.assert.calledOnce(messengerMock.send);
        sinon.assert.calledWith(messengerMock.send, sinon.match.instanceOf(TestResultMessage));
    });

    it('should resolve the exit promise when receiving an "exit" message', async () => {
        const handler = new WorkerMessageHandler(messengerMock, connectorFactoryMock);
        const message = {
            getType: () => MessageTypes.Exit,
            stringify: () => 'exit message'
        };

        const exitPromise = handler.waitForExit();
        messengerMock.emit(MessageTypes.Exit, message);
        await exitPromise;
    });
});

describe('When instantiating the worker message handler', () => {
    let messengerMock, connectorFactoryMock;

    beforeEach(() => {
        messengerMock = {
            on: sinon.stub(),
            send: sinon.stub(),
            getUUID: sinon.stub().returns('worker-uuid')
        };
        connectorFactoryMock = sinon.stub();
    });

    it('should throw an error if messenger is undefined', () => {
        (() => new WorkerMessageHandler(undefined, connectorFactoryMock))
            .should.throw('Messenger instance is undefined');
    });

    it('should throw an error if connectorFactory is undefined', () => {
        (() => new WorkerMessageHandler(messengerMock, undefined))
            .should.throw('Connector factory is undefined or not a function');
    });

    it('should throw an error if connectorFactory is not a function', () => {
        (() => new WorkerMessageHandler(messengerMock, {}))
            .should.throw('Connector factory is undefined or not a function');
    });
});
