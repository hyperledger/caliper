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
const FabricConstants = require('fabric-client/lib/Constants');
const {google, common} = require('fabric-protos');
const {ConnectorBase, CaliperUtils, TxStatus, Version, ConfigUtil} = require('@hyperledger/caliper-core');
const FabricNetwork = require('../../fabricNetwork.js');

const fs = require('fs');

const logger = CaliperUtils.getLogger('connectors/v1/fabric');

//////////////////////
// TYPE DEFINITIONS //
//////////////////////

/**
 * @typedef {Object} EventSource
 *
 * @property {string[]} channel The list of channels this event source listens on. Only meaningful for Fabric v1.0.
 * @property {string} peer The name of the peer the event source connects to.
 * @property {EventHub|ChannelEventHub} eventHub The event hub object representing the connection.
 */

/////////////////////////////
// END OF TYPE DEFINITIONS //
/////////////////////////////

/**
 * Extends {BlockchainConnector} for a Fabric backend, utilizing the SDK's Common Connection Profile.
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
 * @property {number} configContractInstantiateEventTimeout The timeout in milliseconds for receiving the contract instantion event.
 * @property {number} configDefaultTimeout The default timeout in milliseconds to use for invoke/query transactions.
 * @property {string} configClientBasedLoadBalancing The value indicating the type of automatic load balancing to use.
 * @property {boolean} configCountQueryAsLoad Indicates whether queries should be counted as workload.
 */
class LegacyV1Fabric extends ConnectorBase {
    /**
     * Initializes the Fabric adapter.
     * @param {object} networkObject The parsed network configuration.
     * @param {number} workerIndex the worker index
     * @param {string} bcType The target SUT type
     */
    constructor(networkObject, workerIndex, bcType) {
        super(workerIndex, bcType);
        this.version = new Version(require('fabric-client/package').version);

        // clone the object to prevent modification by other objects
        this.network = CaliperUtils.parseYamlString(CaliperUtils.stringifyYaml(networkObject));

        this.clientProfiles = new Map();
        this.adminProfiles = new Map();
        this.registrarProfiles = new Map();
        this.eventSources = [];
        this.txIndex = -1;
        this.randomTargetPeerCache = new Map();
        this.channelEventSourcesCache = new Map();
        this.randomTargetOrdererCache = new Map();
        this.userContracts = new Map();
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
        this.configClientBasedLoadBalancing = ConfigUtil.get(ConfigUtil.keys.Fabric.LoadBalancing, 'client') === 'client';
        this.configCountQueryAsLoad = ConfigUtil.get(ConfigUtil.keys.Fabric.CountQueryAsLoad, true);

        this.networkUtil = new FabricNetwork(this.network);
        this.defaultInvoker = Array.from(this.networkUtil.getClients())[0];

        // NOTE: regardless of the version of the Fabric backend, the SDK must be at least v1.1.0 in order to
        // use the common connection profile feature
        if (this.version.lessThan('1.1.0')) {
            throw new Error(`Fabric SDK ${this.version.toString()} is not supported, use at least version 1.1.0`);
        }

        if (this.networkUtil.isInCompatibilityMode() && this.version.greaterThan('1.1.0')) {
            throw new Error(`Fabric 1.0 compatibility mode is detected, but SDK version ${this.version.toString()} is used`);
        }

        this._prepareCaches();
    }

    //////////////////////////
    // PUBLIC API FUNCTIONS //
    //////////////////////////

    /**
     * Initializes the Fabric adapter: sets up clients, admins, registrars, channels and contracts.
     * @param {boolean} workerInit Indicates whether the initialization happens in the worker process.
     * @async
     */
    async init(workerInit = false) {
        const tlsInfo = this.networkUtil.isMutualTlsEnabled() ? 'mutual'
            : (this.networkUtil.isTlsEnabled() ? 'server' : 'none');
        const compMode = this.networkUtil.isInCompatibilityMode() ? '; Fabric v1.0 compatibility mode' : '';
        logger.info(`Fabric SDK version: ${this.version.toString()}; TLS: ${tlsInfo}${compMode}`);

        // TODO: only required for specific scenarios, means network config has to have more info defined
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
     * Prepares the adapter by loading user data and connection to the event hubs.
     *
     * @param {Number} roundIndex The zero-based round index of the test.
     * @param {Array<string>} args Unused.
     * @return {Promise<{networkInfo : FabricNetwork, eventSources: EventSource[]}>} Returns the network utility object.
     * @async
     */
    async getContext(roundIndex, args) {
        // Reset counter for new test round
        this.txIndex = -1;

        if (!this.context) {
            this.context = {
                networkInfo: this.networkUtil,
                clientIdx: this.workerIndex
            };
            await this._initializeChannelsAndEventHubs();
        }

        return this.context;
    }

    /**
     * Releases the resources of the adapter.
     * @async
     */
    async releaseContext() {
        this.eventSources.forEach((es) => {
            if (es.eventHub.isconnected()) {
                es.eventHub.disconnect();
            }
        });

        this.eventSources = [];
        this.context = undefined;
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
        if (this.networkUtil.isInCompatibilityMode()) {
            // NOTE: for old event hubs we have a single connection to every peer set as an event source
            const EventHub = require('fabric-client/lib/EventHub.js');

            for (const peer of targetPeers) {
                const org = this.networkUtil.getOrganizationOfPeer(peer);
                const admin = this.adminProfiles.get(org);

                const eventHub = new EventHub(admin);
                eventHub.setPeerAddr(this.networkUtil.getPeerEventUrl(peer),
                    this.networkUtil.getGrpcOptionsOfPeer(peer));

                eventSources.push({
                    channel: [channel], // unused during contract instantiation
                    peer: peer,
                    eventHub: eventHub
                });
            }
        } else {
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
        }

        return eventSources;
    }

    /**
     * Collects all peers that are endorsing peers belonging to a set of organizations
     * @param {*} channel The name of the channel
     * @param {string[]} endorsingOrgs An array of the required orgs to target
     * @returns {ChannelPeer[]} Array containing the set of peers
     */
    _getEndorsingPeersForOrgs(channel, endorsingOrgs) {
        const channelPeers = channel.getChannelPeers();
        const filteredPeers = channelPeers.filter((channelPeer) => {
            return channelPeer.isInRole(FabricConstants.NetworkConfig.ENDORSING_PEER_ROLE) &&
                endorsingOrgs.some((org) => channelPeer.isInOrg(org));
        });
        return filteredPeers;
    }

    /**
     * Assembles random target peers for the channel from every organization that has the contract deployed.
     * @param {string} channel The name of the channel.
     * @param {string} contractId The name/ID of the contract.
     * @param {string} contractVersion The version of the contract.
     * @returns {string[]} Array containing a random peer from each needed organization.
     * @private
     */
    _assembleRandomTargetPeers(channel, contractId, contractVersion) {
        const targets = [];
        const contractOrgs = this.randomTargetPeerCache.get(channel).get(`${contractId}@${contractVersion}`);

        for (const entries of contractOrgs.entries()) {
            const peers = entries[1];

            // represents the load balancing mechanism
            const loadBalancingCounter = this.configClientBasedLoadBalancing ? this.workerIndex : this.txIndex;
            targets.push(peers[loadBalancingCounter % peers.length]);
        }

        return targets;
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
     *
     * @param {EventSource} eventSource The event source to use for registering the Tx event.
     * @param {string} txId The transaction ID.
     * @param {TxStatus} invokeStatus The transaction status object.
     * @param {number} startTime The epoch of the transaction start time.
     * @param {number} timeout The timeout for the transaction life-cycle.
     * @return {Promise<{successful: boolean, message: string, time: number}>} The details of the event notification.
     * @private
     */
    _createEventRegistrationPromise(eventSource, txId, invokeStatus, startTime, timeout) {
        return new Promise(resolve => {
            const handle = setTimeout(() => {
                // give the other event hub connections a chance
                // to verify the Tx status, so resolve the promise

                eventSource.eventHub.unregisterTxEvent(txId);

                const time = Date.now();
                invokeStatus.Set(`commit_timeout_${eventSource.peer}`, 'TIMEOUT');

                // resolve the failed transaction with the current time and error message
                resolve({
                    successful: false,
                    message: `Commit timeout on ${eventSource.peer} for transaction ${txId}`,
                    time: time
                });
            }, this._getRemainingTimeout(startTime, timeout));

            eventSource.eventHub.registerTxEvent(txId, (tx, code) => {
                clearTimeout(handle);
                const time = Date.now();
                eventSource.eventHub.unregisterTxEvent(txId);

                // either explicit invalid event or valid event, verified in both cases by at least one peer
                // TODO: what about when a transient error occurred on a peer?
                invokeStatus.SetVerification(true);

                if (code !== 'VALID') {
                    invokeStatus.Set(`commit_error_${eventSource.peer}`, code);

                    resolve({
                        successful: false,
                        message: `Commit error on ${eventSource.peer} with code ${code}`,
                        time: time
                    });
                } else {
                    invokeStatus.Set(`commit_success_${eventSource.peer}`, time);
                    resolve({
                        successful: true,
                        message: 'undefined',
                        time: time
                    });
                }
            }, (err) => {
                clearTimeout(handle);
                eventSource.eventHub.unregisterTxEvent(txId);
                const time = Date.now();

                // we don't know what happened, but give the other event hub connections a chance
                // to verify the Tx status, so resolve this promise
                invokeStatus.Set(`event_hub_error_${eventSource.peer}`, err.message);

                resolve({
                    successful: false,
                    message: `Event hub error on ${eventSource.peer}: ${err.message}`,
                    time: time
                });
            });
        });
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
     * Gets a random target orderer for the given channel.
     * @param {string} channel The name of the channel.
     * @return {string} The name of the target orderer.
     * @private
     */
    _getRandomTargetOrderer(channel) {
        const orderers = this.randomTargetOrdererCache.get(channel);

        // represents the load balancing mechanism
        const loadBalancingCounter = this.configClientBasedLoadBalancing ? this.workerIndex : this.txIndex;

        return orderers[loadBalancingCounter % orderers.length];
    }

    /**
     * Calculates the remaining time to timeout based on the original timeout and a starting time.
     * @param {number} start The epoch of the start time in ms.
     * @param {number} original The original timeout in ms.
     * @returns {number} The remaining time until the timeout in ms.
     * @private
     */
    _getRemainingTimeout(start, original) {
        let newTimeout = original - (Date.now() - start);
        if (newTimeout < this.configSmallestTimeout) {
            logger.warn(`Timeout is too small, default value of ${this.configSmallestTimeout}ms is used instead`);
            newTimeout = this.configSmallestTimeout;
        }

        return newTimeout;
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
     * Initializes the admins of the organizations.
     *
     * @param {boolean} workerInit Indicates whether the initialization happens in the worker process.
     * @private
     * @async
     */
    async _initializeAdmins(workerInit) {
        const orgs = this.networkUtil.getOrganizations();
        for (const org of orgs) {
            const adminName = `admin.${org}`;
            // build the common part of the profile
            const adminProfile = await this._prepareClientProfile(org, undefined, `${org}'s admin`);

            // Check if the materials already exist locally in file system key-value stores.
            const admin = await this._getUserContext(adminProfile, adminName, `${org}'s admin`);
            if (admin) {
                this.adminProfiles.set(org, adminProfile);

                if (this.networkUtil.isMutualTlsEnabled()) {
                    this._setTlsAdminCertAndKey(org);
                }

                if (!workerInit) {
                    logger.warn(`${org}'s admin's materials found locally in file system key-value stores. Make sure it is the right one!`);
                }

                continue;
            }

            // Set the admin explicitly based on its crypto materials either provided in the connection profile
            const cryptoContent = this.networkUtil.getAdminCryptoContentOfOrganization(org);
            await this._createUser(adminProfile, org, adminName, cryptoContent,`${org}'s admin`);

            this.adminProfiles.set(org, adminProfile);

            if (this.networkUtil.isMutualTlsEnabled()) {
                this._setTlsAdminCertAndKey(org);
            }

            logger.info(`${org}'s admin's materials are successfully loaded`);
        }
    }

    /**
     * Initializes the given channel of every client profile to be able to verify proposal responses.
     * @param {Map<string, FabricClient>} profiles The collection of client profiles.
     * @param {string} channel The name of the channel to initialize.
     * @param {boolean} admin Indicates whether the profiles are admin profiles.
     * @private
     * @async
     */
    async _initializeChannel(profiles, channel, admin) {
        // initialize the channel for every client profile from the local config
        for (const profile of profiles.entries()) {
            const profileOrg = admin ? profile[0] : this.networkUtil.getOrganizationOfClient(profile[0]);
            const channelOrgs = this.networkUtil.getOrganizationsOfChannel(channel);

            // skip init for profiles whose org is a not a member of the channel
            if (!channelOrgs.has(profileOrg)) {
                continue;
            }

            const ch = profile[1].getChannel(channel, false);
            if (ch) {
                try {
                    await ch.initialize();
                } catch (err) {
                    logger.error(`Couldn't initialize ${channel} for ${profile[0]}: ${err.message}`);
                    throw err;
                }
            }
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

        // register and enroll each client with its organization's CA
        for (const client of clients) {
            const org = this.networkUtil.getOrganizationOfClient(client);

            // create the profile based on the connection profile
            const clientProfile = await this._prepareClientProfile(org, client, client);
            this.clientProfiles.set(client, clientProfile);

            // check if the materials already exist locally in the file system key-value stores
            const user = await this._getUserContext(clientProfile, client, client);
            if (user) {
                if (this.networkUtil.isMutualTlsEnabled()) {
                    // "retrieve" and set the deserialized cert and key
                    clientProfile.setTlsClientCertAndKey(user.getIdentity()._certificate, user.getSigningIdentity()._signer._key.toBytes());
                }

                if (!workerInit) {
                    logger.warn(`${client}'s materials found locally in file system key-value stores. Make sure it is the right one!`);
                }

                continue;
            }

            const cryptoContent = this.networkUtil.getClientCryptoContent(client);

            if (cryptoContent) {
                // the client is already enrolled, just create and persist the User object
                await this._createUser(clientProfile, org, client, cryptoContent, client);
                if (this.networkUtil.isMutualTlsEnabled()) {
                    // the materials are included in the configuration file
                    const crypto = this.networkUtil.getClientCryptoContent(client);
                    clientProfile.setTlsClientCertAndKey(crypto.signedCertPEM.toString(), crypto.privateKeyPEM.toString());
                }

                if (!workerInit) {
                    logger.info(`${client}'s materials are successfully loaded`);
                }

                continue;
            }

            // The user needs to be enrolled or even registered

            // if the enrollment ID and secret is provided, then enroll the already registered user
            const enrollmentSecret = this.networkUtil.getClientEnrollmentSecret(client);
            if (enrollmentSecret) {
                const enrollment = await this._enrollUser(clientProfile, client, enrollmentSecret, client);

                // create the new user based on the retrieved materials
                await this._createUser(clientProfile, org, client,
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

                // if not in compatibility mode (i.e., at least SDK v1.1), check whether the affiliation is already registered or not
                if (!this.networkUtil.isInCompatibilityMode()) {
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
            await this._createUser(clientProfile, org, client,
                {privateKeyPEM: enrollment.key.toBytes(), signedCertPEM: Buffer.from(enrollment.certificate)}, client);

            if (this.networkUtil.isMutualTlsEnabled()) {
                // set the received cert and key for mutual TLS
                clientProfile.setTlsClientCertAndKey(Buffer.from(enrollment.certificate).toString(), enrollment.key.toString());
                //this._setTlsClientCertAndKey(client);
            }

            if (!workerInit) {
                logger.info(`${client} successfully enrolled`);
            }
        }
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
                        if (!this.networkUtil.isInCompatibilityMode()) {
                            request.metadataPath = CaliperUtils.resolvePath(ccObject.metadataPath);
                        } else {
                            throw new Error(`Installing ${contractInfo.id}@${contractInfo.version} with metadata is not supported in Fabric v1.0`);
                        }
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
                /** @link{ContractInstantiateUpgradeRequest} */
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

                // check contract language
                // other contracts types are not supported in every version
                if (ccObject.language !== 'golang') {
                    if (ccObject.language === 'node' && this.networkUtil.isInCompatibilityMode()) {
                        throw new Error(`${contractInfo.id}@${contractInfo.version} in ${channel}: Node.js contracts are supported starting from Fabric v1.1`);
                    }

                    if (ccObject.language === 'java' && this.version.lessThan('1.3.0')) {
                        throw new Error(`${contractInfo.id}@${contractInfo.version} in ${channel}: Java contracts are supported starting from Fabric v1.3`);
                    }

                    if (!['golang', 'node', 'java'].includes(ccObject.language)) {
                        throw new Error(`${contractInfo.id}@${contractInfo.version} in ${channel}: unknown contract type ${ccObject.language}`);
                    }
                }

                // check private collection configuration
                if (CaliperUtils.checkProperty(ccObject, 'collections-config')) {
                    if (this.version.lessThan('1.2.0')) {
                        throw new Error(`${contractInfo.id}@${contractInfo.version} in ${channel}: private collections are supported from Fabric v1.2`);
                    }

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
     * Prepares caches (pre-calculated values) used during transaction invokes.
     * @private
     */
    _prepareCaches() {
        // assemble random target peer cache for each channel's each contract
        for (const channel of this.networkUtil.getChannels()) {
            this.randomTargetPeerCache.set(channel, new Map());

            for (const contract of this.networkUtil.getContractsOfChannel(channel)) {
                const idAndVersion = `${contract.id}@${contract.version}`;
                this.randomTargetPeerCache.get(channel).set(idAndVersion, new Map());

                const targetOrgs = new Set();
                const targetPeers = this.networkUtil.getTargetPeersOfContractOfChannel(contract, channel);

                // get target orgs
                for (const peer of targetPeers) {
                    targetOrgs.add(this.networkUtil.getOrganizationOfPeer(peer));
                }

                // set target peers in each org
                for (const org of targetOrgs) {
                    const peersOfOrg = this.networkUtil.getPeersOfOrganizationAndChannel(org, channel);

                    // the peers of the org that target the given contract of the given channel
                    // one of these peers needs to be a target for every org
                    // NOTE: this assumes an n-of-n endorsement policy, which is a safe default
                    this.randomTargetPeerCache.get(channel).get(idAndVersion).set(org, [...peersOfOrg].filter(p => targetPeers.has(p)));
                }
            }
        }

        // assemble random target orderer cache for each channel
        for (const channel of this.networkUtil.getChannels()) {
            this.randomTargetOrdererCache.set(channel, Array.from(this.networkUtil.getOrderersOfChannel(channel)));
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

        try {
            await profile.initCredentialStores();
        } catch (err) {
            throw new Error(`Couldn't initialize the credential stores for ${org}'s ${profileName || 'profile'}: ${err.message}`);
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
     * Queries the specified contract according to the provided settings.
     *
     * @param {ContractQuerySettings} querySettings The settings associated with the query.
     * @param {number} timeout The timeout for the call in milliseconds.
     * @return {Promise<TxStatus>} The result and stats of the transaction query.
     */
    async _submitSingleQuery(querySettings, timeout) {
        const startTime = Date.now();
        this.txIndex++;

        // retrieve the necessary client/admin profile
        let invoker;
        let admin = false;

        if (querySettings.invokerIdentity.startsWith('#')) {
            invoker = this.adminProfiles.get(querySettings.invokerIdentity.substring(1));
            admin = true;
        } else {
            invoker = this.clientProfiles.get(querySettings.invokerIdentity);
        }

        // this hints at an error originating from the outside, so it should terminate
        if (!invoker) {
            throw Error(`Invoker ${querySettings.invokerIdentity} not found!`);
        }

        const txIdObject = invoker.newTransactionID(admin);
        const txId = txIdObject.getTransactionID();

        const invokeStatus = new TxStatus(txId);
        invokeStatus.Set('request_type', 'query');
        invokeStatus.SetVerification(true); // querying is a one-step process unlike a normal transaction, so the result is always verified

        ////////////////////////////////
        // SEND TRANSACTION PROPOSALS //
        ////////////////////////////////

        const targetPeers = querySettings.targetPeers ||
            this._assembleRandomTargetPeers(querySettings.channel, querySettings.contractId, querySettings.contractVersion);

        /** @link{ChaincodeInvokeRequest} */
        const proposalRequest = {
            chaincodeId: querySettings.contractId,
            fcn: querySettings.contractFunction,
            args: querySettings.contractArguments || [],
            transientMap: querySettings.transientMap,
            targets: targetPeers
        };

        // the exception should propagate up for an invalid channel name, indicating a user callback module error
        const channel = invoker.getChannel(querySettings.channel, true);

        /** Array of {Buffer|Error} */
        let results = null;

        // NOTE: everything happens inside a try-catch
        // no exception should escape, query failures have to be handled gracefully
        try {
            // NOTE: wrap it in a Promise to enforce user-provided timeout
            const resultPromise = new Promise(async (resolve, reject) => {
                const timeoutHandle = setTimeout(() => {
                    reject(new Error('TIMEOUT'));
                }, this._getRemainingTimeout(startTime, timeout));

                invokeStatus.Set('time_create', Date.now());
                try {
                    const result = await channel.queryByChaincode(proposalRequest, admin);
                    clearTimeout(timeoutHandle);
                    resolve(result);
                } catch(err) {
                    clearTimeout(timeoutHandle);
                    reject(err);
                }
            });

            results = await resultPromise;

            ///////////////////////
            // CHECK THE RESULTS //
            ///////////////////////

            let errMsg;

            // filter for errors inside, so we have accurate indices for the corresponding peers
            results.forEach((value, index) => {
                const targetName = targetPeers[index];
                if (value instanceof Error) {
                    invokeStatus.Set(`endorsement_result_error_${targetName}`, value.message);
                    errMsg = `\n\t- Endorsement error from ${targetName}: ${value.message}`;
                } else {
                    // NOTE: the last result will be kept
                    invokeStatus.SetResult(value);
                    invokeStatus.Set(`endorsement_result_${targetName}`, value);
                }
            });

            if (errMsg) {
                invokeStatus.SetStatusFail();
                logger.error(`Query error for ${querySettings.contractId}@${querySettings.contractVersion} in ${querySettings.channel}:${errMsg}`);
            } else {
                invokeStatus.SetStatusSuccess();
            }
        } catch (err) {
            invokeStatus.SetStatusFail();
            invokeStatus.Set('unexpected_error', err.message);
            logger.error(`Unexpected query error for ${querySettings.contractId}@${querySettings.contractVersion} in ${querySettings.channel}: ${err.stack ? err.stack : err}`);
        }

        return invokeStatus;
    }

    /**
     * Invokes the specified contract according to the provided settings.
     *
     * @param {ContractInvokeSettings} invokeSettings The settings associated with the transaction submission.
     * @param {number} timeout The timeout for the whole transaction life-cycle in milliseconds.
     * @return {Promise<TxStatus>} The result and stats of the transaction invocation.
     */
    async _submitSingleTransaction(invokeSettings, timeout) {
        // note start time to adjust the timeout parameter later
        const startTime = Date.now();
        this.txIndex++; // increase the counter

        // NOTE: since this function is a hot path, there aren't any assertions for the sake of efficiency

        // retrieve the necessary client/admin profile
        let invoker;
        let admin = false;

        if (invokeSettings.invokerIdentity.startsWith('#')) {
            invoker = this.adminProfiles.get(invokeSettings.invokerIdentity.substring(1));
            admin = true;
        } else {
            invoker = this.clientProfiles.get(invokeSettings.invokerIdentity);
        }

        // this hints at an error originating from the outside, so it should terminate
        if (!invoker) {
            throw Error(`Invoker ${invokeSettings.invokerIdentity} not found!`);
        }

        ////////////////////////////////
        // PREPARE SOME BASIC OBJECTS //
        ////////////////////////////////

        const txIdObject = invoker.newTransactionID(admin);
        const txId = txIdObject.getTransactionID();

        // timestamps are recorded for every phase regardless of success/failure
        const invokeStatus = new TxStatus(txId);
        invokeStatus.Set('request_type', 'transaction');

        const errors = []; // errors are collected during response validations

        ////////////////////////////////
        // SEND TRANSACTION PROPOSALS //
        ////////////////////////////////

        const channel = invoker.getChannel(invokeSettings.channel, true);
        let targetPeers;

        if (invokeSettings.targetPeers) {
            targetPeers = invokeSettings.targetPeers;
        } else if (invokeSettings.targetOrganizations) {
            if (Array.isArray(invokeSettings.targetOrganizations) && invokeSettings.targetOrganizations.length > 0) {
                // discovery is never enabled for low level fabric client, so just target all peers in the org
                targetPeers = this._getEndorsingPeersForOrgs(channel, invokeSettings.targetOrganizations);
            } else {
                logger.warn(`${invokeSettings.targetOrganizations} is not a populated array, no orgs targetted`);
            }
        }
        if (!targetPeers) {
            targetPeers = this._assembleRandomTargetPeers(invokeSettings.channel, invokeSettings.contractId, invokeSettings.contractVersion);
        } else if (targetPeers.length === 0) {
            logger.warn('No peers found to be able to target. If targetting organizations, check the organization exists');
        }

        /** @link{ChaincodeInvokeRequest} */
        const proposalRequest = {
            chaincodeId: invokeSettings.contractId,
            fcn: invokeSettings.contractFunction,
            args: invokeSettings.contractArguments || [],
            txId: txIdObject,
            transientMap: invokeSettings.transientMap,
            targets: targetPeers
        };


        /** @link{ProposalResponseObject} */
        let proposalResponseObject = null;

        // NOTE: everything happens inside a try-catch
        // no exception should escape, transaction failures have to be handled gracefully
        try {
            try {
                // account for the elapsed time up to this point
                invokeStatus.Set('time_create', Date.now());
                proposalResponseObject = await channel.sendTransactionProposal(proposalRequest,
                    this._getRemainingTimeout(startTime, timeout));

                invokeStatus.Set('time_endorse', Date.now());
            } catch (err) {
                invokeStatus.Set('time_endorse', Date.now());
                invokeStatus.Set('proposal_error', err.message);

                // error occurred, early life-cycle termination, definitely failed
                invokeStatus.SetVerification(true);

                errors.push(err);
                throw errors; // handle every logging in one place at the end
            }

            //////////////////////////////////
            // CHECKING ENDORSEMENT RESULTS //
            //////////////////////////////////

            /** @link{Array<ProposalResponse>} */
            const proposalResponses = proposalResponseObject[0];
            /** @link{Proposal} */
            const proposal = proposalResponseObject[1];

            // NOTES: filter inside, so we have accurate indices corresponding to the original target peers
            proposalResponses.forEach((value, index) => {
                const targetName = targetPeers[index];

                // Errors from peers/contract are returned as an Error object
                if (value instanceof Error) {
                    invokeStatus.Set(`proposal_response_error_${targetName}`, value.message);

                    // explicit rejection, early life-cycle termination, definitely failed
                    invokeStatus.SetVerification(true);
                    errors.push(new Error(`Proposal response error by ${targetName}: ${value.message}`));
                    return;
                }

                /** @link{ProposalResponse} */
                const proposalResponse = value;

                // save a contract results/response
                // NOTE: the last one will be kept as result
                invokeStatus.SetResult(proposalResponse.response.payload);
                invokeStatus.Set(`endorsement_result_${targetName}`, proposalResponse.response.payload);

                // verify the endorsement signature and identity if configured
                if (this.configVerifyProposalResponse) {
                    if (!channel.verifyProposalResponse(proposalResponse)) {
                        invokeStatus.Set(`endorsement_verify_error_${targetName}`, 'INVALID');

                        // explicit rejection, early life-cycle termination, definitely failed
                        invokeStatus.SetVerification(true);
                        errors.push(new Error(`Couldn't verify endorsement signature or identity of ${targetName}`));
                        return;
                    }
                }

                /** @link{ResponseObject} */
                const responseObject = proposalResponse.response;

                if (responseObject.status !== 200) {
                    invokeStatus.Set(`endorsement_result_error_${targetName}`, `${responseObject.status} ${responseObject.message}`);

                    // explicit rejection, early life-cycle termination, definitely failed
                    invokeStatus.SetVerification(true);
                    errors.push(new Error(`Endorsement denied by ${targetName}: ${responseObject.message}`));
                }
            });

            // if there were errors, stop further processing, jump to the end
            if (errors.length > 0) {
                throw errors;
            }

            if (this.configVerifyReadWriteSets) {
                // check all the read/write sets to see if they're the same
                if (!channel.compareProposalResponseResults(proposalResponses)) {
                    invokeStatus.Set('read_write_set_error', 'MISMATCH');

                    // r/w set mismatch, early life-cycle termination, definitely failed
                    invokeStatus.SetVerification(true);
                    errors.push(new Error('Read/Write set mismatch between endorsements'));
                    throw errors;
                }
            }

            /////////////////////////////////
            // REGISTERING EVENT LISTENERS //
            /////////////////////////////////

            const eventPromises = []; // to wait for every event response

            // NOTE: in compatibility mode, the same EventHub can be used for multiple channels
            // if the peer is part of multiple channels
            this.channelEventSourcesCache.get(invokeSettings.channel).forEach((eventSource) => {
                eventPromises.push(this._createEventRegistrationPromise(eventSource,
                    txId, invokeStatus, startTime, timeout));
            });

            ///////////////////////////////////////////
            // SUBMITTING TRANSACTION TO THE ORDERER //
            ///////////////////////////////////////////

            const targetOrderer = invokeSettings.orderer || this._getRandomTargetOrderer(invokeSettings.channel);
            let orderer;

            if (typeof(targetOrderer) === 'string' || targetOrderer instanceof String) {
                // Using an orderer name
                orderer = channel.getOrderer(targetOrderer);
            } else {
                // Have been passed an orderer as an object within invokeSettings.orderer
                throw new Error('Orderer object passed within invokeSettings: must reference target orderer by name');
            }

            /** @link{TransactionRequest} */
            const transactionRequest = {
                proposalResponses: proposalResponses,
                proposal: proposal,
                orderer
            };

            /** @link{BroadcastResponse} */
            let broadcastResponse;
            try {
                // wrap it in a Promise to add explicit timeout to the call
                const responsePromise = new Promise(async (resolve, reject) => {
                    const timeoutHandle = setTimeout(() => {
                        reject(new Error('TIMEOUT'));
                    }, this._getRemainingTimeout(startTime, timeout));

                    try {
                        const result = await channel.sendTransaction(transactionRequest);
                        clearTimeout(timeoutHandle);
                        resolve(result);
                    } catch(err) {
                        clearTimeout(timeoutHandle);
                        reject(err);
                    }
                });

                broadcastResponse = await responsePromise;
            } catch (err) {
                // either an explicit deny from the orderer
                // or a timeout occurred (eating up all the allocated time for the TX)
                invokeStatus.Set(`broadcast_error_${targetOrderer}`, err.message);
                invokeStatus.SetVerification(true);

                errors.push(new Error(`Broadcast error from ${targetOrderer}: ${err.message}`));
                throw errors;
            }

            invokeStatus.Set('time_orderer_ack', Date.now());

            if (broadcastResponse.status !== 'SUCCESS') {
                invokeStatus.Set(`broadcast_response_error_${targetOrderer}`, broadcastResponse.status);

                // the submission was explicitly rejected, so the Tx will definitely not be ordered
                invokeStatus.SetVerification(true);
                errors.push(new Error(`${targetOrderer} response error with status ${broadcastResponse.status}`));
                throw errors;
            }

            //////////////////////////////
            // PROCESSING EVENT RESULTS //
            //////////////////////////////

            // this shouldn't throw, otherwise the error handling is not robust
            const eventResults = await Promise.all(eventPromises);

            // NOTE: this is the latency@threshold support described by the PSWG in their first paper
            const failedNotifications = eventResults.filter(er => !er.successful);

            // NOTE: an error from any peer indicates some problem, don't mask it;
            // although one successful transaction should be enough for "eventual" success;
            // errors from some peer indicate transient problems, errors from all peers probably indicate validation errors
            if (failedNotifications.length > 0) {
                invokeStatus.SetStatusFail();

                let logMsg = `Transaction[${txId.substring(0, 10)}] commit errors:`;
                for (const commitErrors of failedNotifications) {
                    logMsg += `\n\t- ${commitErrors.message}`;
                }

                logger.error(logMsg);
            } else {
                // sort ascending by finish time
                eventResults.sort((a, b) => a.time - b.time);

                // transform to (0,length] by *, then to (-1,length-1] by -, then to [0,length-1] by ceil
                const thresholdIndex = Math.ceil(eventResults.length * this.configLatencyThreshold - 1);

                // every commit event contained a VALID code
                // mark the time corresponding to the set threshold
                invokeStatus.SetStatusSuccess(eventResults[thresholdIndex].time);
            }
        } catch (err) {
            invokeStatus.SetStatusFail();

            // not the expected error array was thrown, an unexpected error occurred, log it with stack if available
            if (!Array.isArray(err)) {
                invokeStatus.Set('unexpected_error', err.message);
                logger.error(`Transaction[${txId.substring(0, 10)}] unexpected error: ${err.stack ? err.stack : err}`);
            } else if (err.length > 0) {
                let logMsg = `Transaction[${txId.substring(0, 10)}] life-cycle errors:`;
                for (const execError of err) {
                    logMsg += `\n\t- ${execError.message}`;
                }

                logger.error(logMsg);
            }
        }

        return invokeStatus;
    }

    /**
     * Get the named contract for a named user
     * @param {string} invokerIdentity the user identity for interacting with the contract
     * @param {string} contractName the name of the contract to return
     * @returns {FabricNetworkAPI.Contract} A contract that may be used to submit or evaluate transactions
     * @async
     */
    async _getUserContract(invokerIdentity, contractName) {

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
        const contract = contractSet.get(contractName);

        // If no contract found, there is a user configuration/test specification error, so it should terminate
        if (!contract) {
            throw Error(`No contract named ${contractName} found!`);
        }

        return contract;
    }

    /**
     * Initialize the channels and event hubs
     * @async
     */
    async _initializeChannelsAndEventHubs() {
        for (const channel of this.networkUtil.getChannels()) {
            // initialize the channels by getting the config from the orderer
            await this._initializeChannel(this.adminProfiles, channel, true);
            await this._initializeChannel(this.clientProfiles, channel, false);
        }

        if (this.networkUtil.isInCompatibilityMode()) {
            // NOTE: for old event hubs we have a single connection to every peer set as an event source
            const EventHub = require('fabric-client/lib/EventHub.js');

            for (const peer of this.networkUtil.getAllEventSources()) {
                const org = this.networkUtil.getOrganizationOfPeer(peer);
                const admin = this.adminProfiles.get(org);

                const eventHub = new EventHub(admin);
                eventHub.setPeerAddr(this.networkUtil.getPeerEventUrl(peer),
                    this.networkUtil.getGrpcOptionsOfPeer(peer));

                // we can use the same peer for multiple channels in case of peer-level eventing
                this.eventSources.push({
                    channel: this.networkUtil.getChannelsOfPeer(peer),
                    peer: peer,
                    eventHub: eventHub
                });
            }
        } else {
            // NOTE: for channel event hubs we might have multiple connections to a peer,
            // so connect to the defined event sources of every org in every channel
            for (const channel of this.networkUtil.getChannels()) {
                for (const org of this.networkUtil.getOrganizationsOfChannel(channel)) {
                    //TODO: Why are admins used here ? clients should be used really
                    const admin = this.adminProfiles.get(org);

                    // The API for retrieving channel event hubs changed, from SDK v1.2 it expects the MSP ID of the org
                    const orgId = this.version.lessThan('1.2.0') ? org : this.networkUtil.getMspIdOfOrganization(org);

                    const eventHubs = admin.getChannel(channel, true).getChannelEventHubsForOrg(orgId);

                    // the peer (as an event source) is associated with exactly one channel in case of channel-level eventing
                    for (const eventHub of eventHubs) {
                        this.eventSources.push({
                            channel: [channel],
                            peer: this.networkUtil.getPeerNameOfEventHub(eventHub),
                            eventHub: eventHub
                        });
                    }
                }
            }
        }

        this.eventSources.forEach((es) => {
            es.eventHub.connect(false);
        });

        // rebuild the event source cache
        this.channelEventSourcesCache = new Map();

        for (const es of this.eventSources) {
            const channels = es.channel;

            // an event source can be used for multiple channels in compatibility mode
            for (const c of channels) {
                // initialize the cache for a channel with an empty array at the first time
                if (!this.channelEventSourcesCache.has(c)) {
                    this.channelEventSourcesCache.set(c, []);
                }

                // add the event source to the channels collection
                const eventSources = this.channelEventSourcesCache.get(c);
                eventSources.push(es);
            }
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

        const timeout = (request.timeout || this.configDefaultTimeout) * 1000;
        if (request.readOnly) {
            return this._submitSingleQuery(request, timeout);
        } else {
            return this._submitSingleTransaction(request, timeout);
        }
    }
}

module.exports = LegacyV1Fabric;
