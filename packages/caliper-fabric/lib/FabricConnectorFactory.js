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
const Logger = CaliperUtils.getLogger('FabricConnectorFactory');
const semver = require('semver');

const V1_NODE_CONNECTOR = './connector-versions/v1/FabricNonGateway.js';
const V1_GATEWAY_CONNECTOR = './connector-versions/v1/FabricGateway.js';
const V1_WALLET_FACADE_FACTORY = './connector-versions/v1/WalletFacadeFactory.js';

const V2_GATEWAY_CONNECTOR = './connector-versions/v2/FabricGateway.js';
const V2_WALLET_FACADE_FACTORY = './connector-versions/v2/WalletFacadeFactory.js';

const PEER_GATEWAY_CONNECTOR = './connector-versions/peer-gateway/PeerGateway.js';
const PEER_WALLET_FACADE_FACTORY = './connector-versions/peer-gateway/WalletFacadeFactory.js';

/**
 * @typedef {Object} Sdk
 * @property {String} module - The sdk module name
 * @property {String} version - The version of the sdk module
 */

/**
 * @returns {Sdk} installedSDKmodule and version
 */
const _determineInstalledNodeSDKandVersion = () => {
    // Caliper can only work if you use bind and it will pull in fabric network even for non gateway 1.4
    let sdk, packageVersion;

    if (CaliperUtils.moduleIsInstalled('@hyperledger/fabric-gateway')) {
        packageVersion = semver.coerce(require('@hyperledger/fabric-gateway/package').version);
        sdk = 'fabric-gateway';
    }

    if (CaliperUtils.moduleIsInstalled('fabric-network')) {
        if (sdk) {
            throw new Error('Multiple bindings for fabric have been detected, you need to unbind one or more to ensure only a single bind is present to continue');
        }
        packageVersion = semver.coerce(require('fabric-network/package').version);
        sdk = 'fabric-network';
    }


    if (!sdk) {
        throw new Error('Unable to detect required Fabric binding packages');
    }

    return {sdk, packageVersion};
};

const _loadAppropriateConnectorClass = (installedNodeSdk, version) => {
    let connectorPath;
    let walletFacadeFactoryPath;

    if (installedNodeSdk ===  'fabric-network') {
        if (semver.satisfies(version, '=1.x')) {
            const useGateway = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.Enabled, false);
            Logger.info(`Initializing ${useGateway ? 'gateway' : 'standard' } connector compatible with installed fabric-network SDK: ${version}`);

            if (!useGateway) {
                connectorPath = V1_NODE_CONNECTOR;
                walletFacadeFactoryPath = V1_WALLET_FACADE_FACTORY;
            } else {
                // gateway with default event handlers appears in SDK > 1.4.2
                if (semver.satisfies(version, '>=1.4.2')) {
                    connectorPath = V1_GATEWAY_CONNECTOR;
                    walletFacadeFactoryPath = V1_WALLET_FACADE_FACTORY;
                } else {
                    throw new Error('Caliper currently only supports Fabric gateway based operation using Fabric-SDK 1.4.2 and higher. Please retry with a different SDK binding');
                }
            }
        } else if (semver.satisfies(version, '=2.x')) {
            Logger.info(`Initializing gateway connector compatible with installed SDK: ${version}`);
            connectorPath = V2_GATEWAY_CONNECTOR;
            walletFacadeFactoryPath = V2_WALLET_FACADE_FACTORY;
        } else {
            throw new Error(`Installed fabric-network SDK version ${version} did not match any compatible Fabric connectors`);
        }
    } else {
        // can only be fabric-gateway binding due to check done in _determineInstalledNodeSDKandVersion
        if (semver.satisfies(version, '=1.x')) {
            Logger.info(`Initializing peer gateway connector compatible with installed fabric-gateway SDK: ${version}`);
            connectorPath = PEER_GATEWAY_CONNECTOR;
            walletFacadeFactoryPath = PEER_WALLET_FACADE_FACTORY;
        } else {
            throw new Error(`Installed fabric-gateway SDK version ${version} did not match any compatible Fabric connectors`);
        }
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
    if (loadedConnectorConfiguration.version === '1.0') {
        throw new Error('Network configuration version 1.0 is not supported anymore, please use version 2');
    }

    if (!semver.satisfies(loadedConnectorConfiguration.version, '=2.0')) {
        throw new Error(`Unknown network configuration version ${loadedConnectorConfiguration.version} specified`);
    }

    const sdk = _determineInstalledNodeSDKandVersion();

    const {fabricConnectorClass, walletFacadeFactoryClass} = _loadAppropriateConnectorClass(sdk.sdk, sdk.packageVersion);
    const connectorConfiguration = await new ConnectorConfigurationFactory().create(connectorConfigurationFile, new walletFacadeFactoryClass());
    const fabricConnector = new fabricConnectorClass(connectorConfiguration, workerIndex, 'fabric');

    return fabricConnector;
};

module.exports.ConnectorFactory = connectorFactory;
