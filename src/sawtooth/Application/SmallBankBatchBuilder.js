/**
 * Copyright 2017 HUAWEI All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * @file, batch builder definition for small bank use case.
 **/


'use strict';

const logger = require('../../../src/comm/util.js').getLogger('SmallBankBatchBuilder.js');
let BatchBuilder = require('./BatchBuilder.js');

/**
 * get the list of customer ids from the list of small bank transactions
 * @param {object} args list of small bank transactions
 * @returns {object} list of customer ids
 */
function getCustomerIds(args) {
    let cust_ids = [];
    //Based on the payload type get the customer ids
    switch(args.transaction_type) {
    case 'create_account':
    case 'deposit_checking':
    case 'write_check':
    case 'transact_savings':
        cust_ids.push(args.customer_id);
        break;
    case 'send_payment':
    case 'amalgamate':
        cust_ids.push(args.source_customer_id);
        cust_ids.push(args.dest_customer_id);
        break;
    default:
        logger.error('Error: Unknown payload type' + args.payload_type);
        break;
    }
    return cust_ids;
}

/**
 * Create the payload for create account operation
 * @param {object} args small bank transaction
 * @returns {object} payload data
 */
function createAccountPayload(args) {
    let protobuf = require('protocol-buffers');
    let fs = require('fs');
    let root = protobuf(fs.readFileSync('./protos/smallbank.proto'));

    let account = root.SmallbankTransactionPayload.encode({
        payload_type: root.SmallbankTransactionPayload.PayloadType.CREATE_ACCOUNT,
        create_account: {
            customer_id: args.customer_id,
            customer_name: args.customer_name,
            initial_savings_balance: args.initial_savings_balance,
            initial_checking_balance: args.initial_checking_balance
        }
    });
    return account;
}

/**
 * Create the protobuf payload for deposit checking operation
 * @param {object} args small bank transaction
 * @returns {object} payload data
 */
function createDepositCheckingPayload(args) {
    let protobuf = require('protocol-buffers');
    let fs = require('fs');
    let root = protobuf(fs.readFileSync('./protos/smallbank.proto'));

    let account = root.SmallbankTransactionPayload.encode({
        payload_type: root.SmallbankTransactionPayload.PayloadType.DEPOSIT_CHECKING,
        deposit_checking: {
            customer_id: args.customer_id,
            amount: args.amount
        }
    });
    return account;
}

/**
 * Create the protobuf payload for write check operation
 * @param {object} args small bank transaction
 * @returns {object} payload data
 */
function createWriteCheckPayload(args) {
    let protobuf = require('protocol-buffers');
    let fs = require('fs');
    let root = protobuf(fs.readFileSync('./protos/smallbank.proto'));

    let account = root.SmallbankTransactionPayload.encode({
        payload_type: root.SmallbankTransactionPayload.PayloadType.WRITE_CHECK,
        write_check: {
            customer_id: args.customer_id,
            amount: args.amount
        }
    });
    return account;
}

/**
 * Create the protobuf payload for transact saving operation
 * @param {object} args small bank transaction
 * @returns {object} payload data
 */
function createTransactSavingsPayload(args) {
    let protobuf = require('protocol-buffers');
    let fs = require('fs');
    let root = protobuf(fs.readFileSync('./protos/smallbank.proto'));

    let account = root.SmallbankTransactionPayload.encode({
        payload_type: root.SmallbankTransactionPayload.PayloadType.TRANSACT_SAVINGS,
        transact_savings: {
            customer_id: args.customer_id,
            amount: args.amount
        }
    });
    return account;
}

/**
 * Create the protobuf payload for send payment operation
 * @param {object} args small bank transaction
 * @returns {object} payload data
 */
function createSendPaymentPayload(args) {
    let protobuf = require('protocol-buffers');
    let fs = require('fs');
    let root = protobuf(fs.readFileSync('./protos/smallbank.proto'));

    let sendPayment = root.SmallbankTransactionPayload.encode({
        payload_type: root.SmallbankTransactionPayload.PayloadType.SEND_PAYMENT,
        send_payment: {
            source_customer_id: args.source_customer_id,
            dest_customer_id: args.dest_customer_id,
            amount: args.amount
        }
    });
    return sendPayment;
}

/**
 * Create the protobuf payload for Amalgamate operation
 * @param {object} args small bank transaction
 * @returns {object} payload data
 */
function createAmalgamatePayload(args) {
    let protobuf = require('protocol-buffers');
    let fs = require('fs');
    let root = protobuf(fs.readFileSync('./protos/smallbank.proto'));

    let amalgamatePayment = root.SmallbankTransactionPayload.encode({
        payload_type: root.SmallbankTransactionPayload.PayloadType.AMALGAMATE,
        amalgamate: {
            source_customer_id: args.source_customer_id,
            dest_customer_id: args.dest_customer_id,
        }
    });
    return amalgamatePayment;
}

/**
 * Builds payload data which is as per the protobuf format
 * @param {object} args small bank transaction
 * @returns {object} payload data
 */
function buildPayload(args) {
    let payloadBytes;
    //Based on the payload type construct the protobuf message
    switch(args.transaction_type) {
    case 'create_account':
        payloadBytes = createAccountPayload(args);
        break;
    case 'deposit_checking':
        payloadBytes = createDepositCheckingPayload(args);
        break;
    case 'write_check':
        payloadBytes = createWriteCheckPayload(args);
        break;
    case 'transact_savings':
        payloadBytes = createTransactSavingsPayload(args);
        break;
    case 'send_payment':
        payloadBytes = createSendPaymentPayload(args);
        break;
    case 'amalgamate':
        payloadBytes = createAmalgamatePayload(args);
        break;
    }
    return payloadBytes;
}

/**
 * Converts string to byte array
 * @param {string} str string
 * @returns {object} byte array
 */
function as_bytes(str) {
    let byteArray = [];
    for(let i = 0; i<str.length; ++i) {
        let y = str.charCodeAt(i);
        byteArray = byteArray.concat([y]);
    }
    return byteArray;
}

/**
 * Converts byte array to hex string
 * @param {object} buffer byte array
 * @returns {string} hex string
 */
function bytes_to_hex_str(buffer) {
    let hexStringArray = [];
    for(let i = 0; i<buffer.length; ++i) {
        hexStringArray = hexStringArray.concat([buffer[i].toString(16)]);
    }
    let hexAddress = hexStringArray.join('').toString();
    return hexAddress;
}

/**
 * Class responsible for building batch for small bank
 * operations
 */
class SmallBankBatchBuilder extends BatchBuilder {

    /**
     * @param {string} fName transaction family name
     * @param {string} fVersion transaction family version
     */
    constructor(fName, fVersion) {
        super();
        this.familyName = fName;
        this.familyVersion = fVersion;
    }
    /**
     * Calculate a 70-character(35-byte) address to store and retrieve the state
     * and 6 character from account number.
     * @param {number} accNumber customer id
     * @returns {string} state address
     */
    calculateAddress(accNumber) {
        //Generate byte array from customer id
        let byteArray = as_bytes(accNumber.toString());
        const crypto = require('crypto');
        const _hash = (x) =>
            crypto.createHash('sha512').update(x).digest('hex');

        //convert the hash bytes to hex sring
        let hexAddress = bytes_to_hex_str(_hash(Buffer.from(byteArray)));

        const familyNameSpace = _hash(this.familyName).substring(0, 6);
        let address = familyNameSpace + hexAddress.substring(0,64);
        return address;
    }

    /**
     * It is same as calculateAddress but calculates multiple address at a time.
     * and 6 character from account number.
     * @param {number} args array of account numbers
     * @returns {string} list valid state addresses
     */
    calculateAddresses(args) {
        let addresses = [];
        for (let key in args) {
            let address = this.calculateAddress(key);
            addresses.push(address);
        }
        return addresses;
    }

    /**
     * Create the sawtooth transaction from small bank payload
     * @param {object} args small bank payload
     * @param {object} signer used for signing transaction
     * @returns {object} transaction object
     */
    buildTransaction(args, signer) {
        const {createHash} = require('crypto');
        const {protobuf} = require('sawtooth-sdk');

        //get customer ids from the argument and calculate the addresses from
        //customer ids
        let ids = getCustomerIds(args);
        let in_address = this.calculateAddress(ids[0]);
        let input_address=[in_address];
        let output_address=[in_address];
        if(ids.length === 2) {
            let out_address = this.calculateAddress(ids[1]);
            input_address.push(out_address);
            output_address.push(out_address);
        }
        //Generate protobuf payload from input args
        const payloadBytes = buildPayload(args);

        //Construct transaction header
        const transactionHeaderBytes = protobuf.TransactionHeader.encode({
            familyName: this.familyName,
            familyVersion: this.familyVersion,
            inputs: input_address,
            outputs: output_address,
            signerPublicKey: signer.getPublicKey().asHex(),
            batcherPublicKey: signer.getPublicKey().asHex(),
            dependencies: [],
            payloadSha512: createHash('sha512').update(payloadBytes).digest('hex')
        }).finish();

        //construct transaction
        const txnSignature = signer.sign(transactionHeaderBytes);
        const transaction = protobuf.Transaction.create({
            header: transactionHeaderBytes,
            headerSignature: txnSignature,
            payload: payloadBytes
        });
        return transaction;
    }

    /**
     * Builds sawtooth batch from list of small bank transactions
     * @param {object} args list smallbank transactions
     * @returns {object} batch list bytes
     */
    buildBatch(args) {
        const {createContext, CryptoFactory} = require('sawtooth-sdk/signing');
        const context = createContext('secp256k1');
        const {protobuf} = require('sawtooth-sdk');

        const privateKey = context.newRandomPrivateKey();
        const signer = new CryptoFactory(context).newSigner(privateKey);

        let transactions = [];
        for(let i = 0; i<args.length; i++) {
            let transaction = this.buildTransaction(args[i],signer);
            transactions.push(transaction);
        }

        //constrcut batch
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

        //construct batch list
        const batchListBytes = protobuf.BatchList.encode({
            batches: [batch]
        }).finish();

        return batchListBytes;
    }

}

module.exports = SmallBankBatchBuilder;
