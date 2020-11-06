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

const FabricClient = require('fabric-client');
const { google, common } = require('fabric-protos');
const { CaliperUtils, ConfigUtil } = require('@hyperledger/caliper-core');
const fs = require('fs');
const ClientCreator = require('./ClientCreator');

const logger = CaliperUtils.getLogger('connectors/v1/FabricChannelOperations');

/** */
class FabricChannelOperations {

    /**
     * @param {*} connectorConfiguration v
     * @param {*} aliasNameToClientMap v
     */
    constructor(connectorConfiguration) {
        this.connectorConfiguration = connectorConfiguration;
        this.aliasNameToFabricClientMap = null;

        this.configSleepAfterCreateChannel = ConfigUtil.get(ConfigUtil.keys.Fabric.SleepAfter.CreateChannel, 5000);
        this.configSleepAfterJoinChannel = ConfigUtil.get(ConfigUtil.keys.Fabric.SleepAfter.JoinChannel, 3000);
    }

    /**
     * Create all the channels and join the required peers to those created channels
     */
    async createChannelsAndJoinPeers() {
        const channelCreated = await this._createChannels();
        if (channelCreated) {
            logger.info(`Sleeping ${this.configSleepAfterCreateChannel / 1000.0}s...`);
            await CaliperUtils.sleep(this.configSleepAfterCreateChannel);
            await this._joinPeersToCreatedChannels();
            logger.info(`Sleeping ${this.configSleepAfterJoinChannel / 1000.0}s...`);
            await CaliperUtils.sleep(this.configSleepAfterJoinChannel);
        }
    }

    /**
     * Creates the specified channels if necessary.
     * @return {boolean} True, if at least one channel was created. Otherwise, false.
     * @private
     * @async
     */
    async _createChannels() {
        let atLeastOneChannelCreated = false;
        const channelNamesToCreate = this.connectorConfiguration.getChannelNamesForCreation();

        for (const channelNameToCreate of channelNamesToCreate) {
            const channelCreationDefinition = this.connectorConfiguration.getCreationDefinitionForChannelName(channelNameToCreate);

            if (ConfigUtil.get(ConfigUtil.keys.Fabric.SkipCreateChannelPrefix + channelNameToCreate, false)) {
                logger.info(`Creation of Channel '${channelNameToCreate}' is configured to skip`);
                continue;
            }

            let configUpdate;
            if (CaliperUtils.checkProperty(channelCreationDefinition, 'prebuiltTransaction')) {
                logger.info(`Channel '${channelNameToCreate}' definiton being retrieved from file`);
                configUpdate = this._getChannelConfigFromFile(channelCreationDefinition.prebuiltTransaction, channelNameToCreate);
            }
            else if (CaliperUtils.checkProperty(channelCreationDefinition, 'buildTransaction')) {
                logger.info(`Channel '${channelNameToCreate}' definiton being generated from description`);
                const channelTx = this._createChannelTxEnvelope(channelCreationDefinition.buildTransaction, channelNameToCreate);
                const payload = common.Payload.decode(channelTx.getPayload().toBuffer());
                const configtx = common.ConfigUpdateEnvelope.decode(payload.getData().toBuffer());
                configUpdate =  configtx.getConfigUpdate().toBuffer();
            } else {
                throw new Error('Channel creation specified but no prebuiltTransaction or buildTransaction provided');
            }

            // NOTE: without knowing the system channel policies, signing with every org admin is a safe bet
            const peersInChannelByOrganizationMap = await this.connectorConfiguration.getEndorsingPeersInChannelByOrganizationMap();
            const peersInOrganizationMap = peersInChannelByOrganizationMap.get(channelNameToCreate);

            const signatures = [];

            let admin;
            for (const organization of peersInOrganizationMap.keys()) {
                admin = await this._getAdminClientForOrganization(organization);
                try {
                    signatures.push(admin.signChannelConfig(configUpdate));
                } catch (err) {
                    throw new Error(`${organization}'s admin couldn't sign the configuration update of Channel '${channelNameToCreate}': ${err.message}`);
                }
            }

            const txId = admin.newTransactionID(true);
            const request = {
                config: configUpdate,
                signatures: signatures,
                name: channelNameToCreate,
                txId: txId
            };

            try {
                /** @link{BroadcastResponse} */
                const broadcastResponse = await admin.createChannel(request);

                CaliperUtils.assertDefined(broadcastResponse, `The returned broadcast response for creating Channel '${channelNameToCreate}' is undefined`);
                CaliperUtils.assertProperty(broadcastResponse, 'broadcastResponse', 'status');

                if (broadcastResponse.status !== 'SUCCESS') {
                    throw new Error(`Orderer response indicated unsuccessful Channel '${channelNameToCreate}' creation: ${broadcastResponse.status}`);
                }
            } catch (err) {
                throw new Error(`Couldn't create Channel '${channelNameToCreate}': ${err.message}`);
            }

            logger.info(`Channel '${channelNameToCreate}' successfully created`);
            atLeastOneChannelCreated = true;
        }

        return atLeastOneChannelCreated;
    }

    /**
     * Populate an envelope with a channel creation transaction
     * @param {object} channelDefinition The channel configuration object.
     * @param {string} channelName The name of the channel.
     * @return {Buffer} The extracted channel configuration bytes.
     * @private
     */
    _createChannelTxEnvelope(channelDefinition, channelName) {
        // Versioning
        const readVersion = 0;
        const writeVersion = 0;
        const appVersion = 1;
        const policyVersion = 0;

        // Build the readSet
        const readValues = {};
        readValues.Consortium = new common.ConfigValue();

        const readAppGroup = {};
        for (const mspId of channelDefinition.msps) {
            readAppGroup[mspId] = new common.ConfigGroup();
        }
        const readGroups = {};
        readGroups.Application = new common.ConfigGroup({ groups: readAppGroup });

        const readSet = new common.ConfigGroup({ version: readVersion, groups: readGroups, values: readValues });

        // Build the writeSet (based on consortium name and passed Capabiliites)
        const modPolicy = 'Admins';
        const writeValues = {};

        const consortium = new common.Consortium({ name: channelDefinition.consortium });
        writeValues.Consortium = new common.ConfigValue({ version: writeVersion, value: consortium.toBuffer() });

        if (channelDefinition.capabilities) {
            const capabilities = this._populateCapabilities(channelDefinition.capabilities);
            writeValues.Capabilities = new common.ConfigValue({ version: writeVersion, value: capabilities.toBuffer(), mod_policy: modPolicy });
        }

        // Write Policy
        const writePolicies = this._generateWritePolicy(policyVersion, modPolicy);

        // Write Application Groups
        const writeAppGroup = {};
        for (const mspId of channelDefinition.msps) {
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
        const chHeader = new common.ChannelHeader({ type: common.HeaderType.CONFIG_UPDATE, version: channelDefinition.version, timestamp: channelTimestamp, channel_id: channelName, epoch: channelEpoch });

        // Common header
        const header = new common.Header({ channel_header: chHeader.toBuffer() });

        // Form the payload header/data
        const payload = new common.Payload({ header: header, data: configUpdateEnv.toBuffer() });

        // Form and return the envelope
        const envelope = new common.Envelope({ payload: payload.toBuffer() });
        return envelope;
    }

    /**
     * Populate a Capabilities protobuf
     * @param {Array<string>} applicationCapabilities the application capability keys
     * @returns {common.Capabilities} Capabilities in a protobuff
     */
    _populateCapabilities(applicationCapabilities) {
        const capabilities = {};
        for (const capability of applicationCapabilities) {
            capabilities[capability] = new common.Capability();
        }
        return  new common.Capabilities({ capabilities: capabilities });
    }

    /**
     * Form a populted Poicy protobuf that contains an ImplicitMetaPolicy
     * @param {String} subPolicyName the sub policy name
     * @param {common.Policy.PolicyType} rule the rule type
     * @returns {common.Policy} the policy protobuf
     */
    _makeImplicitMetaPolicy(subPolicyName, rule){
        const metaPolicy = new common.ImplicitMetaPolicy({ sub_policy: subPolicyName, rule: rule });
        const policy= new common.Policy({ type: common.Policy.PolicyType.IMPLICIT_META, value: metaPolicy.toBuffer() });
        return policy;
    }

    /**
     * Generate a write policy
     * @param {number} version the policy version
     * @param {string} modPolicy the modification policy
     * @returns {Object} an object of Admin/Reader/Writer keys mapping to populated ConfigPolicy protobuffs
     */
    _generateWritePolicy(version, modPolicy) {
        // Write Policy
        const writePolicies = {};
        // admins
        const adminsPolicy = this._makeImplicitMetaPolicy('Admins', common.ImplicitMetaPolicy.Rule.MAJORITY); // majority
        writePolicies.Admins = new common.ConfigPolicy({ version: version, policy: adminsPolicy, mod_policy: modPolicy });
        // Readers
        const readersPolicy = this._makeImplicitMetaPolicy('Readers', common.ImplicitMetaPolicy.Rule.ANY); // Any
        writePolicies.Readers = new common.ConfigPolicy({ version: version, policy: readersPolicy, mod_policy: modPolicy });
        // Writers
        const writersPolicy = this._makeImplicitMetaPolicy('Writers', common.ImplicitMetaPolicy.Rule.ANY); // Any
        writePolicies.Writers = new common.ConfigPolicy({ version: version, policy: writersPolicy, mod_policy: modPolicy });
        return writePolicies;
    }

    /**
     * Extracts the channel configuration from the configured file.
     * @param {object} prebuiltTransactionFile The channel configuration file
     * @param {string} channelName The name of the channel.
     * @return {Buffer} The extracted channel configuration bytes.
     * @private
     */
    _getChannelConfigFromFile(prebuiltTransactionFile, channelName) {
        // extracting the config from the binary file
        const binaryPath = CaliperUtils.resolvePath(prebuiltTransactionFile);
        let envelopeBytes;

        try {
            envelopeBytes = fs.readFileSync(binaryPath);
        } catch (err) {
            throw new Error(`Couldn't read configuration binary for ${channelName}: ${err.message}`);
        }

        try {
            return new FabricClient().extractChannelConfig(envelopeBytes);
        } catch (err) {
            throw new Error(`Couldn't extract configuration object for ${channelName}: ${err.message}`);
        }
    }

    /**
     * Join peers to the created channels
     * @async
     * @private
     */
    async _joinPeersToCreatedChannels() {
        const channelNamesForCreation = this.connectorConfiguration.getChannelNamesForCreation();
        const errors = [];

        for (const channelNameToJoin of channelNamesForCreation) {
            let genesisBlock = null;
            const peersInChannelByOrganizationMap = await this.connectorConfiguration.getEndorsingPeersInChannelByOrganizationMap();
            const peersInOrganizationMap = peersInChannelByOrganizationMap.get(channelNameToJoin);

            for (const [organization, peersInOrganization] of peersInOrganizationMap) {
                const admin = await this._getAdminClientForOrganization(organization);
                const channelObject = admin.getChannel(channelNameToJoin, true);

                const peersToJoin = [];

                for (const peerInOrganization of peersInOrganization) {
                    try {
                        /** {@link ChannelQueryResponse} */
                        const resp = await admin.queryChannels(peerInOrganization, true);

                        if (resp.channels.some(ch => ch.channel_id === channelNameToJoin)) {
                            logger.info(`${peerInOrganization} has already joined ${channelNameToJoin}`);
                            continue;
                        }

                        peersToJoin.push(peerInOrganization);
                    } catch (err) {
                        errors.push(new Error(`Couldn't query ${channelNameToJoin} information from ${peerInOrganization}: ${err.message}`));
                    }
                }

                if (errors.length > 0) {
                    let errMsg = `The following errors occurred while querying ${channelNameToJoin} information from ${organization}'s peers:`;
                    for (const err of errors) {
                        errMsg += `\n\t- ${err.message}`;
                    }

                    logger.error(errMsg);
                    throw new Error(`Couldn't query ${channelNameToJoin} information from ${organization}'s peers`);
                }

                // all target peers of the org have already joined the channel
                if (peersToJoin.length < 1) {
                    continue;
                }

                // only retrieve the genesis block once, and "cache" it
                if (genesisBlock === null) {
                    try {
                        const genesisTxId = admin.newTransactionID(true);
                        /** @link{OrdererRequest} */
                        const genesisRequest = {
                            txId: genesisTxId
                        };
                        genesisBlock = await channelObject.getGenesisBlock(genesisRequest);
                    } catch (err) {
                        throw new Error(`Couldn't retrieve the genesis block for ${channelNameToJoin}: ${err.message}`);
                    }
                }

                const joinTxId = admin.newTransactionID(true);
                const joinRequest = {
                    block: genesisBlock,
                    txId: joinTxId,
                    targets: peersToJoin
                };

                try {
                    /**{@link ProposalResponse} array*/
                    const joinRespArray = await channelObject.joinChannel(joinRequest);
                    CaliperUtils.assertDefined(joinRespArray);

                    // Some errors are returned as Error instances, some as error messages
                    joinRespArray.forEach((propResponse, index) => {
                        if (propResponse instanceof Error) {
                            errors.push(new Error(`${peersToJoin[index]} could not join ${channelNameToJoin}: ${propResponse.message}`));
                        } else if (propResponse.response.status !== 200) {
                            errors.push(new Error(`${peersToJoin[index]} could not join ${channelNameToJoin}: ${propResponse.response.message}`));
                        }
                    });
                } catch (err) {
                    throw new Error(`Couldn't join peers ${peersToJoin.toString()} to ${channelNameToJoin}: ${err.message}`);
                }

                if (errors.length > 0) {
                    let errMsg = `The following errors occurred while ${organization}'s peers tried to join ${channelNameToJoin}:`;
                    for (const err of errors) {
                        errMsg += `\n\t- ${err.message}`;
                    }

                    logger.error(errMsg);
                    throw new Error(`${organization}'s peers couldn't join ${channelNameToJoin}`);
                }

                logger.info(`${organization}'s peers successfully joined ${channelNameToJoin}: ${peersToJoin}`);
            }
        }
    }

    /**
     * get an admin client instance for the specified organization
     *
     * @param {*} organization organization
     * @async
     */
    async _getAdminClientForOrganization(organization) {
        if (!this.aliasNameToFabricClientMap) {
            const clientCreator = new ClientCreator(this.connectorConfiguration);
            this.aliasNameToFabricClientMap = await clientCreator.createFabricClientsForAllIdentities();
        }

        const adminAliasNames = this.connectorConfiguration.getAdminAliasNamesForOrganization(organization);
        if (adminAliasNames.length === 0) {
            throw new Error(`No Organization admin for ${organization} has been declared in the network configuration`);
        }

        return this.aliasNameToFabricClientMap.get(adminAliasNames[0]);
    }
}

module.exports = FabricChannelOperations;
