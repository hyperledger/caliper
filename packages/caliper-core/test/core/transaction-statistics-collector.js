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

const TransactionStatisticsCollector = require('../../lib/common/core/transaction-statistics-collector');
const TxStatus = require('../../lib/common/core/transaction-status');

describe('the transaction statistics collector', () => {
    const createSuccessfulTxStatus = (creationTimeAfterRoundStart) => {
        const txStatus = new TxStatus('id');
        txStatus.SetTimeCreate(txStatsCollector.getRoundStartTime() + creationTimeAfterRoundStart);
        txStatus.SetStatusSuccess();
        return txStatus;
    };

    let txStatsCollector;
    beforeEach(() => {
        txStatsCollector = new TransactionStatisticsCollector(1,1,'');
        txStatsCollector.activate();
    })

    it('should register as finished a single finished transaction while active irrespective of time of creation', () => {
        txStatsCollector.txSubmitted(3);

        // test if it finishes after the round start time
        txStatsCollector.txFinished(createSuccessfulTxStatus(60000));
        txStatsCollector.getTotalFinishedTx().should.equal(1);

        // test if it finishes when the round started
        txStatsCollector.txFinished(createSuccessfulTxStatus(0));
        txStatsCollector.getTotalFinishedTx().should.equal(2);

        // test if it finishes before the round start time
        txStatsCollector.txFinished(createSuccessfulTxStatus(-60000));
        txStatsCollector.getTotalFinishedTx().should.equal(3);

    });

    it('should register multiple transactions as finished while active irrespective of time of creation', () => {
        txStatsCollector.txSubmitted(3);
        txStatsCollector.txFinished([createSuccessfulTxStatus(60000), createSuccessfulTxStatus(0), createSuccessfulTxStatus(-60000)]);
        txStatsCollector.getTotalFinishedTx().should.equal(3);
    });

    it('should record the transaction statistics if the status was created after the round started', () => {
        txStatsCollector.txSubmitted(1);
        txStatsCollector.getTotalSuccessfulTx().should.equal(0);
        txStatsCollector.txFinished(createSuccessfulTxStatus(60000));
        txStatsCollector.getTotalSuccessfulTx().should.equal(1);
    });

    it('should record the transaction statistics if the status was created at the same time the round started', () => {
        txStatsCollector.txSubmitted(1);
        txStatsCollector.getTotalSuccessfulTx().should.equal(0);
        txStatsCollector.txFinished(createSuccessfulTxStatus(0));
        txStatsCollector.getTotalSuccessfulTx().should.equal(1);
    });

    it('should NOT record the transaction statistics if the status was created before the round started', () => {
        txStatsCollector.txSubmitted(1);
        txStatsCollector.getTotalSuccessfulTx().should.equal(0);
        txStatsCollector.txFinished(createSuccessfulTxStatus(-60000));
        txStatsCollector.getTotalSuccessfulTx().should.equal(0);
    });

    it('should include only the status results that were created on of after the round started', () => {
        txStatsCollector.txSubmitted(3);
        txStatsCollector.txFinished([createSuccessfulTxStatus(60000), createSuccessfulTxStatus(0), createSuccessfulTxStatus(-60000)]);
        txStatsCollector.getTotalSuccessfulTx().should.equal(2);
    });
});
