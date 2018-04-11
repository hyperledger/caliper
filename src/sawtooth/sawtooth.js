/**
 * Copyright 2017 HUAWEI All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * @file, definition of the Sawtooth class, which implements the caliper's NBI for hyperledger sawtooth lake
 */


'use strict'

var BlockchainInterface = require('../comm/blockchain-interface.js')
class Sawtooth extends BlockchainInterface {
	constructor(config_path) {
		 super(config_path);
	}

	gettype() {
		return 'sawtooth';
	}

	init() {
		// todo: sawtooth
		return Promise.resolve();
	}

	installSmartContract() {
		// todo:
		return Promise.resolve();
	}

	getContext(name, args) {
		return Promise.resolve();

	}

	releaseContext(context) {
        // todo:
		return Promise.resolve();
	}

	invokeSmartContract(context, contractID, contractVer, args, timeout) {
		const address = calculateAddresses(contractID, args)
		let sawtoothContractVersion = '1.0'
			if (contractVer === 'v0') {
				sawtoothContractVersion = '1.0'
			}
		const batchBytes = createBatch(contractID, sawtoothContractVersion, address, args)
		return submitBatches(batchBytes)
	}

	queryState(context, contractID, contractVer, queryName) {
		let sawtoothContractVersion = '1.0'
			if (contractVer === 'v0') {
				sawtoothContractVersion = '1.0'
			}
		return querybycontext(context, contractID, contractVer, queryName)
	}

	getDefaultTxStats(stats, results) {
        // nothing to do now
	}
}

module.exports = Sawtooth;

const restApiUrl = 'http://127.0.0.1:8008'

function querybycontext(context, contractID, contractVer, name) {
	const address = calculateAddress(contractID, name)
	return getState(address)
}

function getState(address) {
	var invoke_status = {
			status       : 'created',
			time_create  : Date.now(),
			time_final   : 0,
			result       : null
	};

	const stateLink = restApiUrl + '/state?address=' + address
	var options = {
			uri: stateLink
	}
	return request(options)
	.then(function(body) {
		let data = (JSON.parse(body))["data"]

		if (data.length > 0) {
			let stateDataBase64 = data[0]["data"]
			let stateDataBuffer = new Buffer(stateDataBase64, 'base64')
			let stateData = stateDataBuffer.toString('hex')

			invoke_status.time_final = Date.now();
			invoke_status.result     = stateData;
			invoke_status.status     = 'success';
			return Promise.resolve(invoke_status);
		}
		else {
			throw new Error('no query responses');
		}
	})
	.catch(function (err) {
		console.log('Query failed, ' + (err.stack?err.stack:err));
		return Promise.resolve(invoke_status);
	})
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function submitBatches(batchBytes) {
	var invoke_status = {
		id           : 0,
		status       : 'created',
		time_create  : Date.now(),
		time_final   : 0,
		time_endorse : 0,
		time_order   : 0,
		result       : null
	};
	const request = require('request-promise')
	var options = {
		method: 'POST',
		url: restApiUrl + '/batches',
		body: batchBytes,
		headers: {'Content-Type': 'application/octet-stream'}
	}
	return request(options)	
	.then(function (body) {
		let link = JSON.parse(body).link
		return getBatchStatus(link, invoke_status)
	})
	.catch(function (err) {
		console.log('Submit batches failed, ' + (err.stack?err.stack:err))
		return Promise.resolve(invoke_status);
	})
}

var getIndex = 0
function getBatchStatus(link, invoke_status) {
	getIndex++
	let statusLink = link
	var intervalID = 0
	var timeoutID = 0

	var repeat = (ms, invoke_status) => {
		return new Promise((resolve) => {
			intervalID = setInterval(function(){					
				return getBatchStatusByRequest(resolve, statusLink, invoke_status, intervalID, timeoutID)
			}, ms)

		})
	}

	var timeout = (ms, invoke_status) => {
		return new Promise((resolve) => {
			timeoutID = setTimeout(function(){
				clearInterval(intervalID )
				return resolve(invoke_status);
			}, ms)
		})
	}


	return  Promise.race([repeat(500, invoke_status), timeout(30000, invoke_status)])
	.then(function () {
		return Promise.resolve(invoke_status);
	})
	.catch(function(error) {
		console.log('getBatchStatus error: ' + error)
		return Promise.resolve(invoke_status);
	})
}

var timeoutID = 0
const request = require('request-promise')
var requestIndex = 0

function getBatchStatusByRequest(resolve, statusLink, invoke_status, intervalID, timeoutID) {
	requestIndex++
	var options = {
		uri: statusLink
	}
	return request(options)
	.then(function(body) {
		let batchStatuses = JSON.parse(body).data
		let hasPending = false
		for (let index in batchStatuses){
			let batchStatus = batchStatuses[index].status
			if (batchStatus == 'PENDING'){
				hasPending = true
				break
			}
		}
		if (hasPending != true){
			invoke_status.status = 'success';
			invoke_status.time_final = Date.now();
			clearInterval(intervalID)
			clearTimeout(timeoutID)
			return resolve(invoke_status);
		}
	})
	.catch(function (err) {
		console.log(err)
		return resolve(invoke_status);
	})
}

function calculateAddress(family, name) {

	const crypto = require('crypto')

	const _hash = (x) =>
	crypto.createHash('sha512').update(x).digest('hex').toLowerCase()

	const INT_KEY_NAMESPACE = _hash(family).substring(0, 6)
	let address = INT_KEY_NAMESPACE + _hash(name).slice(-64)
	return address
}

function calculateAddresses(family, args) {
	const crypto = require('crypto')

	const _hash = (x) =>
	crypto.createHash('sha512').update(x).digest('hex').toLowerCase()

	const INT_KEY_NAMESPACE = _hash(family).substring(0, 6)
	let addresses = []

	for (let key in args){
	    let address = INT_KEY_NAMESPACE + _hash(args[key]).slice(-64)
		addresses.push(address)
	}
	return addresses
}

function createBatch(contractID, contractVer, addresses, args) {

	const {createHash} = require('crypto')
	const {createContext, CryptoFactory} = require('sawtooth-sdk/signing')
	const context = createContext('secp256k1')
	const {protobuf} = require('sawtooth-sdk')
	const privateKey = context.newRandomPrivateKey()
	const signer = new CryptoFactory(context).newSigner(privateKey)

	const cbor = require('cbor')
	const payloadBytes = cbor.encode(args)

	const transactionHeaderBytes = protobuf.TransactionHeader.encode({
		familyName: contractID,
		familyVersion: contractVer,
		inputs: addresses,
		outputs: addresses,
		signerPublicKey: signer.getPublicKey().asHex(),
		batcherPublicKey: signer.getPublicKey().asHex(),
		dependencies: [],
		payloadSha512: createHash('sha512').update(payloadBytes).digest('hex')
	     }).finish()

	const txnSignature = signer.sign(transactionHeaderBytes)

	const transaction = protobuf.Transaction.create({
			header: transactionHeaderBytes,
			headerSignature: txnSignature,
			payload: payloadBytes
		})

	const transactions = [transaction]

	const batchHeaderBytes = protobuf.BatchHeader.encode({
                        signerPublicKey: signer.getPublicKey().asHex(),
                        transactionIds: transactions.map((txn) => txn.headerSignature),
		}).finish()

	const batchSignature = signer.sign(batchHeaderBytes)

	const batch = protobuf.Batch.create({
			header: batchHeaderBytes,
			headerSignature: batchSignature,
			transactions: transactions
		})

	const batchListBytes = protobuf.BatchList.encode({
		    batches: [batch]
	}).finish()

	return batchListBytes

}
