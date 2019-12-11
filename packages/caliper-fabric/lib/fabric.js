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

const Fabric = class extends BlockchainInterface {

    /**
     * Initializes the Fabric adapter.
     * @param {string|object} networkConfig The relative or absolute file path, or the object itself of the Common Connection Profile settings.
     * @param {string} workspace_root The absolute path to the root location for the application configuration files.
     * @param {number} clientIndex the client index
     */
    constructor(networkConfig, workspace_root, clientIndex) {
        super(networkConfig);
        const version = require('fabric-client/package').version;
        const useGateway = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway, false);

        Logger.info(`Initializing ${useGateway ? 'gateway' : 'standard' } adaptor compatible with installed SDK: ${version}`);

        // Match returned version on the major semantic version number
        let modulePath;
        if (semver.satisfies(version, '=1.x') && !useGateway) {
            modulePath = './adaptor-versions/fabric-v1.js';
        } else if (semver.satisfies(version, '=1.x') && useGateway) {
            modulePath = './adaptor-versions/fabric-gateway-v1.js';
        } else {
            throw new Error(`Installed SDK version ${version} did not match any compatible Fabric adaptors`);
        }

        let Fabric = require(modulePath);
        this.fabric = new Fabric(networkConfig, workspace_root, clientIndex);
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
     * Initializes the Fabric adapter: sets up clients, admins, registrars, channels and chaincodes.
     * @async
     */
    async init() {
        await this.fabric.init();
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
     * @param {boolean} initPhase Indicates whether to log registrar init progress.
     * @private
     * @async
     */
    async _initializeRegistrars(initPhase) {
        await this.fabric._initializeRegistrars(initPhase);
    }

    /**
     * Initializes the admins of the organizations.
     *
     * @param {boolean} initPhase Indicates whether to log admin init progress.
     * @private
     * @async
     */
    async _initializeAdmins(initPhase) {
        await this.fabric._initializeAdmins(initPhase);
    }

    /**
     * Registers and enrolls the specified users if necessary.
     *
     * @param {boolean} initPhase Indicates whether to log user init progress.
     * @private
     * @async
     */
    async _initializeUsers(initPhase) {
        await this.fabric._initializeUsers(initPhase);
    }

};

module.exports = Fabric;
