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

const grpc = require('@grpc/grpc-js');
const crypto = require('crypto');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const { ConnectorBase, CaliperUtils, TxStatus, Version, ConfigUtil } = require('@hyperledger/caliper-core');
const FabricConnectorContext = require('../../FabricConnectorContext');

const logger = CaliperUtils.getLogger('connectors/peer-gateway/PeerGateway');

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
 *           contract. If an admin is needed, use the organization name prefixed with a _ symbol.
 */

/////////////////////////////
// END OF TYPE DEFINITIONS //
/////////////////////////////

/**
 */
class PeerGateway extends ConnectorBase {

    /**
     * Initializes the Fabric adapter.
     * @param {connectorConfiguration} connectorConfiguration the Connector Configuration
     * @param {number} workerIndex the worker index
     * @param {string} bcType The target SUT type
     */
    constructor(connectorConfiguration, workerIndex, bcType) {
        super(workerIndex, bcType);
        this.connectorConfiguration = connectorConfiguration;

        this.fabricGatewayVersion = new Version(require('@hyperledger/fabric-gateway/package').version);

        this.contractInstancesByIdentity = new Map();
        this.gatewayInstanceByIdentity = new Map();
        this.clients = new Map();
        this.context = undefined;

    }

    /**
     * Get Timeot for Peer Gateway Options.
     *
     * @return {Promise<FabricConnectorContext>} Returns the unique context for the fabric connector
     */
    static _configDefaultTimeout(){
        return {
            deadline: Date.now() + ConfigUtil.get(ConfigUtil.keys.Fabric.Timeout.InvokeOrQuery, 60) * 1000, // 60 second timeout
        };
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
        if (this.connectorConfiguration.isMutualTLS()) {
            throw Error('Mutual tls is not supported with the Peer Gateway Connector');
        }
        if (!this.context) {
            this.context = new FabricConnectorContext(this.workerIndex);
            await this._prepareGatewayAndContractMapsForEachIdentity();
        }

        return this.context;
    }

    /**
     * Initializes the Fabric adapter for use by the Caliper Manager
     * @async
     */
    async init() {
        const defaultOrganization = this.connectorConfiguration.getOrganizations()[0];
        const tlsInfo = this.connectorConfiguration.isMutualTLS() ? 'mutual'
            : ((await this.connectorConfiguration.getConnectionProfileDefinitionForOrganization(defaultOrganization)).isTLSEnabled() ? 'server' : 'none');
        logger.info(`Fabric-Gateway SDK version: ${this.fabricGatewayVersion.toString()} for Peer-Gateway connector; TLS based on ${defaultOrganization}: ${tlsInfo}`);
    }

    /**
     * Installs and initializes the specified contracts.
     * @async
     */
    async installSmartContract() {
        logger.warn('Install smart contract not available for the Fabric Peer Gateway connector');
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

        if (request.targetPeers || request.targetOrganizations) {
            throw new Error('targetPeers or targetOrganizations options are not supported by the Peer Gateway connector');
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
            gateway.close();
        }
        for (const clientName of this.clients.keys()) {
            const client = this.clients.get(clientName);
            logger.info(`disconnecting gRpc client at peer ${clientName}`);
            client.close();
        }

        this.clients.clear();
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
            const connectionProfileDefinition = await this.connectorConfiguration.getConnectionProfileDefinitionForOrganization(organization);
            const firstPeerInOrganization = connectionProfileDefinition.getPeersListForOrganization(organization)[0];
            const aliasNames = await this.connectorConfiguration.getAliasNamesForOrganization(organization);
            const walletFacade = this.connectorConfiguration.getWalletFacade();
            //create Gateway instances for each identity using 1st peer of each organization, retrieve related contract and store into dedicated map
            for (const aliasName of aliasNames) {
                const gateway = await this._createGatewayWithIdentity(organization, aliasName, walletFacade, firstPeerInOrganization);
                this.gatewayInstanceByIdentity.set(aliasName, gateway);

                const contractMap = this._createChannelAndChaincodeIdToContractMap(gateway, aliasName);
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
    _createChannelAndChaincodeIdToContractMap(gateway, aliasName) {
        logger.debug('Entering _createChannelAndChaincodeIdToContractMap');
        logger.info(`Generating contract map for user ${aliasName}`);

        const contractMap = new Map();
        const channels = this.connectorConfiguration.getAllChannelNames();
        for (const channel of channels) {

            const network = gateway.getNetwork(channel);

            const contracts = this.connectorConfiguration.getContractDefinitionsForChannelName(channel);

            for (const contract of contracts) {
                const networkContract = network.getContract(contract.id);
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
     * @param {*} walletFacade, the wallet that holds the identity to be used
     * @param {string} peer The peer we are creating a gateway connection for
     * @returns {Promise<Gateway>} a gateway object for the passed user identity
     * @async
     */
    async _createGatewayWithIdentity(mspId, aliasName, walletFacade, peer) {
        logger.debug(`Entering _createGatewayWithIdentity for alias name ${aliasName}`);
        //create identity from mspId and certificate
        const walletIdentity = await walletFacade.export(aliasName);
        const identity = { mspId: walletIdentity.mspid, credentials: Buffer.from(walletIdentity.certificate) };

        //create gRpc client to designated port
        const client = await this._createClientForPeer(mspId, peer);

        //create signer using the private key of the peer
        const privateKey = crypto.createPrivateKey(walletIdentity.privateKey);
        const signer = signers.newPrivateKeySigner(privateKey);

        //create gateway instance using the grpc client, identity and signer
        const gateway = connect({
            client,
            identity,
            signer,
            evaluateOptions: PeerGateway._configDefaultTimeout,
            endorseOptions: PeerGateway._configDefaultTimeout,
            submitOptions: PeerGateway._configDefaultTimeout,
            commitStatusOptions: PeerGateway._configDefaultTimeout
        });

        logger.debug('Exiting _createGatewayWithIdentity');

        return gateway;
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

        // Build the Caliper TxStatus, this is a reduced item when compared to the low level API capabilities
        // - TxID is not available until after transaction submit/evaluate and must be set at that point
        const invokeStatus = new TxStatus();

        // set the proposal Options(arguments, endorsingOrganizations, transientData)
        const proposalOptions = {};
        // add contract arguments to proposal Options
        proposalOptions.arguments = invokeSettings.contractArguments;
        // Add transient data if present
        if (invokeSettings.transientMap) {
            const transientData = {};
            const keys = Array.from(Object.keys(invokeSettings.transientMap));
            keys.forEach((key) => {
                transientData[key] = Buffer.from(invokeSettings.transientMap[key]);
            });
            proposalOptions.transientData = transientData;
        }
        // set transaction invocation result to return
        try {
            const proposal = smartContract.newProposal(invokeSettings.contractFunction, proposalOptions);
            invokeStatus.SetID(proposal.getTransactionId());
            if (isSubmit) {
                invokeStatus.Set('request_type', 'transaction');
                invokeStatus.SetTimeCreate(Date.now());
                const transaction = await proposal.endorse();
                const subtx = await transaction.submit();
                const status = await subtx.getStatus();

                if (!status.successful) {
                    throw Error(`Failed to submit trasaction with status code: ${status.code}`);
                }

                invokeStatus.SetStatusSuccess();
                invokeStatus.SetResult(subtx.getResult());
            } else {
                invokeStatus.Set('request_type', 'query');
                invokeStatus.SetTimeCreate(Date.now());
                invokeStatus.SetResult(await proposal.evaluate());
                invokeStatus.SetStatusSuccess();
            }
            invokeStatus.SetVerification(true);
            return invokeStatus;
        } catch (err) {
            //check if transaction submission failed, set invokation status accordingly and return it
            if (err.details) {
                err.message += '\nDetails:';
                for (const detail of err.details) {
                    err.message += `\n-  ${detail.address}:${detail.message}`;
                }
            }
            logger.error(`Failed to perform ${isSubmit ? 'submit' : 'query'} transaction [${invokeSettings.contractFunction}] using arguments [${invokeSettings.contractArguments}],  with error: ${err}`);
            invokeStatus.SetStatusFail();
            invokeStatus.SetVerification(true);
            invokeStatus.SetResult('');

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


    /**
     * Create a grpc/grpcs client associated with a specific peer
     * @param {string} mspId The msp id of the organisation which owns the identity
     * @param {string} peer The peer we are creating a grpc client for
     * @returns {Promise<GrpcClient>} a grpc client for the passed peer
     * @async
     */
    async _createClientForPeer(mspId, peer) {
        let client = this.clients.get(peer);
        if (!client) {
            const connectionProfileDefinition = await this.connectorConfiguration.getConnectionProfileDefinitionForOrganization(mspId);

            // set default grpc options
            const grpcOptions = {
                'grpc.max_receive_message_length': -1,
                'grpc.max_send_message_length': -1,
                'grpc.keepalive_time_ms': 120000,
                'grpc.http2.min_time_between_pings_ms': 120000,
                'grpc.keepalive_timeout_ms': 20000,
                'grpc.http2.max_pings_without_data': 0,
                'grpc.keepalive_permit_without_calls': 1
            };

            Object.assign(grpcOptions, connectionProfileDefinition.getGrpcOptionsForPeer(peer));

            // set client end point
            const peerEndpoint = connectionProfileDefinition.getGrpcEndPointForPeer(peer);

            // check if we need to create a grpcs or grpc client
            if (connectionProfileDefinition.isTLSRequiredForEndpoint(peer)) {

                // extrapolate and set grpc option ssl-target-name-override from the connection profile
                // set default to name of the peer if it is not provided
                if (grpcOptions.hasOwnProperty('ssl-target-name-override')) {
                    grpcOptions['grpc.ssl_target_name_override'] = grpcOptions['ssl-target-name-override'];
                    delete grpcOptions['ssl-target-name-override'];
                }

                // create grpcs client with the tlsCredentials of the peer
                const tlsRootCert = await connectionProfileDefinition.getTlsCACertsForPeer(peer);
                const tlsCredentials = grpc.credentials.createSsl(Buffer.from(tlsRootCert));
                client = new grpc.Client(peerEndpoint, tlsCredentials, grpcOptions);
            } else {
                client = new grpc.Client(peerEndpoint, grpc.credentials.createInsecure(), grpcOptions);
            }

            // add client to client-peer mapping
            this.clients.set(peer, client);
        }
        return client;
    }
}

module.exports = PeerGateway;
