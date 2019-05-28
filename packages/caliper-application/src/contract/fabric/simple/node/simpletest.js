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
const shim = require('fabric-shim');
const util = require('util');

const ERROR_SYSTEM = '{"code":300, "location": "%s", "reason": "system error: %s"}';
const ERROR_WRONG_FORMAT = '{"code":301, "location": "%s", "reason": "command format is wrong"}';
const ERROR_ACCOUNT_EXISTING = '{"code":302, "location": "%s", "reason": "account already exists"}';
const ERROR_ACCOUNT_ABNORMAL = '{"code":303, "location": "%s", "reason": "abnormal account"}';
const ERROR_MONEY_NOT_ENOUGH = '{"code":304, "location": "%s", "reason": "account\'s money is not enough"}';

/**
 * Generates an {@link ErrorResponse} from the given arguments.
 * @param {String} location Specifies the location of the error.
 * @param {String} formatString The format string of the error.
 * @param {Object[]} params Arbitrary values to pass to the format string.
 * @return {ErrorResponse} The constructed error response.
 */
function getErrorResponse(location, formatString, ...params) {
    return shim.error(Buffer.from(util.format(formatString, location, ...params)));
}

/**
 * Simple money transfer chaincode written in node.js, implementing {@link ChaincodeInterface}.
 * @type {SimpleChaincode}
 * @extends {ChaincodeInterface}
 */
let SimpleChaincode = class {
    /**
     * Called during chaincode instantiate and upgrade. This method can be used
     * to initialize asset states.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub is implemented by the fabric-shim
     * library and passed to the {@link ChaincodeInterface} calls by the Hyperledger Fabric platform. The stub
     * encapsulates the APIs between the chaincode implementation and the Fabric peer.
     * @return {Promise<SuccessResponse>} Returns a promise of a response indicating the result of the invocation.
     */
    async Init(stub) {
        return shim.success();
    }

    /**
     * Called throughout the life time of the chaincode to carry out business
     * transaction logic and effect the asset states.
     * The provided functions are the following: open, delete, query, transfer.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub is implemented by the fabric-shim
     * library and passed to the {@link ChaincodeInterface} calls by the Hyperledger Fabric platform. The stub
     * encapsulates the APIs between the chaincode implementation and the Fabric peer.
     * @return {Promise<SuccessResponse | ErrorResponse>} Returns a promise of a response indicating the result of the invocation.
     */
    async Invoke(stub) {
        let funcAndParams = stub.getFunctionAndParameters();

        let method = this[funcAndParams.fcn];
        if (!method) {
            return getErrorResponse('Invoke', ERROR_WRONG_FORMAT);
        }

        try {
            return await method(stub, funcAndParams.params);
        } catch (err) {
            return getErrorResponse('Invoke', ERROR_SYSTEM, err);
        }
    }

    /**
     * Creates a new account with the given amount of money. The account must not exist!
     * @async
     * @param {ChaincodeStub} stub The chaincode stub object.
     * @param {String[]} params The parameters for account creation.
     * Index 0: account name. Index 1: initial amount of money.
     * @return {Promise<SuccessResponse | ErrorResponse>} Returns a promise of a response indicating the result of the invocation.
     */
    async open(stub, params) {
        if (params.length !== 2) {
            return getErrorResponse('open', ERROR_WRONG_FORMAT);
        }

        let account = params[0];
        let money = await stub.getState(account);

        if (money.toString()) {
            return getErrorResponse('open', ERROR_ACCOUNT_EXISTING);
        }

        let initMoney = parseInt(params[1]);
        if (isNaN(initMoney)) {
            return getErrorResponse('open', ERROR_WRONG_FORMAT);
        }

        try {
            // expand enumerable Buffer to byte array with the ... operator
            await stub.putState(account, Buffer.from(params[1]));
        } catch (err) {
            return getErrorResponse('open', ERROR_SYSTEM, err);
        }

        return shim.success();
    }

    /**
     * Deletes an account.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub object.
     * @param {String[]} params The parameter for account deletion. Index 0: account name.
     * @return {Promise<SuccessResponse | ErrorResponse>} Returns a promise of a response indicating the result of the invocation.
     */
    async delete(stub, params) {
        if (params.length !== 1) {
            return getErrorResponse('delete', ERROR_WRONG_FORMAT);
        }

        try {
            await stub.deleteState(params[0]);
        } catch (err) {
            return getErrorResponse('delete', ERROR_SYSTEM, err);
        }

        return shim.success();
    }

    /**
     * Queries the amount of money of a given account.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub object.
     * @param {String[]} params The parameter for account query. Index 0: account name.
     * @return {Promise<SuccessResponse | ErrorResponse>} Returns a promise of a response indicating the result of the invocation.
     */
    async query(stub, params) {
        if (params.length !== 1) {
            return getErrorResponse('query', ERROR_WRONG_FORMAT);
        }

        let money;
        try {
            money = await stub.getState(params[0]);
        } catch (err) {
            return getErrorResponse('query', ERROR_SYSTEM, err);
        }

        if (!money) {
            return getErrorResponse('query', ERROR_ACCOUNT_ABNORMAL);
        }

        return shim.success(money);
    }

    /**
     * Transfers a given amount of money from one account to an other.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub object.
     * @param {String[]} params The parameters for money transfer.
     * Index 0: sending account name. Index 1: receiving account name. Index 2: amount of money to transfer.
     * @return {Promise<SuccessResponse | ErrorResponse>} Returns a promise of a response indicating the result of the invocation.
     */
    async transfer(stub, params) {
        if (params.length !== 3) {
            return getErrorResponse('transfer', ERROR_WRONG_FORMAT);
        }

        let money = parseInt(params[2]);
        if (isNaN(money)) {
            return getErrorResponse('transfer', ERROR_WRONG_FORMAT);
        }

        let moneyBytes1, moneyBytes2;
        try {
            moneyBytes1 = await stub.getState(params[0]);
            moneyBytes2 = await stub.getState(params[1]);
        } catch (err) {
            return getErrorResponse('transfer', ERROR_SYSTEM, err);
        }

        if (!moneyBytes1 || !moneyBytes2) {
            return getErrorResponse('transfer', ERROR_ACCOUNT_ABNORMAL);
        }

        let money1 = parseInt(String.fromCharCode.apply(String, moneyBytes1));
        let money2 = parseInt(String.fromCharCode.apply(String, moneyBytes2));

        if (money1 < money) {
            return getErrorResponse('transfer', ERROR_MONEY_NOT_ENOUGH);
        }

        money1 -= money;
        money2 += money;

        try {
            await stub.putState(params[0], Buffer.from(money1.toString()));
            await stub.putState(params[1], Buffer.from(money2.toString()));
        } catch (err) {
            return getErrorResponse('transfer', ERROR_SYSTEM, err);
        }

        return shim.success();
    }
};

try {
    shim.start(new SimpleChaincode());
} catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
}
