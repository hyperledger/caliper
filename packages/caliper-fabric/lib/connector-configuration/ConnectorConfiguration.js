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
    }

    /**
     * parse the configuration
     */
    async parseConfiguration() {
        const configPath = CaliperUtils.resolvePath(this.connectorConfigurationPath);
        this.connectorConfiguration = CaliperUtils.parseYaml(configPath);
        this.identityManager = await this.identityManagerFactory.create(this.walletFacadeFactory, this.connectorConfiguration.organizations);
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
     * @returns {*} returns the channel definition or null if no channel definition for that name
     */
    getDefinitionForChannelName(channelName) {
        const channelList = this.connectorConfiguration.channels;

        if (channelList &&
            Array.isArray(channelList)) {
            const filteredChannelDefinitionList = channelList.filter(channelDefinition => channelDefinition.channelName === channelName);
            return filteredChannelDefinitionList.length > 0 ? filteredChannelDefinitionList[0].definition : null;
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
            const channelWanted = channelList.filter(channelContracts => channelContracts.channelName === channelName);
            const contractDefinitions = channelWanted[0].contracts;
            if (contractDefinitions && Array.isArray(contractDefinitions)) {
                return contractDefinitions;
            }
        }
        return [];
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
     * @returns {ConnectionProfileDefinition} A connection profile definition
     * @async
     */
    async getConnectionProfileDefinitionForOrganization(mspId) {
        const filteredOrganizationList = this.connectorConfiguration.organizations.filter(organization => organization.mspid === mspId);

        if (filteredOrganizationList.length > 0) {
            const connectionProfileEntry = filteredOrganizationList[0].connectionProfile;

            if (!connectionProfileEntry.loadedConnectionProfile) {
                connectionProfileEntry.loadedConnectionProfile = await this._loadConnectionProfile(connectionProfileEntry.path);
            }

            return new ConnectionProfileDefinition(connectionProfileEntry);
        }

        throw new Error(`No organization defined for ${mspId}`);
    }

    /**
     * Get a list of all the alias names for an organization that will be in the wallet
     * @param {string} mspId The msp ID of the organization
     * @returns {string[]} a list of all the aliases or a blank array if there are none
     * @async
     */
    async getAliasNamesForOrganization(mspId) {
        return await this.identityManager.getAliasNamesForOrganization(mspId);
    }

    /**
     * Return the wallet that contains the identity for the alias
     * @param {string} aliasName the alias name
     * @returns {*} the node-sdk version specific wallet
     */
    getWalletForAliasName(aliasName) {
        return this.identityManager.getWallet();
    }

    /**
     * Get an alias name which can be used with a wallet for the unique identity name
     * @param {string} mspId The msp ID of the organization that owns the identity
     * @param {string} identityName the identity name the organization it associates with the identity
     * @returns {string} the unique alias name that will be in the wallet
     */
    getAliasNameFromOrganizationAndIdentityName(mspId, identityName) {
        return this.identityManager.getAliasNameFromOrganizationAndIdentityName(mspId, identityName);
    }

    /**
     * Load a connection profile into memory
     * @param {string} connectionProfilePath The path the the connection profile
     * @returns {*} In memory representation of a connection profile
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
}

module.exports = ConnectorConfiguration;
