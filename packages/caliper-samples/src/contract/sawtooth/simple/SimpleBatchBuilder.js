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

const BatchBuilder = require('@hyperledger/caliper-sawtooth').BatchBuilder;
const {createHash} = require('crypto');
const {createContext, CryptoFactory} = require('sawtooth-sdk/signing');
const {protobuf} = require('sawtooth-sdk');

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
        const context = createContext('secp256k1');
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
        const _hash = (x) =>
            createHash('sha512').update(x).digest('hex').toLowerCase();
        const familyNameSpace = _hash(this.familyName).substring(0, 6);
        let address = familyNameSpace + _hash(name).slice(-64);
        return address;
    }
}
module.exports = SimpleBatchBuilder;
