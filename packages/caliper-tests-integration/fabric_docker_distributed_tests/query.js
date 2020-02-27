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

module.exports.info  = 'Querying marbles.';

let txIndex = 0;
let owners = ['Alice', 'Bob', 'Claire', 'David'];
let bc, contx;

module.exports.init = async function(blockchain, context, args) {
    bc = blockchain;
    contx = context;
};

module.exports.run = async function() {
    txIndex++;
    let marbleOwner = owners[txIndex % owners.length];
    let args = {
        chaincodeFunction: 'queryMarblesByOwner',
        chaincodeArguments: [marbleOwner]
    };

    let targetCC = txIndex % 2 === 0 ? 'mymarbles' : 'yourmarbles';
    return bc.querySmartContract(contx, targetCC, '', args, 10);
};

module.exports.end = async function() {};
