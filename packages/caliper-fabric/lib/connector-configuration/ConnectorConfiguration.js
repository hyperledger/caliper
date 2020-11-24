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

const CaliperUtils = require('@hyperledger/caliper-core').CaliperUtils;
const ConnectionProfileDefinition = require('./ConnectionProfileDefinition');
const fs = require('fs');

const Logger = CaliperUtils.getLogger('ConnectorConfiguration');

/**
 * Parse and process the fabric connector configuration
 */
class ConnectorConfiguration {

    /**
     * @param {string} connectorConfigurationPath path to the json or yaml file defining the configuration
     * @param {IdentityManagerFactory} identityManagerFactory an identity manager factory
     * @param {WalletFacadeFactory} walletFacadeFactory a wallet facade factory
     *
     */
    constructor(connectorConfigurationPath, identityManagerFactory, walletFacadeFactory) {
        CaliperUtils.assertDefined(connectorConfigurationPath, '[ConnectorConfiguration.constructor] Parameter \'connectorConfigurationPath\' is undefined or null');
        this.connectorConfigurationPath = connectorConfigurationPath;
        this.identityManagerFactory = identityManagerFactory;
        this.walletFacadeFactory = walletFacadeFactory;
        this.identityManager = null;
        this.contractDetailsById = new Map();
        this.defaultInvokerMap = new Map();
        this.defaultInvokerForDefaultOrganization = null;
        this.peersInChannelByOrganizationMap = null;
        this.orderersInChannelMap = null;
    }

    /**
     * parse the configuration
     */
    async parseConfiguration() {
        const configPath = CaliperUtils.resolvePath(this.connectorConfigurationPath);
        this.connectorConfiguration = CaliperUtils.parseYaml(configPath);
        this.identityManager = await this.identityManagerFactory.create(this.walletFacadeFactory, this.connectorConfiguration.organizations);
        this._createContractDetailsById();
        await this._createDefaultInvokerCache();
    }

    /**
     * return whether mutual TLS is required or not
     * @returns {boolean} true if mutual TLS required, false otherwise
     */
    isMutualTLS() {
        return (this.connectorConfiguration.caliper.sutOptions &&
                this.connectorConfiguration.caliper.sutOptions.mutualTls) ? true : false;
    }

    /**
     * Returns a list of all the channels defined in the configuration
     * @returns {string[]} A list of all channels in the configuration
     */
    getAllChannelNames() {
        const channelList = this.connectorConfiguration.channels;

        if (channelList &&
            Array.isArray(channelList)) {
            return channelList.map(channelDefinition => channelDefinition.channelName);
        }

        return [];
    }

    /**
     * Returns a list of all the channels which are marked for creation
     * @returns {string[]} A list of all channels which are marked for creation
     */
    getChannelNamesForCreation() {
        const channelList = this.connectorConfiguration.channels;

        if (channelList &&
            Array.isArray(channelList)) {
            return channelList.filter(channelDefinition => channelDefinition.create).map(channelDefinition => channelDefinition.channelName);
        }

        return [];
    }

    /**
     *
     * @param {string} channelName the name of the channel
     * @returns {*} returns the channel definition or null if no channel creation definition for that name
     */
    getCreationDefinitionForChannelName(channelName) {
        const channelList = this.connectorConfiguration.channels;

        if (channelList &&
            Array.isArray(channelList)) {
            const filteredChannelDefinitionList = channelList.filter(channelDefinition => channelDefinition.channelName === channelName);
            return filteredChannelDefinitionList.length > 0 ? filteredChannelDefinitionList[0].create : null;
        }

        return null;
    }
    /**
     * return array of contract definitions for specific channel
     * @param {string} channelName channel name wanted
     * @returns {Array} all of contract definitions for channel
    */
    getContractDefinitionsForChannelName(channelName) {
        const channelList = this.connectorConfiguration.channels;

        if (channelList && Array.isArray(channelList)){
            const channelDefinition = channelList.filter(channelContracts => channelContracts.channelName === channelName);
            const contractDefinitions = channelDefinition[0].contracts;
            if (contractDefinitions && Array.isArray(contractDefinitions)) {
                return contractDefinitions;
            }
        }
        return [];
    }

    /**
     * Gets the details (channel, id and version) for the given contract.
     * @param {string} contractId The unique Id of the contract.
     * @return {{channel: string, id: string}} The details of the contract, null otherwise.
     */
    getContractDetailsForContractId(contractId) {
        return this.contractDetailsById.get(contractId);
    }

    /**
     * Returns a list of all the mspids that represent organizations
     * @returns {string[]} A list of all the mspids that represent organizations
     */
    getOrganizations() {

        // currently an identity manager can't be constructed without a valid
        // organizations block so can assume here that organizations is valid
        return this.connectorConfiguration.organizations.map(organization => organization.mspid);
    }

    /**
     * Get the connection profile definition for a specific organization loading the
     * connection profile into memory if it hasn't already been done
     * @param {string} mspId The msp ID of the organization
     * @returns {Promise<ConnectionProfileDefinition>} A connection profile definition
     * @async
     */
    async getConnectionProfileDefinitionForOrganization(mspId) {
        const filteredOrganizationList = this.connectorConfiguration.organizations.filter(organization => organization.mspid === mspId);

        if (filteredOrganizationList.length > 0) {
            const connectionProfileEntry = filteredOrganizationList[0].connectionProfile;
            if (!connectionProfileEntry) {
                throw new Error(`No connection profile entry for organization ${mspId} has been defined`);
            }

            if (!connectionProfileEntry.path) {
                throw new Error(`No path for the connection profile for organization ${mspId} has been defined`);
            }

            if (!connectionProfileEntry.loadedConnectionProfile) {
                connectionProfileEntry.loadedConnectionProfile = await this._loadConnectionProfile(connectionProfileEntry.path);
            }

            return new ConnectionProfileDefinition(mspId, connectionProfileEntry);
        }

        throw new Error(`No organization defined for ${mspId}`);
    }

    /**
     * Get a list of all the alias names for an organization that will be in the wallet
     * @param {string} mspId The msp ID of the organization
     * @returns {Promise<string[]>} a list of all the aliases (including admin specified) or a blank array if there are none
     * @async
     */
    async getAliasNamesForOrganization(mspId) {
        return await this.identityManager.getAliasNamesForOrganization(mspId);
    }

    /**
     * Get a list of admin alias names for an organization
     * @param {string} mspId the mspid of the organization
     * @returns {string[]} list of admin alias names or empty if none
     */
    getAdminAliasNamesForOrganization(mspId) {
        return this.identityManager.getAdminAliasNamesForOrganization(mspId);
    }

    /**
     * Return the node-sdk version specific wallet
     * @returns {*} the node-sdk version specific wallet
     */
    getWallet() {
        return this.identityManager.getWallet();
    }

    /**
     * Return the wallet facade that contains all the identities
     * @returns {*} the node-sdk version agnostic wallet
     */
    getWalletFacade() {
        return this.identityManager.getWalletFacade();
    }

    /**
     * Get an alias name which can be used, either from providing all the info explicitly or resorting to using
     * default options
     * @param {string} mspId The msp ID of the organization that owns the identity, if not provided will use the default organization
     * @param {string} identityName the identity name in the organization to use, if not specified a default identity will be chosen
     * @returns {string} the unique alias name that will be in the wallet which can be used
     */
    getAliasNameForOrganizationAndIdentityName(mspId, identityName) {
        if (!identityName || identityName.length === 0) {
            if (!mspId || mspId.length === 0) {
                Logger.debug(`Selecting invoker ${this.defaultInvokerForDefaultOrganization} for default organization`);

                return this.defaultInvokerForDefaultOrganization;
            }
            const invokerForOrganization = this.defaultInvokerMap.get(mspId);
            Logger.debug(`Selecting invoker ${invokerForOrganization} for organization ${mspId}`);

            return invokerForOrganization;
        }

        return this.identityManager.generateAliasNameFromOrganizationAndIdentityName(mspId, identityName);
    }

    /**
     * This returns a map of all the channels and the orgs (with their associated endorsing peers) in that channel. The format is
     * channel1
     *    |-- Org1
     *    |     |-- org1EndorsingPeer1
     *    |     \-- org1EndorsingPeer2
     *    |
     *    |-- Org2
     *    |     |-- org2EndorsingPeer
     *    |
     * channel2
     *    |
     *   ...
     *
     * This map provides you with all the channels, the orgs participanting in those channels
     * and the endorsing peers for each organization
     *
     * @returns {Promise<Map>} The above map structure
     * @async
     */
    async getEndorsingPeersInChannelByOrganizationMap() {
        if (!this.peersInChannelByOrganizationMap) {
            this.peersInChannelByOrganizationMap = new Map();

            for (const channelName of this.getAllChannelNames()) {
                this.peersInChannelByOrganizationMap.set(channelName, new Map());
                for (const organization of this.getOrganizations()) {
                    const connectionProfileDefinition = await this.getConnectionProfileDefinitionForOrganization(organization);
                    const organizationPeersInChannel = connectionProfileDefinition.getOwnedEndorsingPeersInChannel(channelName);
                    if (organizationPeersInChannel && organizationPeersInChannel.length > 0) {
                        this.peersInChannelByOrganizationMap.get(channelName).set(organization, organizationPeersInChannel);
                    }
                }
            }
        }

        return this.peersInChannelByOrganizationMap;
    }

    /**
     * Create a map of all the channels and the orderers managing each channel
     * Only used by the operational fabric 1.4 code so only works with static connection profiles
     * @returns {Promise<Map>} Map of orderers for channel
     * @async
     */
    async getOrderersInChannelMap() {
        if (!this.orderersInChannelMap) {
            this.orderersInChannelMap = new Map();

            for (const channelName of this.getAllChannelNames()) {
                for (const organization of this.getOrganizations()) {
                    const connectionProfileDefinition = await this.getConnectionProfileDefinitionForOrganization(organization);
                    let orderers;
                    try {
                        orderers = connectionProfileDefinition.getOrderersForChannel(channelName);
                    } catch(error) {
                        // ignore if the channel is not defined in this connection profile and can try others
                    }
                    if (orderers && orderers.length > 0) {
                        this.orderersInChannelMap.set(channelName, orderers);
                        break;
                    }
                }

                if (!this.orderersInChannelMap.get(channelName)) {
                    throw new Error(`No orderers could be found for channel ${channelName} in any of the connection profiles`);
                }
            }
        }

        return this.orderersInChannelMap;
    }

    /**
     * Load a connection profile into memory
     * @param {string} connectionProfilePath The path the the connection profile
     * @returns {Promise<*>} In memory representation of a connection profile
     * @async
     * @private
     */
    async _loadConnectionProfile(connectionProfilePath) {
        const resolvedConnectionProfilePath = CaliperUtils.resolvePath(connectionProfilePath);
        if (!fs.existsSync(resolvedConnectionProfilePath)) {
            throw new Error(`No connection profile file found at ${resolvedConnectionProfilePath}`);
        }

        return CaliperUtils.parseYaml(resolvedConnectionProfilePath);
    }

    /**
     * create a map to be able to look up contract details based on the contract
     * id.
     * Contract details are just the channel and chaincode id (version number is not required)
     */
    _createContractDetailsById() {
        const channelDefinitions = this.connectorConfiguration.channels;

        if (channelDefinitions && Array.isArray(channelDefinitions)){

            for (const channelDefinition of channelDefinitions) {
                const contractDefinitions = channelDefinition.contracts;

                if (contractDefinitions && Array.isArray(contractDefinitions)) {

                    for (const contractDefinition of contractDefinitions) {

                        if (!contractDefinition.contractID) {
                            contractDefinition.contractID = contractDefinition.id;
                        }

                        if (contractDefinition.language && contractDefinition.language !== 'golang' && contractDefinition.path) {
                            contractDefinition.path = CaliperUtils.resolvePath(contractDefinition.path);
                        }

                        if (this.contractDetailsById.has(contractDefinition.contractID)) {
                            throw new Error(`${contractDefinition.contractID} has already been defined in the configuration`);
                        }

                        this.contractDetailsById.set(contractDefinition.contractID, {channel: channelDefinition.channelName, id: contractDefinition.id});
                    }
                }
            }
        }
    }

    /**
     * create a cache of default invoker alias names
     */
    async _createDefaultInvokerCache() {
        for (const organization of this.getOrganizations()) {
            const aliasNames = await this.identityManager.getAliasNamesForOrganization(organization);
            if (aliasNames.length > 0) {
                this.defaultInvokerMap.set(organization, aliasNames[0]);
                if (!this.defaultInvokerForDefaultOrganization) {
                    this.defaultInvokerForDefaultOrganization = aliasNames[0];
                }
            } else {
                throw new Error(`Organization ${organization} has been defined without at least 1 identity associated with it`);
            }
        }
    }

}

module.exports = ConnectorConfiguration;
