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

const contractId = '<%= chaincodeId %>';
const version = '<%= version %>';

let bc, ctx, clientArgs, clientIdx;

module.exports.init = async function(blockchain, context, args) {
    bc = blockchain;
    ctx = context;
    clientArgs = args;
    clientIdx = context.clientIdx.toString();

    return Promise.resolve();
};

module.exports.run = function() {
    let myArgs = {
        chaincodeFunction: '<%= chaincodeFunction %>',
        chaincodeArguments: <%- chaincodeArguments %>
    };

    return bc.invokeSmartContract(ctx, contractId, version, myArgs, 60);
};

module.exports.end = async function() {
    return Promise.resolve();
};
