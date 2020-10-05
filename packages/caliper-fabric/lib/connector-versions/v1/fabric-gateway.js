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
const { DefaultEventHandlerStrategies, DefaultQueryHandlerStrategies, FileSystemWallet, Gateway, InMemoryWallet, X509WalletMixin } = require('fabric-network');
const { google, common } = require('fabric-protos');
const { ConnectorBase, CaliperUtils, TxStatus, ConfigUtil } = require('@hyperledger/caliper-core');
const FabricNetwork = require('../../fabricNetwork.js');

const fs = require('fs');
const semver = require('semver');

const logger = CaliperUtils.getLogger('connectors/v1/fabric-gateway');

const EventStrategies = {
    msp_all : DefaultEventHandlerStrategies.MSPID_SCOPE_ALLFORTX,
    msp_any : DefaultEventHandlerStrategies.MSPID_SCOPE_ANYFORTX,
    network_all : DefaultEventHandlerStrategies.NETWORK_SCOPE_ALLFORTX,
    network_any : DefaultEventHandlerStrategies.NETWORK_SCOPE_ANYFORTX,
};

const QueryStrategies = {
    msp_single : DefaultQueryHandlerStrategies.MSPID_SCOPE_SINGLE,
    msp_round_robin : DefaultQueryHandlerStrategies.MSPID_SCOPE_ROUND_ROBIN,
};

//////////////////////
// TYPE DEFINITIONS //
//////////////////////

/**
 * @typedef {Object} ContractInvokeSettings
 *
 * @property {string} contractId Required. The name/ID of the contract whose function
 *           should be invoked.
 * @property {string} contractVersion Required. The version of the contract whose function
 *           should be invoked.
 * @property {string} contractFunction Required. The name of the function that should be
 *           invoked in the contract.
 * @property {string[]} [contractArguments] Optional. The list of {string} arguments that should
 *           be passed to the contract.
 * @property {Map<string, Buffer>} [transientMap] Optional. The transient map that should be
 *           passed to the contract.
 * @property {string} invokerIdentity Required. The name of the client who should invoke the
 *           contract. If an admin is needed, use the organization name prefixed with a # symbol.
 * @property {string} channel Required. The name of the channel whose contract should be invoked.
 * @property {string[]} [targetPeers] Optional. An array of endorsing
 *           peer names as the targets of the invoke. When this
 *           parameter is omitted the target list will include the endorsing peers assigned
 *           to the target contract, or if it is also omitted, to the channel.
 * @property {string[]} [targetOrganizations] Optional. An array of endorsing
 *           organizations as the targets of the invoke. If both targetPeers and targetOrganizations
 *           are specified then targetPeers will take precedence
 * @property {string} [orderer] Optional. The name of the orderer to whom the request should
 *           be submitted. If omitted, then the first orderer node of the channel will be used.
 */

/**
 * @typedef {Object} ContractQuerySettings
 *
 * @property {string} contractId Required. The name/ID of the contract whose function
 *           should be invoked.
 * @property {string} contractVersion Required. The version of the contract whose function
 *           should be invoked.
 * @property {string} contractFunction Required. The name of the function that should be
 *           invoked in the contract.
 * @property {string[]} [contractArguments] Optional. The list of {string} arguments that should
 *           be passed to the contract.
 * @property {Map<string, Buffer>} [transientMap] Optional. The transient map that should be
 *           passed to the contract.
 * @property {string} invokerIdentity Required. The name of the client who should invoke the
 *           contract. If an admin is needed, use the organization name prefixed with a # symbol.
 * @property {string} channel Required. The name of the channel whose contract should be invoked.
 * @property {boolean} [countAsLoad] Optional. Indicates whether to count this query as workload.
 */

/////////////////////////////
// END OF TYPE DEFINITIONS //
/////////////////////////////

/**
 * Extends {BlockchainConnector} for a Fabric backend, utilizing the SDK Common Connection Profile.
 *
 * @property {Version} version Contains the version information about the used Fabric SDK.
 * @property {Map<string, FabricClient>} clientProfiles Contains the initialized and user-specific SDK client profiles
 *           for each defined user. Maps the custom user names to the Client instances.
 * @property {Map<string, FabricClient>} adminProfiles Contains the initialized and admin-specific SDK client profiles
 *           for each defined admin. Maps the custom organization names to the Client instances
 *           (since only one admin per org is supported).
 * @property {Map<string, FabricClient>} registrarProfiles Contains the initialized and registrar-specific SDK client
 *           profiles for each defined registrar. Maps the custom organization names to the Client instances
 *           (since only one registrar per org is supported).
 * @property {EventSource[]} eventSources Collection of potential event sources to listen to for transaction confirmation events.
 * @property {number} workerIndex The index of the client process using the adapter that is set in the constructor
 * @property {number} txIndex A counter for keeping track of the index of the currently submitted transaction.
 * @property {FabricNetwork} networkUtil Utility object containing easy-to-query information about the topology
 *           and settings of the network.
 * @property {Map<string, Map<string, Map<string, string[]>>>} randomTargetPeerCache Contains the target peers of contracts
 *           grouped by channels and organizations: Channel -> Contract -> Org -> Peers
 * @property {Map<string, EventSource[]>} channelEventSourcesCache Contains the list of event sources for every channel.
 * @property {Map<string, string[]>} randomTargetOrdererCache Contains the list of target orderers of channels.
 * @property {string} defaultInvoker The name of the client to use if an invoker is not specified.
 * @property {number} configSmallestTimeout The timeout value to use when the user-provided timeout is too small.
 * @property {number} configSleepAfterCreateChannel The sleep duration in milliseconds after creating the channels.
 * @property {number} configSleepAfterJoinChannel The sleep duration in milliseconds after joining the channels.
 * @property {number} configSleepAfterInstantiateContract The sleep duration in milliseconds after instantiating the contracts.
 * @property {boolean} configVerifyProposalResponse Indicates whether to verify the proposal responses of the endorsers.
 * @property {boolean} configVerifyReadWriteSets Indicates whether to verify the matching of the returned read-write sets.
 * @property {number} configLatencyThreshold The network latency threshold to use for calculating the final commit time of transactions.
 * @property {boolean} configOverwriteGopath Indicates whether GOPATH should be set to the Caliper root directory.
 * @property {number} configContractInstantiateTimeout The timeout in milliseconds for the contract instantiation endorsement.
 * @property {number} configContractInstantiateEventTimeout The timeout in milliseconds for receiving the contract instantiation event.
 * @property {number} configDefaultTimeout The default timeout in milliseconds to use for invoke/query transactions.
 * @property {boolean} configCountQueryAsLoad Indicates whether queries should be counted as workload.
 * @property {boolean} configLocalHost Indicates whether to use the localhost default within the Fabric Gateway API
 * @property {boolean} configDiscovery Indicates whether to use discovery within the Fabric Gateway API
 */
class LegacyV1FabricGateway extends ConnectorBase {
    /**
     * Initializes the Fabric adapter.
     * @param {object} networkObject The parsed network configuration.
     * @param {number} workerIndex the worker index
     * @param {string} bcType The target SUT type
     */
    constructor(networkObject, workerIndex, bcType) {
        super(workerIndex, bcType);
        this.version = require('fabric-client/package').version;

        // clone the object to prevent modification by other objects
        this.network = CaliperUtils.parseYamlString(CaliperUtils.stringifyYaml(networkObject));

        this.clientProfiles = new Map();
        this.adminProfiles = new Map();
        this.registrarProfiles = new Map();
        this.txIndex = -1;
        this.orgWallets = new Map();
        this.userContracts = new Map();
        this.userGateways = new Map();
        this.peerCache = new Map();
        this.context = undefined;

        // this value is hardcoded, if it's used, that means that the provided timeouts are not sufficient
        this.configSmallestTimeout = 1000;

        this.configSleepAfterCreateChannel = ConfigUtil.get(ConfigUtil.keys.Fabric.SleepAfter.CreateChannel, 5000);
        this.configSleepAfterJoinChannel = ConfigUtil.get(ConfigUtil.keys.Fabric.SleepAfter.JoinChannel, 3000);
        this.configSleepAfterInstantiateContract = ConfigUtil.get(ConfigUtil.keys.Fabric.SleepAfter.InstantiateContract, 5000);
        this.configVerifyProposalResponse = ConfigUtil.get(ConfigUtil.keys.Fabric.Verify.ProposalResponse, true);
        this.configVerifyReadWriteSets = ConfigUtil.get(ConfigUtil.keys.Fabric.Verify.ReadWriteSets, true);
        this.configLatencyThreshold = ConfigUtil.get(ConfigUtil.keys.Fabric.LatencyThreshold, 1.0);
        this.configOverwriteGopath = ConfigUtil.get(ConfigUtil.keys.Fabric.OverwriteGopath, true);
        this.configContractInstantiateTimeout = ConfigUtil.get(ConfigUtil.keys.Fabric.Timeout.ContractInstantiate, 300000);
        this.configContractInstantiateEventTimeout = ConfigUtil.get(ConfigUtil.keys.Fabric.Timeout.ContractInstantiateEvent, 300000);
        this.configDefaultTimeout = ConfigUtil.get(ConfigUtil.keys.Fabric.Timeout.InvokeOrQuery, 60000);
        this.configCountQueryAsLoad = ConfigUtil.get(ConfigUtil.keys.Fabric.CountQueryAsLoad, true);

        // Gateway connector
        this.configLocalHost = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.LocalHost, true);
        this.configDiscovery = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.Discovery, false);
        this.eventStrategy = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.EventStrategy, 'msp_all');
        this.queryStrategy = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.QueryStrategy, 'msp_single');

        this.networkUtil = new FabricNetwork(this.network);
        this.defaultInvoker = Array.from(this.networkUtil.getClients())[0];

        this._prepareOrgWallets();
    }

    ////////////////////////////////
    // INTERNAL UTILITY FUNCTIONS //
    ////////////////////////////////

    /**
     * Assembles the event sources based on explicitly given target peers.
     * @param {string} channel The name of channel containing the target peers. Doesn't matter if peer-level event service is used in compatibility mode.
     * @param {string[]} targetPeers The list of peers to connect to.
     * @return {EventSource[]} The list of event sources.
     * @private
     */
    _assembleTargetEventSources(channel, targetPeers) {
        const eventSources = [];

        for (const peer of targetPeers) {
            const org = this.networkUtil.getOrganizationOfPeer(peer);
            const admin = this.adminProfiles.get(org);

            const eventHub = admin.getChannel(channel, true).newChannelEventHub(peer);

            eventSources.push({
                channel: [channel], // unused during contract instantiation
                peer: peer,
                eventHub: eventHub
            });
        }

        return eventSources;
    }

    /**
     * Creates the specified channels if necessary.
     * @return {boolean} True, if at least one channel was created. Otherwise, false.
     * @private
     * @async
     */
    async _createChannels() {
        const channels = this.networkUtil.getChannels();
        let channelCreated = false;

        for (const channel of channels) {
            const channelObject = this.networkUtil.getNetworkObject().channels[channel];

            if (CaliperUtils.checkProperty(channelObject, 'created') && channelObject.created) {
                logger.info(`Channel '${channel}' is configured as created, skipping creation`);
                continue;
            }

            if (ConfigUtil.get(ConfigUtil.keys.Fabric.SkipCreateChannelPrefix + channel, false)) {
                logger.info(`Creation of Channel '${channel}' is configured to skip`);
                continue;
            }

            channelCreated = true;

            let configUpdate;
            if (CaliperUtils.checkProperty(channelObject, 'configBinary')) {
                logger.info(`Channel '${channel}' definiton being retrieved from file`);
                configUpdate = this._getChannelConfigFromFile(channelObject, channel);
            }
            else {
                logger.info(`Channel '${channel}' definiton being generated from description`);
                const channelTx = this._createChannelTxEnvelope(channelObject.definition, channel);
                const payload = common.Payload.decode(channelTx.getPayload().toBuffer());
                const configtx = common.ConfigUpdateEnvelope.decode(payload.getData().toBuffer());
                configUpdate =  configtx.getConfigUpdate().toBuffer();
            }

            // NOTE: without knowing the system channel policies, signing with every org admin is a safe bet
            const orgs = this.networkUtil.getOrganizationsOfChannel(channel);
            let admin; // declared here to keep the admin of the last org of the channel
            const signatures = [];
            for (const org of orgs) {
                admin = this.adminProfiles.get(org);
                try {
                    signatures.push(admin.signChannelConfig(configUpdate));
                } catch (err) {
                    throw new Error(`${org}'s admin couldn't sign the configuration update of Channel '${channel}': ${err.message}`);
                }
            }

            const txId = admin.newTransactionID(true);
            const request = {
                config: configUpdate,
                signatures: signatures,
                name: channel,
                txId: txId
            };

            try {
                /** @link{BroadcastResponse} */
                const broadcastResponse = await admin.createChannel(request);

                CaliperUtils.assertDefined(broadcastResponse, `The returned broadcast response for creating Channel '${channel}' is undefined`);
                CaliperUtils.assertProperty(broadcastResponse, 'broadcastResponse', 'status');

                if (broadcastResponse.status !== 'SUCCESS') {
                    throw new Error(`Orderer response indicated unsuccessful Channel '${channel}' creation: ${broadcastResponse.status}`);
                }
            } catch (err) {
                throw new Error(`Couldn't create Channel '${channel}': ${err.message}`);
            }

            logger.info(`Channel '${channel}' successfully created`);
        }

        return channelCreated;
    }

    /**
     * Creates and sets a User object as the context based on the provided identity information.
     * @param {Client} profile The Client object whose user context must be set.
     * @param {string} org The name of the user's organization.
     * @param {string} userName The name of the user.
     * @param {{privateKeyPEM: Buffer, signedCertPEM: Buffer}} cryptoContent The object containing the signing key and cert in PEM format.
     * @param {string} profileName Optional name of the profile that will appear in error messages.
     * @returns {FabricClient.User} The User object created
     * @private
     * @async
     */
    async _createUser(profile, org, userName, cryptoContent, profileName) {
        // set the user explicitly based on its crypto materials
        // createUser also sets the user context
        try {
            return await profile.createUser({
                username: userName,
                mspid: this.networkUtil.getMspIdOfOrganization(org),
                cryptoContent: cryptoContent,
                skipPersistence: true
            });
        } catch (err) {
            throw new Error(`Couldn't create ${profileName || ''} user object: ${err.message}`);
        }
    }

    /**
     * Enrolls the given user through its corresponding CA.
     * @param {Client} profile The Client object whose user must be enrolled.
     * @param {string} id The enrollment ID.
     * @param {string} secret The enrollment secret.
     * @param {string} profileName Optional name of the profile that will appear in error messages.
     * @return {Promise<{key: ECDSA_KEY, certificate: string}>} The resulting private key and certificate.
     * @private
     * @async
     */
    async _enrollUser(profile, id, secret, profileName) {
        // this call will throw an error if the CA configuration is not found
        // this error should propagate up
        const ca = profile.getCertificateAuthority();
        try {
            return await ca.enroll({
                enrollmentID: id,
                enrollmentSecret: secret
            });
        } catch (err) {
            throw new Error(`Couldn't enroll ${profileName || 'user'}: ${err.message}`);
        }
    }

    /**
     * Populate an envelope with a channel creation transaction
     * @param {object} channelObject The channel configuration object.
     * @param {string} channelName The name of the channel.
     * @return {Buffer} The extracted channel configuration bytes.
     * @private
     */
    _createChannelTxEnvelope(channelObject, channelName) {
        // Versioning
        const readVersion = 0;
        const writeVersion = 0;
        const appVersion = 1;
        const policyVersion = 0;

        // Build the readSet
        const readValues = {};
        readValues.Consortium = new common.ConfigValue();

        const readAppGroup = {};
        for (const mspId of channelObject.msps) {
            readAppGroup[mspId] = new common.ConfigGroup();
        }
        const readGroups = {};
        readGroups.Application = new common.ConfigGroup({ groups: readAppGroup });

        const readSet = new common.ConfigGroup({ version: readVersion, groups: readGroups, values: readValues });

        // Build the writeSet (based on consortium name and passed Capabiliites)
        const modPolicy = 'Admins';
        const writeValues = {};

        const consortium = new common.Consortium({ name: channelObject.consortium });
        writeValues.Consortium = new common.ConfigValue({ version: writeVersion, value: consortium.toBuffer() });

        if (channelObject.capabilities) {
            const capabilities = this._populateCapabilities(channelObject.capabilities);
            writeValues.Capabilities = new common.ConfigValue({ version: writeVersion, value: capabilities.toBuffer(), mod_policy: modPolicy });
        }

        // Write Policy
        const writePolicies = this._generateWritePolicy(policyVersion, modPolicy);

        // Write Application Groups
        const writeAppGroup = {};
        for (const mspId of channelObject.msps) {
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
        const chHeader = new common.ChannelHeader({ type: common.HeaderType.CONFIG_UPDATE, version: channelObject.version, timestamp: channelTimestamp, channel_id: channelName, epoch: channelEpoch });

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
     * @returns {common.Capabilities} Capabilities in a protobuf
     */
    _populateCapabilities(applicationCapabilities) {
        const capabilities = {};
        for (const capability of applicationCapabilities) {
            capabilities[capability] = new common.Capability();
        }
        return  new common.Capabilities({ capabilities: capabilities });
    }

    /**
     * Form a populated Policy protobuf that contains an ImplicitMetaPolicy
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
     * @returns {Object} an object of Admin/Reader/Writer keys mapping to populated ConfigPolicy protobufs
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
     * @param {object} channelObject The channel configuration object.
     * @param {string} channelName The name of the channel.
     * @return {Buffer} The extracted channel configuration bytes.
     * @private
     */
    _getChannelConfigFromFile(channelObject, channelName) {
        // extracting the config from the binary file
        const binaryPath = CaliperUtils.resolvePath(channelObject.configBinary);
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
     * Checks whether the user materials are already persisted in the local store and sets the user context if found.
     * @param {Client} profile The Client object to fill with the User instance.
     * @param {string} userName The name of the user to check and load.
     * @param {string} profileName Optional name of the profile that will appear in error messages.
     * @return {Promise<User>} The loaded User object
     * @private
     * @async
     */
    async _getUserContext(profile, userName, profileName) {
        // Check whether the materials are already saved
        // getUserContext automatically sets the user if found
        try {
            return await profile.getUserContext(userName, true);
        } catch (err) {
            throw new Error(`Couldn't check whether ${profileName || 'the user'}'s materials are available locally: ${err.message}`);
        }
    }

    /**
     * Initializes the admins of the organizations. These are required for administrative actions such as channel creation and installing contracts.
     *
     * @param {boolean} workerInit Indicates whether the initialization happens in the worker process.
     * @private
     * @async
     */
    async _initializeAdmins(workerInit) {
        const orgs = this.networkUtil.getOrganizations();
        for (const org of orgs) {
            // Admin names are assumed to be of the form `admin.${org}`
            const adminName = `admin.${org}`;
            // build the common part of the profile
            const adminProfile = await this._prepareClientProfile(org, undefined, `${org}'s admin`);

            // Check for required crypto material, and conditionally create new (admin) user
            let cryptoContent;
            const usesOrgWallets = this.networkUtil.usesOrganizationWallets();
            if (!usesOrgWallets){
                // Check if the materials already exist locally in file system key-value stores, or retrieve from network configuration
                const admin = await this._getUserContext(adminProfile, adminName, `${org}'s admin`);
                if (admin) {
                    this.adminProfiles.set(org, adminProfile);

                    if (this.networkUtil.isMutualTlsEnabled()) {
                        this._setTlsAdminCertAndKey(org);
                    }

                    if (!workerInit) {
                        logger.warn(`${org}'s admin's materials found locally in file system key-value stores. Make sure it is the right one!`);
                    }

                    // Persist to InMemory wallet
                    await this._addToOrgWallet(org, admin.getIdentity()._certificate, admin.getSigningIdentity()._signer._key.toBytes(), adminName);
                    continue;
                } else {
                    cryptoContent = this.networkUtil.getAdminCryptoContentOfOrganization(org);
                }
            } else {
                // If a file wallet is provided, it is expected that *all* required identities are provided
                // Admin is a super-user identity, and is consequently optional
                const orgWallet = this.orgWallets.get(org);
                const hasAdmin = await orgWallet.exists(adminName);
                if (!hasAdmin) {
                    logger.info(`No ${adminName} found in wallet - unable to perform admin options`);
                    continue;
                }

                logger.info(`Retrieving credentials for ${adminName} from wallet`);
                const identity = await orgWallet.export(adminName);
                // Identity {type: string, mspId: string, privateKeyPEM: string, signedCertPEM: string}
                cryptoContent = {
                    privateKeyPEM: identity.privateKey,
                    signedCertPEM: identity.certificate
                };
            }

            // Need to create the admin user
            const adminUser = await this._createUser(adminProfile, org, adminName, cryptoContent,`${org}'s admin`);
            this.adminProfiles.set(org, adminProfile);

            if (this.networkUtil.isMutualTlsEnabled()) {
                this._setTlsAdminCertAndKey(org);
            }

            if (!usesOrgWallets) {
                // Persist to InMemory wallet
                await this._addToOrgWallet(org, adminUser.getIdentity()._certificate, adminUser.getSigningIdentity()._signer._key.toBytes(), adminName);
            }

            logger.info(`${org}'s admin's materials are successfully loaded`);
        }
    }

    /**
     * Initializes the registrars of the organizations.
     *
     * @param {boolean} workerInit Indicates whether the initialization happens in the worker process.
     * @private
     * @async
     */
    async _initializeRegistrars(workerInit) {
        const orgs = this.networkUtil.getOrganizations();
        for (const org of orgs) {

            // providing registrar information is optional and only needed for user registration and enrollment
            if (this.networkUtil.usesOrganizationWallets()) {
                logger.info('skipping registrar initialization due to presence of organization wallets');
                continue;
            }
            const registrarInfo = this.networkUtil.getRegistrarOfOrganization(org);
            if (!registrarInfo) {
                if (!workerInit) {
                    logger.warn(`${org}'s registrar information not provided.`);
                }
                continue;
            }

            // build the common part of the profile
            const registrarProfile = await this._prepareClientProfile(org, undefined, 'registrar');
            // check if the materials already exist locally in the file system key-value stores
            const registrar = await this._getUserContext(registrarProfile, registrarInfo.enrollId, `${org}'s registrar`);

            if (registrar) {
                if (!workerInit) {
                    logger.warn(`${org}'s registrar's materials found locally in file system key-value stores. Make sure it is the right one!`);
                }
                this.registrarProfiles.set(org, registrarProfile);
                continue;
            }

            // set the registrar identity as the current user context
            await this._setUserContextByEnrollment(registrarProfile, registrarInfo.enrollId,
                registrarInfo.enrollSecret, `${org}'s registrar`);

            this.registrarProfiles.set(org, registrarProfile);
            if (!workerInit) {
                logger.info(`${org}'s registrar enrolled successfully`);
            }
        }
    }

    /**
     * Registers and enrolls the specified users if necessary.
     *
     * @param {boolean} workerInit Indicates whether the initialization happens in the worker process.
     * @private
     * @async
     */
    async _initializeUsers(workerInit) {
        const clients = this.networkUtil.getClients();

        for (const client of clients) {
            const org = this.networkUtil.getOrganizationOfClient(client);

            // If using organization wallets, client must already exist within org wallet.
            if (this.networkUtil.usesOrganizationWallets()){
                if (this.orgWallets.has(org)) {
                    const orgWallet = this.orgWallets.get(org);
                    const identityExists = await orgWallet.exists(client);
                    if (!identityExists) {
                        logger.error(`Identity for client ${client} not present within wallet for organization ${org}; will attempt to register and enrol client`);
                    } else {
                        logger.info(`Detected identity for client ${client} within wallet for organization ${org}`);
                        continue;
                    }
                } else {
                    logger.error(`No wallet listed for organization ${org}; will attempt to register and enrol client`);
                }
            }

            // No wallet provided, need to create the identities based on the connection profile
            const clientProfile = await this._prepareClientProfile(org, client, client);
            this.clientProfiles.set(client, clientProfile);

            // check if the materials already exist locally in the file system key-value stores
            let user = await this._getUserContext(clientProfile, client, client);
            if (user) {
                if (this.networkUtil.isMutualTlsEnabled()) {
                    // "retrieve" and set the deserialized cert and key
                    clientProfile.setTlsClientCertAndKey(user.getIdentity()._certificate, user.getSigningIdentity()._signer._key.toBytes());
                }

                if (!workerInit) {
                    logger.warn(`${client}'s materials found locally in file system key-value stores. Make sure it is the right one!`);
                }

                // Add identity to wallet
                await this._addToOrgWallet(org, user.getIdentity()._certificate, user.getSigningIdentity()._signer._key.toBytes(), client);
                continue;
            }

            // Need to look at registering and enrolling each named client, using its organization's CA based on network configuration file
            const cryptoContent = this.networkUtil.getClientCryptoContent(client);
            if (cryptoContent) {
                // the client is already enrolled, just create and persist the User object
                user = await this._createUser(clientProfile, org, client, cryptoContent, client);
                if (this.networkUtil.isMutualTlsEnabled()) {
                    // the materials are included in the configuration file
                    const crypto = this.networkUtil.getClientCryptoContent(client);
                    clientProfile.setTlsClientCertAndKey(crypto.signedCertPEM.toString(), crypto.privateKeyPEM.toString());
                }

                if (!workerInit) {
                    logger.info(`${client}'s materials are successfully loaded`);
                }

                // Persist in InMemory wallet if not using file based wallet
                await this._addToOrgWallet(org, user.getIdentity()._certificate, user.getSigningIdentity()._signer._key.toBytes(), client);
                continue;
            }

            // The user needs to be enrolled or even registered

            // if the enrollment ID and secret is provided, then enroll the already registered user
            const enrollmentSecret = this.networkUtil.getClientEnrollmentSecret(client);
            if (enrollmentSecret) {
                const enrollment = await this._enrollUser(clientProfile, client, enrollmentSecret, client);

                // create the new user based on the retrieved materials
                user = await this._createUser(clientProfile, org, client,
                    {
                        privateKeyPEM: enrollment.key.toBytes(),
                        signedCertPEM: Buffer.from(enrollment.certificate)
                    }, client);

                if (this.networkUtil.isMutualTlsEnabled()) {
                    // set the received cert and key for mutual TLS
                    clientProfile.setTlsClientCertAndKey(Buffer.from(enrollment.certificate).toString(), enrollment.key.toString());
                }

                if (!workerInit) {
                    logger.info(`${client} successfully enrolled`);
                }

                // Add identity to org wallet
                await this._addToOrgWallet(org, user.getIdentity()._certificate, user.getSigningIdentity()._signer._key.toBytes(), client);
                continue;
            }

            // Otherwise, register then enroll the user
            let secret;
            try {
                const registrarProfile = this.registrarProfiles.get(org);

                if (!registrarProfile) {
                    throw new Error(`Registrar identity is not provided for ${org}`);
                }

                const registrarInfo = this.networkUtil.getRegistrarOfOrganization(org);
                const registrar = await registrarProfile.getUserContext(registrarInfo.enrollId, true);
                // this call will throw an error if the CA configuration is not found
                // this error should propagate up
                const ca = clientProfile.getCertificateAuthority();
                const userAffiliation = this.networkUtil.getAffiliationOfUser(client);
                const affService = ca.newAffiliationService();
                let affiliationExists = false;
                try {
                    await affService.getOne(userAffiliation, registrar);
                    affiliationExists = true;
                } catch (err) {
                    if (!workerInit) {
                        logger.info(`${userAffiliation} affiliation doesn't exists`);
                    }
                }

                if (!affiliationExists) {
                    await affService.create({name: userAffiliation, force: true}, registrar);
                    if (!workerInit) {
                        logger.info(`${userAffiliation} affiliation added`);
                    }
                }

                const attributes = this.networkUtil.getAttributesOfUser(client);
                attributes.push({name: 'hf.Registrar.Roles', value: 'client'});

                secret = await ca.register({
                    enrollmentID: client,
                    affiliation: userAffiliation,
                    role: 'client',
                    attrs: attributes
                }, registrar);
            } catch (err) {
                throw new Error(`Couldn't register ${client}: ${err.message}`);
            }

            if (!workerInit) {
                logger.info(`${client} successfully registered`);
            }

            const enrollment = await this._enrollUser(clientProfile, client, secret, client);

            // create the new user based on the retrieved materials
            user = await this._createUser(clientProfile, org, client,
                {privateKeyPEM: enrollment.key.toBytes(), signedCertPEM: Buffer.from(enrollment.certificate)}, client);

            if (this.networkUtil.isMutualTlsEnabled()) {
                // set the received cert and key for mutual TLS
                clientProfile.setTlsClientCertAndKey(Buffer.from(enrollment.certificate).toString(), enrollment.key.toString());
                //this._setTlsClientCertAndKey(client);
            }

            if (!workerInit) {
                logger.info(`${client} successfully enrolled`);
            }

            // Add identity to org wallet
            await this._addToOrgWallet(org, user.getIdentity()._certificate, user.getSigningIdentity()._signer._key.toBytes(), client);
        }
    }

    /**
     * Add a user to the wallet under a provided name
     * @param {string} org, the organization name
     * @param {string} certificate the user certificate
     * @param {string} key the private key matching the certificate
     * @param {string} name the name to store the User as within the wallet
     * @async
     */
    async _addToOrgWallet(org, certificate, key, name) {
        const identity = X509WalletMixin.createIdentity(this.networkUtil.getMspIdOfOrganization(org), certificate, key);
        logger.info(`Adding identity for ${name} to wallet for organization ${org}`);
        const orgWallet = this.orgWallets.get(org);
        await orgWallet.import(name, identity);
        logger.info(`Identity ${name} created and imported to wallet for organization ${org}`);
    }

    /**
     * Extract and persist Contracts from Gateway Networks for identities listed within wallets
     * @async
     */
    async _initializeContracts() {
        // Use organization wallets, but we use gateways associated with client identities to submit transactions
        // by creation and use of a userContracts map

        for (const walletOrg of this.orgWallets.keys()) {
            logger.info(`Retrieving and persisting contract map for organization ${walletOrg}`);
            const orgWallet = this.orgWallets.get(walletOrg);

            // Prepare client contracts based on wallet identities only
            const walletInfoList = await orgWallet.list();
            for (const info of walletInfoList) {
                logger.info(`Retrieving and persisting contract map for identity ${info.label}`);
                // Retrieve
                const contractMap = await this._retrieveContractMapForIdentity(info.label, orgWallet);
                // Persist
                this.userContracts.set(info.label, contractMap);
            }
        }
    }

    /**
     * Retrieve all Contracts accessible for the passed unique identity
     * @param {string} identity, the unique identity that maps to the client name
     * @param {FileSystemWallet | InMemoryWallet} wallet, the wallet that holds the passed identity name
     * @returns {Map<FabricNetworkAPI.Contract>} A map of all Contracts retrieved from the client Gateway
     * @async
     */
    async _retrieveContractMapForIdentity(identity, wallet) {

        // Retrieve the gateway for the passed user. The gateway object is persisted for easier cleanup.
        // - userName must match that created for wallet userId in init phases
        const gateway = await this._retrieveUserGateway(identity, wallet);
        this.userGateways.set(identity, gateway);

        // Work on all channels to build a contract map
        logger.info(`Generating contract map for user ${identity}`);
        const contractMap = new Map();
        const channels = this.networkUtil.getChannels();
        for (const channel of channels) {
            // retrieve the channel network
            const network = await gateway.getNetwork(channel);
            // Work on all contracts/smart contracts in the channel
            const contracts = this.networkUtil.getContractsOfChannel(channel);
            for (const contract of contracts) {
                const networkContract = await network.getContract(contract.id);
                contractMap.set(`${channel}_${contract.id}`, networkContract);
            }
        }

        return contractMap;
    }

    /**
     * Retrieve a Gateway object for the passed userId
     * @param {string} identity string user id to use as the identity
     * @param {FileSystemWallet | InMemoryWallet} wallet, the wallet that holds the passed identity name
     * @returns {FabricNet.Gateway} a gateway object for the passed user identity
     * @async
     */
    async _retrieveUserGateway(identity, wallet) {
        // Build options for the connection
        const opts = {
            identity,
            wallet,
            discovery: {
                asLocalhost: this.configLocalHost,
                enabled: this.configDiscovery
            },
            eventHandlerOptions: {
                commitTimeout: this.configDefaultTimeout,
                strategy: EventStrategies[this.eventStrategy]
            },
            queryHandlerOptions: {
                requestTimeout: this.configDefaultTimeout,
                strategy: QueryStrategies[this.queryStrategy]
            }
        };

        // Optional on mutual auth
        if (this.networkUtil.isMutualTlsEnabled()) {
            opts.clientTlsIdentity = identity;
        }

        // Retrieve gateway using ccp and options
        const gateway = new Gateway();

        logger.info(`Connecting user with identity ${identity} to a Network Gateway`);
        await gateway.connect(this.networkUtil.getNetworkObject(), opts);

        // return the gateway object
        return gateway;
    }

    /**
     * Install the specified contracts to their target peers.
     * @private
     * @async
     */
    async _installContracts() {
        if (this.configOverwriteGopath) {
            process.env.GOPATH = CaliperUtils.resolvePath('.');
        }

        const errors = [];

        const channels = this.networkUtil.getChannels();
        for (const channel of channels) {
            logger.info(`Installing contracts for ${channel}...`);

            // proceed cc by cc for the channel
            const contractInfos = this.networkUtil.getContractsOfChannel(channel);
            for (const contractInfo of contractInfos) {
                const ccObject = this.networkUtil.getNetworkObject().channels[channel].contracts.find(
                    cc => cc.id === contractInfo.id && cc.version === contractInfo.version);

                const targetPeers = this.networkUtil.getTargetPeersOfContractOfChannel(contractInfo, channel);
                if (targetPeers.size < 1) {
                    logger.info(`No target peers are defined for ${contractInfo.id}@${contractInfo.version} on ${channel}, skipping it`);
                    continue;
                }

                // find the peers that don't have the cc installed
                const installTargets = [];

                for (const peer of targetPeers) {
                    const org = this.networkUtil.getOrganizationOfPeer(peer);
                    const admin = this.adminProfiles.get(org);

                    try {
                        /** {@link ChaincodeQueryResponse} */
                        const resp = await admin.queryInstalledChaincodes(peer, true);
                        if (resp.chaincodes.some(cc => cc.name === contractInfo.id && cc.version === contractInfo.version)) {
                            logger.info(`${contractInfo.id}@${contractInfo.version} is already installed on ${peer}`);
                            continue;
                        }

                        installTargets.push(peer);
                    } catch (err) {
                        errors.push(new Error(`Couldn't query installed contracts on ${peer}: ${err.message}`));
                    }
                }

                if (errors.length > 0) {
                    let errorMsg = `Could not query whether ${contractInfo.id}@${contractInfo.version} is installed on some peers of ${channel}:`;
                    for (const err of errors) {
                        errorMsg += `\n\t- ${err.message}`;
                    }

                    logger.error(errorMsg);
                    throw new Error(`Could not query whether ${contractInfo.id}@${contractInfo.version} is installed on some peers of ${channel}`);
                }

                // cc is installed on every target peer in the channel
                if (installTargets.length < 1) {
                    continue;
                }

                // install contracts org by org
                const orgs = this.networkUtil.getOrganizationsOfChannel(channel);
                for (const org of orgs) {
                    const peersOfOrg = this.networkUtil.getPeersOfOrganization(org);
                    // selecting the target peers for this org
                    const orgPeerTargets = installTargets.filter(p => peersOfOrg.has(p));

                    // cc is installed on every target peer of the org in the channel
                    if (orgPeerTargets.length < 1) {
                        continue;
                    }

                    const admin = this.adminProfiles.get(org);

                    const txId = admin.newTransactionID(true);
                    /** @{ChaincodeInstallRequest} */
                    const request = {
                        targets: orgPeerTargets,
                        chaincodePath: ccObject.language === 'golang' ? ccObject.path : CaliperUtils.resolvePath(ccObject.path),
                        chaincodeId: ccObject.id,
                        chaincodeVersion: ccObject.version,
                        chaincodeType: ccObject.language,
                        txId: txId
                    };

                    // metadata (like CouchDB indices) are only supported since Fabric v1.1
                    if (CaliperUtils.checkProperty(ccObject, 'metadataPath')) {
                        request.metadataPath = CaliperUtils.resolvePath(ccObject.metadataPath);
                    }

                    // install to necessary peers of org and process the results
                    try {
                        /** @link{ProposalResponseObject} */
                        const propRespObject = await admin.installChaincode(request);
                        CaliperUtils.assertDefined(propRespObject);

                        /** Array of @link{ProposalResponse} objects */
                        const proposalResponses = propRespObject[0];
                        CaliperUtils.assertDefined(proposalResponses);

                        proposalResponses.forEach((propResponse, index) => {
                            if (propResponse instanceof Error) {
                                const errMsg = `Install proposal error for ${contractInfo.id}@${contractInfo.version} on ${orgPeerTargets[index]}: ${propResponse.message}`;
                                errors.push(new Error(errMsg));
                                return;
                            }

                            /** @link{ProposalResponse} */
                            CaliperUtils.assertProperty(propResponse, 'propResponse', 'response');

                            /** @link{ResponseObject} */
                            const response = propResponse.response;
                            CaliperUtils.assertProperty(response, 'response', 'status');

                            if (response.status !== 200) {
                                const errMsg = `Unsuccessful install status for ${contractInfo.id}@${contractInfo.version} on ${orgPeerTargets[index]}: ${propResponse.response.message}`;
                                errors.push(new Error(errMsg));
                            }
                        });
                    } catch (err) {
                        throw new Error(`Couldn't install ${contractInfo.id}@${contractInfo.version} on peers ${orgPeerTargets.toString()}: ${err.message}`);
                    }

                    // there were some install errors, proceed to the other orgs to gather more information
                    if (errors.length > 0) {
                        continue;
                    }

                    logger.info(`${contractInfo.id}@${contractInfo.version} successfully installed on ${org}'s peers: ${orgPeerTargets.toString()}`);
                }

                if (errors.length > 0) {
                    let errorMsg = `Could not install ${contractInfo.id}@${contractInfo.version} on some peers of ${channel}:`;
                    for (const err of errors) {
                        errorMsg += `\n\t- ${err.message}`;
                    }

                    logger.error(errorMsg);
                    throw new Error(`Could not install ${contractInfo.id}@${contractInfo.version} on some peers of ${channel}`);
                }
            }
        }
    }

    /**
     * Instantiates the contracts on their channels.
     * @return {boolean} True, if at least one contract was instantiated. Otherwise, false.
     * @private
     * @async
     */
    async _instantiateContracts() {
        const channels = this.networkUtil.getChannels();
        let contractInstantiated = false;

        // contracts needs to be installed channel by channel
        for (const channel of channels) {
            const contractInfos = this.networkUtil.getContractsOfChannel(channel);

            for (const contractInfo of contractInfos) {
                logger.info(`Instantiating ${contractInfo.id}@${contractInfo.version} in ${channel}. This might take some time...`);

                const ccObject = this.networkUtil.getNetworkObject().channels[channel].contracts.find(
                    cc => cc.id === contractInfo.id && cc.version === contractInfo.version);

                // check contract language
                // only golang, node and java are supported
                if (!['golang', 'node', 'java'].includes(ccObject.language)) {
                    throw new Error(`${contractInfo.id}@${contractInfo.version} in ${channel}: unknown contract type ${ccObject.language}`);
                }

                const targetPeers = Array.from(this.networkUtil.getTargetPeersOfContractOfChannel(contractInfo, channel));
                if (targetPeers.length < 1) {
                    logger.info(`No target peers are defined for ${contractInfo.id}@${contractInfo.version} in ${channel}, skipping it`);
                    continue;
                }

                // select a target peer for the contract to see if it's instantiated
                // these are the same as the install targets, so if one of the peers has already instantiated the contract,
                // then the other targets also had done the same
                const org = this.networkUtil.getOrganizationOfPeer(targetPeers[0]);
                const admin = this.adminProfiles.get(org);

                /** @link{ChaincodeQueryResponse} */
                let queryResponse;
                try {
                    queryResponse = await admin.getChannel(channel, true).queryInstantiatedChaincodes(targetPeers[0], true);
                } catch (err) {
                    throw new Error(`Couldn't query whether ${contractInfo.id}@${contractInfo.version} is instantiated on ${targetPeers[0]}: ${err.message}`);
                }

                CaliperUtils.assertDefined(queryResponse);
                CaliperUtils.assertProperty(queryResponse, 'queryResponse', 'chaincodes');

                if (queryResponse.chaincodes.some(
                    cc => cc.name === contractInfo.id && cc.version === contractInfo.version)) {
                    logger.info(`${contractInfo.id}@${contractInfo.version} is already instantiated in ${channel}`);
                    continue;
                }

                contractInstantiated = true;

                const txId = admin.newTransactionID(true);
                /** @link{ChaincodeInstantiateUpgradeRequest} */
                const request = {
                    targets: targetPeers,
                    chaincodeId: ccObject.id,
                    chaincodeVersion: ccObject.version,
                    chaincodeType: ccObject.language,
                    args: ccObject.init || [],
                    fcn: ccObject.function || 'init',
                    'endorsement-policy': ccObject['endorsement-policy'] ||
                        this.networkUtil.getDefaultEndorsementPolicy(channel, { id: ccObject.id, version: ccObject.version }),
                    transientMap: this.networkUtil.getTransientMapOfContractOfChannel(contractInfo, channel),
                    txId: txId
                };

                // check private collection configuration
                if (CaliperUtils.checkProperty(ccObject, 'collections-config')) {
                    request['collections-config'] = ccObject['collections-config'];
                }

                /** @link{ProposalResponseObject} */
                let response;
                try {
                    response = await admin.getChannel(channel, true).sendInstantiateProposal(request, this.configContractInstantiateTimeout);
                } catch (err) {
                    throw new Error(`Couldn't endorse ${contractInfo.id}@${contractInfo.version} in ${channel} on peers [${targetPeers.toString()}]: ${err.message}`);
                }

                CaliperUtils.assertDefined(response);

                /** @link{Array<ProposalResponse>} */
                const proposalResponses = response[0];
                /** @link{Proposal} */
                const proposal = response[1];
                CaliperUtils.assertDefined(proposalResponses);
                CaliperUtils.assertDefined(proposal);

                // check each response
                proposalResponses.forEach((propResp, index) => {
                    CaliperUtils.assertDefined(propResp);
                    // an Error is returned for a rejected proposal
                    if (propResp instanceof Error) {
                        throw new Error(`Invalid endorsement for ${contractInfo.id}@${contractInfo.version} in ${channel} from ${targetPeers[index]}: ${propResp.message}`);
                    } else if (propResp.response.status !== 200) {
                        throw new Error(`Invalid endorsement for ${contractInfo.id}@${contractInfo.version} in ${channel} from ${targetPeers[index]}: status code ${propResp.response.status}`);
                    }
                });

                // connect to every event source of every org in the channel
                const eventSources = this._assembleTargetEventSources(channel, targetPeers);
                const eventPromises = [];

                try {
                    // NOTE: everything is resolved, errors are signaled through an Error object
                    // this makes error handling and reporting easier
                    eventSources.forEach((es) => {
                        const promise = new Promise((resolve) => {
                            const timeoutHandle = setTimeout(() => {
                                // unregister manually
                                es.eventHub.unregisterTxEvent(txId.getTransactionID(), false);
                                resolve(new Error(`Commit timeout for ${contractInfo.id}@${contractInfo.version} in ${channel} from ${es.peer}`));
                            }, this.configContractInstantiateEventTimeout);

                            es.eventHub.registerTxEvent(txId.getTransactionID(), (tx, code) => {
                                clearTimeout(timeoutHandle);
                                if (code !== 'VALID') {
                                    resolve(new Error(`Invalid commit code for ${contractInfo.id}@${contractInfo.version} in ${channel} from ${es.peer}: ${code}`));
                                } else {
                                    resolve(code);
                                }
                            }, /* Error handler */ (err) => {
                                clearTimeout(timeoutHandle);
                                resolve(new Error(`Event hub error from ${es.peer} during instantiating ${contractInfo.id}@${contractInfo.version} in ${channel}: ${err.message}`));
                            });

                            es.eventHub.connect();
                        });

                        eventPromises.push(promise);
                    });

                    /** @link{TransactionRequest} */
                    const ordererRequest = {
                        txId: txId,
                        proposalResponses: proposalResponses,
                        proposal: proposal
                    };

                    /** @link{BroadcastResponse} */
                    let broadcastResponse;
                    try {
                        broadcastResponse = await admin.getChannel(channel, true).sendTransaction(ordererRequest);
                    } catch (err) {
                        throw new Error(`Orderer error for instantiating ${contractInfo.id}@${contractInfo.version} in ${channel}: ${err.message}`);
                    }

                    CaliperUtils.assertDefined(broadcastResponse);
                    CaliperUtils.assertProperty(broadcastResponse, 'broadcastResponse', 'status');

                    if (broadcastResponse.status !== 'SUCCESS') {
                        throw new Error(`Orderer error for instantiating ${contractInfo.id}@${contractInfo.version} in ${channel}: ${broadcastResponse.status}`);
                    }

                    // since every event promise is resolved, this shouldn't throw an error
                    const eventResults = await Promise.all(eventPromises);

                    // if we received an error, propagate it
                    if (eventResults.some(er => er instanceof Error)) {
                        let errMsg = `The following errors occured while instantiating ${contractInfo.id}@${contractInfo.version} in ${channel}:`;
                        let err; // keep the last error
                        for (const eventResult of eventResults) {
                            if (eventResult instanceof Error) {
                                err = eventResult;
                                errMsg += `\n\t- ${eventResult.message}`;
                            }
                        }

                        logger.error(errMsg);
                        throw err;
                    }

                    logger.info(`Successfully instantiated ${contractInfo.id}@${contractInfo.version} in ${channel}`);
                } finally {
                    eventSources.forEach(es => {
                        if (es.eventHub.isconnected()) {
                            es.eventHub.disconnect();
                        }
                    });
                }
            }
        }

        return contractInstantiated;
    }

    /**
     * Joins the peers to the specified channels is necessary.
     * @return {boolean} True, if at least one peer joined a channel. Otherwise, false.
     * @private
     * @async
     */
    async _joinChannels() {
        const channels = this.networkUtil.getChannels();
        let channelJoined = false;
        const errors = [];

        for (const channelName of channels) {
            let genesisBlock = null;
            const orgs = this.networkUtil.getOrganizationsOfChannel(channelName);

            for (const org of orgs) {
                const admin = this.adminProfiles.get(org);
                const channelObject = admin.getChannel(channelName, true);

                const peers = this.networkUtil.getPeersOfOrganizationAndChannel(org, channelName);
                const peersToJoin = [];

                for (const peer of peers) {
                    try {
                        /** {@link ChannelQueryResponse} */
                        const resp = await admin.queryChannels(peer, true);
                        if (resp.channels.some(ch => ch.channel_id === channelName)) {
                            logger.info(`${peer} has already joined ${channelName}`);
                            continue;
                        }

                        peersToJoin.push(peer);
                    } catch (err) {
                        errors.push(new Error(`Couldn't query ${channelName} information from ${peer}: ${err.message}`));
                    }
                }

                if (errors.length > 0) {
                    let errMsg = `The following errors occurred while querying ${channelName} information from ${org}'s peers:`;
                    for (const err of errors) {
                        errMsg += `\n\t- ${err.message}`;
                    }

                    logger.error(errMsg);
                    throw new Error(`Couldn't query ${channelName} information from ${org}'s peers`);
                }

                // all target peers of the org have already joined the channel
                if (peersToJoin.length < 1) {
                    continue;
                }

                channelJoined = true;

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
                        throw new Error(`Couldn't retrieve the genesis block for ${channelName}: ${err.message}`);
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
                            errors.push(new Error(`${peersToJoin[index]} could not join ${channelName}: ${propResponse.message}`));
                        } else if (propResponse.response.status !== 200) {
                            errors.push(new Error(`${peersToJoin[index]} could not join ${channelName}: ${propResponse.response.message}`));
                        }
                    });
                } catch (err) {
                    throw new Error(`Couldn't join peers ${peersToJoin.toString()} to ${channelName}: ${err.message}`);
                }

                if (errors.length > 0) {
                    let errMsg = `The following errors occurred while ${org}'s peers tried to join ${channelName}:`;
                    for (const err of errors) {
                        errMsg += `\n\t- ${err.message}`;
                    }

                    logger.error(errMsg);
                    throw new Error(`${org}'s peers couldn't join ${channelName}`);
                }

                logger.info(`${org}'s peers successfully joined ${channelName}: ${peersToJoin}`);
            }
        }

        return channelJoined;
    }

    /**
     * Initialize channel objects for use in peer targeting. Requires user gateways to have been
     * formed in advance.
     */
    async _initializePeerCache() {

        for (const userName of this.userGateways.keys()) {
            const gateway = this.userGateways.get(userName);
            // Loop over known channel names
            const channelNames = this.networkUtil.getChannels();
            for (const channelName of channelNames) {
                const network = await gateway.getNetwork(channelName);
                const channel = network.getChannel();
                // Add all peers
                for (const peerObject of channel.getChannelPeers()) {
                    this.peerCache.set(peerObject.getName(), peerObject);
                }
            }
        }
    }

    /**
     * Conditionally initializes the organization wallet map depending on network configuration
     * @private
     */
    _prepareOrgWallets() {
        if (this.networkUtil.usesOrganizationWallets()) {
            logger.info('Using defined organization file system wallets');
            const orgs = this.networkUtil.getOrganizations();
            for (const org of orgs) {
                const fileWalletPath = this.networkUtil.getWalletPathForOrganization(org);
                if (fileWalletPath) {
                    const wallet = new FileSystemWallet(fileWalletPath);
                    this.orgWallets.set(org, wallet);
                } else {
                    logger.warn(`No defined organization wallet for org ${org}`);
                }
            }
        } else {
            logger.info('Creating new InMemoryWallets for organizations');
            const orgs = this.networkUtil.getOrganizations();
            for (const org of orgs) {
                const wallet = new InMemoryWallet();
                this.orgWallets.set(org, wallet);
            }
        }
    }

    /**
     * Partially assembles a Client object containing general network information.
     * @param {string} org The name of the organization the client belongs to. Mandatory, if the client name is omitted.
     * @param {string} clientName The name of the client to base the profile on.
     *                            If omitted, then the first client of the organization will be used.
     * @param {string} profileName Optional name of the profile that will appear in error messages.
     * @return {Promise<Client>} The partially assembled Client object.
     * @private
     * @async
     */
    async _prepareClientProfile(org, clientName, profileName) {
        let client = clientName;
        if (!client) {
            CaliperUtils.assertDefined(org);
            // base it on the first client connection profile of the org
            const clients = this.networkUtil.getClientsOfOrganization(org);

            // NOTE: this assumes at least one client per org, which is reasonable, the clients will interact with the network
            if (clients.size < 1) {
                throw new Error(`At least one client specification for ${org} is needed to initialize the ${profileName || 'profile'}`);
            }

            client = Array.from(clients)[0];
        }

        // load the general network data from a clone of the network object
        // NOTE: if we provide a common object instead, the Client class will use it directly,
        // and it will be overwritten when loading the next client
        const profile = FabricClient.loadFromConfig(this.networkUtil.getNewNetworkObject());
        profile.loadFromConfig({
            version: '1.0',
            client: this.networkUtil.getClientObject(client)
        });

        if (!this.networkUtil.usesOrganizationWallets()) {
            try {
                await profile.initCredentialStores();
            } catch (err) {
                throw new Error(`Couldn't initialize the credential stores for ${org}'s ${profileName || 'profile'}: ${err.message}`);
            }
        }

        return profile;
    }

    /**
     * Sets the mutual TLS for the admin of the given organization.
     * @param {string} org The name of the organization.
     * @private
     */
    _setTlsAdminCertAndKey(org) {
        const profile = this.adminProfiles.get(org);
        const crypto = this.networkUtil.getAdminCryptoContentOfOrganization(org);
        profile.setTlsClientCertAndKey(crypto.signedCertPEM.toString(), crypto.privateKeyPEM.toString());
    }

    /**
     * Tries to set the given identity as the current user context for the given profile. Enrolls it if needed and can.
     * @param {Client} profile The Client object whose user context must be set.
     * @param {string} userName The name of the user.
     * @param {string} password The password for the user.
     * @param {string} profileName Optional name of the profile that will appear in error messages.
     * @private
     * @async
     */
    async _setUserContextByEnrollment(profile, userName, password, profileName) {
        try {
            // automatically tries to enroll the given identity with the CA (must be registered)
            await profile.setUserContext({
                username: userName,
                password: password
            }, false);
        } catch (err) {
            throw new Error(`Couldn't enroll ${profileName || 'the user'} or set it as user context: ${err.message}`);
        }
    }

    /**
     * Perform a transaction using a Gateway contract
     * @param {ContractInvokeSettings | ContractQuerySettings} invokeSettings The settings associated with the transaction submission.
     * @param {boolean} isSubmit boolean flag to indicate if the transaction is a submit or evaluate
     * @return {Promise<TxStatus>} The result and stats of the transaction invocation.
     * @async
     */
    async _performGatewayTransaction(invokeSettings, isSubmit) {
        // Retrieve the existing contract and a client
        const smartContract = await this._getUserContract(invokeSettings.invokerIdentity, invokeSettings.channel, invokeSettings.contractId);

        // Create a transaction
        const transaction = smartContract.createTransaction(invokeSettings.contractFunction);

        // Build the Caliper TxStatus
        const invokeStatus = new TxStatus(transaction.getTransactionID());

        // Add transient data if present
        // - passed as key value pairing such as {"hello":"world"}
        if (invokeSettings.transientMap) {
            const transientData = {};
            const keys = Array.from(Object.keys(invokeSettings.transientMap));
            keys.forEach((key) => {
                transientData[key] = Buffer.from(invokeSettings.transientMap[key]);
            });
            transaction.setTransient(transientData);
        }

        // Set endorsing peers if passed as a string array
        if (invokeSettings.targetPeers) {
            // Retrieved cached peer objects
            const targetPeerObjects = [];
            for (const name of invokeSettings.targetPeers) {
                const peer = this.peerCache.get(name);
                if (peer) {
                    targetPeerObjects.push(peer);
                }
            }
            // Set the peer objects in the transaction
            if (targetPeerObjects.length > 0) {
                transaction.setEndorsingPeers(targetPeerObjects);
            }
        } else if (invokeSettings.targetOrganizations) {
            if (Array.isArray(invokeSettings.targetOrganizations) && invokeSettings.targetOrganizations.length > 0) {
                transaction.setEndorsingOrganizations(...invokeSettings.targetOrganizations);
            } else {
                logger.warn(`${invokeSettings.targetOrganizations} is not a populated array, no orgs targetted`);
            }
        }

        try {
            let result;
            if (isSubmit) {
                invokeStatus.Set('request_type', 'transaction');
                invokeStatus.Set('time_create', Date.now());
                result = await transaction.submit(...invokeSettings.contractArguments);
            } else {
                if (invokeSettings.targetPeers || invokeSettings.targetOrganizations) {
                    logger.warn('targetPeers or targetOrganizations options are not valid for query requests');
                }
                invokeStatus.Set('request_type', 'query');
                invokeStatus.Set('time_create', Date.now());
                result = await transaction.evaluate(...invokeSettings.contractArguments);
            }
            invokeStatus.result = result;
            invokeStatus.verified = true;
            invokeStatus.SetStatusSuccess();
            return invokeStatus;
        } catch (err) {
            logger.error(`Failed to perform ${isSubmit ? 'submit' : 'query' } transaction [${invokeSettings.contractFunction}] using arguments [${invokeSettings.contractArguments}],  with error: ${err.stack ? err.stack : err}`);
            invokeStatus.SetStatusFail();
            invokeStatus.result = [];
            return invokeStatus;
        }
    }

    /**
     * Get the named contract for a named user
     * @param {string} invokerIdentity the user identity for interacting with the contract
     * @param {string} channelName the channel name the contract exists on
     * @param {string} contractId the name of the contract to return
     * @returns {FabricNetworkAPI.Contract} A contract that may be used to submit or evaluate transactions
     * @async
     */
    async _getUserContract(invokerIdentity, channelName, contractId) {

        // Determine the invoking user for this transaction
        let userName;
        if (invokerIdentity.startsWith('#')) {
            userName = invokerIdentity.substring(1);
        } else {
            userName = invokerIdentity;
        }

        const contractSet = this.userContracts.get(userName);

        // If no contract set found, there is a user configuration/test specification error, so it should terminate
        if (!contractSet) {
            throw Error(`No contracts for Invoker ${userName} found!`);
        }

        // Retrieve the named Network Contract for the invoking user from the Map
        const contract = contractSet.get(`${channelName}_${contractId}`);

        // If no contract found, there is a user configuration/test specification error, so it should terminate
        if (!contract) {
            throw Error(`Unable to find specified contract ${contractId} on channel ${channelName}!`);
        }

        return contract;
    }

    //////////////////////////
    // PUBLIC API FUNCTIONS //
    //////////////////////////

    /**
     * Prepares the adapter by either:
     * - building a gateway object linked to a wallet ID
     * - loading user data and connection to the event hubs.
     *
     * @param {Number} roundIndex The zero-based round index of the test.
     * @param {Array<string>} args Unused.
     * @return {Promise<{networkInfo : FabricNetwork, eventSources: EventSource[]}>} Returns the network utility object.
     * @async
     */
    async getContext(roundIndex, args) {
        // Reset counter for new test round
        this.txIndex = -1;

        // Build Gateway Network Contracts for possible users and return the network object
        // - within submit/evaluate, a contract will be used for a nominated user
        await this._initializeContracts();

        // - use gateways to build a peer cache if the version supports it
        if (semver.satisfies(semver.coerce(this.version), '>=1.4.5')) {
            await this._initializePeerCache();
        } else {
            logger.warn(`Bound SDK ${this.version} is unable to use target peers; to enable target peer nomination for a gateway transaction, bind Caliper to Fabric 1.4.5 and above`);
        }

        // We are done - return the networkUtil object
        this.context = {
            networkInfo: this.networkUtil,
            clientIdx: this.workerIndex
        };

        return this.context;
    }

    /**
     * Initializes the Fabric adapter: sets up clients, admins, registrars, channels and contracts.
     * @param {boolean} workerInit Indicates whether the initialization happens in the worker process.
     * @async
     */
    async init(workerInit = false) {
        const tlsInfo = this.networkUtil.isMutualTlsEnabled() ? 'mutual'
            : (this.networkUtil.isTlsEnabled() ? 'server' : 'none');
        logger.info(`Fabric SDK version: ${this.version.toString()}; TLS: ${tlsInfo}`);

        await this._initializeRegistrars(workerInit);
        await this._initializeAdmins(workerInit);
        await this._initializeUsers(workerInit);
        this.initPhaseCompleted = true;

        if (!workerInit) {
            if (await this._createChannels()) {
                logger.info(`Sleeping ${this.configSleepAfterCreateChannel / 1000.0}s...`);
                await CaliperUtils.sleep(this.configSleepAfterCreateChannel);
            }

            if (await this._joinChannels()) {
                logger.info(`Sleeping ${this.configSleepAfterJoinChannel / 1000.0}s...`);
                await CaliperUtils.sleep(this.configSleepAfterJoinChannel);
            }
        }
    }

    /**
     * Installs and initializes the specified contracts.
     * @async
     */
    async installSmartContract() {
        // With flow conditioning, this phase is conditionally required
        if (!this.initPhaseCompleted ) {
            await this._initializeRegistrars(true);
            await this._initializeAdmins(true);
            await this._initializeUsers(true);
        }

        await this._installContracts();
        if (await this._instantiateContracts()) {
            logger.info(`Sleeping ${this.configSleepAfterInstantiateContract / 1000.0}s...`);
            await CaliperUtils.sleep(this.configSleepAfterInstantiateContract);
        }
    }

    /**
     * Send a single request to the backing SUT.
     * @param {FabricRequestSettings} request The request object.
     */
    async _sendSingleRequest(request) {
        if (!request.hasOwnProperty('channel')) {
            const contractDetails = this.networkUtil.getContractDetails(request.contractId);
            if (!contractDetails) {
                throw new Error(`Could not find details for contract ID ${request.contractId}`);
            }
            request.channel = contractDetails.channel;
            request.contractId = contractDetails.id;
            request.contractVersion = contractDetails.version;
        }

        if (!request.invokerIdentity) {
            request.invokerIdentity = this.defaultInvoker;
        }

        return this._performGatewayTransaction(request, request.readOnly === undefined || !request.readOnly);
    }

    /**
     * Releases the resources of the adapter.
     *
     * @async
     */
    async releaseContext() {
        // Disconnect from all persisted user gateways
        for (const userName of this.userGateways.keys()) {
            const gateway = this.userGateways.get(userName);
            logger.info(`disconnecting gateway for user ${userName}`);
            gateway.disconnect();
        }

        // Clear peer cache
        this.peerCache.clear();
        this.context = undefined;
    }
}

module.exports = LegacyV1FabricGateway;
