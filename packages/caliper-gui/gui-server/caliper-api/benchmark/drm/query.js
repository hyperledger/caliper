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

module.exports.info  = 'querying digital items';

let bc, contx;
let itemIDs;

module.exports.init = function(blockchain, context, args) {
    const publish = require('./publish.js');
    bc      = blockchain;
    contx   = context;
    itemIDs = publish.ids;
    if (publish.ids.length === 0) {
        throw new Error('publish.ids.length is 0');
    }

    return Promise.resolve();
};

module.exports.run = function() {
    const id  = itemIDs[Math.floor(Math.random()*(itemIDs.length))];
    if (bc.bcType === 'fabric') {
        let args = {
            chaincodeFunction: 'query',
            chaincodeArguments: [id],
        };

        return bc.bcObj.querySmartContract(contx, args, 12 * 1000);
    } else {
        // NOTE: query API is not consistent with invoke API
        return bc.queryState(contx, 'drm', 'v0', id);
    }
};

module.exports.end = function() {
    return Promise.resolve();
};
