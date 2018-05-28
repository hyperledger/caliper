/**
 * Copyright 2017 HUAWEI All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 **/

'use strict';

const BatchBuilder = require('./BatchBuilder.js');

/**
 * BatchBuilder for simple use case and it use case specific logic to
 * buildBatch and calculateAddress
 */
class SimpleBatchBuilder extends BatchBuilder {

    /**
     * Constructor
     * @param {String} fName transaction family name
     * @param {String} fVersion transaction family version
     */
    constructor(fName, fVersion) {
        super();
        this.familyName = fName;
        this.familyVersion = fVersion;
    }

    /**
     * Builds sawtooth batch from list of simple transactions
     * @param {object} args list smallbank transactions
     * @returns {object} batch list bytes
     */
    buildBatch(args) {
        const {createHash} = require('crypto');
        const {createContext, CryptoFactory} = require('sawtooth-sdk/signing');
        const context = createContext('secp256k1');
        const {protobuf} = require('sawtooth-sdk');

        const privateKey = context.newRandomPrivateKey();
        const signer = new CryptoFactory(context).newSigner(privateKey);

        let transactions = [];
        for(let i = 0; i < args.length; i++) {
            const addr = args[i].account;
            const address = this.calculateAddress(addr);
            const addresses = [address];

            const cbor = require('cbor');
            const payloadBytes = cbor.encode(args[i]);

            const transactionHeaderBytes = protobuf.TransactionHeader.encode({
                familyName: this.familyName,
                familyVersion: this.familyVersion,
                inputs: addresses,
                outputs: addresses,
                signerPublicKey: signer.getPublicKey().asHex(),
                batcherPublicKey: signer.getPublicKey().asHex(),
                dependencies: [],
                payloadSha512: createHash('sha512').update(payloadBytes).digest('hex')
            }).finish();

            const txnSignature = signer.sign(transactionHeaderBytes);
            const transaction = protobuf.Transaction.create({
                header: transactionHeaderBytes,
                headerSignature: txnSignature,
                payload: payloadBytes
            });
            transactions.push(transaction);
        }

        const batchHeaderBytes = protobuf.BatchHeader.encode({
            signerPublicKey: signer.getPublicKey().asHex(),
            transactionIds: transactions.map((txn) => txn.headerSignature),
        }).finish();

        const batchSignature = signer.sign(batchHeaderBytes);
        const batch = protobuf.Batch.create({
            header: batchHeaderBytes,
            headerSignature: batchSignature,
            transactions: transactions
        });

        const batchListBytes = protobuf.BatchList.encode({
            batches: [batch]
        }).finish();

        return batchListBytes;
    }

    /**
     * Calculate address
     * @param {*} name address name
     * @return {String} address
     */
    calculateAddress(name) {
        const crypto = require('crypto');
        const _hash = (x) =>
            crypto.createHash('sha512').update(x).digest('hex').toLowerCase();
        const familyNameSpace = _hash(this.familyName).substring(0, 6);
        let address = familyNameSpace + _hash(name).slice(-64);
        return address;
    }
}
module.exports = SimpleBatchBuilder;
