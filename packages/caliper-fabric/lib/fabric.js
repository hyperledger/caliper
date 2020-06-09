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

const { BlockchainInterface, CaliperUtils, ConfigUtil } = require('@hyperledger/caliper-core');
const Logger = CaliperUtils.getLogger('adapters/fabric');

const semver = require('semver');
const path = require('path');

const Fabric = class extends BlockchainInterface {

    /**
     * Initializes the Fabric adapter.
     * @param {number} workerIndex The zero-based index of the worker who wants to create an adapter instance. -1 for the master process.
     */
    constructor(workerIndex) {
        super();
        // Switch adaptors based on installed packages
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

        const useGateway = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.UseGateway, false);

        Logger.info(`Initializing ${useGateway ? 'gateway' : 'standard' } adaptor compatible with installed SDK: ${version}`);

        // Match returned version on the major semantic version number
        let modulePath;
        if (semver.satisfies(version, '=1.x')) {
            if (!useGateway) {
                modulePath = './adaptor-versions/v1/fabric-v1.js';
            } else {
                // gateway with default event handlers appears in SDK > 1.4.2
                if (semver.satisfies(version, '>=1.4.2')) {
                    modulePath = './adaptor-versions/v1/fabric-gateway-v1.js';
                } else {
                    throw new Error('Caliper currently only supports Fabric gateway based operation using Fabric-SDK 1.4.2 and higher. Please retry with a different SDK binding');
                }
            }
        } else if (semver.satisfies(version, '=2.x')) {
            if (!useGateway) {
                throw new Error(`Caliper currently only supports gateway based operation using the ${version} Fabric-SDK. Please retry with the gateway flag`);
            } else {
                modulePath = './adaptor-versions/v2/fabric-gateway-v2.js';
            }
        } else {
            throw new Error(`Installed SDK version ${version} did not match any compatible Fabric adaptors`);
        }

        const networkConfig = CaliperUtils.resolvePath(ConfigUtil.get(ConfigUtil.keys.NetworkConfig));
        const workspaceRoot = path.resolve(ConfigUtil.get(ConfigUtil.keys.Workspace));

        const Fabric = require(modulePath);
        this.fabric = new Fabric(networkConfig, workspaceRoot, workerIndex);
    }

    /**
     * Retrieve the blockchain type the implementation relates to
     * @returns {string} the blockchain type
     */
    getType() {
        return this.fabric.getType();
    }

    /**
     * Prepares the adapter by either:
     * - building a gateway object linked to a wallet ID
     * - loading user data and connection to the event hubs.
     *
     * @param {string} name Unused.
     * @param {Array<string>} args Unused.
     * @return {Promise<{networkInfo : FabricNetwork, eventSources: EventSource[]}>} Returns the network utility object.
     * @async
     */
    async getContext(name, args) {
        return await this.fabric.getContext(name, args);
    }

    /**
     * Initializes the Fabric adapter and configures the SUT: sets up clients, admins, registrars, channels and chaincodes.
     * @param {boolean} workerInit Indicates whether the initialization happens in the worker process.
     * @async
     */
    async init(workerInit) {
        await this.fabric.init(workerInit);
    }

    /**
     * Installs and initializes the specified chaincodes.
     * @async
     */
    async installSmartContract() {
        await this.fabric.installSmartContract();
    }

    /**
     * Invokes the specified chaincode according to the provided settings.
     *
     * @param {object} context The context previously created by the Fabric adapter.
     * @param {string} contractID The unique contract ID of the target chaincode.
     * @param {string} contractVersion Unused.
     * @param {ChaincodeInvokeSettings|ChaincodeInvokeSettings[]} invokeSettings The settings (collection) associated with the (batch of) transactions to submit.
     * @param {number} timeout The timeout for the whole transaction life-cycle in seconds.
     * @return {Promise<TxStatus[]>} The result and stats of the transaction invocation.
     */
    async invokeSmartContract(context, contractID, contractVersion, invokeSettings, timeout) {
        return await this.fabric.invokeSmartContract(context, contractID, contractVersion, invokeSettings, timeout);
    }

    /**
     * Queries the specified chaincode according to the provided settings.
     *
     * @param {object} context The context previously created by the Fabric adapter.
     * @param {string} contractID The unique contract ID of the target chaincode.
     * @param {string} contractVersion Unused.
     * @param {ChaincodeQuerySettings|ChaincodeQuerySettings[]} querySettings The settings (collection) associated with the (batch of) query to submit.
     * @param {number} timeout The timeout for the call in seconds.
     * @return {Promise<TxStatus[]>} The result and stats of the transaction query.
     */
    async querySmartContract(context, contractID, contractVersion, querySettings, timeout) {
        return await this.fabric.querySmartContract(context, contractID, contractVersion, querySettings, timeout);
    }

    /**
     * Releases the resources of the adapter.
     *
     * @param {object} context Unused.
     * @async
     */
    async releaseContext(context) {
        await this.fabric.releaseContext(context);
    }

    /**
     * Initializes the registrars of the organizations.
     *
     * @param {boolean} masterInit Indicates whether the initialization happens in the master process.
     * @private
     * @async
     */
    async _initializeRegistrars(masterInit) {
        await this.fabric._initializeRegistrars(masterInit);
    }

    /**
     * Initializes the admins of the organizations.
     *
     * @param {boolean} masterInit Indicates whether the initialization happens in the master process.
     * @private
     * @async
     */
    async _initializeAdmins(masterInit) {
        await this.fabric._initializeAdmins(masterInit);
    }

    /**
     * Registers and enrolls the specified users if necessary.
     *
     * @param {boolean} masterInit Indicates whether the initialization happens in the master process.
     * @private
     * @async
     */
    async _initializeUsers(masterInit) {
        await this.fabric._initializeUsers(masterInit);
    }

};

module.exports = Fabric;
