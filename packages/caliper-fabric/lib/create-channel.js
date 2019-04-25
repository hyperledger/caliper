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

if (global && global.hfc) {
    global.hfc.config = undefined;
}

require('nconf').reset();
const CaliperUtils = require('caliper-core').CaliperUtils;
const commLogger = CaliperUtils.getLogger('create-channel.js');
const utils = require('fabric-client/lib/utils.js');
const Client = require('fabric-client');

const fs = require('fs');
const testUtil = require('./util.js');
const e2eUtils = require('./e2eUtils.js');

/**
 * Create the channels located in the given configuration file.
 * @param {string} config_path The path to the Fabric network configuration file.
 * @param {string} root_path The path to the root of the network configuration file.
 * @return {Promise} The return promise.
 */
async function run(config_path, root_path) {
    const fabric = CaliperUtils.parseYaml(config_path).fabric;
    const channels = fabric.channel;

    if(!channels || channels.length === 0) {
        return Promise.reject(new Error('No channel information found'));
    }

    try {
        let ORGS = fabric.network;
        let caRootsPath = ORGS.orderer.tls_cacerts;
        let data = fs.readFileSync(CaliperUtils.resolvePath(caRootsPath, root_path));
        let caroots = Buffer.from(data).toString();
        utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');

        for (const channel of channels) {
            if(channel.deployed) {
                continue;
            }

            commLogger.info(`Creating ${channel.name}...`);

            // Acting as a client in first org when creating the channel
            const client = new Client();
            const org = channel.organizations[0];

            // Conditional action on TLS enablement
            if(fabric.network.orderer.url.toString().startsWith('grpcs')){
                const fabricCAEndpoint = fabric.network[org].ca.url;
                const caName = fabric.network[org].ca.name;
                const tlsInfo = await e2eUtils.tlsEnroll(fabricCAEndpoint, caName);
                client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
            }

            let orderer = client.newOrderer(
                ORGS.orderer.url,
                {
                    'pem': caroots,
                    'ssl-target-name-override': ORGS.orderer['server-hostname']
                }
            );

            let config = null;
            let signatures = [];

            const store = await Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg(org)});
            client.setStateStore(store);
            let cryptoSuite = Client.newCryptoSuite();
            cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(org)}));
            client.setCryptoSuite(cryptoSuite);
            await testUtil.getOrderAdminSubmitter(client);

            // use the config update created by the configtx tool
            let envelope_bytes = fs.readFileSync(CaliperUtils.resolvePath(channel.config, root_path));
            config = client.extractChannelConfig(envelope_bytes);

            // sign the config for each org
            for (const organization of channel.organizations){
                client._userContext = null;
                await testUtil.getSubmitter(client, true, organization);
                // sign the config
                let signature = client.signChannelConfig(config).toBuffer().toString('hex');
                signatures.push(signature);
            }

            client._userContext = null;
            await testUtil.getOrderAdminSubmitter(client);

            // sign the config
            let signature = client.signChannelConfig(config);
            // collect signature from orderer admin
            signatures.push(signature);
            // build up the create request
            let tx_id = client.newTransactionID();
            let request = {
                config: config,
                signatures : signatures,
                name : channel.name,
                orderer : orderer,
                txId  : tx_id
            };

            // send create request to orderer
            const result = await client.createChannel(request);
            if(result.status && result.status === 'SUCCESS') {
                commLogger.info(`Created ${channel.name} successfully`);
            }
            else {
                throw new Error(`Create status for ${channel.name} is ${result.status} with information ${result.info}`);
            }
        }

        commLogger.info('Sleeping 5s...');
        return await CaliperUtils.sleep(5000);
    } catch(err) {
        commLogger.error(`Failed to create channels: ${(err.stack ? err.stack : err)}`);
        throw err;
    }
}

module.exports.run = run;
