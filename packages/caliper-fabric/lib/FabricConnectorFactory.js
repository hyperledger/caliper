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

const { CaliperUtils, ConfigUtil } = require('@hyperledger/caliper-core');
const ConnectorConfigurationFactory = require('./connector-configuration/ConnectorConfigurationFactory');
const ConfigValidator = require('./configValidator.js');
const Logger = CaliperUtils.getLogger('fabric-connector');
const semver = require('semver');

const LEGACY_V1_NODE_CONNECTOR = './connector-versions/v1/fabric.js';
const LEGACY_V1_GATEWAY_CONNECTOR = './connector-versions/v1/fabric-gateway.js';
const LEGACY_V2_GATEWAY_CONNECTOR = './connector-versions/v2/fabric-gateway.js';

const NEW_V1_NODE_CONNECTOR = './connector-versions/v1/FabricNonGateway.js';
const NEW_V1_GATEWAY_CONNECTOR = './connector-versions/v1/FabricGateway.js';
const NEW_V1_WALLET_FACADE_FACTORY = './connector-versions/v1/WalletFacadeFactory.js';

const NEW_V2_GATEWAY_CONNECTOR = './connector-versions/v2/FabricGateway.js';
const NEW_V2_WALLET_FACADE_FACTORY = './connector-versions/v2/WalletFacadeFactory.js';

/**
 * @returns {string} version
 */
const _determineInstalledNodeSDKVersion = () => {
    let version;
    if (CaliperUtils.moduleIsInstalled('fabric-network')) {
        const packageVersion = require('fabric-network/package').version;
        version = semver.coerce(packageVersion);
    } else if (CaliperUtils.moduleIsInstalled('fabric-client')) {
        const packageVersion = require('fabric-client/package').version;
        version = semver.coerce(packageVersion);
    } else {
        const msg = 'Unable to detect required Fabric binding packages';
        throw new Error(msg);
    }
    return version;
};

const _loadAppropriateConnectorClass = (installedNodeSDKVersion, useGateway, useLegacyVersion) => {
    let connectorPath;
    let walletFacadeFactoryPath;

    if (semver.satisfies(installedNodeSDKVersion, '=1.x')) {
        if (!useGateway) {
            if (useLegacyVersion) {
                connectorPath = LEGACY_V1_NODE_CONNECTOR;
            } else {
                connectorPath = NEW_V1_NODE_CONNECTOR;
                walletFacadeFactoryPath = NEW_V1_WALLET_FACADE_FACTORY;
            }
        } else {
            // gateway with default event handlers appears in SDK > 1.4.2
            if (semver.satisfies(installedNodeSDKVersion, '>=1.4.2')) {
                if (useLegacyVersion) {
                    connectorPath = LEGACY_V1_GATEWAY_CONNECTOR;
                } else {
                    connectorPath = NEW_V1_GATEWAY_CONNECTOR;
                    walletFacadeFactoryPath = NEW_V1_WALLET_FACADE_FACTORY;
                }
            } else {
                throw new Error('Caliper currently only supports Fabric gateway based operation using Fabric-SDK 1.4.2 and higher. Please retry with a different SDK binding');
            }
        }
    } else if (semver.satisfies(installedNodeSDKVersion, '=2.x')) {
        if (!useGateway) {
            throw new Error(`Caliper currently only supports gateway based operation using the ${installedNodeSDKVersion} Fabric-SDK. Please retry with the gateway flag`);
        } else {
            if (useLegacyVersion) {
                connectorPath = LEGACY_V2_GATEWAY_CONNECTOR;
            } else {
                connectorPath = NEW_V2_GATEWAY_CONNECTOR;
                walletFacadeFactoryPath = NEW_V2_WALLET_FACADE_FACTORY;
            }
        }
    } else {
        throw new Error(`Installed SDK version ${installedNodeSDKVersion} did not match any compatible Fabric connectors`);
    }

    const fabricConnectorClass = require(connectorPath);
    let walletFacadeFactoryClass;
    if (walletFacadeFactoryPath) {
        walletFacadeFactoryClass = require(walletFacadeFactoryPath);
    }

    return {fabricConnectorClass, walletFacadeFactoryClass};
};

/**
 * Constructs a Fabric connector.
 * @param {number} workerIndex The zero-based index of the worker who wants to create an connector instance. -1 for the manager process.
 * @return {Promise<BlockchainConnector>} The initialized connector instance.
 * @async
 */
const connectorFactory = async (workerIndex) => {

    const connectorConfigurationFile = CaliperUtils.resolvePath(ConfigUtil.get(ConfigUtil.keys.NetworkConfig));
    const loadedConnectorConfiguration = CaliperUtils.parseYaml(connectorConfigurationFile);
    const legacyVersion = loadedConnectorConfiguration.version === '1.0';

    if (!legacyVersion && !semver.satisfies(loadedConnectorConfiguration.version, '=2.0')) {
        throw new Error(`Unknown network configuration version ${loadedConnectorConfiguration.version} specified`);
    }

    const installedNodeSDKVersion = _determineInstalledNodeSDKVersion();
    const useGateway = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.Enabled, false);
    const useDiscovery = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.Discovery, false);

    Logger.info(`Initializing ${useGateway ? 'gateway' : 'standard' } connector compatible with installed SDK: ${installedNodeSDKVersion}`);
    const {fabricConnectorClass, walletFacadeFactoryClass} = _loadAppropriateConnectorClass(installedNodeSDKVersion, useGateway, legacyVersion);

    let fabricConnector;

    if (legacyVersion) {
        ConfigValidator.validateNetwork(loadedConnectorConfiguration, CaliperUtils.getFlowOptions(), useDiscovery, useGateway);

        fabricConnector = new fabricConnectorClass(loadedConnectorConfiguration, workerIndex, 'fabric');
        if (workerIndex > -1) {
            // These connectors must have init called for both masters and workers
            // but for masters it will have already been called
            await fabricConnector.init(true);
        }
    } else {
        // use new connectors
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(connectorConfigurationFile, new walletFacadeFactoryClass());
        fabricConnector = new fabricConnectorClass(connectorConfiguration, workerIndex, 'fabric');
    }

    return fabricConnector;
};

module.exports.ConnectorFactory = connectorFactory;
