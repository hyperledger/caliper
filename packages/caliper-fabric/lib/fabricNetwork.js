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
 * @property {Map<string, {channel:string, id:string, version:string}>} The mapping of contract IDs to chaincode details.
 */
class FabricNetwork {
    /**
     * Loads and verifies the Common Connection Profile settings.
     *
     * @param {string|object} networkConfig The relative or absolute file path, or the object itself of the Common Connection Profile settings.
     * @param {string|object} workspace_root The relative or absolute file path, or the object itself of the Common Connection Profile settings.
     */
    constructor(networkConfig, workspace_root) {
        CaliperUtils.assertDefined(networkConfig, '[FabricNetwork.constructor] Parameter \'networkConfig\' if undefined or null');

        this.network = undefined;
        if (typeof networkConfig === 'string') {
            let configPath = CaliperUtils.resolvePath(networkConfig, workspace_root);
            this.network = CaliperUtils.parseYaml(configPath);
        } else if (typeof networkConfig === 'object' && networkConfig !== null) {
            // clone the object to prevent modification by other objects
            this.network = CaliperUtils.parseYamlString(CaliperUtils.stringifyYaml(networkConfig));
        } else {
            throw new Error('[FabricNetwork.constructor] Parameter \'networkConfig\' is neither a file path nor an object');
        }

        this.clientConfigs = {};
        this.compatibilityMode = false; // if event URLs are detected for the peers, we're using Fabric 1.0
        this.tls = false;
        this.mutualTls = false;
        this.contractMapping = new Map();
        this._processConfiguration(workspace_root);
    }


    /**
     * Internal utility function for retrieving key information from the network configuration.
     * @param {string} workspaceRoot The path to the root of the workspace.
     *
     * @private
     */
    _processConfiguration(workspaceRoot) {
        this.mutualTls = !!this.network['mutual-tls'];

        if (this.network.wallet) {
            this.network.wallet = CaliperUtils.resolvePath(this.network.wallet, workspaceRoot);
        }

        if (this.network.clients) {
            let clients = this.getClients();
            for (let client of clients) {
                this.clientConfigs[client] = this.network.clients[client];

                let cObj = this.network.clients[client].client;
                // normalize paths
                if (cObj.credentialStore) {
                    cObj.credentialStore.path = CaliperUtils.resolvePath(cObj.credentialStore.path, workspaceRoot);
                    cObj.credentialStore.cryptoStore.path = CaliperUtils.resolvePath(cObj.credentialStore.cryptoStore.path, workspaceRoot);
                }

                if (cObj.clientPrivateKey && cObj.clientPrivateKey.path) {
                    cObj.clientPrivateKey.path = CaliperUtils.resolvePath(cObj.clientPrivateKey.path, workspaceRoot);
                }

                if (cObj.clientSignedCert && cObj.clientSignedCert.path) {
                    cObj.clientSignedCert.path = CaliperUtils.resolvePath(cObj.clientSignedCert.path, workspaceRoot);
                }
            }
        }

        if (this.network.channels) {
            let channels = this.getChannels();
            for (let channel of channels) {
                let cObj = this.network.channels[channel];

                for (let cc of cObj.chaincodes) {
                    if (!cc.contractID) {
                        cc.contractID = cc.id;
                    }

                    this.contractMapping.set(cc.contractID, {channel: channel, id: cc.id, version: cc.version});
                    if (cc.language && cc.language !== 'golang' && cc.path) {
                        cc.path = CaliperUtils.resolvePath(cc.path, workspaceRoot);
                    }
                }
            }
        }

        if (this.network.organizations) {
            let orgs = this.getOrganizations();
            for (let org of orgs) {
                let oObj = this.network.organizations[org];

                if (oObj.adminPrivateKey && oObj.adminPrivateKey.path) {
                    oObj.adminPrivateKey.path = CaliperUtils.resolvePath(oObj.adminPrivateKey.path, workspaceRoot);
                }

                if (oObj.signedCert && oObj.signedCert.path) {
                    oObj.signedCert.path = CaliperUtils.resolvePath(oObj.signedCert.path, workspaceRoot);
                }
            }
        }

        if (this.network.orderers) {
            let orderers = this.getOrderers();
            for (let orderer of orderers) {
                let oObj = this.network.orderers[orderer];

                this.tls |= oObj.url.startsWith('grpcs://');

                if (oObj.tlsCACerts && oObj.tlsCACerts.path) {
                    oObj.tlsCACerts.path = CaliperUtils.resolvePath(oObj.tlsCACerts.path, workspaceRoot);
                }
            }
        }

        if (this.network.peers) {
            let peers = this.getPeers();
            for (let peer of peers) {
                let pObj = this.network.peers[peer];

                this.tls |= pObj.url.startsWith('grpcs://');

                if (pObj.tlsCACerts && pObj.tlsCACerts.path) {
                    pObj.tlsCACerts.path = CaliperUtils.resolvePath(pObj.tlsCACerts.path, workspaceRoot);
                }

                if (pObj.eventUrl) {
                    this.compatibilityMode = true;
                }
            }
        }

        if (this.network.certificateAuthorities) {
            let cas = this.getCertificateAuthorities();
            for (let ca of cas) {
                let caObj = this.network.certificateAuthorities[ca];

                this.tls |= caObj.url.startsWith('https://');

                if (caObj.tlsCACerts && caObj.tlsCACerts.path) {
                    caObj.tlsCACerts.path = CaliperUtils.resolvePath(caObj.tlsCACerts.path, workspaceRoot);
                }
            }
        }

        if (this.mutualTls && this.compatibilityMode) {
            throw new Error('Mutual TLS is not supported for Fabric v1.0');
        }
    }

    /**
     * Gets the configured file wallet path.
     * @return {string} The file wallet path, or false if omitted.
     */
    getFileWalletPath() {
        return this.network.wallet || false;
    }

    /**
     * Gets the admin crypto materials for the given organization.
     * @param {string} org The name of the organization.
     * @returns {{privateKeyPEM: Buffer, signedCertPEM: Buffer}} The object containing the signing key and cert in PEM format.
     */
    getAdminCryptoContentOfOrganization(org) {
        let orgObject = this.network.organizations[org];

        // if either is missing, the result is undefined
        if (!CaliperUtils.checkAllProperties(orgObject, 'adminPrivateKey', 'signedCert')) {
            return undefined;
        }

        let privateKey = orgObject.adminPrivateKey;
        let signedCert = orgObject.signedCert;

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
        let result = new Set();
        for (let channel of this.getChannels()) {
            for (let peer of this.getPeersOfChannel(channel)) {
                let peerObject = this.network.channels[channel].peers[peer];
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
        let result = new Set();
        let cas = this.network.certificateAuthorities;
        for (let key in cas) {
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
     * Gets the chaincode names and versions belonging to the given channel.
     * @param {string} channel The channel name.
     * @returns {Set<{id: string, version: string}>} The set of chaincode names.
     */
    getChaincodesOfChannel(channel) {
        return new Set(this.network.channels[channel].chaincodes.map(cc => {
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
        let result = new Set();
        let channels = this.network.channels;

        for (let key in channels) {
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
        let result = [...this.getChannels()].filter(c => this.getPeersOfChannel(c).has(peer));

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
        let clientObject = this.network.clients[client].client;

        if (!CaliperUtils.checkAllProperties(clientObject, 'clientPrivateKey', 'clientSignedCert')) {
            return undefined;
        }

        let privateKey = clientObject.clientPrivateKey;
        let signedCert = clientObject.clientSignedCert;
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
        let result = new Set();
        let clients = this.network.clients;

        for (let key in clients) {
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
        let clients = this.getClients();
        let result = new Set();

        for (let client of clients) {
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
     * Constructs an N-of-N endorsement policy for the given chaincode of the given channel.
     * @param {string} channel The name of the channel.
     * @param {{id: string, version: string}} chaincodeInfo The chaincode name and version.
     * @return {object} The assembled endorsement policy.
     * @private
     */
    getDefaultEndorsementPolicy(channel, chaincodeInfo) {
        let targetPeers = this.getTargetPeersOfChaincodeOfChannel(chaincodeInfo, channel);
        let targetOrgs = new Set();

        for (let peer of targetPeers) {
            targetOrgs.add(this.getOrganizationOfPeer(peer));
        }

        let orgArray = Array.from(targetOrgs).sort();

        let policy = {
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
        let peerObj = this.network.peers[peer];
        let grpcObj = peerObj.grpcOptions;

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
        let result = new Set();
        let orderers = this.network.orderers;

        for (let key in orderers) {
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
     * Gets the organization that the given CA belongs to.
     * @param {string} ca The name of the CA.
     * @return {string} The name of the organization.
     */
    getOrganizationOfCertificateAuthority(ca) {
        let orgs = this.getOrganizations();
        for (let org of orgs) {
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
        let orgs = this.getOrganizations();
        for (let org of orgs) {
            let peers = this.getPeersOfOrganization(org);
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
        let result = new Set();
        let orgs = this.network.organizations;

        for (let key in orgs) {
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
        let peers = this.getPeersOfChannel(channel);
        let result = new Set();

        for (let peer of peers) {
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
        let peers = this.network.peers;
        for (let peer in peers) {
            if (!peers.hasOwnProperty(peer)) {
                continue;
            }

            // remove protocol from address in the config
            let url = peers[peer].url.replace(/(^\w+:|^)\/\//, '');
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
        let peerAddress = eventHub.getPeerAddr();
        return this.getPeerNameForAddress(peerAddress);
    }

    /**
     * Gets the peer names defined in the network configuration.
     *
     * @returns {Set<string>} The set of peer names.
     */
    getPeers() {
        let result = new Set();
        let peers = this.network.peers;

        for (let peerKey in peers) {
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
        let peers = this.network.channels[channel].peers;
        let result = new Set();

        for (let key in peers) {
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
        let peersInOrg = this.getPeersOfOrganization(org);
        let peersInChannel = this.getPeersOfChannel(channel);

        // return the intersection of the two sets
        return new Set([...peersInOrg].filter(p => peersInChannel.has(p)));
    }

    /**
     * Gets the registrar belonging to the first CA of the given organization.
     * @param {string} org The organization name.
     * @returns {{enrollId: string, enrollSecret: string}} The enrollment ID and secret of the registrar.
     */
    getRegistrarOfOrganization(org) {
        let ca = this.getCertificateAuthorityOfOrganization(org);

        if (!ca || !CaliperUtils.checkProperty(this.network.certificateAuthorities[ca], 'registrar')) {
            return undefined;
        }

        // TODO: only one registrar per CA is supported
        return this.network.certificateAuthorities[ca].registrar[0];
    }

    /**
     * Gets the peer names on which the given chaincode of the given channel should be installed and instantiated.
     * @param {{id: string, version: string}} chaincodeInfo The chaincode name and version.
     * @param {string} channel The channel name.
     * @returns {Set<string>} The set of peer names.
     */
    getTargetPeersOfChaincodeOfChannel(chaincodeInfo, channel) {
        let cc = this.network.channels[channel].chaincodes.find(
            cc => cc.id === chaincodeInfo.id && cc.version === chaincodeInfo.version);

        CaliperUtils.assertDefined(cc, `Could not find the following chaincode in the configuration: ${chaincodeInfo.id}@${chaincodeInfo.version}`);
        // targets are explicitly defined
        if (CaliperUtils.checkProperty(cc, 'targetPeers')) {
            return new Set(cc.targetPeers);
        }

        // we need to gather the target peers from the channel's peer section
        // based on their provided functionality (endorsing and cc query)
        let results = new Set();
        let peers = this.network.channels[channel].peers;
        for (let key in peers) {
            if (!peers.hasOwnProperty(key)) {
                continue;
            }

            let peer = peers[key];
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
        let peerObject = this.network.peers[peer];

        if (!CaliperUtils.checkProperty(peerObject, 'tlsCACerts')) {
            return undefined;
        }

        let tlsCACert = peerObject.tlsCACerts;
        let tlsPEM;

        if (CaliperUtils.checkProperty(tlsCACert, 'path')) {
            tlsPEM = fs.readFileSync(tlsCACert.path).toString();
        } else {
            tlsPEM = tlsCACert.pem;
        }

        return tlsPEM;
    }

    /**
     * Gets the transient map for the given chaincode for the given channel.
     * @param {{id: string, version: string}} chaincode The chaincode name and version.
     * @param {string} channel The channel name.
     *
     * @return {Map<string, Buffer>} The map of attribute names to byte arrays.
     */
    getTransientMapOfChaincodeOfChannel(chaincode, channel) {
        let map = {};
        let cc = this.network.channels[channel].chaincodes.find(
            cc => cc.id === chaincode.id && cc.version === chaincode.version);

        if (!CaliperUtils.checkProperty(cc, 'initTransientMap')) {
            return map;
        }

        for (let key in cc.initTransientMap) {
            if (!cc.initTransientMap.hasOwnProperty(key)) {
                continue;
            }

            let value = cc.initTransientMap[key];
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
