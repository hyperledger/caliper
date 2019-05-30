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

const {google, common} = require('fabric-protos');

/**
 * Populate an empty object with application capabilities
 * @param {*} applicationCapabilities the application capability keys
 * @returns {*} capabilities in a protobuffer
 */
function populateCapabilities(applicationCapabilities) {
    const capabilities = {};
    for (const capability of applicationCapabilities) {
        capabilities[capability] = new common.Capability();
    }
    return  new common.Capabilities({ capabilities: capabilities });
}

/**
 * @param {*} subPolicyName cn
 * @param {*} rule rule
 * @returns {*} the policy
 */
function makeImplicitMetaPolicy(subPolicyName, rule){
    const metaPolicy = new common.ImplicitMetaPolicy({ sub_policy: subPolicyName, rule: rule });
    const policy= new common.Policy({ type: common.Policy.PolicyType.IMPLICIT_META, value: metaPolicy.toBuffer() });
    return policy;
}

/**
 * Generate a write policy
 * @param {*} version the policy version
 * @param {string} modPolicy the modification policy
 * @returns {*} an object of Admin/Reader/Writer keys mapping to populated ConfigPolicy protobuffers
 */
function generateWritePolicy(version, modPolicy) {
    // Write Policy
    const writePolicies = {};
    // admins
    const adminsPolicy = makeImplicitMetaPolicy('Admins', common.ImplicitMetaPolicy.Rule.MAJORITY); // majority
    writePolicies.Admins = new common.ConfigPolicy({ version: version, policy: adminsPolicy, mod_policy: modPolicy });
    // Readers
    const readersPolicy = makeImplicitMetaPolicy('Readers', common.ImplicitMetaPolicy.Rule.ANY); // Any
    writePolicies.Readers = new common.ConfigPolicy({ version: version, policy: readersPolicy, mod_policy: modPolicy });
    // Writers
    const writersPolicy = makeImplicitMetaPolicy('Writers', common.ImplicitMetaPolicy.Rule.ANY); // Any
    writePolicies.Writers = new common.ConfigPolicy({ version: version, policy: writersPolicy, mod_policy: modPolicy });
    return writePolicies;
}
/**
 * Create tx for channel create
 * @param {string} channelName name of chanel to be created
 * @param {number} channelVersion the channel version being configured
 * @param {Array<string>} applicationCapabilities application capabilities for the channel
 * @param {string} consortiumName the consortium name for the channel. Must match that specified in the original configtx.yaml file
 * @param {Array<string>} mspIds array of mspids that are specified in the original configtx.yaml file
 * @returns {common.Envelope} a channelTx envelope
 */
function createChannelTxEnvelope(channelName, channelVersion, applicationCapabilities, consortiumName, mspIds) {

    // Versioning
    const readVersion = 0;
    const writeVersion = 0;
    const appVersion = 1;
    const policyVersion = 0;

    // Build the readSet
    const readValues = {};
    readValues.Consortium = new common.ConfigValue();

    const readAppGroup = {};
    for (const mspId of mspIds) {
        readAppGroup[mspId] = new common.ConfigGroup();
    }
    const readGroups = {};
    readGroups.Application = new common.ConfigGroup({ groups: readAppGroup });

    const readSet = new common.ConfigGroup({ version: readVersion, groups: readGroups, values: readValues });

    // Build the writeSet (based on consortium name and passed Capabiliites)
    const modPolicy = 'Admins';
    const writeValues = {};

    const consortium = new common.Consortium({ name: consortiumName });
    writeValues.Consortium = new common.ConfigValue({ version: writeVersion, value: consortium.toBuffer() });

    if (applicationCapabilities) {
        const capabilities = populateCapabilities(applicationCapabilities);
        writeValues.Capabilities = new common.ConfigValue({ version: writeVersion, value: capabilities.toBuffer(), mod_policy: modPolicy });
    }

    // Write Policy
    const writePolicies = generateWritePolicy(policyVersion, modPolicy);

    // Write Application Groups
    const writeAppGroup = {};
    for (const mspId of mspIds) {
        writeAppGroup[mspId] = new common.ConfigGroup();
    }

    const writeGroups = {};
    writeGroups.Application = new common.ConfigGroup({ version: appVersion, groups: writeAppGroup, policies: writePolicies, mod_policy: modPolicy });

    const writeSet = new common.ConfigGroup({ version: writeVersion, groups: writeGroups, values: writeValues });

    // Now create the configUpdate and configUpdateEnv
    const configUpdate = new common.ConfigUpdate({ channel_id: channelName, read_set: readSet, write_set: writeSet});
    const configUpdateEnv= new common.ConfigUpdateEnvelope({ config_update: configUpdate.toBuffer(), signatures: [] });

    // Channel header
    const channelTimestamp = new google.protobuf.Timestamp({ seconds: Date.now()/1000, nanos: 0 }); // Date.now() is millis since 1970 epoch, we need seconds
    const channelEpoch = 0;
    const chHeader = new common.ChannelHeader({ type: common.HeaderType.CONFIG_UPDATE, version: channelVersion, timestamp: channelTimestamp, channel_id: channelName, epoch: channelEpoch });

    // Common header
    const header = new common.Header({ channel_header: chHeader.toBuffer() });

    // Form the payload header/data
    const payload = new common.Payload({ header: header, data: configUpdateEnv.toBuffer() });

    // Form and return the envelope
    const envelope = new common.Envelope({ payload: payload.toBuffer() });
    return envelope;
}

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

            if (channel.config) {
                commLogger.info(`Channel '${channel}' definiton being retrieved from file`);
                let envelope_bytes = fs.readFileSync(CaliperUtils.resolvePath(channel.config, root_path));
                config = client.extractChannelConfig(envelope_bytes);
            } else {
                // Use the protos to create a channelTx envelope and then extract the config buffer required
                commLogger.info(`Channel '${channel}' definiton being generated`);
                const channelTx = createChannelTxEnvelope(channel.name, channel.version, channel.capabilities, channel.consortium, channel.msps);
                const payload = common.Payload.decode(channelTx.getPayload().toBuffer());
                const configtx = common.ConfigUpdateEnvelope.decode(payload.getData().toBuffer());
                config =  configtx.getConfigUpdate().toBuffer();
            }

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
