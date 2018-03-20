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

var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('E2E join-channel');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var util = require('util');
var path = require('path');
var fs = require('fs');

var Client = require('fabric-client');
var EventHub = require('fabric-client/lib/EventHub.js')

var testUtil = require('./util.js');

var the_user = null;
var tx_id = null;
var rootpath = '../..'
var ORGS;
var allEventhubs = [];

module.exports.run = function (config_path) {
    Client.addConfigFile(config_path);
    var fabric   = Client.getConfigSetting('fabric');
    var channels = fabric.channel;
    if(!channels || channels.length === 0) {
        return Promise.resolve();
    }
    ORGS = Client.getConfigSetting('fabric').network;
    return new Promise(function(resolve, reject) {
        var t = global.tapeObj;
        t.comment('Join channel......')

        return channels.reduce((prev, channel)=>{
            return prev.then(() => {
                if(channel.deployed) {
                    return Promise.resolve();
                }

                t.comment('join ' + channel.name);
                let promises = [];
                channel.organizations.forEach((org, index) => {
                    promises.push(joinChannel(org, channel.name));
                });
                return Promise.all(promises).then(()=>{
                    t.pass('Successfully joined ' + channel.name);
                    return Promise.resolve();
                });
            });
        }, Promise.resolve())
        .then(() => {
            return resolve();
        })
        .catch((err)=>{
            t.fail('Failed to join peers, ' + (err.stack?err.stack:err));
            return reject(new Error('Fabric: Join channel failed'));
        });
    });
}

function disconnect(ehs) {
    for(var key in ehs) {
        var eventhub = ehs[key];
        if (eventhub && eventhub.isconnected()) {
            eventhub.disconnect();
        }
    }
}
function joinChannel(org, channelName) {
	var client  = new Client();
	var channel = client.newChannel(channelName);

	var orgName = ORGS[org].name;

	var targets = [], eventhubs = [];

	var caRootsPath = ORGS.orderer.tls_cacerts;
	let data = fs.readFileSync(path.join(__dirname, rootpath, caRootsPath));
	let caroots = Buffer.from(data).toString();
	var genesis_block = null;

	channel.addOrderer(
		client.newOrderer(
			ORGS.orderer.url,
			{
				'pem': caroots,
				'ssl-target-name-override': ORGS.orderer['server-hostname']
			}
		)
	);

	return Client.newDefaultKeyValueStore({
		path: testUtil.storePathForOrg(orgName)
	}).then((store) => {
		client.setStateStore(store);

		return testUtil.getOrderAdminSubmitter(client);
	}).then((admin) => {
		tx_id = client.newTransactionID();
		let request = {
			txId : 	tx_id
		};

		return channel.getGenesisBlock(request);
	}).then((block) =>{
		genesis_block = block;

		// get the peer org's admin required to send join channel requests
		client._userContext = null;

		return testUtil.getSubmitter(client, true /* get peer org admin */, org);
	}).then((admin) => {
		the_user = admin;
		for (let key in ORGS[org]) {
			if (ORGS[org].hasOwnProperty(key)) {
			    if(key.indexOf('peer') === 0) {
                    data = fs.readFileSync(path.join(__dirname, rootpath, ORGS[org][key]['tls_cacerts']));
                    targets.push(
                        client.newPeer(
                            ORGS[org][key].requests,
                            {
                                pem: Buffer.from(data).toString(),
                                'ssl-target-name-override': ORGS[org][key]['server-hostname']
                            }
                        )
                    );

                    let eh = new EventHub(client);  //client.newEventHub();
                    eh.setPeerAddr(
                        ORGS[org][key].events,
                        {
                            pem: Buffer.from(data).toString(),
                            'ssl-target-name-override': ORGS[org][key]['server-hostname']
                        }
                    );
                    eh.connect();
                    eventhubs.push(eh);
                    allEventhubs.push(eh);
                }
			}
		}

		var eventPromises = [];
		eventhubs.forEach((eh) => {
			let txPromise = new Promise((resolve, reject) => {
				let handle = setTimeout(reject, 30000);

				eh.registerBlockEvent((block) => {
					clearTimeout(handle);

					// in real-world situations, a peer may have more than one channel so
					// we must check that this block came from the channel we asked the peer to join
					if(block.data.data.length === 1) {
						// Config block must only contain one transaction
						var channel_header = block.data.data[0].payload.header.channel_header;
						if (channel_header.channel_id === channelName) {
							resolve();
						}
						else {
							reject(new Error('invalid channel name'));
						}
					}
				});
			});

			eventPromises.push(txPromise);
		});
		tx_id = client.newTransactionID();
		let request = {
			targets : targets,
			block : genesis_block,
			txId : 	tx_id
		};
		let sendPromise = channel.joinChannel(request);
		return Promise.all([sendPromise].concat(eventPromises));
	})
	.then((results) => {
	    disconnect(eventhubs);
		if(results[0] && results[0][0] && results[0][0].response && results[0][0].response.status == 200) {
			// t.pass(util.format('Successfully joined peers in organization %s to join the channel', orgName));
		} else {
			throw new Error('Unexpected join channel response');
		}
	})
	.catch((err)=>{
	    disconnect(eventhubs);
	    return Promise.reject(err);
	});
}

