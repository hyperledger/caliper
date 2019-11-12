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

const uuidv4 = require('uuid/v4');
const utils = require('./utils');
const Transaction = require('./transactionObject').Transaction;

/**
 * Generate a random number via UUID
 * @return {Number} random number
 */
function genRandomID() {
    let uuid = uuidv4();
    uuid = '0x' + uuid.replace(/-/g, '');

    return uuid;
}

/**
 * Sign a transaction with private key and callback
 * @param {String} txData transaction data
 * @param {Buffer} privKey private key
 * @param {callback} callback callback function
 * @return {String} signed transaction data
 */
function signTransaction(txData, privKey, callback) {
    let tx = new Transaction(txData);
    let privateKey = Buffer.from(privKey, 'hex');
    tx.sign(privateKey);

    // Build a serialized hex version of the tx
    let serializedTx = '0x' + tx.serialize().toString('hex');
    if (callback !== null) {
        callback(serializedTx);
    } else {
        return serializedTx;
    }
}

/**
 * get transaction data
 * @param {String} func function name
 * @param {Array} params params
 * @return {String} transaction data
 */
function getTxData(func, params) {
    let r = /^\w+\((.*)\)$/g.exec(func);
    let types = [];
    if (r[1]) {
        types = r[1].split(',');
    }
    return utils.encodeTxData(func, types, params);
}

/**
 * get signed transaction data
 * @param {Number} groupId ID of the group where this transaction will be sent to
 * @param {Buffer} account user account
 * @param {Buffer} privateKey private key
 * @param {Buffer} to target address
 * @param {String} func function name
 * @param {Array} params params
 * @param {Number} blockLimit block limit
 * @return {String} signed transaction data
 */
function getSignTx(groupId, account, privateKey, to, func, params, blockLimit) {
    let txData = getTxData(func, params);

    let postdata = {
        data: txData,
        from: account,
        to: to,
        gas: 1000000,
        randomid: genRandomID(),
        blockLimit: blockLimit,
        chainId: 1,
        groupId: groupId,
        extraData: '0x0'
    };

    return signTransaction(postdata, privateKey, null);
}

/**
 * get signed deploy tx
 * @param {Number} groupId ID of the group where this transaction will be sent to
 * @param {Buffer} account user account
 * @param {Buffer} privateKey private key
 * @param {Buffer} bin contract bin
 * @param {Number} blockLimit block limit
 * @return {String} signed deploy transaction data
 */
function getSignDeployTx(groupId, account, privateKey, bin, blockLimit) {
    let txData = bin.indexOf('0x') === 0 ? bin : ('0x' + bin);

    let postdata = {
        data: txData,
        from: account,
        to: null,
        gas: 1000000,
        randomid: genRandomID(),
        blockLimit: blockLimit,
        chainId: 1,
        groupId: groupId,
        extraData: '0x0'
    };

    return signTransaction(postdata, privateKey, null);
}

module.exports.getSignDeployTx = getSignDeployTx;
module.exports.signTransaction = signTransaction;
module.exports.getSignTx = getSignTx;
module.exports.getTxData = getTxData;
