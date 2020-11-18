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

const { DefaultEventHandlerStrategies, DefaultQueryHandlerStrategies, Gateway } = require('fabric-network');
const { ConnectorBase, CaliperUtils, TxStatus, Version, ConfigUtil } = require('@hyperledger/caliper-core');
const FabricConnectorContext = require('../../FabricConnectorContext');

const logger = CaliperUtils.getLogger('connectors/v2/FabricGateway');

const EventStrategies = {
    msp_all : DefaultEventHandlerStrategies.MSPID_SCOPE_ALLFORTX,
    msp_any : DefaultEventHandlerStrategies.MSPID_SCOPE_ANYFORTX,
    network_all : DefaultEventHandlerStrategies.NETWORK_SCOPE_ALLFORTX,
    network_any : DefaultEventHandlerStrategies.NETWORK_SCOPE_ANYFORTX,
};

const QueryStrategies = {
    msp_single : DefaultQueryHandlerStrategies.MSPID_SCOPE_SINGLE,
    msp_round_robin : DefaultQueryHandlerStrategies.MSPID_SCOPE_ROUND_ROBIN,
};

//////////////////////
// TYPE DEFINITIONS //
//////////////////////

/**
 * @typedef {Object} FabricRequestSettings
 *
 * @property {string} channel Required. The name of the channel whose contract should be invoked.
 * @property {string} contractId Required. The name/ID of the contract whose function
 *           should be invoked.
 * @property {string} contractFunction Required. The name of the function that should be
 *           invoked in the contract.
 * @property {string[]} [contractArguments] Optional. The list of {string} arguments that should
 *           be passed to the contract.
 * @property {Map<string, Buffer>} [transientMap] Optional. The transient map that should be
 *           passed to the contract.
 * @property {string} [invokerMspId] Optional. The MspId of the invoker. Required if there are more than
 *           1 organisation defined in the network configuration file
 * @property {string} invokerIdentity Required. The identity name of the invoker
 * @property {boolean} [readOnly] Optional. Indicates whether the request is a submit or evaluation.
 *           contract. If an admin is needed, use the organization name prefixed with a # symbol.
 * @property {string[]} [targetPeers] Optional. An array of endorsing
 *           peer names as the targets of the invoke. When this
 *           parameter is omitted the target list will include the endorsing peers assigned
 *           to the target contract, or if it is also omitted, to the channel.
 * @property {string[]} [targetOrganizations] Optional. An array of endorsing
 *           organizations as the targets of the invoke. If both targetPeers and targetOrganizations
 *           are specified then targetPeers will take precedence
 */

/////////////////////////////
// END OF TYPE DEFINITIONS //
/////////////////////////////

/**
 */
class V2FabricGateway extends ConnectorBase {

    /**
     * Initializes the Fabric adapter.
     * @param {connectorConfiguration} connectorConfiguration the Connector Configuration
     * @param {number} workerIndex the worker index
     * @param {string} bcType The target SUT type
     */
    constructor(connectorConfiguration, workerIndex, bcType) {
        super(workerIndex, bcType);
        this.connectorConfiguration = connectorConfiguration;

        this.fabricNetworkVersion = new Version(require('fabric-network/package').version);

        this.contractInstancesByIdentity = new Map();
        this.gatewayInstanceByIdentity = new Map();
        this.peerNameToPeerObjectCache = new Map();
        this.context = undefined;

        // Timeouts
        this.configSmallestTimeout = 1000;
        this.configDefaultTimeout = ConfigUtil.get(ConfigUtil.keys.Fabric.Timeout.InvokeOrQuery, 60000);
        this.configCountQueryAsLoad = ConfigUtil.get(ConfigUtil.keys.Fabric.CountQueryAsLoad, true);

        // Gateway connector
        this.configLocalHost = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.LocalHost, true);
        this.configEventStrategy = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.EventStrategy, 'msp_all');
        this.configQueryStrategy = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.QueryStrategy, 'msp_single');
    }

    //////////////////////////
    // PUBLIC API FUNCTIONS //
    //////////////////////////

    /**
     * Prepares the adapter for use by a worker.
     *
     * @param {Number} roundIndex The zero-based round index of the test.
     * @param {Array<string>} args Unused.
     * @return {Promise<FabricConnectorContext>} Returns the unique context for the fabric connector
     * @async
     */
    async getContext(roundIndex, args) {
        if (!this.context) {
            this.context = new FabricConnectorContext(this.workerIndex);
            await this._prepareGatewayAndContractMapsForEachIdentity();
            await this._buildPeerCache(); // TODO: might be able to do this just once
        }

        return this.context;
    }

    /**
     * Initializes the Fabric adapter for use by the Caliper Master
     * @async
     */
    async init() {
        // Seems to be only for operational initialisation but need to implement as the master
        // will call it
        const defaultOrganization = this.connectorConfiguration.getOrganizations()[0];
        const tlsInfo = this.connectorConfiguration.isMutualTLS() ? 'mutual'
            : (this.connectorConfiguration.getConnectionProfileDefinitionForOrganization(defaultOrganization).isTLSEnabled() ? 'server' : 'none');
        logger.info(`Fabric SDK version: ${this.fabricNetworkVersion.toString()}; TLS based on ${defaultOrganization}: ${tlsInfo}`);
    }

    /**
     * Installs and initializes the specified contracts.
     * @async
     */
    async installSmartContract() {
        logger.warn(`Install smart contract not available with Fabric SDK version: ${this.fabricNetworkVersion.toString()}`);
    }

    /**
     * Send a single request to the backing SUT.
     * @param {FabricRequestSettings} request The request object.
     */
    async _sendSingleRequest(request) {
        if (!request.contractId) {
            throw new Error('No contractId provided in the request');
        }

        if (!request.channel) {
            const contractDetails = this.connectorConfiguration.getContractDetailsForContractId(request.contractId);
            if (!contractDetails) {
                throw new Error(`Could not find details for contract ID ${request.contractId}`);
            }
            request.channel = contractDetails.channel;
            request.contractId = contractDetails.id;
        }

        if (!request.contractFunction) {
            throw new Error('No contractFunction provided in the request');
        }

        if (!request.contractArguments) {
            request.contractArguments = [];
        }

        return await this._submitOrEvaluateTransaction(request, request.readOnly === undefined || !request.readOnly);
    }

    /**
     * Releases the resources of the adapter.
     *
     * @async
     */
    async releaseContext() {
        for (const userName of this.gatewayInstanceByIdentity.keys()) {
            const gateway = this.gatewayInstanceByIdentity.get(userName);
            logger.info(`disconnecting gateway for user ${userName}`);
            gateway.disconnect();
        }

        this.peerNameToPeerObjectCache.clear();
        this.context = undefined;
    }


    ////////////////////////////////
    // INTERNAL UTILITY FUNCTIONS //
    ////////////////////////////////

    /**
     * Extract and persist Contracts from Gateway Networks for identities listed within the wallet
     * @async
     */
    async _prepareGatewayAndContractMapsForEachIdentity() {
        logger.debug('Entering _prepareGatewayAndContractMapsForEachIdentity');

        for (const organization of this.connectorConfiguration.getOrganizations()) {
            const aliasNames = await this.connectorConfiguration.getAliasNamesForOrganization(organization);
            const walletWithIdentities = this.connectorConfiguration.getWallet();

            for (const aliasName of aliasNames) {
                const gateway = await this._createGatewayWithIdentity(organization, aliasName, walletWithIdentities);
                this.gatewayInstanceByIdentity.set(aliasName, gateway);

                const contractMap = await this._createChannelAndChaincodeIdToContractMap(gateway, aliasName);
                this.contractInstancesByIdentity.set(aliasName, contractMap);
            }
        }
        logger.debug('Exiting _prepareGatewayAndContractMapsForEachIdentity');
    }

    /**
     * Create a map with key of channel+chaincode id to fabric-network contract instances
     * @param {Gateway} gateway the gateway to use
     * @param {string} aliasName, the aliasName of the identity being used by the gateway
     * @returns {Promise<Map<Contract>>} A map of all Contract instances for that identity across all the channels and chaincodes
     * @async
     */
    async _createChannelAndChaincodeIdToContractMap(gateway, aliasName) {
        logger.debug('Entering _createChannelAndChaincodeIdToContractMap');
        logger.info(`Generating contract map for user ${aliasName}`);

        const contractMap = new Map();
        const channels = this.connectorConfiguration.getAllChannelNames();
        for (const channel of channels) {

            let network;
            try {
                network = await gateway.getNetwork(channel);
            } catch(err) {
                logger.warn(`Couldn't initialize ${channel} for ${aliasName}. ${aliasName} not available for use on this channel. Error: ${err.message}`);
                continue;
            }

            const contracts = this.connectorConfiguration.getContractDefinitionsForChannelName(channel);

            for (const contract of contracts) {
                const networkContract = await network.getContract(contract.id);
                contractMap.set(`${channel}_${contract.id}`, networkContract);
            }
        }
        logger.debug('Exiting _createChannelAndChaincodeIdToContractMap');

        return contractMap;
    }

    /**
     * Create a fabric-network gateway instance associated with a specific identity
     * @param {string} mspId The msp id of the organisation which owns the identity
     * @param {string} aliasName The alias name that represents the identity to use
     * @param {*} wallet, the wallet that holds the identity to be used
     * @returns {Promise<Gateway>} a gateway object for the passed user identity
     * @async
     */
    async _createGatewayWithIdentity(mspId, aliasName, wallet) {
        logger.debug(`Entering _createGatewayWithIdentity for alias name ${aliasName}`);

        const connectionProfileDefinition = await this.connectorConfiguration.getConnectionProfileDefinitionForOrganization(mspId);
        const opts = {
            identity: aliasName,
            wallet,
            discovery: {
                asLocalhost: this.configLocalHost,
                enabled: connectionProfileDefinition.isDynamicConnectionProfile()
            },
            eventHandlerOptions: {
                commitTimeout: this.configDefaultTimeout,
                strategy: EventStrategies[this.configEventStrategy]
            },
            queryHandlerOptions: {
                timeout: this.configDefaultTimeout,
                strategy: QueryStrategies[this.configQueryStrategy]
            }
        };

        if (this.connectorConfiguration.isMutualTLS()) {
            opts.clientTlsIdentity = aliasName;
        }

        const gateway = new Gateway();

        try {
            logger.info(`Connecting user with identity ${aliasName} to a Network Gateway`);
            await gateway.connect(connectionProfileDefinition.getConnectionProfile(), opts);
            logger.info(`Successfully connected user with identity ${aliasName} to a Network Gateway`);
        } catch (err) {
            logger.error(`Connecting user with identity ${aliasName} to a Network Gateway failed with error: ${err}`);
            throw err;
        }

        logger.debug('Exiting _createGatewayWithIdentity');

        return gateway;
    }

    /**
     */
    async _buildPeerCache() {
        logger.debug('Entering _buildPeerCache');
        for (const aliasName of this.gatewayInstanceByIdentity.keys()) {
            const gateway = this.gatewayInstanceByIdentity.get(aliasName);
            const channelNames = this.connectorConfiguration.getAllChannelNames();

            for (const channelName of channelNames) {
                const network = await gateway.getNetwork(channelName);
                const channel = network.getChannel();

                // WARNING: This uses an internal API to get the endorsers
                for (const peerObject of channel.client.getEndorsers()) {
                    this.peerNameToPeerObjectCache.set(peerObject.name, peerObject);
                }
            }
        }
        logger.debug('Exiting _buildPeerCache');
    }

    /**
     * Submit or evaluate a transaction
     * @param {FabricRequestSettings} invokeSettings The settings associated with the transaction submission.
     * @param {boolean} isSubmit boolean flag to indicate if the transaction is a submit or evaluate
     * @return {Promise<TxStatus>} The result and stats of the transaction invocation.
     * @async
     */
    async _submitOrEvaluateTransaction(invokeSettings, isSubmit) {
        const smartContract = await this._getContractForIdentityOnChannelWithChaincodeID(invokeSettings.invokerMspId, invokeSettings.invokerIdentity, invokeSettings.channel, invokeSettings.contractId);
        const transaction = smartContract.createTransaction(invokeSettings.contractFunction);

        // Build the Caliper TxStatus, this is a reduced item when compared to the low level API capabilities
        // - TxID is not available until after transaction submit/evaluate and must be set at that point
        const invokeStatus = new TxStatus();

        // Add transient data if present
        // - passed as key value pairing such as {"hello":"world"}
        if (invokeSettings.transientMap) {
            const transientData = {};
            const keys = Array.from(Object.keys(invokeSettings.transientMap));
            keys.forEach((key) => {
                transientData[key] = Buffer.from(invokeSettings.transientMap[key]);
            });
            transaction.setTransient(transientData);
        }

        if (invokeSettings.targetPeers && isSubmit) {
            if (Array.isArray(invokeSettings.targetPeers) && invokeSettings.targetPeers.length > 0) {
                const targetPeerObjects = [];
                for (const name of invokeSettings.targetPeers) {
                    const peer = this.peerNameToPeerObjectCache.get(name);
                    if (peer) {
                        targetPeerObjects.push(peer);
                    }
                }
                if (targetPeerObjects.length > 0) {
                    transaction.setEndorsingPeers(targetPeerObjects);
                }
            } else {
                logger.warn(`${invokeSettings.targetPeers} is not a populated array, no peers targeted`);
            }
        } else if (invokeSettings.targetOrganizations && isSubmit) {
            if (Array.isArray(invokeSettings.targetOrganizations) && invokeSettings.targetOrganizations.length > 0) {
                transaction.setEndorsingOrganizations(...invokeSettings.targetOrganizations);
            } else {
                logger.warn(`${invokeSettings.targetOrganizations} is not a populated array, no orgs targeted`);
            }
        }

        try {
            let result;

            if (isSubmit) {
                invokeStatus.Set('request_type', 'transaction');
                invokeStatus.Set('time_create', Date.now());
                result = await transaction.submit(...invokeSettings.contractArguments);
            } else {

                if (invokeSettings.targetPeers || invokeSettings.targetOrganizations) {
                    logger.warn('targetPeers or targetOrganizations options are not valid for query requests');
                }

                invokeStatus.Set('request_type', 'query');
                invokeStatus.Set('time_create', Date.now());
                result = await transaction.evaluate(...invokeSettings.contractArguments);
            }

            invokeStatus.SetResult(result);
            invokeStatus.SetVerification(true);
            invokeStatus.SetStatusSuccess();
            invokeStatus.SetID(transaction.getTransactionId());

            return invokeStatus;
        } catch (err) {
            logger.error(`Failed to perform ${isSubmit ? 'submit' : 'query' } transaction [${invokeSettings.contractFunction}] using arguments [${invokeSettings.contractArguments}],  with error: ${err.stack ? err.stack : err}`);
            invokeStatus.SetStatusFail();
            invokeStatus.SetVerification(true);
            invokeStatus.SetResult('');
            invokeStatus.SetID(transaction.getTransactionId());

            return invokeStatus;
        }
    }

    /**
     * Get the the specific contract for the identity invoking the request
     * @param {string} mspId the mspId of the organisation that owns the identity
     * @param {string} identityName the identity requested to be used by the workload
     * @param {string} channelName the channel name the contract exists on
     * @param {string} contractId the name of the contract to return
     * @returns {Promise<FabricNetworkAPI.Contract>} A contract that may be used to submit or evaluate transactions
     * @async
     */
    async _getContractForIdentityOnChannelWithChaincodeID(mspId, identityName, channelName, contractId) {
        logger.debug('Entering _getContractForIdentityOnChannelWithChaincodeID');

        const aliasName = this.connectorConfiguration.getAliasNameForOrganizationAndIdentityName(mspId, identityName);
        const contractSet = this.contractInstancesByIdentity.get(aliasName);

        // If no contract set found, there is a user configuration/test specification error, so it should terminate
        if (!contractSet) {
            throw Error(`No contracts for invokerIdentity ${identityName}${mspId ? ` in ${mspId}` : ''} found. Identity and/or MspId does not exist`);
        }

        const contract = contractSet.get(`${channelName}_${contractId}`);

        // If no contract found, there is a user configuration/test specification error, so it should terminate
        if (!contract) {
            throw Error(`Unable to find specified contract ${contractId} on channel ${channelName}!`);
        }

        logger.debug('Exiting _getContractForIdentityOnChannelWithChaincodeID');

        return contract;
    }
}

module.exports = V2FabricGateway;
