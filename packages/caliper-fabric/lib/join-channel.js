/**
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
*/

'use strict';

const fs = require('fs');
const Client = require('fabric-client');
const e2eUtils = require('./e2eUtils.js');
const testUtil = require('./util.js');
const CaliperUtils = require('caliper-core').CaliperUtils;
const commlogger = CaliperUtils.getLogger('join-channel.js');

/**
 * Join the peers of the given organization to the given channel.
 * @param {string} org The name of the organization.
 * @param {string} channelName The name of the channel.
 * @param {object} orgs orgs from configuration details.
 * @param {string} root_path The path to the root of the network configuration file.
 * @async
 */
async function joinChannel(org, channelName, orgs, root_path) {
    const client = new Client();
    const channel = client.newChannel(channelName);
    const orgName = orgs[org].name;
    const targets = [];

    const caRootsPath = orgs.orderer.tls_cacerts;
    let data = fs.readFileSync(CaliperUtils.resolvePath(caRootsPath, root_path));
    let caroots = Buffer.from(data).toString();

    try {

        // Conditional action on TLS enablement
        if(orgs.orderer.url.toString().startsWith('grpcs')){
            const fabricCAEndpoint = orgs[org].ca.url;
            const caName = orgs[org].ca.name;
            const tlsInfo = await e2eUtils.tlsEnroll(fabricCAEndpoint, caName);
            client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
        }

        const store = await Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg(orgName)});
        client.setStateStore(store);
        await testUtil.getOrderAdminSubmitter(client);

        channel.addOrderer(
            client.newOrderer(
                orgs.orderer.url,
                {
                    'pem': caroots,
                    'ssl-target-name-override': orgs.orderer['server-hostname']
                }
            )
        );

        let tx_id = client.newTransactionID();
        let request = {
            txId : tx_id
        };

        const genesis_block = await channel.getGenesisBlock(request);

        // get the peer org's admin required to send join channel requests
        client._userContext = null;

        await testUtil.getSubmitter(client, true /* get peer org admin */, org);

        for (let key in orgs[org]) {
            if (orgs[org].hasOwnProperty(key)) {
                if(key.indexOf('peer') === 0) {
                    data = fs.readFileSync(CaliperUtils.resolvePath(orgs[org][key].tls_cacerts, root_path));
                    targets.push(
                        client.newPeer(
                            orgs[org][key].requests,
                            {
                                pem: Buffer.from(data).toString(),
                                'ssl-target-name-override': orgs[org][key]['server-hostname']
                            }
                        )
                    );
                }
            }
        }

        tx_id = client.newTransactionID();
        request = {
            targets : targets,
            block : genesis_block,
            txId : tx_id
        };

        const results = await channel.joinChannel(request, 130000);

        if(results[0] && results[0].response && results[0].response.status === 200) {
            commlogger.info(`Successfully joined ${orgName}'s peers to ${channelName}`);
        } else {
            throw new Error('Unexpected join channel response: ' + JSON.stringify(results));
        }
    } catch (err) {
        commlogger.error(`Couldn't join ${orgName}'s peers to ${channelName}: ${err.stack ? err.stack : err}`);
        throw err;
    }
}

/**
 * Join the channel
 * @param {*} config_path The path to the Fabric network configuration file.
 * @param {String} root_path the root path to netowrk config
 * @async
 */
async function run(config_path, root_path) {
    const fabric = CaliperUtils.parseYaml(config_path).fabric;
    let channels = fabric.channel;
    if(!channels || channels.length === 0) {
        return;
    }
    const orgs = fabric.network;
    commlogger.info('Joining channels...');

    try {
        for (let channel of channels) {
            if(channel.deployed) {
                continue;
            }

            for (let org of channel.organizations) {
                // NOTE: made the execution sequential for easier debugging
                commlogger.info(`Joining organization ${org} to channel ${channel.name}...`);
                await joinChannel(org, channel.name, orgs, root_path);
            }

            commlogger.info(`Successfully joined ${channel.name}`);
        }
    } catch (err) {
        commlogger.error(`Failed to join peers: ${(err.stack ? err.stack : err)}`);
        throw err;
    }
}

module.exports.run = run;
