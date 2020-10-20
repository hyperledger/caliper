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

const { DefaultEventHandlerStrategies, DefaultQueryHandlerStrategies, Gateway, Wallets } = require('fabric-network');
const { ConnectorBase, CaliperUtils, TxStatus, Version, ConfigUtil } = require('@hyperledger/caliper-core');

const FabricNetwork = require('../../fabricNetwork.js');
const RegistrarHelper = require('./registrarHelper');

const logger = CaliperUtils.getLogger('connectors/v2/fabric-gateway');

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
 * @typedef {Object} ContractInvokeSettings
 *
 * @property {string} contractId Required. The name/ID of the contract whose function
 *           should be invoked.
 * @property {string} contractVersion Required. The version of the contract whose function
 *           should be invoked.
 * @property {string} contractFunction Required. The name of the function that should be
 *           invoked in the contract.
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

/**
 * @typedef {Object} ContractQuerySettings
 *
 * @property {string} contractId Required. The name/ID of the contract whose function
 *           should be invoked.
 * @property {string} contractVersion Required. The version of the contract whose function
 *           should be invoked.
 * @property {string} contractFunction Required. The name of the function that should be
 *           invoked in the contract.
 * @property {string[]} [contractArguments] Optional. The list of {string} arguments that should
 *           be passed to the contract.
 * @property {Map<string, Buffer>} [transientMap] Optional. The transient map that should be
 *           passed to the contract.
 * @property {string} invokerIdentity Required. The name of the client who should invoke the
 *           contract. If an admin is needed, use the organization name prefixed with a # symbol.
 * @property {string} channel Required. The name of the channel whose contract should be invoked.
 * @property {boolean} [countAsLoad] Optional. Indicates whether to count this query as workload.
 */

/////////////////////////////
// END OF TYPE DEFINITIONS //
/////////////////////////////

/**
 * Legacy (old network config format) Connector for V2 Node SDK using Gateway API
 */
class LegacyV2FabricGateway extends ConnectorBase {
    /**
     * Initializes the Fabric adapter.
     * @param {object} networkObject The parsed network configuration.
     * @param {number} workerIndex the worker index
     * @param {string} bcType The target SUT type
     */
    constructor(networkObject, workerIndex, bcType) {
        super(workerIndex, bcType);
        this.version = new Version(require('fabric-network/package').version);

        // clone the object to prevent modification by other objects
        this.network = CaliperUtils.parseYamlString(CaliperUtils.stringifyYaml(networkObject));

        this.txIndex = -1;
        this.networkUtil = new FabricNetwork(this.network);
        this.defaultInvoker = Array.from(this.networkUtil.getClients())[0];

        this.orgWallets = new Map();
        this.userContracts = new Map();
        this.userGateways = new Map();
        this.peerCache = new Map();
        this.context = undefined;

        // Timeouts
        this.configSmallestTimeout = 1000;
        this.configDefaultTimeout = ConfigUtil.get(ConfigUtil.keys.Fabric.Timeout.InvokeOrQuery, 60000);
        this.configCountQueryAsLoad = ConfigUtil.get(ConfigUtil.keys.Fabric.CountQueryAsLoad, true);

        // Gateway connector
        this.configLocalHost = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.LocalHost, true);
        this.configDiscovery = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.Discovery, false);
        this.eventStrategy = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.EventStrategy, 'msp_all');
        this.queryStrategy = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.QueryStrategy, 'msp_single');
    }

    ////////////////////////////////
    // INTERNAL UTILITY FUNCTIONS //
    ////////////////////////////////

    /**
     * Initialize the connector
     */
    async _initConnector() {
        logger.debug('Entering _initConnector');
        const tlsInfo = this.networkUtil.isMutualTlsEnabled() ? 'mutual'
            : (this.networkUtil.isTlsEnabled() ? 'server' : 'none');
        logger.info(`Fabric SDK version: ${this.version.toString()}; TLS: ${tlsInfo}`);

        await this._prepareOrgWallets();
        await this._initializeAdmins();
        // Initialize registrars *after* initialization of admins so that admins are not created
        this.registrarHelper = await RegistrarHelper.newWithNetwork(this.networkUtil);
        await this._initializeUsers();
        logger.debug('Exiting _initConnector');
    }

    /**
     * Initializes the admins of the organizations.
     *
     * @private
     * @async
     */
    async _initializeAdmins() {
        logger.info('Initializing administrators');
        const orgs = this.networkUtil.getOrganizations();
        for (const org of orgs) {
            const adminName = `admin.${org}`;

            // Check if the caliper config file has this identity supplied
            if (!this.networkUtil.getClients().has(adminName)) {
                logger.info(`No ${adminName} found in caliper configuration file - unable to perform admin options`);
                continue;
            }

            // Since admin exists, conditionally use it
            logger.info(`Administrator ${adminName} found in caliper configuration file - checking for ability to use the identity`);
            const usesOrgWallets = this.networkUtil.usesOrganizationWallets();
            if (usesOrgWallets) {
                // If a file wallet is provided, it is expected that *all* required identities are provided
                // Admin is a super-user identity, and is consequently optional
                const orgWallet = this.orgWallets.get(org);
                const hasAdmin = await orgWallet.get(adminName);
                if (!hasAdmin) {
                    logger.info(`No ${adminName} found in wallet - unable to perform admin options using client specified in caliper configuration file`);
                }
            } else {
                // Build up the admin identity based on caliper client items and add to the in-memory wallet
                const cryptoContent = this.networkUtil.getAdminCryptoContentOfOrganization(org);
                if (!cryptoContent) {
                    logger.info(`No ${adminName} cryptoContent found in caliper configuration file - unable to perform admin options`);
                    continue;
                } else {
                    await this._addToOrgWallet(org, cryptoContent.signedCertPEM, cryptoContent.privateKeyPEM, adminName);
                }
            }
            logger.info(`${org}'s admin's materials are successfully loaded`);
        }
        logger.info('Completed initializing administrators');
    }

    /**
     * Registers and enrolls the specified users if necessary.
     *
     * @param {boolean} workerInit Indicates whether the initialization happens in the worker process.
     * @private
     * @async
     */
    async _initializeUsers() {
        logger.info('Initializing users');

        // Ensure clients passed by the config are able to be used
        // - They must be present in a wallet
        // - Use passed material if present
        // - Register and enroll each client with its organization's CA as a fall back option
        for (const clientName of this.networkUtil.getClients()) {
            const orgName = this.networkUtil.getOrganizationOfClient(clientName);

            const orgWallet = this.orgWallets.get(orgName);
            const hasClient = await orgWallet.get(clientName);
            if (hasClient) {
                logger.info(`Client ${clientName} present in wallet: skipping client enrollment`);
                continue;
            } else {
                // Extract required information from the supplied caliper config
                const cryptoContent = this.networkUtil.getClientCryptoContent(clientName);
                if (cryptoContent) {
                    logger.info(`Client ${clientName} being initialized using provided crypto content`);
                    await this._addToOrgWallet(orgName, cryptoContent.signedCertPEM.toString('utf8'), cryptoContent.privateKeyPEM.toString('utf8'), clientName);
                } else {
                    logger.info(`No crypto content provided for client ${clientName}; will attempt to register and enrol`);
                    try {
                        // Check if there is a valid registrar to use for the org
                        if (this.registrarHelper.registrarExistsForOrg(orgName)) {
                            // Do we have an enrollment secret?
                            const enrollmentSecret = this.networkUtil.getClientEnrollmentSecret(clientName);
                            if (enrollmentSecret) {
                                // enrolled, so register with enrollment secret
                                const enrollment = await this.registrarHelper.enrollUserForOrg(orgName, clientName, enrollmentSecret);
                                await this._addToOrgWallet(orgName, enrollment.certificate,  enrollment.key.toBytes(), clientName);
                            } else {
                                // Register and enrol
                                const secret = await this.registrarHelper.registerUserForOrg(orgName, clientName);
                                const enrollment = await this.registrarHelper.enrollUserForOrg(orgName, clientName, secret);
                                await this._addToOrgWallet(orgName, enrollment.certificate,  enrollment.key.toBytes(), clientName);
                            }
                        } else {
                            logger.warn(`Required registrar for organization ${orgName} does not exist; unable to enroll client with identity ${clientName}.`);
                        }
                    } catch (error) {
                        logger.warn(`Failed to enrol client with identity ${clientName}. This client will be unavailable for use, due to error ${error.toString()}`);
                        continue;
                    }
                }
            }
        }
        logger.info('Completed initializing users');
    }

    /**
     * Add a user to the wallet under a provided name
     * @param {string} org, the organization name
     * @param {string} certificate the user certificate
     * @param {string} key the private key matching the certificate
     * @param {string} identityName the name to store the User as within the wallet
     * @async
     */
    async _addToOrgWallet(org, certificate, key, identityName) {
        logger.info(`Adding identity for name ${identityName} to wallet for organization ${org}`);
        const identity = {
            credentials: {
                certificate: certificate,
                privateKey: key,
            },
            mspId: this.networkUtil.getMspIdOfOrganization(org),
            type: 'X.509',
        };

        const orgWallet = this.orgWallets.get(org);
        await orgWallet.put(identityName, identity);
        logger.info(`Identity ${identityName} created and imported to wallet`);
    }

    /**
     * Extract and persist Contracts from Gateway Networks for identities listed within the wallet
     * @async
     */
    async _initializeContracts() {
        logger.debug('Entering _initializeContracts');
        for (const walletOrg of this.orgWallets.keys()) {
            logger.info(`Retrieving and persisting contract map for organization ${walletOrg}`);
            const orgWallet = this.orgWallets.get(walletOrg);

            // Prepare client contracts based on wallet identities only
            const walletIdentities = await orgWallet.list();
            for (const identity of walletIdentities) {
                logger.info(`Retrieving and persisting contract map for identity ${identity}`);
                // Retrieve
                const contractMap = await this._retrieveContractMapForIdentity(identity, orgWallet);
                // Persist
                this.userContracts.set(identity, contractMap);
            }
        }
        logger.debug('Exiting _initializeContracts');
    }

    /**
     * Retrieve all Contracts using a passed identity and organization wallet
     * @param {string} identity, the unique client identity name
     * @param {FileSystemWallet | InMemoryWallet} wallet, the wallet that holds the passed identity name
     * @returns {Map<Contract>} A map of all Contracts retrieved from the client Gateway
     * @async
     */
    async _retrieveContractMapForIdentity(identity, wallet) {
        logger.debug('Entering _retrieveContractsForIdentity');
        // Retrieve the gateway for the passed identity. The gateway object is persisted for easier cleanup.
        // - userName must match that created for wallet userId in init phases
        const gateway = await this._retrieveUserGateway(identity, wallet);
        this.userGateways.set(identity, gateway);

        // Work on all channels to build a contract map
        logger.info(`Generating contract map for user ${identity}`);
        const contractMap = new Map();
        const channels = this.networkUtil.getChannels();
        for (const channel of channels) {
            // retrieve the channel network
            const network = await gateway.getNetwork(channel);
            // Work on all contracts/smart contracts in the channel
            const contracts = this.networkUtil.getContractsOfChannel(channel);
            for (const contract of contracts) {
                const networkContract = await network.getContract(contract.id);
                contractMap.set(`${channel}_${contract.id}`, networkContract);
            }
        }

        logger.debug('Exiting _retrieveContractsForIdentity');
        return contractMap;
    }

    /**
     * Retrieve a Gateway object for the passed userId
     * @param {string} identity string identity
     * @param {FileSystemWallet | InMemoryWallet} wallet, the wallet that holds the passed identity name
     * @returns {FabricNet.Gateway} a gateway object for the passed user identity
     * @async
     */
    async _retrieveUserGateway(identity, wallet) {
        logger.debug(`Entering _retrieveUserGateway for identity name ${identity}`);
        // Build options for the connection
        const opts = {
            identity,
            wallet,
            discovery: {
                asLocalhost: this.configLocalHost,
                enabled: this.configDiscovery
            },
            eventHandlerOptions: {
                commitTimeout: this.configDefaultTimeout,
                strategy: EventStrategies[this.eventStrategy]
            },
            queryHandlerOptions: {
                timeout: this.configDefaultTimeout,
                strategy: QueryStrategies[this.queryStrategy]
            }
        };

        // Optional on mutual auth
        if (this.networkUtil.isMutualTlsEnabled()) {
            opts.clientTlsIdentity = identity;
        }

        // Retrieve gateway using ccp and options
        const gateway = new Gateway();

        try {
            logger.info(`Connecting user with identity ${identity} to a Network Gateway`);
            await gateway.connect(this.networkUtil.getNetworkObject(), opts);
            logger.info(`Successfully connected user with identity ${identity} to a Network Gateway`);
        } catch (err) {
            logger.error(`Connecting user with identity ${identity} to a Network Gateway failed with error: ${err}`);
        }

        // return the gateway object
        logger.debug('Exiting _retrieveUserGateway');
        return gateway;
    }

    /**
     * Initialize channel objects for use in peer targeting. Requires user gateways to have been
     * formed in advance.
     */
    async _initializePeerCache() {
        logger.debug('Entering _initializePeerCache');
        for (const userName of this.userGateways.keys()) {
            const gateway = this.userGateways.get(userName);
            // Loop over known channel names
            const channelNames = this.networkUtil.getChannels();
            for (const channelName of channelNames) {
                const network = await gateway.getNetwork(channelName);
                const channel = network.getChannel();

                // Add all peers
                for (const peerObject of channel.client.getEndorsers()) {
                    this.peerCache.set(peerObject.name, peerObject);
                }
            }
        }
        logger.debug('Exiting _initializePeerCache');
    }

    /**
     * Conditionally initializes the organization wallet map depending on network configuration
     * @private
     */
    async _prepareOrgWallets() {
        logger.debug('Entering _prepareOrgWallets');
        if (this.networkUtil.usesOrganizationWallets()) {
            logger.info('Using defined organization file system wallets');
            const orgs = this.networkUtil.getOrganizations();
            for (const org of orgs) {
                const fileWalletPath = this.networkUtil.getWalletPathForOrganization(org);
                if (fileWalletPath) {
                    const wallet = await Wallets.newFileSystemWallet(fileWalletPath);
                    this.orgWallets.set(org, wallet);
                } else {
                    logger.warn(`No defined organization wallet for org ${org}`);
                }
            }
        } else {
            logger.info('Creating new InMemoryWallets for organizations');
            const orgs = this.networkUtil.getOrganizations();
            for (const org of orgs) {
                const wallet = await Wallets.newInMemoryWallet();
                this.orgWallets.set(org, wallet);
            }
        }
        logger.debug('Exiting _prepareOrgWallets');
    }

    /**
     * Perform a transaction using a Gateway contract
     * @param {ContractInvokeSettings|ContractQuerySettings} invokeSettings The settings associated with the transaction submission.
     * @param {boolean} isSubmit boolean flag to indicate if the transaction is a submit or evaluate
     * @return {Promise<TxStatus>} The result and stats of the transaction invocation.
     * @async
     */
    async _performGatewayTransaction(invokeSettings, isSubmit) {
        // Retrieve the existing contract for the invokerIdentity
        const smartContract = await this._getUserContract(invokeSettings.invokerIdentity, invokeSettings.channel, invokeSettings.contractId);

        // Create a transaction
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

        // Set endorsing peers if passed as a string array
        if (invokeSettings.targetPeers) {
            // Retrieved cached peer objects
            const targetPeerObjects = [];
            for (const name of invokeSettings.targetPeers) {
                const peer = this.peerCache.get(name);
                if (peer) {
                    targetPeerObjects.push(peer);
                }
            }
            // Set the peer objects in the transaction
            if (targetPeerObjects.length > 0) {
                transaction.setEndorsingPeers(targetPeerObjects);
            }
        } else if (invokeSettings.targetOrganizations) {
            if (Array.isArray(invokeSettings.targetOrganizations) && invokeSettings.targetOrganizations.length > 0) {
                transaction.setEndorsingOrganizations(...invokeSettings.targetOrganizations);
            } else {
                logger.warn(`${invokeSettings.targetOrganizations} is not a populated array, no orgs targetted`);
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
            invokeStatus.result = result;
            invokeStatus.verified = true;
            invokeStatus.SetStatusSuccess();
            invokeStatus.SetID(transaction.getTransactionId());
            return invokeStatus;
        } catch (err) {
            logger.error(`Failed to perform ${isSubmit ? 'submit' : 'query' } transaction [${invokeSettings.contractFunction}] using arguments [${invokeSettings.contractArguments}],  with error: ${err.stack ? err.stack : err}`);
            invokeStatus.SetStatusFail();
            invokeStatus.result = [];
            invokeStatus.SetID(transaction.getTransactionId());
            return invokeStatus;
        }
    }

    /**
     * Get the named contract for a named user
     * @param {string} invokerIdentity the user identity for interacting with the contract
     * @param {string} channelName the channel name the contract exists on
     * @param {string} contractId the name of the contract to return
     * @returns {FabricNetworkAPI.Contract} A contract that may be used to submit or evaluate transactions
     * @async
     */
    async _getUserContract(invokerIdentity, channelName, contractId) {
        logger.debug('Entering _getUserContract');
        // Determine the invoking user for this transaction
        let userName;
        if (invokerIdentity.startsWith('#')) {
            userName = invokerIdentity.substring(1);
        } else {
            userName = invokerIdentity;
        }

        const contractSet = this.userContracts.get(userName);

        // If no contract set found, there is a user configuration/test specification error, so it should terminate
        if (!contractSet) {
            throw Error(`No contracts for Invoker ${userName} found!`);
        }

        // Retrieve the named Network Contract for the invoking user from the Map
        const contract = contractSet.get(`${channelName}_${contractId}`);

        // If no contract found, there is a user configuration/test specification error, so it should terminate
        if (!contract) {
            throw Error(`Unable to find specified contract ${contractId} on channel ${channelName}!`);
        }

        logger.debug('Exiting _getUserContract');
        return contract;
    }

    //////////////////////////
    // PUBLIC API FUNCTIONS //
    //////////////////////////

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
        // Reset counter for new test round
        this.txIndex = -1;

        // Build Gateway Network Contracts for possible users and return the network object
        // - within submit/evaluate, a contract will be used for a nominated user
        await this._initializeContracts();

        // - use gateways to build a peer cache
        await this._initializePeerCache();

        // We are done - return the networkUtil object
        this.context = {
            networkInfo: this.networkUtil,
            clientIdx: this.workerIndex
        };

        return this.context;
    }

    /**
     * Initializes the Fabric adapter: sets up clients, admins, registrars, channels and contracts.
     * @param {boolean} workerInit unused
     * @async
     */
    async init() {
        const tlsInfo = this.networkUtil.isMutualTlsEnabled() ? 'mutual'
            : (this.networkUtil.isTlsEnabled() ? 'server' : 'none');
        logger.info(`Fabric SDK version: ${this.version.toString()}; TLS: ${tlsInfo}`);

        logger.warn(`Administrative actions are not possible with Fabric SDK version: ${this.version.toString()}`);
        await this._initConnector();
    }

    /**
     * Installs and initializes the specified contracts.
     * @async
     */
    async installSmartContract() {
        logger.warn(`Install smart contract not available with Fabric SDK version: ${this.version.toString()}`);
    }

    /**
     * Send a single request to the backing SUT.
     * @param {FabricRequestSettings} request The request object.
     */
    async _sendSingleRequest(request) {
        if (!request.hasOwnProperty('channel')) {
            const contractDetails = this.networkUtil.getContractDetails(request.contractId);
            if (!contractDetails) {
                throw new Error(`Could not find details for contract ID ${request.contractId}`);
            }
            request.channel = contractDetails.channel;
            request.contractId = contractDetails.id;
            request.contractVersion = contractDetails.version;
        }

        if (!request.invokerIdentity) {
            request.invokerIdentity = this.defaultInvoker;
        }

        return this._performGatewayTransaction(request, request.readOnly === undefined || !request.readOnly);
    }

    /**
     * Releases the resources of the adapter.
     *
     * @async
     */
    async releaseContext() {
        // Disconnect from all persisted user gateways
        for (const userName of this.userGateways.keys()) {
            const gateway = this.userGateways.get(userName);
            logger.info(`disconnecting gateway for user ${userName}`);
            gateway.disconnect();
        }

        // Clear peer cache
        this.peerCache.clear();
        this.context = undefined;
    }}

module.exports = LegacyV2FabricGateway;
