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

const ConnectorConfiguration = require('./ConnectorConfiguration');
const IdentityManagerFactory = require('../identity-management/IdentityManagerFactory');

/**
 * Factory class for ConnectorConfigurations
 */
class ConnectorConfigurationFactory {

    /**
     * Create a ConnectorConfiguration instance
     * @param {string} connectorConfigurationPath path to connector configuration file
     * @param {IWalletFacadeFactory} walletFacadeFactory a version specific wallet facade factory
     * @returns {Promise<ConnectorConfiguration>} instance of a ConnectorConfiguration
     * @async
     */
    async create(connectorConfigurationPath, walletFacadeFactory) {
        const connectorConfiguration = new ConnectorConfiguration(connectorConfigurationPath, new IdentityManagerFactory(), walletFacadeFactory);
        await connectorConfiguration.parseConfiguration();
        return connectorConfiguration;
    }
}

module.exports = ConnectorConfigurationFactory;
