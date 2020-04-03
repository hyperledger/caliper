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
let account_array;

module.exports.init = function(blockchain, context, args) {
    const open = require('./open.js');
    bc       = blockchain;
    contx    = context;
    account_array = open.account_array;

    return Promise.resolve();
};

module.exports.run = function() {
    const acc  = account_array[Math.floor(Math.random()*(account_array.length))];

    if (bc.getType() === 'fabric') {
        let args = {
            chaincodeFunction: 'query',
            chaincodeArguments: [acc],
        };

        return bc.bcObj.querySmartContract(contx, 'simple', 'v0', args, 10);
    } else {
        // NOTE: the query API is not consistent with the invoke API
        return bc.queryState(contx, 'simple', 'v0', acc);
    }
};

module.exports.end = function() {
    // do nothing
    return Promise.resolve();
};
