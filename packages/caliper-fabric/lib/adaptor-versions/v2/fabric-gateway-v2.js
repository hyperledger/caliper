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
const { BlockchainInterface, CaliperUtils, TxStatus, Version, ConfigUtil } = require('@hyperledger/caliper-core');

const FabricNetwork = require('../../fabricNetwork.js');
const ConfigValidator = require('../../configValidator.js');
const RegistrarHelper = require('./registrarHelper');

const logger = CaliperUtils.getLogger('adapters/fabric');

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
 * @typedef {Object} ChaincodeInvokeSettings
 *
 * @property {string} chaincodeId Required. The name/ID of the chaincode whose function
 *           should be invoked.
 * @property {string} chaincodeVersion Required. The version of the chaincode whose function
 *           should be invoked.
 * @property {string} chaincodeFunction Required. The name of the function that should be
 *           invoked in the chaincode.
 * @property {string[]} chaincodeArguments Optional. The list of {string} arguments that should
 *           be passed to the chaincode.
 * @property {Map<string, Buffer>} transientMap Optional. The transient map that should be
 *           passed to the chaincode.
 * @property {string} invokerIdentity Required. The name of the client who should invoke the
 *           chaincode. If an admin is needed, use the organization name prefixed with a # symbol.
 * @property {string} channel Required. The name of the channel whose chaincode should be invoked.
 * @property {string[]} targetPeers Optional. An array of endorsing
 *           peer names as the targets of the invoke. When this
 *           parameter is omitted the target list will include the endorsing peers assigned
 *           to the target chaincode, or if it is also omitted, to the channel.
 * @property {string} orderer Optional. The name of the orderer to whom the request should
 *           be submitted. If omitted, then the first orderer node of the channel will be used.
 */

/**
 * @typedef {Object} ChaincodeQuerySettings
 *
 * @property {string} chaincodeId Required. The name/ID of the chaincode whose function
 *           should be invoked.
 * @property {string} chaincodeVersion Required. The version of the chaincode whose function
 *           should be invoked.
 * @property {string} chaincodeFunction Required. The name of the function that should be
 *           invoked in the chaincode.
 * @property {string[]} chaincodeArguments Optional. The list of {string} arguments that should
 *           be passed to the chaincode.
 * @property {Map<string, Buffer>} transientMap Optional. The transient map that should be
 *           passed to the chaincode.
 * @property {string} invokerIdentity Required. The name of the client who should invoke the
 *           chaincode. If an admin is needed, use the organization name prefixed with a # symbol.
 * @property {string} channel Required. The name of the channel whose chaincode should be invoked.
 * @property {string[]} targetPeers Optional. An array of endorsing
 *           peer names as the targets of the invoke. When this
 *           parameter is omitted the target list will include the endorsing peers assigned
 *           to the target chaincode, or if it is also omitted, to the channel.
 * @property {boolean} countAsLoad Optional. Indicates whether to count this query as workload.
 */

/////////////////////////////
// END OF TYPE DEFINITIONS //
/////////////////////////////

/**
 * Implements {BlockchainInterface} for a Fabric backend, utilizing the SDK's Common Connection Profile.
 *
 * @property {Version} version Contains the version information about the used Fabric SDK.
 * @property {number} clientIndex The index of the client process using the adapter that is set in the constructor
 * @property {number} txIndex A counter for keeping track of the index of the currently submitted transaction.
 * @property {FabricNetwork} networkUtil Utility object containing easy-to-query information about the topology
 *           and settings of the network.
 * @property {RegistrarHelper} registrarHelper A RegistrarHelper used to help register and enrol new test clients
 * @property {string} defaultInvoker The name of the client to use if an invoker is not specified.
 * @property {number} configSmallestTimeout The timeout value to use when the user-provided timeout is too small.
 * @property {number} configDefaultTimeout The default timeout in milliseconds to use for invoke/query transactions.
 * @property {boolean} configCountQueryAsLoad Indicates whether queries should be counted as workload.
 * @property {boolean} configLocalHost Indicates whether to use the localhost default within the Fabric Gateway API
 * @property {boolean} configDiscovery Indicates whether to use discovery within the Fabric Gateway API
 * @property {string} eventStrategy Event strategy to use within the Fabric Gateway
 * @property {string} queryStrategy Query strategy to use within the Fabric Gateway
 * @property {Wallet} wallet The wallet containing all identities
 * @property {Map} userContracts A map of identities to contracts they may submit/evaluate
 * @property {Map} userGateways A map of identities to the gateway they are connected
 * @property {Map} peerCache A cache of peer objects
 */
class Fabric extends BlockchainInterface {
    /**
     * Initializes the Fabric adapter.
     * @param {string|object} networkConfig The relative or absolute file path, or the object itself of the Common Connection Profile settings.
     * @param {string} workspace_root The absolute path to the root location for the application configuration files.
     * @param {number} clientIndex the client index
     */
    constructor(networkConfig, workspace_root, clientIndex) {
        super(networkConfig);
        this.bcType = 'fabric';
        this.workspaceRoot = workspace_root;
        this.version = new Version(require('fabric-network/package').version);

        this.network = undefined;
        if (typeof networkConfig === 'string') {
            const configPath = CaliperUtils.resolvePath(networkConfig, workspace_root);
            this.network = CaliperUtils.parseYaml(configPath);
        } else if (typeof networkConfig === 'object' && networkConfig !== null) {
            // clone the object to prevent modification by other objects
            this.network = CaliperUtils.parseYamlString(CaliperUtils.stringifyYaml(networkConfig));
        } else {
            throw new Error('[FabricNetwork.constructor] Parameter \'networkConfig\' is neither a file path nor an object');
        }

        this.clientIndex = clientIndex;
        this.txIndex = -1;
        this.networkUtil = new FabricNetwork(this.network, workspace_root);
        this.defaultInvoker = Array.from(this.networkUtil.getClients())[0];

        this.wallet = undefined;
        this.userContracts = new Map();
        this.userGateways = new Map();
        this.peerCache = new Map();

        // Timeouts
        this.configSmallestTimeout = 1000;
        this.configDefaultTimeout = ConfigUtil.get(ConfigUtil.keys.Fabric.Timeout.InvokeOrQuery, 60000);
        this.configCountQueryAsLoad = ConfigUtil.get(ConfigUtil.keys.Fabric.CountQueryAsLoad, true);

        // Gateway adaptor
        this.configLocalHost = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.GatewayLocalHost, true);
        this.configDiscovery = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.Discovery, false);
        this.eventStrategy = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.EventStrategy, 'msp_all');
        this.queryStrategy = ConfigUtil.get(ConfigUtil.keys.Fabric.Gateway.QueryStrategy, 'msp_single');

        // validate the network
        ConfigValidator.validateNetwork(this.network, CaliperUtils.getFlowOptions(), this.configDiscovery, true);
    }

    ////////////////////////////////
    // INTERNAL UTILITY FUNCTIONS //
    ////////////////////////////////

    /**
     * Initialize the adaptor
     */
    async _initAdaptor() {
        const tlsInfo = this.networkUtil.isMutualTlsEnabled() ? 'mutual'
            : (this.networkUtil.isTlsEnabled() ? 'server' : 'none');
        logger.info(`Fabric SDK version: ${this.version.toString()}; TLS: ${tlsInfo}`);

        await this._prepareWallet();
        await this._initializeAdmins();
        // Initialize registrars *after* initialization of admins so that admins are not created
        this.registrarHelper = await RegistrarHelper.newWithNetwork(this.networkUtil);
        await this._initializeUsers();
        this.initPhaseCompleted = true;
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
            const fileWalletPath = this.networkUtil.getFileWalletPath();
            if (fileWalletPath) {
                // If a file wallet is provided, it is expected that *all* required identities are provided
                // Admin is a super-user identity, and is consequently optional
                const hasAdmin = await this.wallet.get(adminName);
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
                    await this._addToWallet(org, cryptoContent.signedCertPEM, cryptoContent.privateKeyPEM, adminName);
                }
            }
            logger.info(`${org}'s admin's materials are successfully loaded`);
        }
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
            const hasClient = await this.wallet.get(clientName);
            if (hasClient) {
                logger.info(`Client ${clientName} present in wallet: skipping client enrollment`);
                continue;
            } else {
                // Extract required information from the supplied caliper config
                const cryptoContent = this.networkUtil.getClientCryptoContent(clientName);
                if (cryptoContent) {
                    await this._addToWallet(orgName, cryptoContent.signedCertPEM.toString('utf8'), cryptoContent.privateKeyPEM.toString('utf8'), clientName);
                } else {
                    try {
                        // Check if there is a valid registrar to use for the org
                        if (this.registrarHelper.registrarExistsForOrg(orgName)) {
                            // Do we have an enrollment secret?
                            const enrollmentSecret = this.networkUtil.getClientEnrollmentSecret(clientName);
                            if (enrollmentSecret) {
                                // enrolled, so register with enrollment secret
                                const enrollment = await this.registrarHelper.enrollUserForOrg(orgName, clientName, enrollmentSecret);
                                await this._addToWallet(orgName, enrollment.certificate,  enrollment.key.toBytes(), clientName);
                            } else {
                                // Register and enrol
                                const secret = await this.registrarHelper.registerUserForOrg(orgName, clientName);
                                const enrollment = await this.registrarHelper.enrollUserForOrg(orgName, clientName, secret);
                                await this._addToWallet(orgName, enrollment.certificate,  enrollment.key.toBytes(), clientName);
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
    }

    /**
     * Add a user to the wallet under a provided name
     * @param {string} org, the organization name
     * @param {string} certificate the user certificate
     * @param {string} key the private key matching the certificate
     * @param {string} identityName the name to store the User as within the wallet
     * @async
     */
    async _addToWallet(org, certificate, key, identityName) {
        const identity = {
            credentials: {
                certificate: certificate,
                privateKey: key,
            },
            mspId: this.networkUtil.getMspIdOfOrganization(org),
            type: 'X.509',
        };

        logger.info(`Adding identity for identityName ${identityName} to wallet`);
        await this.wallet.put(identityName, identity);
        logger.info(`Identity ${identityName} created and imported to wallet`);
    }

    /**
     * Extract and persist Contracts from Gateway Networks for identities listed within the wallet
     * @async
     */
    async _initializeContracts() {
        // Prepare client contracts based on wallet identities only
        const walletIdentities = await this.wallet.list();
        for (const identity of walletIdentities) {
            logger.info(`Retrieving and persisting contract map for identity ${identity}`);
            // Retrieve
            const contractMap = await this._retrieveContractsForUser(identity);
            // Persist
            this.userContracts.set(identity, contractMap);
        }
    }

    /**
     * Retrieve all Contracts from the passed client gateway object
     * @param {string} userName, the unique client user name
     * @returns {Map<Contract>} A map of all Contracts retrieved from the client Gateway
     * @async
     */
    async _retrieveContractsForUser(userName) {

        // Retrieve the gateway for the passed user. The gateway object is persisted for easier cleanup.
        // - userName must match that created for wallet userId in init phases
        const gateway = await this._retrieveUserGateway(userName);
        this.userGateways.set(userName, gateway);

        // Work on all channels to build a contract map
        logger.info(`Generating contract map for user ${userName}`);
        const contractMap = new Map();
        const channels = this.networkUtil.getChannels();
        for (const channel of channels) {
            // retrieve the channel network
            const network = await gateway.getNetwork(channel);
            // Work on all chaincodes/smart contracts in the channel
            const chaincodes = this.networkUtil.getChaincodesOfChannel(channel);
            for (const chaincode of chaincodes) {
                const contract = await network.getContract(chaincode.id);
                contractMap.set(chaincode.id, contract);
            }
        }

        return contractMap;
    }

    /**
     * Retrieve a Gateway object for the passed userId
     * @param {string} userId string user id to use as the identity
     * @returns {FabricNet.Gateway} a gateway object for the passed user identity
     * @async
     */
    async _retrieveUserGateway(userId) {
        // Build options for the connection (this.wallet is set on _prepareWallet call)
        const opts = {
            wallet: this.wallet,
            identity: userId,
            discovery: {
                asLocalhost: this.configLocalHost,
                enabled: this.configDiscovery
            },
            eventHandlerOptions: {
                commitTimeout: this.configDefaultTimeout,
                strategy: EventStrategies[this.eventStrategy]
            },
            queryHandlerOptions: {
                requestTimeout: this.configDefaultTimeout,
                strategy: QueryStrategies[this.queryStrategy]
            }
        };

        // Optional on mutual auth
        if (this.networkUtil.isMutualTlsEnabled()) {
            opts.clientTlsIdentity = userId;
        }

        // Retrieve gateway using ccp and options
        const gateway = new Gateway();

        try {
            logger.info(`Connecting user ${userId} to a Network Gateway`);
            await gateway.connect(this.networkUtil.getNetworkObject(), opts);
            logger.info(`Successfully connected user ${userId} to a Network Gateway`);
        } catch (err) {
            logger.error(`Connecting user ${userId} to a Network Gateway failed with error: ${err}`);
        }

        // return the gateway object
        return gateway;
    }

    /**
     * Initialize channel objects for use in peer targeting. Requires user gateways to have been
     * formed in advance.
     */
    async _initializePeerCache() {

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
    }

    /**
     * Conditionally initializes a wallet depending on user provided options
     * @private
     */
    async _prepareWallet() {
        const fileWalletPath = this.networkUtil.getFileWalletPath();
        if (fileWalletPath) {
            logger.info(`Using defined file wallet path ${fileWalletPath}`);
            this.wallet = await Wallets.newFileSystemWallet(fileWalletPath);
        } else {
            logger.info('Creating new InMemoryWallet to persist user identities');
            this.wallet = await Wallets.newInMemoryWallet();
        }
    }

    /**
     * Perform a transaction using a Gateway contract
     * @param {object} context The context previously created by the Fabric adapter.
     * @param {ChaincodeInvokeSettings} invokeSettings The settings associated with the transaction submission.
     * @param {boolean} isSubmit boolean flag to indicate if the transaction is a submit or evaluate
     * @return {Promise<TxStatus>} The result and stats of the transaction invocation.
     * @async
     */
    async _performGatewayTransaction(context, invokeSettings, isSubmit) {

        // Retrieve the existing contract and a client
        const smartContract = await this._getUserContract(invokeSettings.invokerIdentity, invokeSettings.chaincodeId);

        // Create a transaction
        const transaction = smartContract.createTransaction(invokeSettings.chaincodeFunction);

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
                targetPeerObjects.push(peer);
            }
            // Set the peer objects in the transaction
            transaction.setEndorsingPeers(targetPeerObjects);
        }

        try {
            let result;
            if (isSubmit) {
                if (context.engine) {
                    context.engine.submitCallback(1);
                }
                invokeStatus.Set('request_type', 'transaction');
                result = await transaction.submit(...invokeSettings.chaincodeArguments);
            } else {
                const countAsLoad = invokeSettings.countAsLoad === undefined ? this.configCountQueryAsLoad : invokeSettings.countAsLoad;
                if (context.engine && countAsLoad) {
                    context.engine.submitCallback(1);
                }
                invokeStatus.Set('request_type', 'query');
                result = await transaction.evaluate(...invokeSettings.chaincodeArguments);
            }
            invokeStatus.result = result;
            invokeStatus.verified = true;
            invokeStatus.SetStatusSuccess();
            invokeStatus.SetID(transaction.getTransactionId());
            return invokeStatus;
        } catch (err) {
            logger.error(`Failed to perform ${isSubmit ? 'submit' : 'query' } transaction [${invokeSettings.chaincodeFunction}] using arguments [${invokeSettings.chaincodeArguments}],  with error: ${err.stack ? err.stack : err}`);
            invokeStatus.SetStatusFail();
            invokeStatus.result = [];
            invokeStatus.SetID(transaction.getTransactionId());
            return invokeStatus;
        }
    }

    /**
     * Get the named contract for a named user
     * @param {string} invokerIdentity the user identity for interacting with the contract
     * @param {string} contractName the name of the contract to return
     * @returns {FabricNetworkAPI.Contract} A contract that may be used to submit or evaluate transactions
     * @async
     */
    async _getUserContract(invokerIdentity, contractName) {

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
        const contract = contractSet.get(contractName);

        // If no contract found, there is a user configuration/test specification error, so it should terminate
        if (!contract) {
            throw Error(`No contract named ${contractName} found!`);
        }

        return contract;
    }

    //////////////////////////
    // PUBLIC API FUNCTIONS //
    //////////////////////////

    /**
     * Retrieve the blockchain type the implementation relates to
     * @returns {string} the blockchain type
     */
    getType() {
        return this.bcType;
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
        // Reset counter for new test round
        this.txIndex = -1;

        // Build Gateway Network Contracts for possible users and return the network object
        // - within submit/evaluate, a contract will be used for a nominated user
        await this._initializeContracts();

        // - use gateways to build a peer cache
        await this._initializePeerCache();

        // We are done - return the networkUtil object
        return {
            networkInfo: this.networkUtil,
            clientIdx: this.clientIndex
        };
    }

    /**
     * Initializes the Fabric adapter: sets up clients, admins, registrars, channels and chaincodes.
     * @param {boolean} workerInit unused
     * @async
     */
    async init() {
        const tlsInfo = this.networkUtil.isMutualTlsEnabled() ? 'mutual'
            : (this.networkUtil.isTlsEnabled() ? 'server' : 'none');
        logger.info(`Fabric SDK version: ${this.version.toString()}; TLS: ${tlsInfo}`);

        logger.warn(`Administrative actions are not possible with Fabric SDK version: ${this.version.toString()}`);
        await this._initAdaptor();
    }

    /**
     * Installs and initializes the specified chaincodes.
     * @async
     */
    async installSmartContract() {
        logger.warn(`Install smart contract not available with Fabric SDK version: ${this.version.toString()}`);
    }

    /**
     * Invokes the specified chaincode according to the provided settings.
     *
     * @param {object} context The context previously created by the Fabric adapter.
     * @param {string} contractID The unique contract ID of the target chaincode.
     * @param {string} contractVersion Unused.
     * @param {ChaincodeInvokeSettings|ChaincodeInvokeSettings[]} invokeSettings The settings (collection) associated with the (batch of) transactions to submit.
     * @param {number} timeout The timeout override for the whole transaction life-cycle in seconds.
     * @return {Promise<TxStatus[]>} The result and stats of the transaction invocation.
     */
    async invokeSmartContract(context, contractID, contractVersion, invokeSettings, timeout) {
        const promises = [];
        let settingsArray;

        if (!Array.isArray(invokeSettings)) {
            settingsArray = [invokeSettings];
        } else {
            settingsArray = invokeSettings;
        }

        for (const settings of settingsArray) {
            const contractDetails = this.networkUtil.getContractDetails(contractID);
            if (!contractDetails) {
                throw new Error(`Could not find details for contract ID ${contractID}`);
            }

            settings.channel = contractDetails.channel;
            settings.chaincodeId = contractDetails.id;
            settings.chaincodeVersion = contractDetails.version;

            if (!settings.invokerIdentity) {
                settings.invokerIdentity = this.defaultInvoker;
            }

            promises.push(this._performGatewayTransaction(context, settings, true));
        }

        return await Promise.all(promises);
    }

    /**
     * Queries the specified chaincode according to the provided settings.
     *
     * @param {object} context The context previously created by the Fabric adapter.
     * @param {string} contractID The unique contract ID of the target chaincode.
     * @param {string} contractVersion Unused.
     * @param {ChaincodeQuerySettings|ChaincodeQuerySettings[]} querySettings The settings (collection) associated with the (batch of) query to submit.
     * @param {number} timeout Unused - timeouts are set using globally defined values in the gateway construction phase.
     * @return {Promise<TxStatus[]>} The result and stats of the transaction query.
     */
    async querySmartContract(context, contractID, contractVersion, querySettings, timeout) {
        const promises = [];
        let settingsArray;

        if (!Array.isArray(querySettings)) {
            settingsArray = [querySettings];
        } else {
            settingsArray = querySettings;
        }

        for (const settings of settingsArray) {
            const contractDetails = this.networkUtil.getContractDetails(contractID);
            if (!contractDetails) {
                throw new Error(`Could not find details for contract ID ${contractID}`);
            }

            settings.channel = contractDetails.channel;
            settings.chaincodeId = contractDetails.id;
            settings.chaincodeVersion = contractDetails.version;

            if (!settings.invokerIdentity) {
                settings.invokerIdentity = this.defaultInvoker;
            }

            promises.push(this._performGatewayTransaction(context, settings, false));
        }

        return await Promise.all(promises);
    }

    /**
     * Releases the resources of the adapter.
     *
     * @param {object} context Unused.
     * @async
     */
    async releaseContext(context) {
        // Disconnect from all persisted user gateways
        for (const userName of this.userGateways.keys()) {
            const gateway = this.userGateways.get(userName);
            logger.info(`disconnecting gateway for user ${userName}`);
            gateway.disconnect();
        }

        // Clear peer cache
        this.peerCache.clear();
    }}

module.exports = Fabric;
