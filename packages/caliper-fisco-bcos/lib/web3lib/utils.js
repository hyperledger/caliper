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

const secp256k1 = require('secp256k1');
const cryptoJSSha3 = require('crypto-js/sha3');
const keccak = require('keccak');
const assert = require('assert');
const rlp = require('rlp');
const coder = require('web3/lib/solidity/coder');
const ethjsUtil = require('ethjs-util');
const encryptType = require('./config').EncryptType;

/**
 * Convert data to Buffer
 * @param {any} data data to be transformed to buffer
 * @return {Buffer} transformation result
 */
function toBuffer(data) {
    if (!Buffer.isBuffer(data)) {
        if (Array.isArray(data)) {
            data = Buffer.from(data);
        } else if (data instanceof String) {
            if (ethjsUtil.isHexPrefixed(data)) {
                data = Buffer.from(ethjsUtil.padToEven(ethjsUtil.stripHexPrefix(data)), 'hex');
            } else {
                data = Buffer.from(data);
            }
        } else if (Number.isInteger(data)) {
            data = ethjsUtil.intToBuffer(data);
        } else if (data === null || data === undefined) {
            data = Buffer.allocUnsafe(0);
        } else if (data.toArray) {
            data = Buffer.from(data.toArray());
        } else {
            throw new Error('invalid type');
        }
    }
    return data;
}

/**
 * Calculate hash of data
 * @param {any} data data
 * @param {int} bits length of hash
 * @return {Buffer} hash of data
 */
function sha3(data, bits) {
    if (encryptType === 0) {
        data = toBuffer(data);
        if (!bits) {
            bits = 256;
        }
        let digestData = keccak('keccak' + bits).update(data).digest();
        return digestData;
    } else {
        throw new Error('Unsupported type of encryption');
    }
}

/**
 * Calculate public key from private key
 * @param {Buffer} privateKey A private key must be 256 bits wide
 * @return {Buffer} public key
 */
function privateKeyToPublicKey(privateKey) {
    if (encryptType === 0) {
        privateKey = ethjsUtil.toBuffer(privateKey);
        let publicKey = keccak.publicKeyCreate(privateKey, false).slice(1);
        return publicKey;
    } else {
        throw new Error('Unsupported type of encryption');
    }
}

/**
 * Calculate address from public key
 * @param {Buffer} publicKey public key
 * @param {bool} sanitize whether to sanitize publicKey
 * @return {Buffer} address
 */
function publicKeyToAddress(publicKey, sanitize = false) {
    if (encryptType === 0) {
        if (sanitize && (publicKey.length !== 64)) {
            publicKey = secp256k1.publicKeyConvert(publicKey, false).slice(1);
        }
        assert(publicKey.length === 64);
    }
    // Only take the lower 160bits of the hash as address
    return sha3(publicKey).slice(-20);
}

/**
 * Calculate address from private key
 * @param {Buffer} privateKey private key
 * @return {Buffer} address
 */
function privateKeyToAddress(privateKey) {
    return publicKeyToAddress(privateKeyToPublicKey(privateKey));
}

/**
 * Recover public key from (v, r, s)
 * @param {String} msgHash message hash
 * @param {String} v v
 * @param {String} r r
 * @param {String} s s
 * @return {String} public key recovered from (v, r, s)
 */
function ecrecover(msgHash, v, r, s) {
    let signature = Buffer.concat([ethjsUtil.setLength(r, 32), ethjsUtil.setLength(s, 32)], 64);
    let recovery = v - 27;
    if (recovery !== 0 && recovery !== 1) {
        throw new Error('Invalid signature v value');
    }
    let senderPubickKey = secp256k1.recover(msgHash, signature, recovery);
    return secp256k1.publicKeyConvert(senderPubickKey, false).slice(1);
}

/**
 * Create sign data
 * @param {String} msgHash message hash
 * @param {String} privateKey private key
 * @return {Object} returns (v, r, s) for secp256k1
 */
function ecsign(msgHash, privateKey) {
    let ret = {};
    if (encryptType === 0) {
        let sig = secp256k1.sign(msgHash, privateKey);
        ret.r = sig.signature.slice(0, 32);
        ret.s = sig.signature.slice(32, 64);
        ret.v = sig.recovery + 27;
    } else {
        throw new Error('Unsupported type of encryption');
    }
    return ret;
}

/**
 * Calcuate hash of RLP data
 * @param {rlp} data RLP data
 * @return {String} the hash of data
 */
function rlphash(data) {
    return sha3(rlp.encode(data));
}

/**
 * encode params
 * @param {Array} types types
 * @param {Array} params params
 * @return {Buffer} params' code
 */
function encodeParams(types, params) {
    let ret = coder.encodeParams(types, params);
    return ret;
}

/**
 * decode params
 * @param {Array} types types
 * @param {Buffer} bytes params' code
 * @return {Array} params
 */
function decodeParams(types, bytes) {
    let ret = coder.decodeParams(types, bytes);
    return ret;
}

/**
 * encode function name
 * @param {String} fcn function name
 * @return {Buffer} function name's code
 */
function encodeFunctionName(fcn) {
    let digest = null;
    if (encryptType === 1) {
        digest = sha3(fcn, 256).toString('hex');
    } else {
        digest = cryptoJSSha3(fcn, {
            outputLength: 256
        }).toString();
    }
    let ret = '0x' + digest.slice(0, 8);
    return ret;
}

/**
 * encode transaction data
 * @param {String} fcn function name
 * @param {Array} types types
 * @param {Array} params params
 * @return {Buffer} tx data's code
 */
function encodeTxData(fcn, types, params) {
    let txDataCode = encodeFunctionName(fcn);
    let paramsCode = encodeParams(types, params);
    txDataCode += paramsCode;
    return txDataCode;
}

module.exports.privateKeyToPublicKey = privateKeyToPublicKey;
module.exports.publicKeyToAddress = publicKeyToAddress;
module.exports.privateKeyToAddress = privateKeyToAddress;
module.exports.rlphash = rlphash;
module.exports.ecrecover = ecrecover;
module.exports.ecsign = ecsign;
module.exports.sha3 = sha3;
module.exports.toBuffer = toBuffer;

module.exports.encodeTxData = encodeTxData;
module.exports.decodeParams = decodeParams;
module.exports.encodeParams = encodeParams;
