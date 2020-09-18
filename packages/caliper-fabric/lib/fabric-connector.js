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

/**
 * @typedef {Object} FabricRequestSettings
 *
 * @property {string} contractId Required. The name/ID of the contract whose function
 *           should be invoked.
 * @property {string} contractVersion Required. The version of the contract whose function
 *           should be invoked.
 * @property {string} contractFunction Required. The name of the function that should be
 *           invoked in the contract.
 * @property {boolean} readOnly Optional. Indicates whether the request is a transaction or a query.
 * @property {string[]} [contractArguments] Optional. The list of {string} arguments that should
 *           be passed to the contract.
 * @property {Map<string, Buffer>} [transientMap] Optional. The transient map that should be
 *           passed to the contract.
 * @property {string} invokerIdentity Required. The name of the client who should invoke the
 *           contract. If an admin is needed, use the organization name prefixed with a # symbol.
 * @property {string} channel Required. The name of the channel whose contract should be invoked.
 * @property {string[]} [targetPeers] Optional. An array of endorsing
 *           peer names as the targets of the invoke. When this
 *           parameter is omitted the target list will include the endorsing peers assigned
 *           to the target contract, or if it is also omitted, to the channel.
 * @property {string[]} [targetOrganizations] Optional. An array of endorsing
 *           organizations as the targets of the invoke. If both targetPeers and targetOrganizations
 *           are specified then targetPeers will take precedence
 * @property {string} [orderer] Optional. The name of the orderer to whom the request should
 *           be submitted. If omitted, then the first orderer node of the channel will be used.
 */

'use strict';

const { ConnectorBase, CaliperUtils, ConfigUtil, Constants } = require('@hyperledger/caliper-core');
const ConfigValidator = require('./configValidator.js');
const Logger = CaliperUtils.getLogger('fabric-connector');

const semver = require('semver');

const FabricConnector = class extends ConnectorBase {

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

        // propagate inside events through this decorator
        const self = this;
        this.fabric.on(Constants.Events.Connector.TxsSubmitted, count => self._onTxsSubmitted(count));
        this.fabric.on(Constants.Events.Connector.TxsFinished, results => self._onTxsFinished(results));
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
     * Send one or more requests to the backing SUT.
     * @param {FabricRequestSettings} requests The object(s) containing the options of the request(s).
     * @return {Promise<TxStatus>} The array of data about the executed requests.
     * @async
     */
    async _sendSingleRequest(requests) {
        return this.fabric._sendSingleRequest(requests);
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
