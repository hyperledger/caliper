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
const expect = chai.expect;

const TxObserverDispatch = require('../../../lib/worker/tx-observers/tx-observer-dispatch');
const TxObserverInterface = require('../../../lib/worker/tx-observers/tx-observer-interface');
const CaliperUtils = require('../../../lib/common/utils/caliper-utils');
const { TxStatus } = require('../../../');

describe('Transaction Observer Dispatch behavior', function() {
    let mockMessenger;
    let internalObserver;
    let dispatcher;
    let mockFactory;

    beforeEach(function() {
        // Mocks and stubs
        mockMessenger = sinon.stub();
        internalObserver = sinon.createStubInstance(TxObserverInterface);

        // Mock a factory function for creating TX observers
        mockFactory = sinon.stub().returns({
            activate: sinon.stub(),
            deactivate: sinon.stub(),
            txSubmitted: sinon.stub(),
            txFinished: sinon.spy(),
        });

        // Stub the utils to return the mock factory function
        sinon.stub(CaliperUtils, 'loadModuleFunction').returns(mockFactory);

        // Instantiate the dispatcher
        dispatcher = new TxObserverDispatch(mockMessenger, internalObserver, 'managerUuid', 1);
    });

    afterEach(function() {
        // Restore any stubs or mocks
        sinon.restore();
    });

    describe('When Activated', function() {
        it('should activate all registered observers', async function() {
            await dispatcher.activate(0, 'test-round');

            // Ensure txObservers is not empty
            expect(dispatcher.txObservers).to.not.be.empty;
            expect(internalObserver.activate.calledOnce).to.be.true;
            dispatcher.txObservers.forEach(observer => {
                expect(observer.activate.calledOnce).to.be.true;
            });
        });
    });

    describe('When Deactivated', function() {
        it('should deactivate all registered observers', async function() {
            await dispatcher.activate(0, 'test-round');
            // Deactivate the dispatcher
            await dispatcher.deactivate();

            // Ensure txObservers is not empty
            expect(dispatcher.txObservers).to.not.be.empty;
            expect(internalObserver.deactivate.calledOnce).to.be.true;
            dispatcher.txObservers.forEach(observer => {
                expect(observer).to.have.property('deactivate');
                expect(observer.deactivate.calledOnce).to.be.true;
            });
        });

    });

    describe('When Transaction is Submitted', function() {
        it('should forward the transaction submission event to all observers after the dispatcher is activated', async function() {
            // Activate the dispatcher first
            await dispatcher.activate(0, 'test-round');

            // Call txSubmitted
            dispatcher.txSubmitted(5);


            // Ensure txObservers is not empty
            expect(dispatcher.txObservers).to.not.be.empty;
            // Ensure each observer's txSubmitted method was called with the correct count
            dispatcher.txObservers.forEach(observer => {
                expect(observer.txSubmitted.calledWith(5)).to.be.true;
            });
        });


        it('should not forward the transaction submission event to observers if the dispatcher is not active', function() {
            dispatcher.active = false;
            dispatcher.txSubmitted(5);

            // Ensure txObservers is not empty
            expect(dispatcher.txObservers).to.not.be.empty;
            dispatcher.txObservers.forEach(observer => {
                expect(observer.txSubmitted.called).to.be.false;
            });
        });

    });

    describe('When Transaction is Completed', function() {
        it('should forward the transaction completion event to all observers after the dispatcher is activated', async function() {
            const mockResult = { status: 'success' };

            // Activate the dispatcher first
            await dispatcher.activate(0, 'test-round');

            // Call txFinished
            dispatcher.txFinished(mockResult);


            // Ensure txObservers is not empty
            expect(dispatcher.txObservers).to.not.be.empty;
            // Ensure each observer's txFinished method was called with the correct result
            dispatcher.txObservers.forEach(observer => {
                expect(observer.txFinished.calledWith(sinon.match({
                    status: 'success',
                    workerIndex: dispatcher.workerIndex,
                    roundIndex: dispatcher.currentRound,
                }))).to.be.true;
            });
        });

        it('should not forward the transaction completion event to observers if the dispatcher is not active', function() {
            dispatcher.active = false;
            const mockResult = { status: 'success' };
            dispatcher.txFinished(mockResult);


            // Ensure txObservers is not empty
            expect(dispatcher.txObservers).to.not.be.empty;
            dispatcher.txObservers.forEach(observer => {
                expect(observer.txFinished.called).to.be.false;
            });
        });

        it('should correctly process a single TxStatus object', async function() {
            // Create a TxStatus object with a string result field
            const txStatus = new TxStatus('tx1');
            txStatus.SetStatusSuccess();
            txStatus.result = 'Some string result';

            // Activate the dispatcher first
            await dispatcher.activate(0, 'test-round');

            // Call txFinished with the TxStatus object
            dispatcher.txFinished(txStatus);

            // Ensure txObservers is not empty
            expect(dispatcher.txObservers).to.not.be.empty;

            // Assert that txStatus now has workerIndex and roundIndex set
            expect(txStatus.workerIndex).to.equal(dispatcher.workerIndex);
            expect(txStatus.roundIndex).to.equal(dispatcher.currentRound);

            dispatcher.txObservers.forEach(observer => {
                expect(observer.txFinished.calledOnce).to.be.true;
                const calledArg = observer.txFinished.getCall(0).args[0];
                expect(calledArg).to.equal(txStatus);
            });
        });

        it('should correctly process an array of TxStatus objects', async function() {
            const txStatus1 = new TxStatus('tx1');
            txStatus1.SetStatusSuccess();
            txStatus1.result = 'Result 1';

            const txStatus2 = new TxStatus('tx2');
            txStatus2.SetStatusFail();
            txStatus2.result = 'Result 2';

            const resultsArray = [txStatus1, txStatus2];
            await dispatcher.activate(0, 'test-round');

            dispatcher.txFinished(resultsArray);
            expect(dispatcher.txObservers).to.not.be.empty;

            resultsArray.forEach(txStatus => {
                expect(txStatus.workerIndex).to.equal(dispatcher.workerIndex);
                expect(txStatus.roundIndex).to.equal(dispatcher.currentRound);
            });

            dispatcher.txObservers.forEach(observer => {
                expect(observer.txFinished.calledOnce).to.be.true;
                const calledArg = observer.txFinished.getCall(0).args[0];
                expect(calledArg).to.deep.equal(resultsArray);
            });
        });


    });
});
