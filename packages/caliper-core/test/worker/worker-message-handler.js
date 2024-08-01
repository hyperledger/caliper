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
const mockery = require('mockery');

const MessageTypes = require('../../lib/common/utils/constants').Messages.Types;
const ConnectedMessage = require('../../lib/common/messages/connectedMessage');
const AssignedMessage = require('../../lib/common/messages/assignedMessage');
const ReadyMessage = require('../../lib/common/messages/readyMessage');
const PreparedMessage = require('../../lib/common/messages/preparedMessage');
const TestResultMessage = require('../../lib/common/messages/testResultMessage');
const WorkerMessageHandler = require('../../lib/worker/worker-message-handler');
const CaliperWorker = require('../../lib/worker/caliper-worker');

describe('Message Handling Behavior', () => {
    let messengerMock, connectorFactoryMock, workerMock, sandbox;
    beforeEach(() => {
        sandbox = sinon.createSandbox();
        messengerMock = {
            on: sandbox.stub(),
            send: sandbox.stub(),
            getUUID: sandbox.stub().returns('worker-uuid')
        };

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
        sandbox.reset();
    });

    it('should register the worker when receiving a "register" message', async () => {
        new WorkerMessageHandler(messengerMock, connectorFactoryMock);
        const message = {
            getType: () => MessageTypes.Register,
            getSender: () => 'manager-uuid',
            stringify: () => 'register message'
        };

        const registerHandler = messengerMock.on.getCalls().find(call => call.args[0] === MessageTypes.Register).args[1];
        await registerHandler(message);

        sinon.assert.calledOnce(messengerMock.send);
        sinon.assert.calledWith(messengerMock.send, sinon.match.instanceOf(ConnectedMessage));
    });

    it('should assign the worker ID when receiving an "assignId" message', async () => {
        new WorkerMessageHandler(messengerMock, connectorFactoryMock);
        const message = {
            getType: () => MessageTypes.AssignId,
            getWorkerIndex: () => 1,
            stringify: () => 'assignId message'
        };


        const assignHandler = messengerMock.on.getCalls().find(call => call.args[0] === MessageTypes.AssignId).args[1];
        await assignHandler(message);

        sinon.assert.calledOnce(messengerMock.send);
        sinon.assert.calledWith(messengerMock.send, sinon.match.instanceOf(AssignedMessage));
    });

    it('should initialize the worker when receiving an "initialize" message', async () => {
        const handler = new WorkerMessageHandler(messengerMock, connectorFactoryMock);
        connectorFactoryMock.resolves('connector-instance');
        const message = {
            getType: () => MessageTypes.Initialize,
            stringify: () => 'initialize message'
        };

        const registeredHandler = messengerMock.on.getCalls().find(call => call.args[0] === MessageTypes.Initialize).args[1];
        await registeredHandler(message);

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

        const registeredHandler = messengerMock.on.getCalls().find(call => call.args[0] === MessageTypes.Prepare).args[1];
        await registeredHandler(message);

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

        const registeredHandler = messengerMock.on.getCalls().find(call => call.args[0] === MessageTypes.Test).args[1];
        await registeredHandler(message);


        sinon.assert.calledOnce(workerMock.executeRound);
        sinon.assert.calledOnce(messengerMock.send);
        sinon.assert.calledWith(messengerMock.send, sinon.match.instanceOf(TestResultMessage));
    });

    it('should resolve the exit promise when receiving an "exit" message', async () => {
        const handler = new WorkerMessageHandler(messengerMock, connectorFactoryMock);
        handler.exitPromiseFunctions.resolve = sandbox.stub();
        const message = {
            getType: () => MessageTypes.Exit,
            stringify: () => 'exit message'
        };


        const exitHandler = messengerMock.on.getCalls().find(call => call.args[0] === MessageTypes.Exit).args[1];
        await exitHandler(message);

        handler.exitPromiseFunctions.resolve.should.have.been.calledOnce;
    });

    it('should throw Error when constructor validations are violated', () => {
        const createHandler = (messenger, connectorFactory) => {
            return () => new WorkerMessageHandler(messenger, connectorFactory);
        };
        chai.expect(createHandler(undefined, connectorFactoryMock)).to.throw('Messenger instance is undefined');
        chai.expect(createHandler(messengerMock, undefined)).to.throw('Connector factory is undefined or not a function');
        chai.expect(createHandler(messengerMock, {})).to.throw('Connector factory is undefined or not a function');
    });
});
