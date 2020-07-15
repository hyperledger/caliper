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

const { BlockchainConnector, CaliperUtils, ConfigUtil } = require('@hyperledger/caliper-core');
const ConfigValidator = require('./configValidator.js');
const Logger = CaliperUtils.getLogger('fabric-connector');

const semver = require('semver');

const FabricConnector = class extends BlockchainConnector {

    /**
     * Initializes the Fabric adapter.
     * @param {number} workerIndex The index of the worker who wants to create an adapter instance. -1 for the manager process.
     * @param {string} bcType The target SUT type
     */
    constructor(workerIndex, bcType) {
        super(workerIndex, bcType);
        // Switch connectors based on installed packages
        // - will either have fabric-network, or fabric-client
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

        const useGateway = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.Enabled, false);
        const useDiscovery = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.Discovery, false);

        Logger.info(`Initializing ${useGateway ? 'gateway' : 'standard' } connector compatible with installed SDK: ${version}`);

        // Match returned version on the major semantic version number
        let modulePath;
        if (semver.satisfies(version, '=1.x')) {
            if (!useGateway) {
                modulePath = './connector-versions/v1/fabric.js';
            } else {
                // gateway with default event handlers appears in SDK > 1.4.2
                if (semver.satisfies(version, '>=1.4.2')) {
                    modulePath = './connector-versions/v1/fabric-gateway.js';
                } else {
                    throw new Error('Caliper currently only supports Fabric gateway based operation using Fabric-SDK 1.4.2 and higher. Please retry with a different SDK binding');
                }
            }
        } else if (semver.satisfies(version, '=2.x')) {
            if (!useGateway) {
                throw new Error(`Caliper currently only supports gateway based operation using the ${version} Fabric-SDK. Please retry with the gateway flag`);
            } else {
                modulePath = './connector-versions/v2/fabric-gateway.js';
            }
        } else {
            throw new Error(`Installed SDK version ${version} did not match any compatible Fabric connectors`);
        }

        const networkConfig = CaliperUtils.resolvePath(ConfigUtil.get(ConfigUtil.keys.NetworkConfig));

        // validate the passed network file before use in underlying connector(s)
        const configPath = CaliperUtils.resolvePath(networkConfig);
        const networkObject = CaliperUtils.parseYaml(configPath);
        ConfigValidator.validateNetwork(networkObject, CaliperUtils.getFlowOptions(), useDiscovery, useGateway);

        const Fabric = require(modulePath);
        this.fabric = new Fabric(networkObject, workerIndex, bcType);
    }

    /**
     * Prepares the adapter by either:
     * - building a gateway object linked to a wallet ID
     * - loading user data and connection to the event hubs.
     *
     * @param {Number} roundIndex The zero-based round index of the test.
     * @param {Array<string>} args Unused.
     * @return {Promise<{networkInfo : FabricNetwork, eventSources: EventSource[]}>} Returns the network utility object.
     * @async
     */
    async getContext(roundIndex, args) {
        return await this.fabric.getContext(roundIndex, args);
    }

    /**
     * Initializes the Fabric adapter and configures the SUT: sets up clients, admins, registrars, channels and contracts.
     * @param {boolean} workerInit Indicates whether the initialization happens in the worker process.
     * @async
     */
    async init(workerInit) {
        await this.fabric.init(workerInit);
    }

    /**
     * Installs and initializes the specified contracts.
     * @async
     */
    async installSmartContract() {
        await this.fabric.installSmartContract();
    }

    /**
     * Invokes the specified contract according to the provided settings.
     *
     * @param {string} contractID The unique contract ID of the target contract.
     * @param {string} contractVersion Unused.
     * @param {ContractInvokeSettings|ContractInvokeSettings[]} invokeSettings The settings (collection) associated with the (batch of) transactions to submit.
     * @param {number} timeout The timeout for the whole transaction life-cycle in seconds.
     * @return {Promise<TxStatus[]>} The result and stats of the transaction invocation.
     */
    async invokeSmartContract(contractID, contractVersion, invokeSettings, timeout) {
        return await this.fabric.invokeSmartContract(contractID, contractVersion, invokeSettings, timeout);
    }

    /**
     * Queries the specified contract according to the provided settings.
     *
     * @param {string} contractID The unique contract ID of the target contract.
     * @param {string} contractVersion Unused.
     * @param {ContractQuerySettings|ContractQuerySettings[]} querySettings The settings (collection) associated with the (batch of) query to submit.
     * @param {number} timeout The timeout for the call in seconds.
     * @return {Promise<TxStatus[]>} The result and stats of the transaction query.
     */
    async querySmartContract(contractID, contractVersion, querySettings, timeout) {
        return await this.fabric.querySmartContract(contractID, contractVersion, querySettings, timeout);
    }

    /**
     * Releases the resources of the adapter.
     *
     * @async
     */
    async releaseContext() {
        await this.fabric.releaseContext();
    }

};

module.exports = FabricConnector;
