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

const TransactionStatisticsCollector = require('../../../lib/common/core/transaction-statistics-collector');
const TxStatus = require('../../../lib/common/core/transaction-status');

const chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('TransactionStatisticsCollector implementation', () => {

    let sandbox;
    let clock;

    beforeEach(function() {
        sandbox = sinon.createSandbox();
        clock = sandbox.useFakeTimers();
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe('Using a single TransactionStatisticsCollector to collect results', () => {

        it('should be possible to get basic round information from the collector', () => {
            const transactionStatisticsCollector = new TransactionStatisticsCollector(0, 1, 'roundLabel');

            transactionStatisticsCollector.getWorkerIndex().should.equal(0);
            transactionStatisticsCollector.getRoundIndex().should.equal(1);
            transactionStatisticsCollector.getRoundLabel().should.equal('roundLabel');
        });

        it('should not be possible to update a TransactionStatisticsCollector submission count if it is not activated', () => {
            const transactionStatisticsCollector = new TransactionStatisticsCollector();

            transactionStatisticsCollector.txSubmitted(1);
            transactionStatisticsCollector.getTotalSubmittedTx().should.equal(0);
        });

        it('should not be possible to update a TransactionStatisticsCollector finished count if it is not activated', () => {
            const transactionStatisticsCollector = new TransactionStatisticsCollector();

            const updateSpy = sandbox.spy(transactionStatisticsCollector, '_updateStatistics');

            const txStatus = new TxStatus();
            transactionStatisticsCollector.txFinished(txStatus);
            sinon.assert.notCalled(updateSpy);
        });

        it('should be possible to update a TransactionStatisticsCollector with a single submission count once activated', () => {
            const transactionStatisticsCollector = new TransactionStatisticsCollector();
            transactionStatisticsCollector.activate();

            transactionStatisticsCollector.txSubmitted(1);
            transactionStatisticsCollector.getTotalSubmittedTx().should.equal(1);
        });

        it('should be possible to update a TransactionStatisticsCollector with a multiple submission counts once activated', () => {
            const transactionStatisticsCollector = new TransactionStatisticsCollector();
            transactionStatisticsCollector.activate();

            transactionStatisticsCollector.txSubmitted(7);
            transactionStatisticsCollector.getTotalSubmittedTx().should.equal(7);
        });

        it('should be possible to update a TransactionStatisticsCollector with a TxStatus result once activated', () => {
            const transactionStatisticsCollector = new TransactionStatisticsCollector();
            transactionStatisticsCollector.activate();

            const updateSpy = sandbox.spy(transactionStatisticsCollector, '_updateStatistics');

            // Must increment time for it to be valid
            clock.tick(50);
            const txStatus = new TxStatus();
            transactionStatisticsCollector.txFinished(txStatus);
            sinon.assert.calledOnce(updateSpy);
        });

        it('should be possible to update a TransactionStatisticsCollector with an array of TxStatus results once activated', () => {
            const transactionStatisticsCollector = new TransactionStatisticsCollector();
            transactionStatisticsCollector.activate();

            const updateSpy = sandbox.spy(transactionStatisticsCollector, '_updateStatistics');

            // Must increment time for it to be valid
            clock.tick(50);
            const txStatus = new TxStatus();
            transactionStatisticsCollector.txFinished([txStatus, txStatus]);
            sinon.assert.calledTwice(updateSpy);
        });

        it('should not be possible to update a TransactionStatisticsCollector with a transaction submission once deactivated', () => {
            const transactionStatisticsCollector = new TransactionStatisticsCollector();
            transactionStatisticsCollector.activate();

            transactionStatisticsCollector.txSubmitted(1);
            transactionStatisticsCollector.getTotalSubmittedTx().should.equal(1);

            transactionStatisticsCollector.deactivate();

            // submit again and check not incremented
            transactionStatisticsCollector.txSubmitted(1);
            transactionStatisticsCollector.getTotalSubmittedTx().should.equal(1);
        });

        it('should not be possible to update a TransactionStatisticsCollector with a TxStatus result once deactivated', () => {
            const transactionStatisticsCollector = new TransactionStatisticsCollector();
            transactionStatisticsCollector.activate();

            const updateSpy = sandbox.spy(transactionStatisticsCollector, '_updateStatistics');

            // require time delta so that the result is deemed relevant
            clock.tick(50);
            const txStatus0 = new TxStatus();
            const txStatus1 = new TxStatus();
            transactionStatisticsCollector.txFinished(txStatus0);

            // Deactivate (sets end time)
            transactionStatisticsCollector.deactivate();

            // extend time again
            clock.tick(25);
            transactionStatisticsCollector.txFinished(txStatus1);

            sinon.assert.calledOnce(updateSpy);
            transactionStatisticsCollector.getRoundFinishTime().should.equal(50);
        });

    });

    describe('Updating a TransactionStatisticsCollector with a TxStatus result', () => {

        it('should update successful transactions', () => {
            const transactionStatisticsCollector = new TransactionStatisticsCollector();
            transactionStatisticsCollector.activate();

            clock.tick(50);
            const txStatus = new TxStatus();

            // require time delta so that the result is deemed relevant
            clock.tick(50);
            txStatus.SetStatusSuccess();

            transactionStatisticsCollector.txFinished(txStatus);

            // Common transaction statistics
            transactionStatisticsCollector.getTotalSuccessfulTx().should.equal(1);
            transactionStatisticsCollector.getFirstCreateTime().should.equal(txStatus.GetTimeCreate());
            transactionStatisticsCollector.getLastCreateTime().should.equal(txStatus.GetTimeCreate());
            transactionStatisticsCollector.getFirstFinishTime().should.equal(txStatus.GetTimeFinal());
            transactionStatisticsCollector.getLastFinishTime().should.equal(txStatus.GetTimeFinal());

            // Successful transaction statistics
            transactionStatisticsCollector.getTotalFinishedTx().should.equal(1);
            transactionStatisticsCollector.getMinLatencyForSuccessful().should.equal(txStatus.GetTimeFinal() - txStatus.GetTimeCreate());
            transactionStatisticsCollector.getMaxLatencyForSuccessful().should.equal(txStatus.GetTimeFinal() - txStatus.GetTimeCreate());
            transactionStatisticsCollector.getTotalLatencyForSuccessful().should.equal(txStatus.GetTimeFinal() - txStatus.GetTimeCreate());

            // Failed transaction statistics (nothing should have failed)
            transactionStatisticsCollector.getTotalFailedTx().should.equal(0);
            transactionStatisticsCollector.getMinLatencyForFailed().should.equal(Number.MAX_SAFE_INTEGER);
            transactionStatisticsCollector.getMaxLatencyForFailed().should.equal(0);
            transactionStatisticsCollector.getTotalLatencyForFailed().should.equal(0);
        });

        it('should update failed transactions', () => {
            const transactionStatisticsCollector = new TransactionStatisticsCollector();
            transactionStatisticsCollector.activate();

            clock.tick(50);
            const txStatus = new TxStatus();

            // require time delta so that the result is deemed relevant
            clock.tick(50);
            txStatus.SetStatusFail();

            transactionStatisticsCollector.txFinished(txStatus);

            // Common transaction statistics
            transactionStatisticsCollector.getTotalFailedTx().should.equal(1);
            transactionStatisticsCollector.getFirstCreateTime().should.equal(txStatus.GetTimeCreate());
            transactionStatisticsCollector.getLastCreateTime().should.equal(txStatus.GetTimeCreate());
            transactionStatisticsCollector.getFirstFinishTime().should.equal(txStatus.GetTimeFinal());
            transactionStatisticsCollector.getLastFinishTime().should.equal(txStatus.GetTimeFinal());

            // Failed transaction statistics
            transactionStatisticsCollector.getTotalFinishedTx().should.equal(1);
            transactionStatisticsCollector.getMinLatencyForFailed().should.equal(txStatus.GetTimeFinal() - txStatus.GetTimeCreate());
            transactionStatisticsCollector.getMaxLatencyForFailed().should.equal(txStatus.GetTimeFinal() - txStatus.GetTimeCreate());
            transactionStatisticsCollector.getTotalLatencyForFailed().should.equal(txStatus.GetTimeFinal() - txStatus.GetTimeCreate());

            // Successful transaction statistics (nothing should have passed)
            transactionStatisticsCollector.getTotalSuccessfulTx().should.equal(0);
            transactionStatisticsCollector.getMinLatencyForSuccessful().should.equal(Number.MAX_SAFE_INTEGER);
            transactionStatisticsCollector.getMaxLatencyForSuccessful().should.equal(0);
            transactionStatisticsCollector.getTotalLatencyForSuccessful().should.equal(0);
        });

        it('should be possible update with an array of successful transactions', () => {

            const transactionStatisticsCollector = new TransactionStatisticsCollector();
            transactionStatisticsCollector.activate();

            // require time delta so that the result is deemed relevant
            clock.tick(50);
            const txStatus0 = new TxStatus();
            clock.tick(25);
            const txStatus1 = new TxStatus();
            txStatus0.SetStatusSuccess();
            clock.tick(100);
            txStatus1.SetStatusSuccess();

            transactionStatisticsCollector.txFinished([txStatus0, txStatus1]);

            // Common transaction statistics
            transactionStatisticsCollector.getFirstCreateTime().should.equal(txStatus0.GetTimeCreate());
            transactionStatisticsCollector.getLastCreateTime().should.equal(txStatus1.GetTimeCreate());
            transactionStatisticsCollector.getFirstFinishTime().should.equal(txStatus0.GetTimeFinal());
            transactionStatisticsCollector.getLastFinishTime().should.equal(txStatus1.GetTimeFinal());

            // Successful transaction statistics
            transactionStatisticsCollector.getTotalSuccessfulTx().should.equal(2);
            transactionStatisticsCollector.getMinLatencyForSuccessful().should.equal(txStatus0.GetTimeFinal() - txStatus0.GetTimeCreate());
            transactionStatisticsCollector.getMaxLatencyForSuccessful().should.equal(txStatus1.GetTimeFinal() - txStatus1.GetTimeCreate());
            transactionStatisticsCollector.getTotalLatencyForSuccessful().should.equal((txStatus0.GetTimeFinal() - txStatus0.GetTimeCreate()) + (txStatus1.GetTimeFinal() - txStatus1.GetTimeCreate()));

            // Failed transaction statistics (nothing should have failed)
            transactionStatisticsCollector.getTotalFailedTx().should.equal(0);
            transactionStatisticsCollector.getMinLatencyForFailed().should.equal(Number.MAX_SAFE_INTEGER);
            transactionStatisticsCollector.getMaxLatencyForFailed().should.equal(0);
            transactionStatisticsCollector.getTotalLatencyForFailed().should.equal(0);
        });

        it('should be possible update with an array of failed transactions', () => {

            const transactionStatisticsCollector = new TransactionStatisticsCollector();
            transactionStatisticsCollector.activate();

            // require time delta so that the result is deemed relevant
            clock.tick(50);
            const txStatus0 = new TxStatus();
            clock.tick(25);
            const txStatus1 = new TxStatus();
            txStatus0.SetStatusFail();
            clock.tick(100);
            txStatus1.SetStatusFail();

            transactionStatisticsCollector.txFinished([txStatus0, txStatus1]);

            // Common transaction statistics
            transactionStatisticsCollector.getTotalFailedTx().should.equal(2);
            transactionStatisticsCollector.getFirstCreateTime().should.equal(txStatus0.GetTimeCreate());
            transactionStatisticsCollector.getLastCreateTime().should.equal(txStatus1.GetTimeCreate());
            transactionStatisticsCollector.getFirstFinishTime().should.equal(txStatus0.GetTimeFinal());
            transactionStatisticsCollector.getLastFinishTime().should.equal(txStatus1.GetTimeFinal());

            // Failed transaction statistics
            transactionStatisticsCollector.getMinLatencyForFailed().should.equal(txStatus0.GetTimeFinal() - txStatus0.GetTimeCreate());
            transactionStatisticsCollector.getMaxLatencyForFailed().should.equal(txStatus1.GetTimeFinal() - txStatus1.GetTimeCreate());
            transactionStatisticsCollector.getTotalLatencyForFailed().should.equal((txStatus0.GetTimeFinal() - txStatus0.GetTimeCreate()) + (txStatus1.GetTimeFinal() - txStatus1.GetTimeCreate()));

            // Successful transaction statistics (nothing should have passed)
            transactionStatisticsCollector.getTotalSuccessfulTx().should.equal(0);
            transactionStatisticsCollector.getMinLatencyForSuccessful().should.equal(Number.MAX_SAFE_INTEGER);
            transactionStatisticsCollector.getMaxLatencyForSuccessful().should.equal(0);
            transactionStatisticsCollector.getTotalLatencyForSuccessful().should.equal(0);
        });

        it('should be possible update with an array of failed and passing transactions', () => {

            const transactionStatisticsCollector = new TransactionStatisticsCollector();
            transactionStatisticsCollector.activate();

            // require time delta so that the result is deemed relevant
            clock.tick(50);
            const txStatus0 = new TxStatus();
            clock.tick(25);
            const txStatus1 = new TxStatus();
            txStatus0.SetStatusSuccess();
            clock.tick(100);
            txStatus1.SetStatusFail();

            transactionStatisticsCollector.txFinished([txStatus0, txStatus1]);

            // Common transaction statistics
            transactionStatisticsCollector.getTotalFinishedTx().should.equal(2);
            transactionStatisticsCollector.getFirstCreateTime().should.equal(txStatus0.GetTimeCreate());
            transactionStatisticsCollector.getLastCreateTime().should.equal(txStatus1.GetTimeCreate());
            transactionStatisticsCollector.getFirstFinishTime().should.equal(txStatus0.GetTimeFinal());
            transactionStatisticsCollector.getLastFinishTime().should.equal(txStatus1.GetTimeFinal());

            // Successful transaction statistics
            transactionStatisticsCollector.getTotalSuccessfulTx().should.equal(1);
            transactionStatisticsCollector.getMinLatencyForSuccessful().should.equal(txStatus0.GetTimeFinal() - txStatus0.GetTimeCreate());
            transactionStatisticsCollector.getMaxLatencyForSuccessful().should.equal(txStatus0.GetTimeFinal() - txStatus0.GetTimeCreate());
            transactionStatisticsCollector.getTotalLatencyForSuccessful().should.equal(txStatus0.GetTimeFinal() - txStatus0.GetTimeCreate());

            // Failed transaction statistics
            transactionStatisticsCollector.getTotalFailedTx().should.equal(1);
            transactionStatisticsCollector.getMinLatencyForFailed().should.equal(txStatus1.GetTimeFinal() - txStatus1.GetTimeCreate());
            transactionStatisticsCollector.getMaxLatencyForFailed().should.equal(txStatus1.GetTimeFinal() - txStatus1.GetTimeCreate());
            transactionStatisticsCollector.getTotalLatencyForFailed().should.equal(txStatus1.GetTimeFinal() - txStatus1.GetTimeCreate());
        });
    });

    describe('Aggregating multiple TransactionStatisticsCollector results', () => {

        it('should be possible to merge TransactionStatisticsCollector results into a single aggregation', () => {

            const transactionStatisticsCollector0 = new TransactionStatisticsCollector();
            transactionStatisticsCollector0.activate();

            const transactionStatisticsCollector1 = new TransactionStatisticsCollector();
            transactionStatisticsCollector1.activate();

            clock.tick(50);
            const txStatus0 = new TxStatus();
            clock.tick(25);
            const txStatus1 = new TxStatus();
            txStatus0.SetStatusSuccess();
            clock.tick(100);
            txStatus1.SetStatusSuccess();

            transactionStatisticsCollector0.txFinished(txStatus0);
            transactionStatisticsCollector1.txFinished(txStatus1);

            const mergedCollector = TransactionStatisticsCollector.mergeCollectorResults([transactionStatisticsCollector0, transactionStatisticsCollector1]);

            mergedCollector.getTotalSuccessfulTx().should.equal(2);
            mergedCollector.getFirstCreateTime().should.equal(txStatus0.GetTimeCreate());
            mergedCollector.getLastCreateTime().should.equal(txStatus1.GetTimeCreate());
            mergedCollector.getFirstFinishTime().should.equal(txStatus0.GetTimeFinal());
            mergedCollector.getLastFinishTime().should.equal(txStatus1.GetTimeFinal());
            mergedCollector.getMinLatencyForSuccessful().should.equal(txStatus0.GetTimeFinal() - txStatus0.GetTimeCreate());
            mergedCollector.getMaxLatencyForSuccessful().should.equal(txStatus1.GetTimeFinal() - txStatus1.GetTimeCreate());
            mergedCollector.getTotalLatencyForSuccessful().should.equal((txStatus0.GetTimeFinal() - txStatus0.GetTimeCreate()) + (txStatus1.GetTimeFinal() - txStatus1.GetTimeCreate()));
        });

    });

});
