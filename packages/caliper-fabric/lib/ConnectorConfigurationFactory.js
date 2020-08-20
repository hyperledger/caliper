'use strict';

const ConnectorConfiguration = require('./ConnectorConfiguration');

/**
 * Factory class for ConnectorConfigurations
 */
class ConnectorConfigurationFactory {

    /**
     * Create a ConnectorConfiguration instance
     * @param {string} connectorConfigurationPath path to connector configuration file
     * @returns {ConnectorConfiguration} instance of a ConnectorConfiguration
     */
    create(connectorConfigurationPath) {
        return new ConnectorConfiguration(connectorConfigurationPath);
    }
}

module.exports = ConnectorConfigurationFactory;
