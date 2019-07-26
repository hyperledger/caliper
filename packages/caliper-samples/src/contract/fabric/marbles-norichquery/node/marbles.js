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

/*
* NOTE: This implementation is a derivative work of the following:
* https://github.com/hyperledger/fabric-samples/blob/release-1.1/chaincode/marbles02/node/marbles_chaincode.js
* The modifications include: bug fixes and refactoring for eslint compliance.
*/

/* eslint-disable no-console */

'use strict';
const shim = require('fabric-shim');
const util = require('util');

/**
 * Marble asset management chaincode written in node.js, implementing {@link ChaincodeInterface}.
 * @type {SimpleChaincode}
 * @extends {ChaincodeInterface}
 */
let Chaincode = class {
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
        let ret = stub.getFunctionAndParameters();
        console.info(ret);
        console.info('=========== Instantiated Marbles Chaincode ===========');
        return shim.success();
    }

    /**
     * Called throughout the life time of the chaincode to carry out business
     * transaction logic and effect the asset states.
     * The provided functions are the following: initMarble, delete, transferMarble, readMarble, getMarblesByRange,
     * transferMarblesBasedOnColor, queryMarblesByOwner, queryMarbles, getHistoryForMarble.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub is implemented by the fabric-shim
     * library and passed to the {@link ChaincodeInterface} calls by the Hyperledger Fabric platform. The stub
     * encapsulates the APIs between the chaincode implementation and the Fabric peer.
     * @return {Promise<SuccessResponse | ErrorResponse>} Returns a promise of a response indicating the result of the invocation.
     */
    async Invoke(stub) {
        console.info('Transaction ID: ' + stub.getTxID());
        console.info(util.format('Args: %j', stub.getArgs()));

        let ret = stub.getFunctionAndParameters();
        console.info(ret);

        let method = this[ret.fcn];
        if (!method) {
            console.log('no function of name:' + ret.fcn + ' found');
            throw new Error('Received unknown function ' + ret.fcn + ' invocation');
        }
        try {
            let payload = await method(stub, ret.params, this);
            return shim.success(payload);
        } catch (err) {
            console.log(err);
            return shim.error(err);
        }
    }

    /**
     * Creates a new marble with the given attributes.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub.
     * @param {String[]} args The arguments of the function. Index 0: marble name. Index 1: marble color.
     * Index 2: marble size. Index 3: marble owner.
     */
    async initMarble(stub, args) {
        if (args.length !== 4) {
            throw new Error('Incorrect number of arguments. Expecting 4');
        }
        // ==== Input sanitation ====
        console.info('--- start init marble ---');
        if (args[0].length <= 0) {
            throw new Error('1st argument must be a non-empty string');
        }
        if (args[1].length <= 0) {
            throw new Error('2nd argument must be a non-empty string');
        }
        if (args[2].length <= 0) {
            throw new Error('3rd argument must be a non-empty string');
        }
        if (args[3].length <= 0) {
            throw new Error('4th argument must be a non-empty string');
        }
        let marbleName = args[0];
        let color = args[1].toLowerCase();
        let owner = args[3].toLowerCase();
        let size = parseInt(args[2]);
        if (isNaN(size)) {
            throw new Error('3rd argument must be a numeric string');
        }

        // ==== Check if marble already exists ====
        let marbleState = await stub.getState(marbleName);
        if (marbleState.toString()) {
            throw new Error('This marble already exists: ' + marbleName);
        }

        // ==== Create marble object and marshal to JSON ====
        let marble = {};
        marble.docType = 'marble';
        marble.name = marbleName;
        marble.color = color;
        marble.size = size;
        marble.owner = owner;

        // === Save marble to state ===
        await stub.putState(marbleName, Buffer.from(JSON.stringify(marble)));
        let indexName = 'color~name';
        let colorNameIndexKey = await stub.createCompositeKey(indexName, [marble.color, marble.name]);
        console.info(colorNameIndexKey);
        //  Save index entry to state. Only the key name is needed, no need to store a duplicate copy of the marble.
        //  Note - passing a 'nil' value will effectively delete the key from state, therefore we pass null character as value
        await stub.putState(colorNameIndexKey, Buffer.from('\u0000'));
        // ==== Marble saved and indexed. Return success ====
        console.info('- end init marble');
    }

    /**
     * Retrieves the information about a marble.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub.
     * @param {String[]} args The arguments of the function. Index 0: marble name.
     * @return {Promise<Object[]>} The byte representation of the marble.
     */
    async readMarble(stub, args) {
        if (args.length !== 1) {
            throw new Error('Incorrect number of arguments. Expecting name of the marble to query');
        }

        let name = args[0];
        if (!name) {
            throw new Error(' marble name must not be empty');
        }
        let marbleAsBytes = await stub.getState(name); //get the marble from chaincode state
        if (!marbleAsBytes.toString()) {
            let jsonResp = {};
            jsonResp.Error = 'Marble does not exist: ' + name;
            throw new Error(JSON.stringify(jsonResp));
        }
        console.info('=======================================');
        console.log(marbleAsBytes.toString());
        console.info('=======================================');
        return marbleAsBytes;
    }

    /**
     * Deletes the given marble.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub.
     * @param {String[]} args The arguments of the function. Index 0: marble name.
     */
    async delete(stub, args) {
        if (args.length !== 1) {
            throw new Error('Incorrect number of arguments. Expecting name of the marble to delete');
        }
        let marbleName = args[0];
        if (!marbleName) {
            throw new Error('marble name must not be empty');
        }
        // to maintain the color~name index, we need to read the marble first and get its color
        let valAsBytes = await stub.getState(marbleName); //get the marble from chaincode state
        let jsonResp = {};
        if (!valAsBytes) {
            jsonResp.error = 'marble does not exist: ' + marbleName;
            throw new Error(jsonResp);
        }
        let marbleJSON = {};
        try {
            marbleJSON = JSON.parse(valAsBytes.toString());
        } catch (err) {
            jsonResp = {};
            jsonResp.error = 'Failed to decode JSON of: ' + marbleName;
            throw new Error(jsonResp);
        }

        await stub.deleteState(marbleName); //remove the marble from chaincode state

        // delete the index
        let indexName = 'color~name';
        let colorNameIndexKey = stub.createCompositeKey(indexName, [marbleJSON.color, marbleJSON.name]);
        if (!colorNameIndexKey) {
            throw new Error(' Failed to create the createCompositeKey');
        }
        //  Delete index entry to state.
        await stub.deleteState(colorNameIndexKey);
    }

    // ===========================================================
    // transfer a marble by setting a new owner name on the marble
    // ===========================================================
    /**
     * Transfers the given marble to a new owner.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub.
     * @param {String[]} args The arguments of the function. Index 0: marble name. Index 1: the new owner.
     */
    async transferMarble(stub, args) {
        if (args.length !== 2) {
            throw new Error('Incorrect number of arguments. Expecting marble name and owner');
        }

        let marbleName = args[0];
        let newOwner = args[1].toLowerCase();
        console.info('- start transferMarble ', marbleName, newOwner);

        let marbleAsBytes = await stub.getState(marbleName);
        if (!marbleAsBytes || !marbleAsBytes.toString()) {
            throw new Error('marble does not exist');
        }
        let marbleToTransfer = {};
        try {
            marbleToTransfer = JSON.parse(marbleAsBytes.toString()); //unmarshal
        } catch (err) {
            let jsonResp = {};
            jsonResp.error = 'Failed to decode JSON of: ' + marbleName;
            throw new Error(jsonResp);
        }
        console.info(marbleToTransfer);
        marbleToTransfer.owner = newOwner; //change the owner

        let marbleJSONasBytes = Buffer.from(JSON.stringify(marbleToTransfer));
        await stub.putState(marbleName, marbleJSONasBytes); //rewrite the marble

        console.info('- end transferMarble (success)');
    }

    /**
     * Performs a range query based on the start and end keys provided.
     *
     * Read-only function results are not typically submitted to ordering. If the read-only
     * results are submitted to ordering, or if the query is used in an update transaction
     * and submitted to ordering, then the committing peers will re-execute to guarantee that
     * result sets are stable between endorsement time and commit time. The transaction is
     * invalidated by the committing peers if the result set has changed between endorsement
     * time and commit time.
     * Therefore, range queries are a safe option for performing update transactions based on query results.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub.
     * @param {String[]} args The arguments of the function. Index 0: start key. Index 1: end key.
     * @param {Chaincode} thisObject The chaincode object context.
     * @return {Promise<Buffer>} The marbles in the given range.
     */
    async getMarblesByRange(stub, args, thisObject) {

        if (args.length !== 2) {
            throw new Error('Incorrect number of arguments. Expecting 2');
        }

        let startKey = args[0];
        let endKey = args[1];

        let resultsIterator = await stub.getStateByRange(startKey, endKey);
        let results = await thisObject.getAllResults(resultsIterator, false);

        return Buffer.from(JSON.stringify(results));
    }

    /**
     * Transfers marbles of a given color to a certain new owner.
     *
     * Uses a GetStateByPartialCompositeKey (range query) against color~name 'index'.
     * Committing peers will re-execute range queries to guarantee that result sets are stable
     * between endorsement time and commit time. The transaction is invalidated by the
     * committing peers if the result set has changed between endorsement time and commit time.
     * Therefore, range queries are a safe option for performing update transactions based on query results.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub.
     * @param {String[]} args The arguments of the function. Index 0: marble color. Index 1: new owner.
     * @param {Chaincode} thisObject The chaincode object context.
     */
    async transferMarblesBasedOnColor(stub, args, thisObject) {
        if (args.length !== 2) {
            throw new Error('Incorrect number of arguments. Expecting color and owner');
        }

        let color = args[0];
        let newOwner = args[1].toLowerCase();
        console.info('- start transferMarblesBasedOnColor ', color, newOwner);

        // Query the color~name index by color
        // This will execute a key range query on all keys starting with 'color'
        let coloredMarbleResultsIterator = await stub.getStateByPartialCompositeKey('color~name', [color]);

        let hasNext = true;
        // Iterate through result set and for each marble found, transfer to newOwner
        while (hasNext) {
            let responseRange;
            try {
                responseRange = await coloredMarbleResultsIterator.next();
            } catch (err) {
                hasNext = false;
                continue;
            }

            if (!responseRange || !responseRange.value || !responseRange.value.key) {
                return;
            }
            console.log(responseRange.value.key);

            // let value = res.value.value.toString('utf8');
            let objectType;
            let attributes;
            ({
                objectType,
                attributes
            } = await stub.splitCompositeKey(responseRange.value.key));

            let returnedColor = attributes[0];
            let returnedMarbleName = attributes[1];
            console.info(util.format('- found a marble from index:%s color:%s name:%s\n', objectType, returnedColor, returnedMarbleName));

            // Now call the transfer function for the found marble.
            // Re-use the same function that is used to transfer individual marbles
            await thisObject.transferMarble(stub, [returnedMarbleName, newOwner]);
        }

        let responsePayload = util.format('Transferred %s marbles to %s', color, newOwner);
        console.info('- end transferMarblesBasedOnColor: ' + responsePayload);
    }

    /**
     * Gets the results of a specified iterator.
     * @async
     * @param {Object} iterator The iterator to use.
     * @param {Boolean} isHistory Specifies whether the iterator returns history entries or not.
     * @return {Promise<Object[]>} The array of results in JSON format.
     */
    async getAllResults(iterator, isHistory) {
        let allResults = [];
        let hasNext = true;
        while (hasNext) {
            let res;
            try {
                res = await iterator.next();
            } catch (err) {
                hasNext = false;
                continue;
            }

            if (res.value && res.value.value.toString()) {
                let jsonRes = {};
                console.log(res.value.value.toString('utf8'));

                if (isHistory && isHistory === true) {
                    jsonRes.TxId = res.value.tx_id;
                    jsonRes.Timestamp = res.value.timestamp;
                    jsonRes.IsDelete = res.value.is_delete.toString();
                    try {
                        jsonRes.Value = JSON.parse(res.value.value.toString('utf8'));
                    } catch (err) {
                        console.log(err);
                        jsonRes.Value = res.value.value.toString('utf8');
                    }
                } else {
                    jsonRes.Key = res.value.key;
                    try {
                        jsonRes.Record = JSON.parse(res.value.value.toString('utf8'));
                    } catch (err) {
                        console.log(err);
                        jsonRes.Record = res.value.value.toString('utf8');
                    }
                }
                allResults.push(jsonRes);
            }
            if (res.done) {
                console.log('end of data');
                await iterator.close();
                console.info(allResults);
                return allResults;
            }
        }
    }

    /**
     * Retrieves the history for a marble.
     * @async
     * @param {ChaincodeStub} stub The chaincode stub.
     * @param {String[]} args The arguments of the function. Index 0: marble name.
     * @param {Chaincode} thisObject The chaincode object context.
     * @return {Promise<Buffer>} The history entries of the specified marble.
     */
    async getHistoryForMarble(stub, args, thisObject) {

        if (args.length !== 1) {
            throw new Error('Incorrect number of arguments. Expecting 1');
        }
        let marbleName = args[0];
        console.info('- start getHistoryForMarble: %s\n', marbleName);

        let resultsIterator = await stub.getHistoryForKey(marbleName);
        let results = await thisObject.getAllResults(resultsIterator, true);

        return Buffer.from(JSON.stringify(results));
    }
};

shim.start(new Chaincode());
