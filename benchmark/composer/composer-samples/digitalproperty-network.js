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
*  Digital Property Network
*  Registers a Property for sale through a Transaction.
*  - Example test round
*      {
*        "label" : "digitalproperty-network",
*        "txNumbAndTps" : [[10,20]],
*        "arguments": {"testAssets": 10},
*        "callback" : "benchmark/composer/composer-samples/digitalproperty-network.js"
*      }
*  - Init: 
*    - Single Participant (Person) created
*    - Test specified number of Assets (LandTitle) created, belonging to a Participant
*  - Run:
*    - Transactions run against all created Assets to register them for sale
*
*/

'use strict'

module.exports.info  = "Digital Property Network Performance Test";

const namespace = 'net.biz.digitalPropertyNetwork';

var bc;
var busNetConnection;
var factory;

var testAssetNum;
var assetId = 0;

module.exports.init = function(blockchain, context, args) {
    // Create Participants and Assets to use in main test    
    bc = blockchain;
    busNetConnection = context;
    testAssetNum = args.testAssets;

    factory = busNetConnection.getBusinessNetwork().getFactory();
   
    return busNetConnection.getParticipantRegistry(namespace + '.Person')
    .then((participantRegistry) => {
        let participant = factory.newResource(namespace, 'Person', 'PERSON_0');
        participant.firstName = 'penguin';
        participant.lastName = 'wombat';
        return participantRegistry.addAll([participant]);
    })
    .then(() => {
        return busNetConnection.getAssetRegistry(namespace + '.LandTitle');
    })
    .then((assetRegistry) => {
        var assets   = Array();  
        for (let i = 0; i < testAssetNum; i ++) {
            let testAsset = factory.newResource(namespace, 'LandTitle', 'TITLE_' + i);
            testAsset.owner = factory.newRelationship(namespace, 'Person', 'PERSON_0');
            testAsset.information = 'Random information';
            assets.push(testAsset);
        }        
        console.log('Adding ' + assets.length + ' Assets......');
        return assetRegistry.addAll(assets);        
    })
    .then((resp) => {
        console.log('Asset addition complete');
        return Promise.resolve();
    })
    .catch(function (err) {
      console.log('error in test init: ', err);
      return Promise.reject(err);
    }); 
}

module.exports.run = function() {
    let transaction = factory.newTransaction(namespace, 'RegisterPropertyForSale');
    transaction.seller = factory.newRelationship(namespace, 'Person', 'myId');
    transaction.title = factory.newRelationship(namespace, 'LandTitle', 'TITLE_' + assetId++);  
    return bc.bcObj.submitTransaction(busNetConnection, transaction);
}

module.exports.end = function(results) {
    return Promise.resolve(true);
};