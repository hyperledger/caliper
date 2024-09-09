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
            txFinished: sinon.stub(),
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

            expect(internalObserver.activate.calledOnce).to.be.true;
            dispatcher.txObservers.forEach(observer => {
                expect(observer.activate.calledOnce).to.be.true;
            });
        });
    });

    describe('When Deactivation', function() {
        it('should deactivate all registered observers', async function() {
            await dispatcher.activate(0, 'test-round');
            // Deactivate the dispatcher
            await dispatcher.deactivate();
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

            // Ensure each observer's txSubmitted method was called with the correct count
            dispatcher.txObservers.forEach(observer => {
                expect(observer.txSubmitted.calledWith(5)).to.be.true;
            });
        });


        it('should not forward the transaction submission event to observers if the dispatcher is not active', function() {
            dispatcher.active = false;
            dispatcher.txSubmitted(5);

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

            dispatcher.txObservers.forEach(observer => {
                expect(observer.txFinished.called).to.be.false;
            });
        });
    });
});
