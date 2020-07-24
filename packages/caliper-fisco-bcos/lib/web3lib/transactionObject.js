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

let utils = require('./utils');
const encryptType = require('./config').EncryptType;
const ethjsUtil = require('ethereumjs-util');
const BN = ethjsUtil.BN;

/**
 * Constructor of transaction
 * @param {data} data transaction data
 */
function Transaction(data) {
    data = data || {};
    let fields = null;

    if (encryptType === 1) {
        fields = [{
            name: 'randomid',
            length: 32,
            allowLess: true,
            default: Buffer.from([])
        }, {
            name: 'gasPrice',
            length: 32,
            allowLess: true,
            default: Buffer.from([])
        }, {
            name: 'gasLimit',
            alias: 'gas',
            length: 32,
            allowLess: true,
            default: Buffer.from([])
        }, {
            name: 'blockLimit',
            length: 32,
            allowLess: true,
            default: Buffer.from([])
        }, {
            name: 'to',
            allowZero: true,
            length: 20,
            default: Buffer.from([])
        }, {
            name: 'value',
            length: 32,
            allowLess: true,
            default: Buffer.from([])
        }, {
            name: 'data',
            alias: 'input',
            allowZero: true,
            default: Buffer.from([])
        }, {
            name: 'pub',
            length: 64,
            allowLess: true,
            default: Buffer.from([])
        }, {
            name: 'r',
            length: 32,
            allowLess: true,
            default: Buffer.from([])
        }, {
            name: 's',
            length: 32,
            allowLess: true,
            default: Buffer.from([])
        }];
    } else {
        fields = [{
            name: 'randomid',
            length: 32,
            allowLess: true,
            default: Buffer.from([])
        }, {
            name: 'gasPrice',
            length: 32,
            allowLess: true,
            default: Buffer.from([])
        }, {
            name: 'gasLimit',
            alias: 'gas',
            length: 32,
            allowLess: true,
            default: Buffer.from([])
        }, {
            name: 'blockLimit',
            length: 32,
            allowLess: true,
            default: Buffer.from([])
        }, {
            name: 'to',
            allowZero: true,
            length: 20,
            default: Buffer.from([])
        }, {
            name: 'value',
            length: 32,
            allowLess: true,
            default: Buffer.from([])
        }, {
            name: 'data',
            alias: 'input',
            allowZero: true,
            default: Buffer.from([])
        }, {
            name: 'chainId',
            length: 32,
            allowLess: true,
            default: Buffer.from([])
        }, {
            name: 'groupId',
            length: 32,
            allowLess: true,
            default: Buffer.from([])
        }, {
            name: 'extraData',
            allowZero: true,
            default: Buffer.from([])
        }, {
            name: 'v',
            length: 1,
            default: Buffer.from([0x1c])
        }, {
            name: 'r',
            length: 32,
            allowLess: true,
            default: Buffer.from([])
        }, {
            name: 's',
            length: 32,
            allowLess: true,
            default: Buffer.from([])
        }];
    }

    ethjsUtil.defineProperties(this, fields, data);

    Object.defineProperty(this, 'from', {
        enumerable: true,
        configurable: true,
        get: this.getSenderAddress.bind(this)
    });

    let sigV = ethjsUtil.bufferToInt(this.v);
    let chainId = Math.floor((sigV - 35) / 2);
    if (chainId < 0) {
        chainId = 0;
    }

    this._chainId = chainId || data.chainId || 0;
    this._homestead = true;
}

/**
 * If the tx's `to` is to the creation address
 * @return {Boolean} returns `true` if tx is to to the creation address, otherwise returns `false`
 */
Transaction.prototype.toCreationAddress = function () {
    return this.recipients.toString('hex') === '';
};

/**
 * Computes a sha3-256 hash of the serialized tx
 * @param {Boolean} [includeSignature=true] whether or not to inculde the signature
 * @return {Buffer} a sha3-256 hash of the serialized tx
 */
Transaction.prototype.hash = function (includeSignature) {
    if (includeSignature === undefined) {
        includeSignature = true;
    }
    // backup original signature
    const rawCopy = this.raw.slice(0);

    // modify raw for signature generation only
    if (this._chainId > 0) {
        includeSignature = true;
        this.v = this._chainId;
        this.r = 0;
        this.s = 0;
    }
    // generate rlp params for hash
    let txRawForHash = includeSignature ? this.raw : this.raw.slice(0, this.raw.length - 3);
    //var txRawForHash = includeSignature ? this.raw : this.raw.slice(0, 7)

    // restore original signature
    this.raw = rawCopy.slice();

    // create hash
    return utils.rlphash(txRawForHash);
};

/**
 * returns the chain ID
 * @return {Number} chain ID
 */
Transaction.prototype.getChainId = function () {
    return this._chainId;
};

/**
 * returns the sender's address
 * @return {Buffer} sender's address
 */
Transaction.prototype.getSenderAddress = function () {
    if (this._from) {
        return this._from;
    }
    const pubkey = this.getSenderPublicKey();
    this._from = ethjsUtil.publicToAddress(pubkey);
    return this._from;
};

/**
 * returns the public key of the sender
 * @return {Buffer} the public key of the sender
 */
Transaction.prototype.getSenderPublicKey = function () {
    if (!this._senderPubKey || !this._senderPubKey.length) {
        if (!this.verifySignature()) {
            throw new Error('Invalid Signature');
        }
    }
    return this._senderPubKey;
};

/**
 * Determines if the signature is valid
 * @return {Boolean} whether the signature is valid
 */
Transaction.prototype.verifySignature = function () {
    let SECP256K1_N_DIV_2 = new BN('7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0', 16);
    const msgHash = this.hash(false);
    // All transaction signatures whose s-value is greater than secp256k1n/2 are considered invalid.
    if (this._homestead && new BN(this.s).cmp(SECP256K1_N_DIV_2) === 1) {
        return false;
    }

    try {
        let v = ethjsUtil.bufferToInt(this.v);
        if (this._chainId > 0) {
            v -= this._chainId * 2 + 8;
        }
        this._senderPubKey = utils.ecrecover(msgHash, v, this.r, this.s);
    } catch (e) {
        return false;
    }

    return !!this._senderPubKey;
};

/**
 * sign a transaction with a given private key
 * @param {Buffer} privateKey private key
 */
Transaction.prototype.sign = function (privateKey) {
    const msgHash = this.hash(false);
    const sig = utils.ecsign(msgHash, privateKey);
    Object.assign(this, sig);
};

/**
 * the up front amount that an account must have for this transaction to be valid
 * @return {BN} up front amount
 */
Transaction.prototype.getUpfrontCost = function () {
    return new BN(this.gasLimit)
        .imul(new BN(this.gasPrice))
        .iadd(new BN(this.value));
};

/**
 * validates the signature and checks to see if it has enough gas
 * @param {Boolean} [stringError=false] whether to return a string with a dscription of why the validation failed or return a Bloolean
 * @return {Boolean|String} validation result
 */
Transaction.prototype.validate = function (stringError) {
    const errors = [];
    if (!this.verifySignature()) {
        errors.push('Invalid Signature');
    }

    if (this.getBaseFee().cmp(new BN(this.gasLimit)) > 0) {
        errors.push([`gas limit is to low. Need at least ${this.getBaseFee()}`]);
    }

    if (stringError === undefined || stringError === false) {
        return errors.length === 0;
    } else {
        return errors.join(' ');
    }
};

exports.Transaction = Transaction;
