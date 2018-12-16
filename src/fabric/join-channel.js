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

const fs = require('fs');

const Client = require('fabric-client');
const EventHub = require('fabric-client/lib/EventHub.js');

const testUtil = require('./util.js');
const commUtils = require('../comm/util');
const commlogger = commUtils.getLogger('join-channel.js');

//let the_user = null;
let tx_id = null;
let ORGS;
const allEventhubs = [];

/**
 * Disconnect from the given list of event hubs.
 * @param {object[]} ehs A collection of event hubs.
 */
function disconnect(ehs) {
    for(let key in ehs) {
        const eventhub = ehs[key];
        if (eventhub && eventhub.isconnected()) {
            eventhub.disconnect();
        }
    }
}

/**
 * Join the peers of the given organization to the given channel.
 * @param {string} org The name of the organization.
 * @param {string} channelName The name of the channel.
 * @async
 */
async function joinChannel(org, channelName) {
    const client = new Client();
    const channel = client.newChannel(channelName);

    const orgName = ORGS[org].name;

    const targets = [], eventhubs = [];

    const caRootsPath = ORGS.orderer.tls_cacerts;
    let data = fs.readFileSync(commUtils.resolvePath(caRootsPath));
    let caroots = Buffer.from(data).toString();

    channel.addOrderer(
        client.newOrderer(
            ORGS.orderer.url,
            {
                'pem': caroots,
                'ssl-target-name-override': ORGS.orderer['server-hostname']
            }
        )
    );

    try {
        let store = await Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg(orgName)});
        client.setStateStore(store);
        await testUtil.getOrderAdminSubmitter(client);
        tx_id = client.newTransactionID();
        let request = {
            txId : tx_id
        };

        let genesis_block = await channel.getGenesisBlock(request);
        // get the peer org's admin required to send join channel requests
        client._userContext = null;
        await testUtil.getSubmitter(client, true /* get peer org admin */, org);

        //the_user = admin;
        for (let key in ORGS[org]) {
            if (!ORGS[org].hasOwnProperty(key) || key.indexOf('peer') !== 0) {
                continue;
            }

            data = fs.readFileSync(commUtils.resolvePath(ORGS[org][key].tls_cacerts));
            targets.push(
                client.newPeer(
                    ORGS[org][key].requests,
                    {
                        pem: Buffer.from(data).toString(),
                        'ssl-target-name-override': ORGS[org][key]['server-hostname']
                    }
                )
            );
            let eh = new EventHub(client);
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

        const eventPromises = [];
        eventhubs.forEach((eh) => {
            let txPromise = new Promise((resolve, reject) => {
                let handle = setTimeout(reject, 30000);

                eh.registerBlockEvent((block) => {
                    clearTimeout(handle);

                    // in real-world situations, a peer may have more than one channel so
                    // we must check that this block came from the channel we asked the peer to join
                    if(block.data.data.length === 1) {
                        // Config block must only contain one transaction
                        const channel_header = block.data.data[0].payload.header.channel_header;
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
        request = {
            targets : targets,
            block : genesis_block,
            txId : tx_id
        };

        let sendPromise = channel.joinChannel(request);
        let results = await Promise.all([sendPromise].concat(eventPromises));

        disconnect(eventhubs);
        if(results[0] && results[0][0] && results[0][0].response && results[0][0].response.status === 200) {
            commlogger.info(`Successfully joined ${orgName}'s peers to ${channelName}`);
        } else {
            throw new Error('Unexpected join channel response');
        }
    } catch (err) {
        disconnect(eventhubs);
        commlogger.error(`Couldn't join ${orgName}'s peers to ${channelName}: ${err.stack ? err.stack : err}`);
        throw err;
    }
}

module.exports.run = async function (config_path) {
    const fabric = commUtils.parseYaml(config_path).fabric;
    let channels = fabric.channel;
    if(!channels || channels.length === 0) {
        return;
    }
    ORGS = fabric.network;
    commlogger.info('Joining channels...');

    try {
        for (let channel of channels) {
            if(channel.deployed) {
                continue;
            }

            commlogger.info(`Joining ${channel.name}...`);
            for (let org of channel.organizations) {
                // NOTE: made the execution sequential for easier debugging
                await joinChannel(org, channel.name);
            }

            commlogger.info(`Successfully joined ${channel.name}`);
        }
    } catch (err) {
        commlogger.error(`Failed to join peers: ${(err.stack ? err.stack : err)}`);
        throw err;
    }
};

