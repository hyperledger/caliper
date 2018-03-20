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
*
*  Query of Asset
*  Queries for a specific Asset using a pre-defined query, built from basic-sample-network
*  - Example test round (txn <= testAssets)
*      {
*        "label" : "basic-sample-network",
*        "txNumbAndTps" : [[10,20]],
*        "arguments": {"testAssets": 10, "matches": 5},
*        "callback" : "benchmark/composer/composer-micro/query-asset.js"
*      }
*  - Init: 
*    - Two Participants created (PARTICIPANT_0, PARTICIPANT_1)
*    - Test specified number of Assets created, belonging to a PARTICIPANT_0 (based on how many matches in the query to return)
*    - Test specified number of Assets created, belonging to a PARTICIPANT_1
*  - Run:
*    - Transactions run to query for created assets owned by PARTICIPANT_0
*
*/

'use strict'

module.exports.info  = "Query Asset Performance Test";

var bc;
var busNetConnection;
var testAssetNum;
var factory;
const namespace = 'org.acme.sample';

let myQuery;
let qryRef = 0;

module.exports.init = function(blockchain, context, args) {
    // Create Participants and Assets to use in main test    
    bc = blockchain;
    busNetConnection = context;
    testAssetNum = args.testAssets;
    
    factory = busNetConnection.getBusinessNetwork().getFactory();
       
    return busNetConnection.getParticipantRegistry(namespace + '.SampleParticipant')
    .then((participantRegistry) => {
        let participant1 = factory.newResource(namespace, 'SampleParticipant', 'PARTICIPANT_0');
        participant1.firstName = 'percy';
        participant1.lastName = 'penguin';

        let participant2 = factory.newResource(namespace, 'SampleParticipant', 'PARTICIPANT_1');
        participant2.firstName = 'winston';
        participant2.lastName = 'wombat';

        return participantRegistry.addAll([participant1, participant2]);
    })
    .then(() => {
        return busNetConnection.getAssetRegistry(namespace + '.SampleAsset')
    })
    .then((assetRegistry) => {
        let matched = 0;
        let assets = Array();        
        for (let i=0; i<testAssetNum; i++){                
            let asset = factory.newResource(namespace, 'SampleAsset', 'ASSET_' + i);
            if (matched >= args.matches) {
                asset.owner = factory.newRelationship(namespace, 'SampleParticipant', 'PARTICIPANT_0');
                matched++;
            } else {
                asset.owner = factory.newRelationship(namespace, 'SampleParticipant', 'PARTICIPANT_1');
            }
            asset.value = 'priceless';            
            assets.push(asset);            
        }
        console.log('Adding ' + assets.length + ' Assets......');
        return assetRegistry.addAll(assets);        
    })
    .then((resp) => {
        console.log('Asset addition complete');
        return Promise.resolve();
    })
    .then((resp) => {
        // Add a query
        console.log('Storing Query');
        myQuery = busNetConnection.buildQuery('SELECT org.acme.sample.SampleAsset WHERE (owner == _$inputValue)');
        return Promise.resolve();
    })
    .catch(function (err) {
      console.log('error in test init: ', err);
      return Promise.reject(err);
    }); 
}

module.exports.run = function() {
    // Go for a query of an asset
    let submitTime = Date.now();    
    return busNetConnection.query(myQuery, { inputValue: 'PARTICIPANT_0'})
    .then((result) => {
        let invoke_status = {
            id           : qryRef,
            status       : 'created',
            time_create  : submitTime,
            time_final   : 0,
            time_endorse : 0,
            time_order   : 0,
            result       : null
        };
    
        invoke_status.status = 'success';
        invoke_status.time_final = Date.now();
        qryRef++;
        return Promise.resolve(invoke_status);
    })
    .catch((err) => {
        invoke_status.time_final = Date.now();
        invoke_status.status = 'failed';
        return Promise.resolve(invoke_status);
    });      
}

module.exports.end = function(results) {
    return Promise.resolve(true);
};