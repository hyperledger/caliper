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

// TODO: two or more commands
const create = function(context, args) {
    return {
        fn: "createAccount",
        args: {
            accountName: args.accountName,
            domainId: context.domain,
            publicKey: args.publicKey
        }
    };
};

// TODO: two or more queries
const query = function(context, args) {
    return {
        fn: "getAccount",
        args: { accountId: args.accountId }
    };
};

const transfer = function(context, args) {
    if (!context.assetId || !args.amount) {
        return {};
    }
    return {
        fn: "transferAsset",
        args: {
            srcAccountId: context.id,
            destAccountId: args.accountName + "@" + context.domain,
            assetId: context.assetId,
            description: "coin transfer",
            amount: args.amount
        }
    };
};

const simple = function(context, args) {
    try {
        switch (args.verb) {
            case "create":
                return create(context, args);
            case "query":
                return query(context, args);
            case "transfer":
                return transfer(context, args);
            default:
                throw new Error('Unknown verb for "simple" contract');
        }
    } catch (err) {
        console.error(err);
        return {};
    }
};

module.exports.contracts = {
    simple: simple
};
