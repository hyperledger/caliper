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
const fs = require('fs').promises;
/**
 *
 */
class ConnectionProfileDefinition {

    /**
     * @param {*} mspId The Connection Profile's organization mspId
     * @param {*} ConnectionProfileConfiguration The Connection Profile Configuration
     */
    constructor(mspId, ConnectionProfileConfiguration) {
        this.mspId = mspId;
        this.connectionProfile = ConnectionProfileConfiguration.loadedConnectionProfile;
        this.dynamicConnectionProfile = typeof ConnectionProfileConfiguration.discover === 'boolean' ? ConnectionProfileConfiguration.discover : false;
        this.TLSEnabled = false;

        if (this._searchForPropertyValues(this.connectionProfile, 'url', /grpcs|https/).length > 0) {
            this.TLSEnabled = true;
        }

    }

    /**
     * @returns {*} The Connection profile
     */
    getConnectionProfile() {
        return this.connectionProfile;
    }

    /**
     * @returns {boolean} Whether this connection profile is dynamic (ie should use discovery) or static
     */
    isDynamicConnectionProfile() {
        return this.dynamicConnectionProfile;
    }

    /**
     * get the list of Orderers defined for a channel.
     *
     * @param {*} channelName The channel name
     * @returns {[string]} The array of orderers allocated to that channel
     */
    getOrderersForChannel(channelName) {
        if (!this.connectionProfile.channels || !this.connectionProfile.channels[channelName]) {
            throw new Error(`No channel ${channelName} defined in the connection profile for organization ${this.mspId}`);
        }

        const orderersDefined = this.connectionProfile.channels[channelName].orderers;

        if (!orderersDefined || !Array.isArray(orderersDefined)) {
            throw new Error(`No orderers defined for ${channelName} in the connection profile for organization ${this.mspId}`);
        }

        return orderersDefined;
    }

    /**
     * get the list of peers in this connection profile organization that are part of the requested chanel
     *
     * @param {*} channelName The channel name
     * @returns {[string]} The array of peers that are in the channel for this organization's CCP
     */
    getOwnedEndorsingPeersInChannel(channelName) {
        const channelPeers = this._getChannelPeers(channelName);

        const ownedPeersInChannelName = [];
        const organizationPeersList = this._searchForPropertyValues(this.connectionProfile.organizations[this.connectionProfile.client.organization], 'peers');
        if (organizationPeersList.length > 0) {
            const organizationPeers = organizationPeersList[0];
            for (const organizationPeer of organizationPeers) {
                if (channelPeers.hasOwnProperty(organizationPeer) && this._isAbleToEndorse(channelPeers[organizationPeer])) {
                    ownedPeersInChannelName.push(organizationPeer);
                }
            }
        }

        return ownedPeersInChannelName;
    }

    /**
     * Return the list of endorsing peers for a specific channel as defined by this connection profile
     * @param {*} channelName the name of the channel
     * @returns {[string]} the endorsing peers for this channel
     */
    getEndorsingPeersInChannel(channelName) {
        const channelPeers = this._getChannelPeers(channelName);
        const endorsingPeersInChannel = [];
        for (const channelPeer of Object.keys(channelPeers)) {
            if (channelPeers.hasOwnProperty(channelPeer) && this._isAbleToEndorse(channelPeers[channelPeer])) {
                endorsingPeersInChannel.push(channelPeer);
            }
        }
        return endorsingPeersInChannel;
    }

    /**
     * Returns whether the connection profile is using TLS somewhere or not
     * @returns {boolean} true if at least 1 entry has grpcs or https
     */
    isTLSEnabled() {
        return this.TLSEnabled;
    }

    /**
     * Get all the peers defined in the specified channel
     * @param {*} channelName The name of the channel
     * @returns {*} The object containing all the peers in the channel
     * @private
     */
    _getChannelPeers(channelName) {
        if (!this.connectionProfile.channels || !this.connectionProfile.channels[channelName]) {
            throw new Error(`No channel ${channelName} defined in the connection profile for organization ${this.mspId}`);
        }

        const channelPeers = this.connectionProfile.channels[channelName].peers;

        if (!channelPeers) {
            throw new Error(`No peers defined for ${channelName} in the connection profile for organization ${this.mspId}`);
        }

        return channelPeers;
    }

    /**
     * Search for a property name, whose value matches the regex
     * Don't need to handle arrays at this time
     *
     * @param {*} object the object to search and update
     * @param {string} propertyName a property name in the configuration
     * @param {regexp} propertyValueMatch a regex pattern the value has to match against
     * @returns {[*]} an array of the object properties that have a matching value
     *
     */
    _searchForPropertyValues(object, propertyName, propertyValueMatch) {
        const foundPropertyValues = [];

        for (const objectKey in object) {
            if (objectKey === propertyName) {
                if (!propertyValueMatch) {
                    foundPropertyValues.push(object[objectKey]);
                } else if (propertyValueMatch.test(object[objectKey])) {
                    foundPropertyValues.push(object[objectKey]);
                }
            } else {
                if (typeof object[objectKey] === 'object') {
                    foundPropertyValues.push(...this._searchForPropertyValues(object[objectKey], propertyName, propertyValueMatch));
                }
            }

        }

        return foundPropertyValues;
    }

    /**
     * Check peer can endorse
     * @param {*} peer the peer to check
     * @returns {boolean} true if peer is defined as able to endorse (meaning it has chaincode to run)
     */
    _isAbleToEndorse(peer) {
        // the default value of 'endorsingPeer' is true, or it's explicitly set to true
        if (!CaliperUtils.checkProperty(peer, 'endorsingPeer') ||
            (CaliperUtils.checkProperty(peer, 'endorsingPeer') && peer.endorsingPeer)) {

            return true;
        }

        // the default value of 'chaincodeQuery' is true, or it's explicitly set to true
        if (!CaliperUtils.checkProperty(peer, 'chaincodeQuery') ||
            (CaliperUtils.checkProperty(peer, 'chaincodeQuery') && peer.chaincodeQuery)) {

            return true;
        }

        return false;
    }

    /**
     * Return the list of peers for organization of the connection profile
     * @param {*} mspId the mspId of the org
     * @returns {[string]} an array containing the list of all the peers
     */
    getPeersListForOrganization(mspId) {
        if (!this.connectionProfile.organizations) {
            throw new Error('No organizations property can be found for the connection profile provided');
        }

        for (const org in this.connectionProfile.organizations) {
            if (this.connectionProfile.organizations[org].mspid === mspId) {
                const peers = this.connectionProfile.organizations[org].peers;

                if (!peers) {
                    throw new Error(`Org with mspid ${mspId} listed in connectionProfile.organizations does not have any peers property`);
                }
                if (peers.length === 0) {
                    throw new Error(`Org with mspid ${mspId} has a peers property but it is empty`);
                }

                return peers;
            }
        }

        throw new Error(`Org with mspid ${mspId} cannot be found in connectionProfile.organizations`);
    }


    /**
     * Return the tls certificate for the specified peer, can only be called when a grps url and respective certs are provided
     * @param {string} peer the name of the peer
     * @returns {string} tls certificate
     */
    async getTlsCACertsForPeer(peer) {
        const peerObj = this._getPeerIfValid(peer);

        if (!peerObj.tlsCACerts) {
            throw new Error(`No tlsCACerts property for ${peer} in the connection profile was provided`);
        }

        if (peerObj.tlsCACerts.pem) {
            if (!peerObj.tlsCACerts.pem.startsWith('-----BEGIN ')) {
                throw new Error(`pem provided for ${peer} in the connection profile .tlsCACerts.pem is not valid`);
            }
            return peerObj.tlsCACerts.pem;
        } else if (peerObj.tlsCACerts.path) {
            const pemPath = peerObj.tlsCACerts.path;
            const resolvedPemPath = CaliperUtils.resolvePath(pemPath);
            try {
                await fs.stat(resolvedPemPath);
            } catch(err) {
                if (err.errno === -2 || err.errno === -4058) {
                    throw new Error(`path property does not point to a file that exists at ${resolvedPemPath} for ${peer}`);
                }
                throw err;
            }

            const pem = (await fs.readFile(resolvedPemPath)).toString();

            if (!pem.startsWith('-----BEGIN ')) {
                throw new Error(`path property does not point to a valid pem file for ${resolvedPemPath} for ${peer}`);
            }

            return pem;
        } else {
            throw new Error(`No valid tls cert option provided in the ${peer}.tlsCACerts property of connection profile`);
        }
    }

    /**
     * Return the end point of the peer
     * @param {string} peer the name of the peer
     * @returns {string} end point for peer
     */
    getGrpcEndPointForPeer(peer) {
        const url = this._getPeerIfValid(peer).url;

        if (!url.startsWith('grpcs://') && !url.startsWith('grpc://')) {
            throw new Error(`${url} is not a valid grpc/grpcs url, make sure to prefix grpc:// or grpcs:// at the beginning of the url`);
        }
        return url.replace(/(grpcs|grpc)(:\/\/)/, '');
    }

    /**
     * Return if the end point of the peer requires tls
     * @param {string} peer the name of the peer
     * @returns {boolean} returns true if tls is required for the endpoint, false otherwise
     */
    isTLSRequiredForEndpoint(peer) {
        return this._getPeerIfValid(peer).url.startsWith('grpcs://');
    }

    /**
     * Return the gRpc options for the specified peer
     * @param {*} peer the name of the peer
     * @returns {[*]} the list of grpc options
     */
    getGrpcOptionsForPeer(peer) {
        const grpcOptions = this._getPeerIfValid(peer).grpcOptions;

        if (!grpcOptions) {
            return {};
        }
        return grpcOptions;
    }

    /**
     * Check if peer provided is present in peers property and return it
     * @param {string} peer the name of the peer
     * @returns {*} the peer object
     */
    _getPeerIfValid(peer) {
        if (!peer) {
            throw new Error('No peer provided to locate in connection profile definition');
        }
        if (!this.connectionProfile.peers) {
            throw new Error('No peers property can be found in the connection profile provided');
        }
        if (!this.connectionProfile.peers[peer]) {
            throw new Error(`${peer} provided is not present in the connection profile`);
        }

        if (!this.connectionProfile.peers[peer].url) {
            throw new Error(`${peer} provided does not have url property provided in the connection Profile`);
        }
        return this.connectionProfile.peers[peer];
    }
}

module.exports = ConnectionProfileDefinition;