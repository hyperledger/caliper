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

const FabricConstants = require('fabric-client/lib/Constants');
const {ConnectorBase, CaliperUtils, TxStatus, Version, ConfigUtil} = require('@hyperledger/caliper-core');
const FabricConnectorContext = require('../../FabricConnectorContext');
const ClientCreator = require('./ClientCreator');
const FabricChannelOperations = require('./FabricChannelOperations');
const FabricChaincodeOperations = require('./FabricChaincodeOperations');
const logger = CaliperUtils.getLogger('connectors/v1/FabricNonGateway');

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
 * @property {number} [timeout] Optional. override the default timeout values for requests in seconds
 */


/**
 *  Non gateway implementation of node-sdk 1.4 fabric connector
*/
class V1Fabric extends ConnectorBase {

    /**
     * Initializes the Fabric adapter.
     * @param {object} connectorConfiguration The parsed network configuration.
     * @param {number} workerIndex the worker index
     * @param {string} bcType The target SUT type
     */
    constructor(connectorConfiguration, workerIndex, bcType) {
        super(workerIndex, bcType);
        this.connectorConfiguration = connectorConfiguration;
        this.fabricNetworkVersion = new Version(require('fabric-client/package').version);

        this.aliasNameToFabricClientMap = new Map();
        this.channelNameToChannelEventHubsMap = new Map();

        this.orderersInChannelMap = null;
        this.peersInChannelByOrganizationMap = null;
        this.MapsFromConnectionProfileCreated = false;

        this.context = undefined;

        // this value is hardcoded, if it's used, that means that the provided timeouts are not sufficient
        this.configSmallestTimeout = 1000;

        this.configVerifyProposalResponse = ConfigUtil.get(ConfigUtil.keys.Fabric.Verify.ProposalResponse, true);
        this.configVerifyReadWriteSets = ConfigUtil.get(ConfigUtil.keys.Fabric.Verify.ReadWriteSets, true);
        this.configLatencyThreshold = ConfigUtil.get(ConfigUtil.keys.Fabric.LatencyThreshold, 1.0);
        this.configDefaultTimeout = ConfigUtil.get(ConfigUtil.keys.Fabric.Timeout.InvokeOrQuery, 60000);
        this.configClientBasedLoadBalancing = ConfigUtil.get(ConfigUtil.keys.Fabric.LoadBalancing, 'client') === 'client';
        this.configCountQueryAsLoad = ConfigUtil.get(ConfigUtil.keys.Fabric.CountQueryAsLoad, true);

        this.transactionCounter = -1;
    }

    //////////////////////////
    // PUBLIC API FUNCTIONS //
    //////////////////////////

    /**
     * Prepares the adapter for use by a worker
     *
     * @param {Number} roundIndex The zero-based round index of the test.
     * @param {Array<string>} args Unused.
     * @return {Promise<{FabricConnectorContext}>} Returns a Fabric Connector Context
     * @async
     */
    async getContext(roundIndex, args) {
        if (!this.MapsFromConnectionProfileCreated) {
            await this._validateConnectionProfilesAreStatic();
            this.MapsFromConnectionProfileCreated = true;
            this.orderersInChannelMap = await this.connectorConfiguration.getOrderersInChannelMap();
            this.peersInChannelByOrganizationMap = await this.connectorConfiguration.getEndorsingPeersInChannelByOrganizationMap();
        }

        if (!this.context) {
            this.context = new FabricConnectorContext(this.workerIndex);
            const clientCreator = new ClientCreator(this.connectorConfiguration);
            this.aliasNameToFabricClientMap = await clientCreator.createFabricClientsForAllIdentities();
            await this._initializeApproriateChannelsForFabricClients();
            await this._createEventHubsForEachChannel();
            this.transactionCounter = -1;
        }

        return this.context;
    }

    /**
     * Initializes the Fabric adapter for use by a manager
     * @async
     */
    async init() {
        await this._validateConnectionProfilesAreStatic();
        const defaultOrganization = this.connectorConfiguration.getOrganizations()[0];
        const tlsInfo = this.connectorConfiguration.isMutualTLS() ? 'mutual'
            : (this.connectorConfiguration.getConnectionProfileDefinitionForOrganization(defaultOrganization).isTLSEnabled() ? 'server' : 'none');
        logger.info(`Fabric SDK version: ${this.fabricNetworkVersion.toString()}; TLS based on ${defaultOrganization}: ${tlsInfo}`);

        const fabricChannelOperations = new FabricChannelOperations(this.connectorConfiguration);
        await fabricChannelOperations.createChannelsAndJoinPeers();
    }

    /**
     * Installs and initializes the specified contracts.
     * @async
     */
    async installSmartContract() {
        const fabricChaincodeOperations = new FabricChaincodeOperations(this.connectorConfiguration);
        await fabricChaincodeOperations.installAndInstantiateChaincodes();
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

        const timeout = (request.timeout || this.configDefaultTimeout) * 1000;  // TODO: Differs from gateway impl and doesn't support the request.timeout option

        if (request.readOnly) {
            return this._submitSingleQuery(request, timeout);
        }

        return this._submitSingleTransaction(request, timeout);
    }


    /**
     * Releases the resources of the adapter.
     * @async
     */
    async releaseContext() {
        for (const channelEventHubs of this.channelNameToChannelEventHubsMap.values()) {
            for (const channelEventHub of channelEventHubs) {
                if (channelEventHub.isconnected()) {
                    channelEventHub.disconnect();
                }
            }
        }

        this._closeAppropriateChannelsForFabricClients();

        this.channelNameToChannelEventHubsMap.clear();
        this.aliasNameToFabricClientMap.clear();
        this.context = undefined;
    }


    ////////////////////////////////
    // INTERNAL UTILITY FUNCTIONS //
    ////////////////////////////////

    /**
     * Validate that the connection profiles are static
     */
    async _validateConnectionProfilesAreStatic() {
        const organizations = this.connectorConfiguration.getOrganizations();
        const incorrectConnectionProfileDefinitions = [];
        for (const organization of organizations) {
            const connectionProfileDefinitionForOrganization = await this.connectorConfiguration.getConnectionProfileDefinitionForOrganization(organization);

            if (connectionProfileDefinitionForOrganization.isDynamicConnectionProfile()) {
                incorrectConnectionProfileDefinitions.push(organization);
            }
        }

        if (incorrectConnectionProfileDefinitions.length > 0) {
            throw new Error(`Connection profiles for the organization(s) '${incorrectConnectionProfileDefinitions.join(', ')}' have been specified as discover which is not allowed`);
        }
    }

    /**
     * Initialize channels for each Client instance where that channel is defined for that client
     * @private
     * @async
     */
    async _initializeApproriateChannelsForFabricClients() {
        for (const [aliasName, fabricClient] of this.aliasNameToFabricClientMap.entries()) {
            for (const channelName of this.connectorConfiguration.getAllChannelNames()) {
                const channel = fabricClient.getChannel(channelName, false);
                if (channel) {
                    try {
                        await channel.initialize();
                    } catch (err) {
                        logger.warn(`Couldn't initialize ${channelName} for ${aliasName}. ${aliasName} not available for use on this channel. Error: ${err.message}`);
                    }
                }
            }
        }
    }

    /**
     * Close channels for each client
     * @private
     */
    _closeAppropriateChannelsForFabricClients() {
        for (const fabricClient of this.aliasNameToFabricClientMap.values()) {
            for (const channelName of this.connectorConfiguration.getAllChannelNames()) {
                const channel = fabricClient.getChannel(channelName, false);
                if (channel) {
                    channel.close();
                }
            }
        }
    }

    /**
     * Create eventhubs for each channel from peers which are part of the channel.
     * Replicates the requirement to get events from all peers in the channel before a txn is considered done
     * @private
     * @async
    */
    async _createEventHubsForEachChannel() {
        for (const channelName of this.connectorConfiguration.getAllChannelNames()) {
            const channelEventHubs = [];
            for (const fabricClient of this.aliasNameToFabricClientMap.values()) {
                const channel = fabricClient.getChannel(channelName, false);
                if (channel) {
                    const eventingPeersForChannel = channel.getPeers().filter(peer => peer.isInRole(FabricConstants.NetworkConfig.EVENT_SOURCE_ROLE));
                    for (const eventingPeer of eventingPeersForChannel) {
                        const channelEventHub = channel.newChannelEventHub(eventingPeer);
                        channelEventHub.connect();
                        channelEventHubs.push(channelEventHub);
                    }
                    this.channelNameToChannelEventHubsMap.set(channelName, channelEventHubs);
                    break;
                }
            }
        }
    }

    /**
     * Queries the specified contract according to the provided settings.
     *
     * @param {ContractQuerySettings} querySettings The settings associated with the query.
     * @param {number} timeout The timeout for the call in milliseconds.
     * @return {Promise<TxStatus>} The result and stats of the transaction query.
     * @private
     * @async
     */
    async _submitSingleQuery(querySettings, timeout) {
        this.transactionCounter++;
        const startTime = Date.now();
        const fabricClientForInvoker = this._getFabricClientForInvoker(querySettings);
        const txIdObject = fabricClientForInvoker.newTransactionID();
        const txId = txIdObject.getTransactionID();

        const invokeStatus = new TxStatus(txId);
        invokeStatus.Set('request_type', 'query');
        invokeStatus.SetVerification(true); // querying is a one-step process unlike a normal transaction, so the result is always verified

        ////////////////////////////////
        // SEND TRANSACTION PROPOSALS //
        ////////////////////////////////

        let targetPeers;
        if (querySettings.targetPeers) {
            if (Array.isArray(querySettings.targetPeers) && querySettings.targetPeers.length > 0) {
                targetPeers = querySettings.targetPeers;
            } else {
                logger.warn(`${querySettings.targetPeers} is not a populated array, no peers targeted`);
            }
        }

        if (!targetPeers) {
            targetPeers = this._assembleRandomTargetPeers(querySettings.channel);
        }

        /** @link{ChaincodeInvokeRequest} */
        const proposalRequest = {
            chaincodeId: querySettings.contractId,
            fcn: querySettings.contractFunction,
            args: querySettings.contractArguments || [],
            transientMap: querySettings.transientMap,
            targets: targetPeers
        };

        // the exception should propagate up for an invalid channel name, indicating a user callback module error
        const channel = fabricClientForInvoker.getChannel(querySettings.channel, true);

        /** Array of {Buffer|Error} */
        let results = null;

        try {
            // NOTE: wrap it in a Promise to enforce user-provided timeout
            const resultPromise = new Promise(async (resolve, reject) => {
                const timeoutHandle = setTimeout(() => {
                    reject(new Error('TIMEOUT'));
                }, this._getRemainingTimeout(startTime, timeout));

                invokeStatus.Set('time_create', Date.now());
                try {
                    const result = await channel.queryByChaincode(proposalRequest);
                    clearTimeout(timeoutHandle);
                    resolve(result);
                } catch(err) {
                    clearTimeout(timeoutHandle);
                    reject(err);
                }
            });

            results = await resultPromise;

            ///////////////////////
            // CHECK THE RESULTS //
            ///////////////////////

            let errMsg;

            // filter for errors inside, so we have accurate indices for the corresponding peers
            results.forEach((value, index) => {
                const targetName = targetPeers[index];
                if (value instanceof Error) {
                    invokeStatus.Set(`endorsement_result_error_${targetName}`, value.message);
                    errMsg = `\n\t- Endorsement error from ${targetName}: ${value.message}`;
                } else {
                    // NOTE: the last result will be kept
                    invokeStatus.SetResult(value);
                    invokeStatus.Set(`endorsement_result_${targetName}`, value);
                }
            });

            if (errMsg) {
                invokeStatus.SetStatusFail();
                invokeStatus.SetResult('');
                logger.error(`Query error for ${querySettings.contractId}@${querySettings.contractVersion} in ${querySettings.channel}:${errMsg}`);
            } else {
                invokeStatus.SetStatusSuccess();
            }
        } catch (err) {
            invokeStatus.SetStatusFail();
            invokeStatus.SetResult('');
            invokeStatus.Set('unexpected_error', err.message);
            logger.error(`Unexpected query error for ${querySettings.contractId}@${querySettings.contractVersion} in ${querySettings.channel}: ${err.stack ? err.stack : err}`);
        }

        return invokeStatus;
    }

    /**
     * Invokes the specified contract according to the provided settings.
     *
     * @param {ContractInvokeSettings} invokeSettings The settings associated with the transaction submission.
     * @param {number} timeout The timeout for the whole transaction life-cycle in milliseconds.
     * @return {Promise<TxStatus>} The result and stats of the transaction invocation.
     * @private
     * @async
     */
    async _submitSingleTransaction(invokeSettings, timeout) {
        // NOTE: since this function is a hot path, there aren't any assertions for the sake of efficiency
        this.transactionCounter++;
        // note start time to adjust the timeout parameter later
        const startTime = Date.now();
        const fabricClientForInvoker = this._getFabricClientForInvoker(invokeSettings);

        ////////////////////////////////
        // PREPARE SOME BASIC OBJECTS //
        ////////////////////////////////

        const txIdObject = fabricClientForInvoker.newTransactionID();
        const txId = txIdObject.getTransactionID();

        // timestamps are recorded for every phase regardless of success/failure
        const invokeStatus = new TxStatus(txId);
        invokeStatus.Set('request_type', 'transaction');

        const errors = []; // errors are collected during response validations

        ////////////////////////////////
        // SEND TRANSACTION PROPOSALS //
        ////////////////////////////////

        const channel = fabricClientForInvoker.getChannel(invokeSettings.channel, true);
        let targetPeers;

        if (invokeSettings.targetPeers) {
            if (Array.isArray(invokeSettings.targetPeers) && invokeSettings.targetPeers.length > 0) {
                targetPeers = invokeSettings.targetPeers;
            } else {
                logger.warn(`${invokeSettings.targetPeers} is not a populated array, no peers targeted`);
            }
        } else if (invokeSettings.targetOrganizations) {
            if (Array.isArray(invokeSettings.targetOrganizations) && invokeSettings.targetOrganizations.length > 0) {
                // discovery is never enabled for low level fabric client, so just target all peers in the org
                targetPeers = this._getEndorsingPeersForOrgs(channel, invokeSettings.targetOrganizations);
            } else {
                logger.warn(`${invokeSettings.targetOrganizations} is not a populated array, no orgs targetted`);
            }
        }
        if (!targetPeers) {
            targetPeers = this._assembleRandomTargetPeers(invokeSettings.channel);
        } else if (targetPeers.length === 0) {
            logger.warn('No peers found to be able to target. If targetting organizations, check the organization exists');
        }

        /** @link{ChaincodeInvokeRequest} */
        const proposalRequest = {
            chaincodeId: invokeSettings.contractId,
            fcn: invokeSettings.contractFunction,
            args: invokeSettings.contractArguments || [],
            txId: txIdObject,
            transientMap: invokeSettings.transientMap,
            targets: targetPeers
        };


        /** @link{ProposalResponseObject} */
        let proposalResponseObject = null;

        // NOTE: everything happens inside a try-catch
        // no exception should escape, transaction failures have to be handled gracefully
        try {
            try {
                // account for the elapsed time up to this point
                invokeStatus.Set('time_create', Date.now());
                proposalResponseObject = await channel.sendTransactionProposal(proposalRequest,
                    this._getRemainingTimeout(startTime, timeout));

                invokeStatus.Set('time_endorse', Date.now());
            } catch (err) {
                invokeStatus.Set('time_endorse', Date.now());
                invokeStatus.Set('proposal_error', err.message);

                // error occurred, early life-cycle termination, definitely failed
                invokeStatus.SetVerification(true);
                invokeStatus.SetResult('');

                errors.push(err);
                throw errors; // handle every logging in one place at the end
            }

            //////////////////////////////////
            // CHECKING ENDORSEMENT RESULTS //
            //////////////////////////////////

            /** @link{Array<ProposalResponse>} */
            const proposalResponses = proposalResponseObject[0];
            /** @link{Proposal} */
            const proposal = proposalResponseObject[1];

            // NOTES: filter inside, so we have accurate indices corresponding to the original target peers
            proposalResponses.forEach((value, index) => {
                const targetName = targetPeers[index];

                // Errors from peers/contract are returned as an Error object
                if (value instanceof Error) {
                    invokeStatus.Set(`proposal_response_error_${targetName}`, value.message);

                    // explicit rejection, early life-cycle termination, definitely failed
                    invokeStatus.SetVerification(true);
                    errors.push(new Error(`Proposal response error by ${targetName}: ${value.message}`));
                    return;
                }

                /** @link{ProposalResponse} */
                const proposalResponse = value;

                // save a contract results/response
                // NOTE: the last one will be kept as result
                invokeStatus.SetResult(proposalResponse.response.payload);
                invokeStatus.Set(`endorsement_result_${targetName}`, proposalResponse.response.payload);

                // verify the endorsement signature and identity if configured
                if (this.configVerifyProposalResponse) {
                    if (!channel.verifyProposalResponse(proposalResponse)) {
                        invokeStatus.Set(`endorsement_verify_error_${targetName}`, 'INVALID');

                        // explicit rejection, early life-cycle termination, definitely failed
                        invokeStatus.SetVerification(true);
                        errors.push(new Error(`Couldn't verify endorsement signature or identity of ${targetName}`));
                        return;
                    }
                }

                /** @link{ResponseObject} */
                const responseObject = proposalResponse.response;

                if (responseObject.status !== 200) {
                    invokeStatus.Set(`endorsement_result_error_${targetName}`, `${responseObject.status} ${responseObject.message}`);

                    // explicit rejection, early life-cycle termination, definitely failed
                    invokeStatus.SetVerification(true);
                    errors.push(new Error(`Endorsement denied by ${targetName}: ${responseObject.message}`));
                }
            });

            // if there were errors, stop further processing, jump to the end
            if (errors.length > 0) {
                throw errors;
            }

            if (this.configVerifyReadWriteSets) {
                // check all the read/write sets to see if they're the same
                if (!channel.compareProposalResponseResults(proposalResponses)) {
                    invokeStatus.Set('read_write_set_error', 'MISMATCH');

                    // r/w set mismatch, early life-cycle termination, definitely failed
                    invokeStatus.SetVerification(true);
                    errors.push(new Error('Read/Write set mismatch between endorsements'));
                    throw errors;
                }
            }

            /////////////////////////////////
            // REGISTERING EVENT LISTENERS //
            /////////////////////////////////

            const eventPromises = [];
            for (const channelEventHub of this.channelNameToChannelEventHubsMap.get(invokeSettings.channel)) {
                eventPromises.push(this._createEventRegistrationPromise(channelEventHub, txId, invokeStatus, startTime, timeout));
            }

            ///////////////////////////////////////////
            // SUBMITTING TRANSACTION TO THE ORDERER //
            ///////////////////////////////////////////

            const targetOrderer = invokeSettings.orderer || this._getRandomTargetOrderer(invokeSettings.channel);
            let orderer;

            if (typeof(targetOrderer) === 'string' || targetOrderer instanceof String) {
                // Using an orderer name
                orderer = channel.getOrderer(targetOrderer);
            } else {
                // Have been passed an orderer as an object within invokeSettings.orderer
                throw new Error('Orderer object passed within invokeSettings: must reference target orderer by name');
            }

            /** @link{TransactionRequest} */
            const transactionRequest = {
                proposalResponses: proposalResponses,
                proposal: proposal,
                orderer
            };

            /** @link{BroadcastResponse} */
            let broadcastResponse;
            try {
                // wrap it in a Promise to add explicit timeout to the call
                const responsePromise = new Promise(async (resolve, reject) => {
                    const timeoutHandle = setTimeout(() => {
                        reject(new Error('TIMEOUT'));
                    }, this._getRemainingTimeout(startTime, timeout));

                    try {
                        const result = await channel.sendTransaction(transactionRequest);
                        clearTimeout(timeoutHandle);
                        resolve(result);
                    } catch(err) {
                        clearTimeout(timeoutHandle);
                        reject(err);
                    }
                });

                broadcastResponse = await responsePromise;
            } catch (err) {
                // either an explicit deny from the orderer
                // or a timeout occurred (eating up all the allocated time for the TX)
                invokeStatus.Set(`broadcast_error_${targetOrderer}`, err.message);
                invokeStatus.SetVerification(true);

                errors.push(new Error(`Broadcast error from ${targetOrderer}: ${err.message}`));
                throw errors;
            }

            invokeStatus.Set('time_orderer_ack', Date.now());

            if (broadcastResponse.status !== 'SUCCESS') {
                invokeStatus.Set(`broadcast_response_error_${targetOrderer}`, broadcastResponse.status);

                // the submission was explicitly rejected, so the Tx will definitely not be ordered
                invokeStatus.SetVerification(true);
                errors.push(new Error(`${targetOrderer} response error with status ${broadcastResponse.status}`));
                throw errors;
            }

            //////////////////////////////
            // PROCESSING EVENT RESULTS //
            //////////////////////////////

            // this shouldn't throw, otherwise the error handling is not robust
            const eventResults = await Promise.all(eventPromises);

            // NOTE: this is the latency@threshold support described by the PSWG in their first paper
            const failedNotifications = eventResults.filter(er => !er.successful);

            // NOTE: an error from any peer indicates some problem, don't mask it;
            // although one successful transaction should be enough for "eventual" success;
            // errors from some peer indicate transient problems, errors from all peers probably indicate validation errors
            if (failedNotifications.length > 0) {
                invokeStatus.SetStatusFail();

                let logMsg = `Transaction[${txId.substring(0, 10)}] commit errors:`;
                for (const commitErrors of failedNotifications) {
                    logMsg += `\n\t- ${commitErrors.message}`;
                }

                logger.error(logMsg);
            } else {
                // sort ascending by finish time
                eventResults.sort((a, b) => a.time - b.time);

                // transform to (0,length] by *, then to (-1,length-1] by -, then to [0,length-1] by ceil
                const thresholdIndex = Math.ceil(eventResults.length * this.configLatencyThreshold - 1);

                // every commit event contained a VALID code
                // mark the time corresponding to the set threshold
                invokeStatus.SetStatusSuccess(eventResults[thresholdIndex].time);
            }
        } catch (err) {
            invokeStatus.SetStatusFail();
            invokeStatus.SetResult('');

            // not the expected error array was thrown, an unexpected error occurred, log it with stack if available
            if (!Array.isArray(err)) {
                invokeStatus.Set('unexpected_error', err.message);
                logger.error(`Transaction[${txId.substring(0, 10)}] unexpected error: ${err.stack ? err.stack : err}`);
            } else if (err.length > 0) {
                let logMsg = `Transaction[${txId.substring(0, 10)}] life-cycle errors:`;
                for (const execError of err) {
                    logMsg += `\n\t- ${execError.message}`;
                }

                logger.error(logMsg);
            }
        }

        return invokeStatus;
    }

    /**
     * Get the appropriate fabric Client instance for the invoker
     * @param {*} invokeSettings invoke settings
     * @returns {Client} fabric Client instance
     * @private
     */
    _getFabricClientForInvoker(invokeSettings) {
        const invokerName = invokeSettings.invokerIdentity;
        const invokerMspId = invokeSettings.invokerMspId;
        const aliasName = this.connectorConfiguration.getAliasNameForOrganizationAndIdentityName(invokerMspId, invokerName);
        const fabricClientForInvoker = this.aliasNameToFabricClientMap.get(aliasName);
        if (!fabricClientForInvoker) {
            throw Error(`No contracts for invokerIdentity ${invokerName}${invokerMspId ? ` in ${invokerMspId}` : ''} found. Identity and/or MspId does not exist`);
        }

        return fabricClientForInvoker;
    }

    /**
     * Collects all peers that are endorsing peers belonging to a set of organizations
     * @param {*} channel The name of the channel
     * @param {string[]} endorsingOrgs An array of the required orgs to target
     * @returns {ChannelPeer[]} Array containing the set of peers
     * @private
     */
    _getEndorsingPeersForOrgs(channel, endorsingOrgs) {
        const channelPeers = channel.getChannelPeers();
        const filteredPeers = channelPeers.filter((channelPeer) => {
            return channelPeer.isInRole(FabricConstants.NetworkConfig.ENDORSING_PEER_ROLE) &&
                endorsingOrgs.some((org) => channelPeer.isInOrg(org));
        });

        return filteredPeers;
    }

    /**
     * Assembles random target peers for the channel from every organization that has the contract deployed.
     * @param {string} channel The name of the channel.
     * @returns {string[]} Array containing a random peer from each needed organization.
     * @private
     */
    _assembleRandomTargetPeers(channel) {
        const targets = [];
        const contractOrgs = this.peersInChannelByOrganizationMap.get(channel);

        for (const entries of contractOrgs.entries()) {
            const peersInOrganization = entries[1];

            // represents the load balancing mechanism
            const loadBalancingCounter = this.configClientBasedLoadBalancing ? this.workerIndex : this.transactionCounter;
            targets.push(peersInOrganization[loadBalancingCounter % peersInOrganization.length]);
        }

        return targets;
    }

    /**
     *
     * @param {ChannelEventHub} channelEventHub The event source to use for registering the Tx event.
     * @param {string} txId The transaction ID.
     * @param {TxStatus} invokeStatus The transaction status object.
     * @param {number} startTime The epoch of the transaction start time.
     * @param {number} timeout The timeout for the transaction life-cycle.
     * @return {Promise<{successful: boolean, message: string, time: number}>} The details of the event notification.
     * @private
     */
    _createEventRegistrationPromise(channelEventHub, txId, invokeStatus, startTime, timeout) {
        return new Promise(resolve => {
            const handle = setTimeout(() => {
                // give the other event hub connections a chance
                // to verify the Tx status, so resolve the promise

                channelEventHub.unregisterTxEvent(txId);

                const time = Date.now();
                invokeStatus.Set(`commit_timeout_${channelEventHub.getName()}`, 'TIMEOUT');

                // resolve the failed transaction with the current time and error message
                resolve({
                    successful: false,
                    message: `Commit timeout on ${channelEventHub.getName()} for transaction ${txId}`,
                    time: time
                });
            }, this._getRemainingTimeout(startTime, timeout));

            channelEventHub.registerTxEvent(txId, (tx, code) => {
                clearTimeout(handle);
                const time = Date.now();
                channelEventHub.unregisterTxEvent(txId);

                // either explicit invalid event or valid event, verified in both cases by at least one peer
                // TODO: what about when a transient error occurred on a peer?
                invokeStatus.SetVerification(true);

                if (code !== 'VALID') {
                    invokeStatus.Set(`commit_error_${channelEventHub.getName()}`, code);

                    resolve({
                        successful: false,
                        message: `Commit error on ${channelEventHub.getName()} with code ${code}`,
                        time: time
                    });
                } else {
                    invokeStatus.Set(`commit_success_${channelEventHub.getName()}`, time);
                    resolve({
                        successful: true,
                        message: 'undefined',
                        time: time
                    });
                }
            }, (err) => {
                clearTimeout(handle);
                channelEventHub.unregisterTxEvent(txId);
                const time = Date.now();

                // we don't know what happened, but give the other event hub connections a chance
                // to verify the Tx status, so resolve this promise
                invokeStatus.Set(`event_hub_error_${channelEventHub.getName()}`, err.message);

                resolve({
                    successful: false,
                    message: `Event hub error on ${channelEventHub.getName()}: ${err.message}`,
                    time: time
                });
            });
        });
    }

    /**
     * Gets a random target orderer for the given channel.
     * @param {string} channel The name of the channel.
     * @return {string} The name of the target orderer.
     * @private
     */
    _getRandomTargetOrderer(channel) {
        const orderers = this.orderersInChannelMap.get(channel);

        // represents the load balancing mechanism
        const loadBalancingCounter = this.configClientBasedLoadBalancing ? this.workerIndex : this.transactionCounter;

        return orderers[loadBalancingCounter % orderers.length];
    }

    /**
     * Calculates the remaining time to timeout based on the original timeout and a starting time.
     * @param {number} start The epoch of the start time in ms.
     * @param {number} original The original timeout in ms.
     * @returns {number} The remaining time until the timeout in ms.
     * @private
     */
    _getRemainingTimeout(start, original) {
        let newTimeout = original - (Date.now() - start);
        if (newTimeout < this.configSmallestTimeout) {
            logger.warn(`Timeout is too small, default value of ${this.configSmallestTimeout}ms is used instead`);
            newTimeout = this.configSmallestTimeout;
        }

        return newTimeout;
    }
}

module.exports = V1Fabric;
