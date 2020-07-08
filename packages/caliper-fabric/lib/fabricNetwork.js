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

const fs = require('fs');
const CaliperUtils = require('@hyperledger/caliper-core').CaliperUtils;

/**
 * Utility class for accessing information in a Common Connection Profile configuration
 * (and the Caliper specific extensions) without relying on its structure.
 *
 * @property {object} network The loaded network configuration object.
 * @property {object} clientConfigs The map of client names to their client configuration objects.
 * @property {boolean} compatibilityMode Indicates whether the configuration describes a v1.0 Fabric network.
 * @property {boolean} tls Indicates whether TLS communication is configured for the network.
 * @property {boolean} mutualTls Indicates whether mutual TLS communication is configured for the network.
 * @property {Map<string, {channel:string, id:string, version:string}>} The mapping of contract IDs to contract details.
 */
class FabricNetwork {
    /**
     * Loads and verifies the Common Connection Profile settings.
     *
     * @param {string|object} networkConfig The relative or absolute file path, or the object itself of the Common Connection Profile settings.
     */
    constructor(networkConfig) {
        CaliperUtils.assertDefined(networkConfig, '[FabricNetwork.constructor] Parameter \'networkConfig\' if undefined or null');

        this.network = undefined;
        if (typeof networkConfig === 'string') {
            // resolve path will by default use the known workspace root
            const configPath = CaliperUtils.resolvePath(networkConfig);
            this.network = CaliperUtils.parseYaml(configPath);
        } else if (typeof networkConfig === 'object' && networkConfig !== null) {
            // clone the object to prevent modification by other objects
            this.network = CaliperUtils.parseYamlString(CaliperUtils.stringifyYaml(networkConfig));
        } else {
            throw new Error('[FabricNetwork.constructor] Parameter "networkConfig" is neither a file path nor an object');
        }

        this.clientConfigs = {};
        this.compatibilityMode = false; // if event URLs are detected for the peers, we're using Fabric 1.0
        this.tls = false;
        this.mutualTls = false;
        this.contractMapping = new Map();
        this._processConfiguration();
    }


    /**
     * Internal utility function for retrieving key information from the network configuration.
     *
     * @private
     */
    _processConfiguration() {
        this.mutualTls = !!this.network['mutual-tls'];

        if (this.network.clients) {
            const clients = this.getClients();
            for (const client of clients) {
                this.clientConfigs[client] = this.network.clients[client];

                const cObj = this.network.clients[client].client;
                // normalize paths
                if (cObj.credentialStore) {
                    cObj.credentialStore.path = CaliperUtils.resolvePath(cObj.credentialStore.path);
                    cObj.credentialStore.cryptoStore.path = CaliperUtils.resolvePath(cObj.credentialStore.cryptoStore.path);
                }

                if (cObj.clientPrivateKey && cObj.clientPrivateKey.path) {
                    cObj.clientPrivateKey.path = CaliperUtils.resolvePath(cObj.clientPrivateKey.path);
                }

                if (cObj.clientSignedCert && cObj.clientSignedCert.path) {
                    cObj.clientSignedCert.path = CaliperUtils.resolvePath(cObj.clientSignedCert.path);
                }
            }
        }

        if (this.network.channels) {
            const channels = this.getChannels();
            for (const channel of channels) {
                const cObj = this.network.channels[channel];

                for (const cc of cObj.contracts) {
                    if (!cc.contractID) {
                        cc.contractID = cc.id;
                    }

                    this.contractMapping.set(cc.contractID, {channel: channel, id: cc.id, version: cc.version});
                    if (cc.language && cc.language !== 'golang' && cc.path) {
                        cc.path = CaliperUtils.resolvePath(cc.path);
                    }
                }
            }
        }

        if (this.network.organizations) {
            const orgs = this.getOrganizations();
            for (const org of orgs) {
                const oObj = this.network.organizations[org];

                if (oObj.adminPrivateKey && oObj.adminPrivateKey.path) {
                    oObj.adminPrivateKey.path = CaliperUtils.resolvePath(oObj.adminPrivateKey.path);
                }

                if (oObj.signedCert && oObj.signedCert.path) {
                    oObj.signedCert.path = CaliperUtils.resolvePath(oObj.signedCert.path);
                }
            }
        }

        if (this.network.orderers) {
            const orderers = this.getOrderers();
            for (const orderer of orderers) {
                const oObj = this.network.orderers[orderer];

                this.tls |= oObj.url.startsWith('grpcs://');

                if (oObj.tlsCACerts && oObj.tlsCACerts.path) {
                    oObj.tlsCACerts.path = CaliperUtils.resolvePath(oObj.tlsCACerts.path);
                }
            }
        }

        if (this.network.peers) {
            const peers = this.getPeers();
            for (const peer of peers) {
                const pObj = this.network.peers[peer];

                this.tls |= pObj.url.startsWith('grpcs://');

                if (pObj.tlsCACerts && pObj.tlsCACerts.path) {
                    pObj.tlsCACerts.path = CaliperUtils.resolvePath(pObj.tlsCACerts.path);
                }

                if (pObj.eventUrl) {
                    this.compatibilityMode = true;
                }
            }
        }

        if (this.network.certificateAuthorities) {
            const cas = this.getCertificateAuthorities();
            for (const ca of cas) {
                const caObj = this.network.certificateAuthorities[ca];

                this.tls |= caObj.url.startsWith('https://');

                if (caObj.tlsCACerts && caObj.tlsCACerts.path) {
                    caObj.tlsCACerts.path = CaliperUtils.resolvePath(caObj.tlsCACerts.path);
                }
            }
        }

        if (this.mutualTls && this.compatibilityMode) {
            throw new Error('Mutual TLS is not supported for Fabric v1.0');
        }
    }

    /**
     * Gets the admin crypto materials for the given organization.
     * @param {string} org The name of the organization.
     * @returns {{privateKeyPEM: Buffer, signedCertPEM: Buffer}} The object containing the signing key and cert in PEM format.
     */
    getAdminCryptoContentOfOrganization(org) {
        const orgObject = this.network.organizations[org];

        // if either is missing, the result is undefined
        if (!CaliperUtils.checkAllProperties(orgObject, 'adminPrivateKey', 'signedCert')) {
            return undefined;
        }

        const privateKey = orgObject.adminPrivateKey;
        const signedCert = orgObject.signedCert;

        let privateKeyPEM;
        let signedCertPEM;

        if (CaliperUtils.checkProperty(privateKey, 'path')) {
            privateKeyPEM = fs.readFileSync(privateKey.path);
        } else {
            privateKeyPEM = privateKey.pem;
        }

        if (CaliperUtils.checkProperty(signedCert, 'path')) {
            signedCertPEM = fs.readFileSync(signedCert.path);
        } else {
            signedCertPEM = signedCert.pem;
        }

        // if either is missing, the result is undefined
        if (!privateKeyPEM || !signedCertPEM) {
            return undefined;
        }

        return {
            privateKeyPEM: privateKeyPEM,
            signedCertPEM: signedCertPEM
        };
    }

    /**
     * Gets the affiliation of the given client.
     * @param {string} client The client name.
     * @returns {string|undefined} The affiliation or 'undefined' if omitted from the configuration.
     */
    getAffiliationOfUser(client) {
        if (CaliperUtils.checkProperty(this.clientConfigs[client].client, 'affiliation')) {
            return this.clientConfigs[client].client.affiliation;
        }

        return undefined;
    }

    /**
     * Gets the set of event sources (peer names) in the network.
     * @return {Set<string>} The set of peer names functioning as an event source.
     */
    getAllEventSources() {
        const result = new Set();
        for (const channel of this.getChannels()) {
            for (const peer of this.getPeersOfChannel(channel)) {
                const peerObject = this.network.channels[channel].peers[peer];
                // defaults to true, or explicitly set
                if (!CaliperUtils.checkProperty(peerObject, 'eventSource') || peerObject.eventSource) {
                    result.add(peer);
                }
            }
        }

        if (result.size === 0) {
            throw new Error('Could not find any event source');
        }

        return result;
    }

    /**
     * Gets the registration attributes of the given client.
     * @param {string} client The client name.
     * @returns {{name: string, value: string, ecert: boolean}[]} The attributes or empty array if omitted from the configuration.
     */
    getAttributesOfUser(client) {
        if (CaliperUtils.checkProperty(this.clientConfigs[client].client, 'attributes')) {
            return this.clientConfigs[client].client.attributes;
        }

        return [];
    }

    /**
     * Gets the certificate authority names defined in the network configuration.
     *
     * @returns {Set<string>} The set of CA names.
     */
    getCertificateAuthorities() {
        const result = new Set();
        const cas = this.network.certificateAuthorities;
        for (const key in cas) {
            if (!cas.hasOwnProperty(key)) {
                continue;
            }

            result.add(key.toString());
        }

        return result;
    }

    /**
     * Gets the first CA name for the given organization.
     * @param {string} org The organization name.
     * @returns {string} The CA name.
     */
    getCertificateAuthorityOfOrganization(org) {
        if (!CaliperUtils.checkProperty(this.network.organizations[org], 'certificateAuthorities') ||
            this.network.organizations[org].certificateAuthorities.size < 1) {
            return undefined;
        }

        // TODO: only one CA per org is supported
        return this.network.organizations[org].certificateAuthorities[0];
    }

    /**
     * Gets the CA object corresponding to the passed name.
     * @param {string} caName The CA name.
     * @returns {object} The CA object.
     */
    getCertificateAuthority(caName) {
        if (!CaliperUtils.checkProperty(this.network, 'certificateAuthorities') ||
            !CaliperUtils.checkProperty(this.network.certificateAuthorities, caName) ) {
            return undefined;
        }

        return this.network.certificateAuthorities[caName];
    }

    /**
     * Gets the contract names and versions belonging to the given channel.
     * @param {string} channel The channel name.
     * @returns {Set<{id: string, version: string}>} The set of contract names.
     */
    getContractsOfChannel(channel) {
        return new Set(this.network.channels[channel].contracts.map(cc => {
            return {
                id: cc.id,
                version: cc.version
            };
        }));
    }

    /**
     * Gets the channel names defined in the network configuration.
     * @returns {Set<string>} The set of channel names.
     */
    getChannels() {
        const result = new Set();
        const channels = this.network.channels;

        for (const key in channels) {
            if (!channels.hasOwnProperty(key)) {
                continue;
            }

            result.add(key.toString());
        }

        return result;
    }

    /**
     * Gets the array of channels that the peer belongs to.
     * @param {string} peer The name of the peer.
     * @return {string[]} The array of channel names the peer belongs to.
     */
    getChannelsOfPeer(peer) {
        const result = [...this.getChannels()].filter(c => this.getPeersOfChannel(c).has(peer));

        if (result.length === 0) {
            throw new Error(`${peer} does not belong to any channel`);
        }

        return result;
    }

    /**
     * Gets the crypto materials for the given user.
     * @param {string} client The name of the user.
     * @returns {{privateKeyPEM: Buffer, signedCertPEM: Buffer}} The object containing the signing key and cert.
     */
    getClientCryptoContent(client) {
        const clientObject = this.network.clients[client].client;

        if (!CaliperUtils.checkAllProperties(clientObject, 'clientPrivateKey', 'clientSignedCert')) {
            return undefined;
        }

        const privateKey = clientObject.clientPrivateKey;
        const signedCert = clientObject.clientSignedCert;
        let privateKeyPEM;
        let signedCertPEM;

        if (CaliperUtils.checkProperty(privateKey, 'path')) {
            privateKeyPEM = fs.readFileSync(privateKey.path);
        } else {
            privateKeyPEM = privateKey.pem;
        }

        if (CaliperUtils.checkProperty(signedCert, 'path')) {
            signedCertPEM = fs.readFileSync(signedCert.path);
        } else {
            signedCertPEM = signedCert.pem;
        }

        return {
            privateKeyPEM: privateKeyPEM,
            signedCertPEM: signedCertPEM
        };
    }

    /**
     * Gets the enrollment secret of the given client.
     * @param {string} client The client name.
     * @returns {string} The enrollment secret.
     */
    getClientEnrollmentSecret(client) {
        if (CaliperUtils.checkProperty(this.network.clients[client].client, 'enrollmentSecret')) {
            return this.network.clients[client].client.enrollmentSecret;
        }

        return undefined;
    }

    /**
     * Checks if organization wallets are specified
     * @returns {boolean} boolean value for existence of organization wallets
     */
    usesOrganizationWallets() {
        return CaliperUtils.checkProperty(this.network, 'organizationWallets') && (Object.getOwnPropertyNames(this.network.organizationWallets).length !== 0);
    }

    /**
     * Gets the path to the wallet being used by the given organization.
     * @param {string} org The organization name.
     * @returns {string} The resolved wallet path.
     */
    getWalletPathForOrganization(org) {
        if (this.usesOrganizationWallets()) {
            if (CaliperUtils.checkProperty(this.network.organizationWallets, org)) {
                const walletObject = this.network.organizationWallets[org];
                return CaliperUtils.resolvePath(walletObject.path);
            }
        }

        return undefined;
    }

    /**
     * Gets the path to the wallet being used by the given client.
     * @param {string} client The client name.
     * @returns {string} The resolved wallet path.
     */
    getWalletPathForClient(client) {
        const org = this.getOrganizationOfClient(client);
        return this.getWalletPathForOrganization(org);
    }

    /**
     * Gets the raw configuration object for the given client.
     *
     * Use it only when you need access to the client objects itself (which is rare)!!
     * @param {string} client The client name.
     * @returns {{version: string, client: object}} The client object.
     */
    getClientObject(client) {
        return this.network.clients[client].client;
    }

    /**
     * Gets the clients names defined in the network configuration.
     * @returns {Set<string>} The set of client names.
     */
    getClients() {
        const result = new Set();
        const clients = this.network.clients;

        for (const key in clients) {
            if (!clients.hasOwnProperty(key)) {
                continue;
            }

            result.add(key.toString());
        }

        return result;
    }

    /**
     * Gets the client names belonging to the given organization.
     * @param {string} org The organization name.
     * @returns {Set<string>} The set of client names.
     */
    getClientsOfOrganization(org) {
        const clients = this.getClients();
        const result = new Set();

        for (const client of clients) {
            if (this.network.clients[client].client.organization === org) {
                result.add(client);
            }
        }

        return result;
    }

    /**
     * Gets the details (channel, id and version) for the given contract.
     * @param {string} contractID The unique ID of the contract.
     * @return {{channel: string, id: string, version: string}} The details of the contract.
     */
    getContractDetails(contractID) {
        return this.contractMapping.get(contractID);
    }

    /**
     * Constructs an N-of-N endorsement policy for the given contract of the given channel.
     * @param {string} channel The name of the channel.
     * @param {{id: string, version: string}} contractInfo The contract name and version.
     * @return {object} The assembled endorsement policy.
     * @private
     */
    getDefaultEndorsementPolicy(channel, contractInfo) {
        const targetPeers = this.getTargetPeersOfContractOfChannel(contractInfo, channel);
        const targetOrgs = new Set();

        for (const peer of targetPeers) {
            targetOrgs.add(this.getOrganizationOfPeer(peer));
        }

        const orgArray = Array.from(targetOrgs).sort();

        const policy = {
            identities: [],
            policy: {}
        };

        policy.policy[`${orgArray.length}-of`] = [];

        for (let i = 0; i < orgArray.length; ++i) {
            policy.identities[i] = {
                role: {
                    name: 'member',
                    mspId: this.getMspIdOfOrganization(orgArray[i])
                }
            };

            policy.policy[`${orgArray.length}-of`][i] = {
                'signed-by': i
            };
        }

        return policy;
    }

    /**
     * Gets the GRPC options of the peer extended with the CA certificate PEM of the peer if present.
     * @param {string} peer The name of the peer.
     * @return {object} An object containing the GRPC options of the peer.
     */
    getGrpcOptionsOfPeer(peer) {
        const peerObj = this.network.peers[peer];
        const grpcObj = peerObj.grpcOptions;

        if (CaliperUtils.checkProperty(peerObj, 'tlsCACerts')) {
            grpcObj.pem = this.getTlsCaCertificateOfPeer(peer);
        }

        return grpcObj;
    }

    /**
     * Gets the MSP ID of the given organization.
     * @param {string} org The organization name.
     * @returns {string} The MSP ID.
     */
    getMspIdOfOrganization(org) {
        return this.network.organizations[org].mspid;
    }

    /**
     * Gets the raw Common Connection Profile object describing the network.
     *
     * Use it only when you need access to the network-related objects itself (which is rare)!!
     * @returns {object} The Common Connection Profile object (with the Caliper extensions).
     */
    getNetworkObject() {
        return this.network;
    }

    /**
     * Gets a new network configuration object instance based on the loaded one.
     * @returns {object} The network configuration object.
     */
    getNewNetworkObject() {
        return CaliperUtils.parseYamlString(CaliperUtils.stringifyYaml(this.network));
    }

    /**
     * Gets the orderer names defined in the network configuration.
     * @returns {Set<string>} The set of orderer names.
     */
    getOrderers() {
        const result = new Set();
        const orderers = this.network.orderers;

        for (const key in orderers) {
            if (!orderers.hasOwnProperty(key)) {
                continue;
            }

            result.add(key.toString());
        }

        return result;
    }

    /**
     * Gets the orderer names belonging to the given channel.
     * @param {string} channel The name of the channel.
     * @returns {Set<string>} The set of orderer names.
     */
    getOrderersOfChannel(channel) {
        return new Set(this.network.channels[channel].orderers);
    }

    /**
     * Get the orderer object from the network definition
     * @param {string} ordererName the orderer name to return
     * @returns {object} orderer object
     */
    getOrdererObject(ordererName) {
        return this.network.orderers[ordererName];
    }

    /**
     * Gets the organization that the given CA belongs to.
     * @param {string} ca The name of the CA.
     * @return {string} The name of the organization.
     */
    getOrganizationOfCertificateAuthority(ca) {
        const orgs = this.getOrganizations();
        for (const org of orgs) {
            if (this.network.organizations[org].certificateAuthorities.includes(ca)) {
                return org;
            }
        }

        return undefined;
    }

    /**
     * Gets the organization name that the given client belongs to.
     * @param {string} client The client name.
     * @returns {string} The organization name.
     */
    getOrganizationOfClient(client) {
        return this.clientConfigs[client].client.organization;
    }

    /**
     * Gets the origanization name in which the given peer belongs to.
     * @param {string} peer The peer name.
     * @returns {string} The organization name.
     */
    getOrganizationOfPeer(peer) {
        const orgs = this.getOrganizations();
        for (const org of orgs) {
            const peers = this.getPeersOfOrganization(org);
            if (peers.has(peer)) {
                return org;
            }
        }

        throw new Error('Peer ' + peer + ' not found in any organization');
    }

    /**
     * Gets the organization names defined in the network configuration.
     * @returns {Set<string>} The set of organization names.
     */
    getOrganizations() {
        const result = new Set();
        const orgs = this.network.organizations;

        for (const key in orgs) {
            if (!orgs.hasOwnProperty(key)) {
                continue;
            }

            result.add(key.toString());
        }

        return result;
    }

    /**
     * Gets the organization names belonging to the given channel.
     * @param {string} channel The name of the channel.
     * @returns {Set<string>} The set of organization names.
     */
    getOrganizationsOfChannel(channel) {
        const peers = this.getPeersOfChannel(channel);
        const result = new Set();

        for (const peer of peers) {
            result.add(this.getOrganizationOfPeer(peer));
        }

        return result;
    }

    /**
     * Gets the event connection URL of the given peer.
     * @param {string} peer The name of the peer.
     * @return {string} The event URL of the peer.
     */
    getPeerEventUrl(peer) {
        return this.network.peers[peer].eventUrl;
    }

    /**
     * Gets the name of the peer corresponding to the given address.
     * @param {string} address The address of the peer.
     * @return {string} The name of the peer.
     */
    getPeerNameForAddress(address) {
        const peers = this.network.peers;
        for (const peer in peers) {
            if (!peers.hasOwnProperty(peer)) {
                continue;
            }

            // remove protocol from address in the config
            const url = peers[peer].url.replace(/(^\w+:|^)\/\//, '');
            if (url === address) {
                return peer.toString();
            }
        }

        return undefined;
    }

    /**
     * Gets the peer name corresponding to the given event hub.
     * @param {EventHub|ChannelEventHub} eventHub The event hub instance.
     * @return {string} The name of the peer.
     */
    getPeerNameOfEventHub(eventHub) {
        const peerAddress = eventHub.getPeerAddr();
        return this.getPeerNameForAddress(peerAddress);
    }

    /**
     * Gets the peer names defined in the network configuration.
     *
     * @returns {Set<string>} The set of peer names.
     */
    getPeers() {
        const result = new Set();
        const peers = this.network.peers;

        for (const peerKey in peers) {
            if (!peers.hasOwnProperty(peerKey)) {
                continue;
            }

            result.add(peerKey.toString());
        }

        return result;
    }

    /**
     * Gets the peer names belonging to the given channel.
     * @param {string} channel The name of the channel.
     * @returns {Set<string>} The set of peer names.
     */
    getPeersOfChannel(channel) {
        const peers = this.network.channels[channel].peers;
        const result = new Set();

        for (const key in peers) {
            if (!peers.hasOwnProperty(key)) {
                continue;
            }

            result.add(key.toString());
        }

        return result;
    }

    /**
     * Gets the peer names belonging to the given organization.
     * @param {string} org The name of the organization.
     * @returns {Set<string>} The set of peer names.
     */
    getPeersOfOrganization(org) {
        return new Set(this.network.organizations[org].peers);
    }

    /**
     * Gets the peer names belonging to the given organization AND channel.
     * @param {string} org The name of the organization.
     * @param {string} channel The name of the channel.
     * @returns {Set<string>} The set of peer names.
     */
    getPeersOfOrganizationAndChannel(org, channel) {
        const peersInOrg = this.getPeersOfOrganization(org);
        const peersInChannel = this.getPeersOfChannel(channel);

        // return the intersection of the two sets
        return new Set([...peersInOrg].filter(p => peersInChannel.has(p)));
    }

    /**
     * Gets the registrar belonging to the first CA of the given organization.
     * @param {string} org The organization name.
     * @returns {{enrollId: string, enrollSecret: string}} The enrollment ID and secret of the registrar.
     */
    getRegistrarOfOrganization(org) {
        const ca = this.getCertificateAuthorityOfOrganization(org);

        if (!ca || !CaliperUtils.checkProperty(this.network.certificateAuthorities[ca], 'registrar')) {
            return undefined;
        }

        // TODO: only one registrar per CA is supported
        return this.network.certificateAuthorities[ca].registrar[0];
    }

    /**
     * Gets the peer names on which the given contract of the given channel should be installed and instantiated.
     * @param {{id: string, version: string}} contractInfo The contract name and version.
     * @param {string} channel The channel name.
     * @returns {Set<string>} The set of peer names.
     */
    getTargetPeersOfContractOfChannel(contractInfo, channel) {
        const cc = this.network.channels[channel].contracts.find(
            cc => cc.id === contractInfo.id && cc.version === contractInfo.version);

        CaliperUtils.assertDefined(cc, `Could not find the following contract in the configuration: ${contractInfo.id}@${contractInfo.version}`);
        // targets are explicitly defined
        if (CaliperUtils.checkProperty(cc, 'targetPeers')) {
            return new Set(cc.targetPeers);
        }

        // we need to gather the target peers from the channel's peer section
        // based on their provided functionality (endorsing and cc query)
        const results = new Set();
        const peers = this.network.channels[channel].peers;
        for (const key in peers) {
            if (!peers.hasOwnProperty(key)) {
                continue;
            }

            const peer = peers[key];
            // if only the peer name is present in the config, then it is a target based on the default values
            if (!CaliperUtils.checkDefined(peer)) {
                results.add(key.toString());
            }

            // the default value of 'endorsingPeer' is true, or it's explicitly set to true
            if (!CaliperUtils.checkProperty(peer, 'endorsingPeer') ||
                (CaliperUtils.checkProperty(peer, 'endorsingPeer') && peer.endorsingPeer)) {
                results.add(key.toString());
                continue;
            }

            // the default value of 'chaincodeQuery' is true, or it's explicitly set to true
            if (!CaliperUtils.checkProperty(peer, 'chaincodeQuery') ||
                (CaliperUtils.checkProperty(peer, 'chaincodeQuery') && peer.chaincodeQuery)) {
                results.add(key.toString());
            }
        }

        return results;
    }

    /**
     * Gets the TLS CA certificate of the given peer.
     * @param {string} peer The name of the peer.
     * @return {string} The PEM encoded CA certificate.
     */
    getTlsCaCertificateOfPeer(peer) {
        const peerObject = this.network.peers[peer];

        if (!CaliperUtils.checkProperty(peerObject, 'tlsCACerts')) {
            return undefined;
        }

        const tlsCACert = peerObject.tlsCACerts;
        let tlsPEM;

        if (CaliperUtils.checkProperty(tlsCACert, 'path')) {
            tlsPEM = fs.readFileSync(tlsCACert.path).toString();
        } else {
            tlsPEM = tlsCACert.pem;
        }

        return tlsPEM;
    }

    /**
     * Gets the transient map for the given contract for the given channel.
     * @param {{id: string, version: string}} contract The contract name and version.
     * @param {string} channel The channel name.
     *
     * @return {Map<string, Buffer>} The map of attribute names to byte arrays.
     */
    getTransientMapOfContractOfChannel(contract, channel) {
        const map = {};
        const cc = this.network.channels[channel].contracts.find(
            cc => cc.id === contract.id && cc.version === contract.version);

        if (!CaliperUtils.checkProperty(cc, 'initTransientMap')) {
            return map;
        }

        for (const key in cc.initTransientMap) {
            if (!cc.initTransientMap.hasOwnProperty(key)) {
                continue;
            }

            const value = cc.initTransientMap[key];
            map[key.toString()] = Buffer.from(value.toString());
        }

        return map;
    }


    /**
     * Return the name of the first client in the named organisation
     * @param {string} org the organisation name
     * @returns {string} the client name
     */
    getFirstClientInOrg(org) {
        return this.getClientsOfOrganization(org)[0];
    }

    /**
     * Indicates whether the network is a Fabric v1.0 network or not.
     * @return {boolean} True, if the network contains legacy event service URLs. Otherwise false.
     */
    isInCompatibilityMode() {
        return this.compatibilityMode;
    }

    /**
     * Indicates whether mutual TLS is configured for the adapter.
     * @return {boolean} True, if mutual TLS is configured. Otherwise, false.
     */
    isMutualTlsEnabled() {
        return this.mutualTls;
    }

    /**
     * Indicates whether server-side TLS is configured for the adapter.
     * @return {boolean} True, if server-side TLS is configured. Otherwise, false.
     */
    isTlsEnabled() {
        return this.tls;
    }

}

module.exports = FabricNetwork;
