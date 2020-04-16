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

"use strict";

module.exports.info = "transfering assets";

let bc, contx;
let accounts;
let amount;

module.exports.init = function(blockchain, context, args) {
    const open = require("./create.js");
    if (!args.hasOwnProperty("money")) {
        args.money = "10.00";
    }
    if (!args.hasOwnProperty("txnPerBatch")) {
        args.txnPerBatch = 1;
    }
    bc = blockchain;
    contx = context;
    amount = args.money;
    accounts = open.accounts;

    return Promise.resolve();
};

module.exports.run = function() {
    const account = accounts[Math.floor(Math.random() * accounts.length)];
    let args = {
        verb: "transfer",
        account: account,
        amount: amount
    };

    return bc.invokeSmartContract(contx, "simple", "v0", args, 10);
};

module.exports.end = function() {
    // do nothing
    return Promise.resolve();
};
