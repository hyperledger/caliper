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

const TxStatus = require('../../lib/common/core/transaction-status');

describe('the transaction status', () => {
    it('should create a default time creation', () => {
        const txStatus = new TxStatus();
        txStatus.GetTimeCreate().should.be.greaterThan(0);
    });

    it('should allow changing of the default time creation', () => {
        const txStatus = new TxStatus();
        const orgTimeCreate = txStatus.GetTimeCreate();
        const newTimeCreate = Date.now() + 60000;
        txStatus.SetTimeCreate(newTimeCreate);
        txStatus.GetTimeCreate().should.not.equal(orgTimeCreate);
        txStatus.GetTimeCreate().should.equal(newTimeCreate);
    });
});
