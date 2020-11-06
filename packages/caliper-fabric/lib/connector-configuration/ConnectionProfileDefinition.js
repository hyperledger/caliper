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
     * get the list of peers in this connection profile organisation that are part of the requested chanel
     *
     * @param {*} channelName The channel name
     * @returns {[string]} The array of peers that are in the channel for this organisation's CCP
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

}

module.exports = ConnectionProfileDefinition;
