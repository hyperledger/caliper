/**
 * Modifications Copyright 2017 HUAWEI
 * Copyright 2016 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

'use strict';

if (global && global.hfc) global.hfc.config = undefined;
require('nconf').reset();
var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('E2E create-channel');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var Client = require('fabric-client');
var util = require('util');
var fs = require('fs');
var path = require('path');
var grpc = require('grpc');

var testUtil = require('./util.js');
var commUtils = require('../comm/util');

function run(config_path) {
    Client.addConfigFile(config_path);
    var fabric   = Client.getConfigSetting('fabric');
    var channels = fabric.channel;
    if(!channels || channels.length === 0) {
        return Promise.reject(new Error('No channel information found'));
    }
    return new Promise(function(resolve, reject) {
        var t = global.tapeObj;
        var ORGS = fabric.network;
        var caRootsPath = ORGS.orderer.tls_cacerts;
        var data = fs.readFileSync(path.join(__dirname, '../..', caRootsPath));
        var caroots = Buffer.from(data).toString();
        utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');

        return channels.reduce((prev, channel)=>{
            return prev.then(()=>{
                if(channel.deployed) {
                    return Promise.resolve();
                }

                t.comment('create ' + channel.name + '......');

                // Acting as a client in first org when creating the channel
                let client = new Client();
                let org = channel.organizations[0];
                let orderer = client.newOrderer(
                    ORGS.orderer.url,
                    {
                        'pem': caroots,
                        'ssl-target-name-override': ORGS.orderer['server-hostname']
                    }
                );

                let config = null;
                let signatures = [];

                return Client.newDefaultKeyValueStore({
                    path: testUtil.storePathForOrg(org)
                })
                .then((store) => {
                    client.setStateStore(store);
                    var cryptoSuite = Client.newCryptoSuite();
                    cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(org)}));
                    client.setCryptoSuite(cryptoSuite);
                    return testUtil.getOrderAdminSubmitter(client);
                })
                .then((admin) =>{
                    // use the config update created by the configtx tool
                    let envelope_bytes = fs.readFileSync(path.join(__dirname, '../..', channel.config));
                    config = client.extractChannelConfig(envelope_bytes);

                    // TODO: read from channel config instead of binary tx file

                    // sign the config for each org
                    return channel.organizations.reduce(function(prev, item){
                        return prev.then(() => {
                            client._userContext = null;
                            return testUtil.getSubmitter(client, true, item).then((orgAdmin) =>{
                                // sign the config
                                let signature = client.signChannelConfig(config);
                                // TODO: signature counting against policies on the orderer
                                // at the moment is being investigated, but it requires this
                                // weird double-signature from each org admin
                                signatures.push(signature);
                                signatures.push(signature);
                                return Promise.resolve();
                            });
                        })
                    }, Promise.resolve())
                    .then(()=>{
                        client._userContext = null;
                        return testUtil.getOrderAdminSubmitter(client);
                    })
                    .then((orderAdmin) => {
                        // sign the config
                        var signature = client.signChannelConfig(config);
                        // collect signature from orderer admin
                        // TODO: signature counting against policies on the orderer
                        // at the moment is being investigated, but it requires this
                        // weird double-signature from each org admin
                        signatures.push(signature);
                        signatures.push(signature);
                         // build up the create request
                        let tx_id = client.newTransactionID();
                        var request = {
                            config: config,
                            signatures : signatures,
                            name : channel.name,
                            orderer : orderer,
                            txId  : tx_id
                        };

                        // send create request to orderer
                        return client.createChannel(request);
                    })
                    .then((result) => {
                        if(result.status && result.status === 'SUCCESS') {
                            t.pass('created ' + channel.name + ' successfully');
                            return Promise.resolve();
                        }
                        else {
                            throw new Error('create status is ' + result.status);
                        }
                    });
                })
            })
        }, Promise.resolve())
        .then(()=>{
            t.comment('Sleep 5s......');
            return commUtils.sleep(5000);
        })
        .then(() => {
            return resolve();
        })
       .catch((err) => {
            t.fail('Failed to create channels ' + (err.stack?err.stack:err));
            return reject(new Error('Fabric: Create channel failed'));
        });
    });
}

module.exports.run = run;


