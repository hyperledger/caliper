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

const yaml = require('js-yaml');
const fs = require('fs');
const CaliperUtils = require('caliper-core').CaliperUtils;

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

        if (typeof networkConfig === 'string') {
            let configPath = CaliperUtils.resolvePath(networkConfig, workspace_root);
            this.network = yaml.safeLoad(fs.readFileSync(configPath, 'utf-8'),
                {schema: yaml.DEFAULT_SAFE_SCHEMA});
        } else if (typeof networkConfig === 'object' && networkConfig !== null) {
            // clone the object to prevent modification by other objects
            this.network = yaml.safeLoad(yaml.safeDump(networkConfig), {schema: yaml.DEFAULT_SAFE_SCHEMA});
        } else {
            throw new Error('[FabricNetwork.constructor] Parameter \'networkConfig\' is neither a file path nor an object');
        }

        this.clientConfigs = {};
        this.compatibilityMode = false; // if event URLs are detected for the peers, we're using Fabric 1.0
        this.tls = false;
        this.mutualTls = false;
        this.contractMapping = new Map();
        this.workspaceRoot = workspace_root;
        this._validateNetworkConfiguration();
    }

    ////////////////////////////////
    // INTERNAL UTILITY FUNCTIONS //
    ////////////////////////////////

    /**
     * Internal utility function for checking whether the given CA exists in the configuration.
     * The function throws an error if it doesn't exist.
     * @param {string} ca The name of the CA.
     * @param {string} msg An optional error message that will be thrown in case of an invalid CA.
     * @private
     */
    _assertCaExists(ca, msg) {
        let cas = this.network.certificateAuthorities;
        for (let c in cas) {
            if (!cas.hasOwnProperty(c)) {
                continue;
            }

            // we found the CA in the CAs section
            if (c.toString() === ca) {
                return;
            }
        }

        // didn't find the CA
        throw new Error(msg || `Couldn't find ${ca} in the 'certificateAuthorities' section`);
    }

    /**
     * Internal utility function for checking whether the given orderer exists in the configuration.
     * The function throws an error if it doesn't exist.
     * @param {string} orderer The name of the orderer.
     * @param {string} msg An optional error message that will be thrown in case of an invalid orderer.
     * @private
     */
    _assertOrdererExists(orderer, msg) {
        let orderers = this.network.orderers;
        for (let ord in orderers) {
            if (!orderers.hasOwnProperty(ord)) {
                continue;
            }

            // we found the orderer in the orderers section
            if (ord.toString() === orderer) {
                return;
            }
        }

        // didn't find the orderer
        throw new Error(msg || `Couldn't find ${orderer} in the 'orderers' section`);
    }

    /**
     * Internal utility function for checking whether the given peer exists in the configuration.
     * The function throws an error if it doesn't exist.
     * @param {string} peer The name of the peer.
     * @param {string} msg An optional error message that will be thrown in case of an invalid peer.
     * @private
     */
    _assertPeerExists(peer, msg) {
        let peers = this.network.peers;
        for (let p in peers) {
            if (!peers.hasOwnProperty(p)) {
                continue;
            }

            // we found the peer in the peers section
            if (p.toString() === peer) {
                return;
            }
        }

        // didn't find the peer
        throw new Error(msg || `Couldn't find ${peer} in the 'peers' section`);
    }

    /**
     * Internal utility function for validating that the Common Connection Profile
     * setting contains every required property.
     *
     * @private
     */
    _validateNetworkConfiguration() {
        // top level properties
        // CAs are only needed when a user enrollment or registration is needed
        let requiredCas = new Set();
        let providedCas = new Set();

        CaliperUtils.assertAllProperties(this.network, 'network',
            'caliper', 'clients', 'channels', 'organizations', 'orderers', 'peers');

        CaliperUtils.assertProperty(this.network.caliper, 'network.caliper', 'blockchain');

        this.mutualTls = CaliperUtils.checkProperty(this.network, 'mutual-tls') ? this.network['mutual-tls'] : false;

        // ===========
        // = CLIENTS =
        // ===========

        let clients = this.getClients();
        if (clients.size < 1) {
            throw new Error('Network configuration error: the \'clients\' section does not contain any entries');
        }

        for (let client of clients) {
            let clientObjectName = `network.clients.${client}`;
            let clientObject = this.network.clients[client];

            CaliperUtils.assertProperty(clientObject, clientObjectName, 'client');
            this.clientConfigs[client] = this.network.clients[client];

            // include the client level for convenience
            clientObject = this.network.clients[client].client;
            clientObjectName = `network.clients.${client}.client`;

            CaliperUtils.assertAllProperties(clientObject, clientObjectName, 'organization', 'credentialStore');
            CaliperUtils.assertAllProperties(clientObject.credentialStore, `${clientObjectName}.credentialStore`, 'path', 'cryptoStore');
            CaliperUtils.assertProperty(clientObject.credentialStore.cryptoStore, `${clientObjectName}.credentialStore.cryptoStore`, 'path');

            // normalize paths
            clientObject.credentialStore.path = CaliperUtils.resolvePath(clientObject.credentialStore.path, this.workspaceRoot);
            clientObject.credentialStore.cryptoStore.path = CaliperUtils.resolvePath(clientObject.credentialStore.cryptoStore.path, this.workspaceRoot);

            // user identity can be provided in multiple ways
            // if there is any crypto content info, every crypto content info is needed
            if (CaliperUtils.checkAnyProperty(clientObject, 'clientPrivateKey', 'clientSignedCert')) {
                CaliperUtils.assertAllProperties(clientObject, clientObjectName, 'clientPrivateKey', 'clientSignedCert');

                // either file path or pem content is needed
                CaliperUtils.assertAnyProperty(clientObject.clientPrivateKey, `${clientObjectName}.clientPrivateKey`, 'path', 'pem');
                CaliperUtils.assertAnyProperty(clientObject.clientSignedCert, `${clientObjectName}.clientSignedCert`, 'path', 'pem');

                // normalize the paths if provided
                if (CaliperUtils.checkProperty(clientObject.clientPrivateKey, 'path')) {
                    clientObject.clientPrivateKey.path = CaliperUtils.resolvePath(clientObject.clientPrivateKey.path, this.workspaceRoot);
                }

                if (CaliperUtils.checkProperty(clientObject.clientSignedCert, 'path')) {
                    clientObject.clientSignedCert.path = CaliperUtils.resolvePath(clientObject.clientSignedCert.path, this.workspaceRoot);
                }
            } else if (CaliperUtils.checkProperty(clientObject, 'enrollSecret')) {
                // otherwise, enrollment info can also be specified and the CA will be needed
                // TODO: currently only one CA is supported
                requiredCas.add(this.getOrganizationOfClient(client));
            } else {
                // if no crypto material or enrollment info is provided, then registration and CA info is needed
                CaliperUtils.assertProperty(clientObject, clientObjectName, 'affiliation');
                // TODO: currently only one CA is supported
                requiredCas.add(this.getOrganizationOfClient(client));
            }


        }

        // ============
        // = CHANNELS =
        // ============
        let channels = this.getChannels();
        if (channels.size < 1) {
            throw new Error('Network configuration error: the \'channels\' section does not contain any entries');
        }
        for (let channel of channels) {
            let channelObj = this.network.channels[channel];
            let channelObjName = `network.channels.${channel}`;

            // if the channel is not created, we need the configuration artifacts
            // created defaults to false
            if (!CaliperUtils.checkProperty(channelObj, 'created') || !channelObj.created) {
                // one kind of config is needed
                if (!CaliperUtils.checkProperty(channelObj, 'configBinary')) {
                    CaliperUtils.assertAllProperties(channelObj, channelObjName, 'configUpdateObject', 'configtxlatorPath');
                }
            }

            // mandatory top-level properties
            CaliperUtils.assertAllProperties(channelObj, channelObjName, 'orderers', 'peers', 'chaincodes');

            // ====================
            // = CHANNEL ORDERERS =
            // ====================
            let ordererCollection = channelObj.orderers;

            if (ordererCollection.length < 1) {
                throw new Error(`'channels.${channel}.orderers' does not contain any element`);
            }

            // check whether the orderer references are valid
            ordererCollection.forEach((orderer) => {
                this._assertOrdererExists(orderer, `${orderer} is not a valid orderer reference in ${channel}`);
            });

            // =================
            // = CHANNEL PEERS =
            // =================
            let peerCollection = channelObj.peers;
            let peerPresent = false; // signal if we found a peer in the channel

            // check whether the peer references are valid
            for (let peer in peerCollection) {
                if (!peerCollection.hasOwnProperty(peer)) {
                    continue;
                }

                this._assertPeerExists(peer,
                    `${peer.toString()} is not a valid peer reference in ${channel}`);
                peerPresent = true;
            }

            if (!peerPresent) {
                throw new Error(`'channels.${channel}.peers' does not contain any element`);
            }

            // ======================
            // = CHANNEL CHAINCODES =
            // ======================
            let chaincodesCollection = channelObj.chaincodes;
            if (chaincodesCollection.size < 1) {
                throw new Error(`'channels.${channel}.chaincodes' does not contain any elements`);
            }

            // to check that there's no duplication
            let chaincodeSet = new Set();

            chaincodesCollection.forEach((cc, index) => {
                // 'metadataPath', 'targetPeers' and 'init' is optional
                CaliperUtils.assertDefined(cc, `The element 'channels.${channel}.chaincodes[${index}]' is undefined or null`);

                // other attributes are optional if the chaincode is already installed and instantiated
                // this will be know at install/instantiate time
                CaliperUtils.assertAllProperties(cc, `channels.${channel}.chaincodes[${index}]`, 'id', 'version');

                let idAndVersion = `${cc.id}@${cc.version}`;
                if (chaincodeSet.has(idAndVersion)) {
                    throw new Error(`${idAndVersion} is defined more than once in the configuration`);
                }

                let contractID;
                if (CaliperUtils.checkProperty(cc, 'contractID')) {
                    contractID = cc.contractID;
                } else {
                    contractID = cc.id;
                }

                if (this.contractMapping.has(contractID)) {
                    throw new Error(`Contract ID ${contractID} is used more than once in the configuration`);
                }

                // add the mapping for the contract ID
                this.contractMapping.set(contractID, {channel: channel, id: cc.id, version: cc.version});

                chaincodeSet.add(idAndVersion);

                // if target peers are defined, then check the validity of the references
                if (!CaliperUtils.checkProperty(cc, 'targetPeers')) {
                    return;
                }

                for (let tp of cc.targetPeers) {
                    this._assertPeerExists(tp,
                        `${tp} is not a valid peer reference in 'channels.${channel}.chaincodes[${index}].targetPeers'`);
                }
            });
        }

        // =================
        // = ORGANIZATIONS =
        // =================
        let orgs = this.getOrganizations();
        if (orgs.size < 1) {
            throw new Error('\'organizations\' section does not contain any entries');
        }

        for (let org of orgs) {
            let orgObj = this.network.organizations[org];
            let orgObjName = `network.organizations.${org}`;

            // Caliper is a special client, it requires admin access to every org
            // NOTE: because of the queries during the init phase, we can't avoid using admin profiles
            // CAs are only needed if a user needs to be enrolled or registered
            CaliperUtils.assertAllProperties(orgObj, orgObjName, 'mspid', 'peers', 'adminPrivateKey', 'signedCert');

            // either path or pem is required
            CaliperUtils.assertAnyProperty(orgObj.adminPrivateKey, `${orgObjName}.adminPrivateKey`, 'path', 'pem');
            CaliperUtils.assertAnyProperty(orgObj.signedCert, `${orgObjName}.signedCert`, 'path', 'pem');

            // normalize paths if provided
            if (CaliperUtils.checkProperty(orgObj.adminPrivateKey, 'path')) {
                orgObj.adminPrivateKey.path = CaliperUtils.resolvePath(orgObj.adminPrivateKey.path, this.workspaceRoot);
            }

            if (CaliperUtils.checkProperty(orgObj.signedCert, 'path')) {
                orgObj.signedCert.path = CaliperUtils.resolvePath(orgObj.signedCert.path, this.workspaceRoot);
            }

            // ======================
            // = ORGANIZATION PEERS =
            // ======================
            if (orgObj.peers.length < 1) {
                throw new Error(`'organizations.${org}.peers' does not contain any element`);
            }

            // verify peer references
            for (let peer of orgObj.peers) {
                this._assertPeerExists(peer, `${peer} is not a valid peer reference in 'organizations.${org}.peers'`);
            }

            // ===================
            // = ORGANIZATION CA =
            // ===================

            // if CAs are specified, check their validity
            if (!CaliperUtils.checkProperty(orgObj, 'certificateAuthorities')) {
                continue;
            }

            let caCollection = orgObj.certificateAuthorities;
            for (let ca of caCollection) {
                this._assertCaExists(ca, `${ca} is not a valid CA reference in 'organizations.${org}'.certificateAuthorities`);
            }
        }

        // ============
        // = ORDERERS =
        // ============
        let orderers = this.getOrderers();
        if (orderers.size < 1) {
            throw new Error('\'orderers\' section does not contain any entries');
        }

        for (let orderer of orderers) {
            // 'grpcOptions' is optional
            CaliperUtils.assertProperty(this.network.orderers, 'network.orderers', orderer);
            let ordererObj = this.network.orderers[orderer];
            let ordererObjName = `network.orderers.${orderer}`;

            CaliperUtils.assertProperty(ordererObj, ordererObjName, 'url');
            // tlsCACerts is needed only for TLS
            if (ordererObj.url.startsWith('grpcs://')) {
                this.tls = true;
                CaliperUtils.assertProperty(ordererObj, ordererObjName, 'tlsCACerts');
                CaliperUtils.assertAnyProperty(ordererObj.tlsCACerts, `${ordererObjName}.tlsCACerts`, 'path', 'pem');

                // normalize path is provided
                if (CaliperUtils.checkProperty(ordererObj.tlsCACerts, 'path')) {
                    ordererObj.tlsCACerts.path = CaliperUtils.resolvePath(ordererObj.tlsCACerts.path, this.workspaceRoot);
                }
            }
        }

        // =========
        // = PEERS =
        // =========
        let peers = this.getPeers();
        if (peers.size < 1) {
            throw new Error('\'peers\' section does not contain any entries');
        }
        for (let peer of peers) {
            // 'grpcOptions' is optional
            CaliperUtils.assertProperty(this.network.peers, 'network.peers', peer);
            let peerObj = this.network.peers[peer];
            let peerObjName = `network.peers.${peer}`;

            CaliperUtils.assertProperty(peerObj, peerObjName, 'url');

            // tlsCACerts is needed only for TLS
            if (peerObj.url.startsWith('grpcs://')) {
                this.tls = true;
                CaliperUtils.assertProperty(peerObj, peerObjName, 'tlsCACerts');
                CaliperUtils.assertAnyProperty(peerObj.tlsCACerts, `${peerObjName}.tlsCACerts`, 'path', 'pem');

                // normalize path if provided
                if (CaliperUtils.checkProperty(peerObj.tlsCACerts, 'path')) {
                    peerObj.tlsCACerts.path = CaliperUtils.resolvePath(peerObj.tlsCACerts.path, this.workspaceRoot);
                }
            }

            if (CaliperUtils.checkProperty(peerObj, 'eventUrl')) {
                this.compatibilityMode = true;

                // check if both URLS are using TLS or neither
                if ((peerObj.url.startsWith('grpcs://') && peerObj.eventUrl.startsWith('grpc://')) ||
                    (peerObj.url.startsWith('grpc://') && peerObj.eventUrl.startsWith('grpcs://'))) {
                    throw new Error(`${peer} uses different protocols for the transaction and event services`);
                }
            }
        }

        // in case of compatibility mode, require event URLs from every peer
        if (this.compatibilityMode) {
            for (let peer of peers) {
                if (!CaliperUtils.checkProperty(this.network.peers[peer], 'eventUrl')) {
                    throw new Error(`${peer} doesn't provide an event URL in compatibility mode`);
                }
            }
        }

        // ===========================
        // = CERTIFICATE AUTHORITIES =
        // ===========================
        if (CaliperUtils.checkProperty(this.network, 'certificateAuthorities')) {
            let cas = this.getCertificateAuthorities();
            for (let ca of cas) {
                // 'httpOptions' is optional
                CaliperUtils.assertProperty(this.network.certificateAuthorities, 'network.certificateAuthorities', ca);

                let caObj = this.network.certificateAuthorities[ca];
                let caObjName = `network.certificateAuthorities.${ca}`;

                // validate the registrars if provided
                if (CaliperUtils.checkProperty(caObj, 'registrar')) {
                    caObj.registrar.forEach((reg, index) => {
                        CaliperUtils.assertAllProperties(caObj.registrar[index], `${caObjName}.registrar[${index}]`, 'enrollId', 'enrollSecret');
                    });

                    // we actually need the registrar, not just the CA
                    providedCas.add(this.getOrganizationOfCertificateAuthority(ca));
                }

                // tlsCACerts is needed only for TLS
                if (caObj.url.startsWith('https://')) {
                    this.tls = true;
                    CaliperUtils.assertProperty(caObj, caObjName, 'tlsCACerts');
                    CaliperUtils.assertAnyProperty(caObj.tlsCACerts, `${caObjName}.tlsCACerts`, 'path', 'pem');

                    //normalize path if provided
                    if (CaliperUtils.checkProperty(caObj.tlsCACerts, 'path')) {
                        caObj.tlsCACerts.path = CaliperUtils.resolvePath(caObj.tlsCACerts.path, this.workspaceRoot);
                    }
                }
            }
        }

        // find the not provided CAs, i.e., requiredCas \ providedCas set operation
        let notProvidedCas = new Set([...requiredCas].filter(ca => !providedCas.has(ca)));
        if (notProvidedCas.size > 0) {
            throw new Error(`The following org's CAs and their registrars are required for user management, but are not provided: ${Array.from(notProvidedCas).join(', ')}`);
        }

        // ==============================
        // = CHECK CONSISTENT TLS USAGE =
        // ==============================

        // if at least one node has TLS configured
        if (this.tls) {
            // check every orderer
            for (let orderer of orderers) {
                let ordererObj = this.network.orderers[orderer];
                let ordererObjName = `network.orderers.${orderer}`;

                CaliperUtils.assertProperty(ordererObj, ordererObjName, 'tlsCACerts');
                CaliperUtils.assertAnyProperty(ordererObj.tlsCACerts, `${ordererObjName}.tlsCACerts`, 'path', 'pem');

                if (!ordererObj.url.startsWith('grpcs://')) {
                    throw new Error(`${orderer} doesn't use the grpcs protocol, but TLS is configured on other nodes`);
                }
            }

            // check every peer
            for (let peer of peers) {
                let peerObj = this.network.peers[peer];
                let peerObjName = `network.peers.${peer}`;

                CaliperUtils.assertProperty(peerObj, peerObjName, 'tlsCACerts');
                CaliperUtils.assertAnyProperty(peerObj.tlsCACerts, `${peerObjName}.tlsCACerts`, 'path', 'pem');

                if (!peerObj.url.startsWith('grpcs://')) {
                    throw new Error(`${peer} doesn't use the grpcs protocol, but TLS is configured on other nodes`);
                }

                // check peer URLs
                if (this.compatibilityMode && !peerObj.eventUrl.startsWith('grpcs://')) {
                    throw new Error(`${peer} doesn't use the grpcs protocol for eventing, but TLS is configured on other nodes`);
                }
            }

            // check every CA
            if (CaliperUtils.checkProperty(this.network, 'certificateAuthorities')) {
                let cas = this.getCertificateAuthorities();
                for (let ca of cas) {
                    let caObj = this.network.certificateAuthorities[ca];
                    let caObjName = `network.certificateAuthorities.${ca}`;

                    CaliperUtils.assertProperty(caObj, caObjName, 'tlsCACerts');
                    CaliperUtils.assertAnyProperty(caObj.tlsCACerts, `${caObjName}.tlsCACerts`, 'path', 'pem');

                    if (!caObj.url.startsWith('https://')) {
                        throw new Error(`${ca} doesn't use the https protocol, but TLS is configured on other nodes`);
                    }
                }
            }
        }

        // else: none of the nodes indicated TLS in their configuration/protocol, so nothing to check

        // mutual TLS requires server-side TLS
        if (this.mutualTls && !this.tls) {
            throw new Error('Mutual TLS is configured without using TLS on network nodes');
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
            privateKeyPEM = fs.readFileSync(CaliperUtils.resolvePath(privateKey.path, this.workspaceRoot));
        } else {
            privateKeyPEM = privateKey.pem;
        }

        if (CaliperUtils.checkProperty(signedCert, 'path')) {
            signedCertPEM = fs.readFileSync(CaliperUtils.resolvePath(signedCert.path, this.workspaceRoot));
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

    //////////////////////
    // PUBLIC FUNCTIONS //
    //////////////////////

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
            privateKeyPEM = fs.readFileSync(CaliperUtils.resolvePath(privateKey.path, this.workspaceRoot));
        } else {
            privateKeyPEM = privateKey.pem;
        }

        if (CaliperUtils.checkProperty(signedCert, 'path')) {
            signedCertPEM = fs.readFileSync(CaliperUtils.resolvePath(signedCert.path, this.workspaceRoot));
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
        return yaml.safeLoad(yaml.safeDump(this.network));
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
            tlsPEM = fs.readFileSync(CaliperUtils.resolvePath(tlsCACert.path, this.workspaceRoot)).toString();
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
