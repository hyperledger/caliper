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
 * Parse and process the fabric connector configuration
 */
class ConnectorConfiguration {

    /**
     * @param {string} connectorConfigurationPath path to the json or yaml file defining the configuration
     */
    constructor(connectorConfigurationPath) {
        CaliperUtils.assertDefined(connectorConfigurationPath, '[ConnectorConfiguration.constructor] Parameter \'connectorConfigurationPath\' is undefined or null');

        const configPath = CaliperUtils.resolvePath(connectorConfigurationPath);
        this.adapterConfiguration = CaliperUtils.parseYaml(configPath);
    }

    /**
     * return whether mutual TLS is required or not
     * @returns {boolean} true if mutual TLS required, false otherwise
     */
    isMutualTLS() {
        return (this.adapterConfiguration.caliper.sutOptions &&
                this.adapterConfiguration.caliper.sutOptions.mutualTls) ? true : false;
    }

    /**
     * Returns a list of all the channels which are marked for creation
     * @returns {string[]} A list of all channels which are marked for creation
     */
    getChannelNamesForCreation() {
        const channelList = this.adapterConfiguration.channels;

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
        const channelList = this.adapterConfiguration.channels;

        if (channelList &&
            Array.isArray(channelList)) {
            const filteredChannelDefinitionList = channelList.filter(channelDefinition => channelDefinition.channelName === channelName);
            return filteredChannelDefinitionList.length > 0 ? filteredChannelDefinitionList[0].definition : null;
        }

        return null;
    }
}

module.exports = ConnectorConfiguration;
