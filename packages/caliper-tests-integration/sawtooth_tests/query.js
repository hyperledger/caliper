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

module.exports.info  = 'querying accounts';


let bc, contx;
let accounts;
module.exports.init = function(blockchain, context, args) {
    let acc = require('./smallbankOperations.js');
    bc       = blockchain;
    contx    = context;
    accounts = acc.account_array;
    return Promise.resolve();
};

module.exports.run = function() {
    let acc_num  = accounts[Math.floor(Math.random()*(accounts.length))];
    if (bc.bcType === 'fabric') {
        let args = {
            chaincodeFunction: 'query',
            chaincodeArguments: [acc_num.toString()],
        };
        return bc.bcObj.querySmartContract(contx, 'smallbank', '1.0', args, 3);
    } else {
        // NOTE: the query API is inconsistent with the invoke API
        return bc.queryState(contx, 'smallbank', '1.0', acc_num);
    }
};

module.exports.end = function() {
    // do nothing
    return Promise.resolve();
};
