/**
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */


'use strict';

//const fs = require('fs');
//const path = require('path');

//const FabricCAService = require('fabric-ca-client');
//const Client = require('fabric-client');
//const hash = require('fabric-client/lib/hash');

/*const elliptic = require('elliptic');
const EC = elliptic.ec;

const privateKeyPath = path.resolve(__dirname, '../../network/fabric-v1.1/config/crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/keystore/key.pem');
const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
const certPath = path.resolve(__dirname, '../../network/fabric-v1.1/config/crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/signcerts/User1@org1.example.com-cert.pem');
const certPem = fs.readFileSync(certPath, 'utf8');
const mspId = 'Org1MSP';

// this ordersForCurve comes from CryptoSuite_ECDSA_AES.js and will be part of the
// stand alone fabric-sig package in future.
const ordersForCurve = {
    'secp256r1': {
        'halfOrder': elliptic.curves['p256'].n.shrn(1),
        'order': elliptic.curves['p256'].n
    },
    'secp384r1': {
        'halfOrder': elliptic.curves['p384'].n.shrn(1),
        'order': elliptic.curves['p384'].n
    }
};*/

/**
 * this method is used for test at this moment. In future this
 * would be a stand alone package that running at the browser/cellphone/PAD
 *
 * @param {string} privateKey PEM encoded private key
 * @param {Buffer} proposalBytes proposal bytes
 */
/*function sign(privateKey, proposalBytes, algorithm, keySize) {
    const hashAlgorithm = algorithm.toUpperCase();
    const hashFunction = hash[`${hashAlgorithm}_${keySize}`];
    const ecdsaCurve = elliptic.curves[`p${keySize}`];
    const ecdsa = new EC(ecdsaCurve);
    const key = KEYUTIL.getKey(privateKey);

    const signKey = ecdsa.keyFromPrivate(key.prvKeyHex, 'hex');
    const digest = hashFunction(proposalBytes);

    let sig = ecdsa.sign(Buffer.from(digest, 'hex'), signKey);
    sig = _preventMalleability(sig, key.ecparams);

    return Buffer.from(sig.toDER());
}

function signProposal(proposalBytes) {
    const signature = sign(privateKeyPem, proposalBytes, 'sha2', 256);
    const signedProposal = { signature, proposal_bytes: proposalBytes };
    return signedProposal;
}*/

/**
 * Gernerate signed transaction.
 * @param {object} transactionRequest The transaction requestion.
 * @param {object} channel The Fabric channel.
 * @return {object} The object of signed transaction
 */
function generateSignedTransaction(transactionRequest, channel) {
    // fabric v1.3
    /*const commitProposal = channel.generateUnsignedTransaction(transactionRequest);

    // sign this commit proposal at local
    const signedCommitProposal = signProposal(commitProposal.toBuffer());

    const response = await channel.sendSignedTransaction({
        signedProposal: signedCommitProposal,
        request: commitReq,
    });
    return signedCommitProposal;*/
    // fabric v1.2v1.1v1.0
    const signedTransaction = channel.generateSignedTransaction(transactionRequest);
    return signedTransaction;
}

module.exports.generateSignedTransaction = generateSignedTransaction;
