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
const ClientCreator = require('./ClientCreator');

const logger = CaliperUtils.getLogger('connectors/v1/FabricChaincodeOperations');

/** */
class FabricChaincodeOperations {

    /**
     * @param {*} connectorConfiguration the connector configuration
     */
    constructor(connectorConfiguration) {

        this.connectorConfiguration = connectorConfiguration;
        this.aliasNameToFabricClientMap = null;

        this.configSleepAfterInstantiateContract = ConfigUtil.get(ConfigUtil.keys.Fabric.SleepAfter.InstantiateContract, 5000);
        this.configOverwriteGopath = ConfigUtil.get(ConfigUtil.keys.Fabric.OverwriteGopath, true);
        this.configContractInstantiateTimeout = ConfigUtil.get(ConfigUtil.keys.Fabric.Timeout.ContractInstantiate, 300000);
        this.configContractInstantiateEventTimeout = ConfigUtil.get(ConfigUtil.keys.Fabric.Timeout.ContractInstantiateEvent, 300000);
    }

    /**
     * install and instantiate all chaincodes as required that are defined in the connector configuration
     * @async
     */
    async installAndInstantiateChaincodes() {
        await this._installChaincodes();
        const atLeastOneChaincodeInstantiated = await this._instantiateChaincodes();
        if (atLeastOneChaincodeInstantiated) {
            logger.info(`Sleeping ${this.configSleepAfterInstantiateContract / 1000.0}s...`);
            await CaliperUtils.sleep(this.configSleepAfterInstantiateContract);
        }
    }

    /**
     * Install All the defined chaincodes that are requested to be installed in the connector configuration
     * @async
     * @private
     */
    async _installChaincodes() {
        if (this.configOverwriteGopath) {
            process.env.GOPATH = CaliperUtils.resolvePath('.');
        }

        const channelNames = this.connectorConfiguration.getAllChannelNames();
        for (const channelName of channelNames) {
            logger.info(`Installing contracts for ${channelName}...`);

            // proceed cc by cc for the channel
            const contractDefinitions = this.connectorConfiguration.getContractDefinitionsForChannelName(channelName);
            for (const contractDefinition of contractDefinitions) {

                if (!contractDefinition.install) {
                    continue;
                }

                const peersInChannelByOrganizationMap = await this.connectorConfiguration.getEndorsingPeersInChannelByOrganizationMap();
                const peersInOrganizationMap = peersInChannelByOrganizationMap.get(channelName);
                const allChaincodeInstallErrors = [];

                for (const [organization, peersInOrganization] of peersInOrganizationMap) {
                    const adminForOrganization = await this._getAdminClientForOrganization(organization);
                    const queryInstalledErrors = [];
                    const listOfPeersInOrganizationToInstallOn = [];

                    // TODO: support contractDefinitions.install.targetPeers ? they would need to go through the check of whether
                    // the chaincode has already been installed
                    for (const peerInOrganization of peersInOrganization) {
                        try {
                            /** {@link ChaincodeQueryResponse} */
                            const resp = await adminForOrganization.queryInstalledChaincodes(peerInOrganization, true);
                            if (resp.chaincodes.some(cc => cc.name === contractDefinition.id && cc.version === contractDefinition.install.version)) {
                                logger.info(`${contractDefinition.id}@${contractDefinition.install.version} is already installed on ${peerInOrganization}`);
                                continue;
                            }

                            listOfPeersInOrganizationToInstallOn.push(peerInOrganization);
                        } catch (err) {
                            queryInstalledErrors.push(new Error(`Couldn't query installed contracts on ${peerInOrganization}: ${err.message}`));
                        }
                    }

                    if (queryInstalledErrors.length > 0) {
                        let errorMsg = `Could not query whether ${contractDefinition.id}@${contractDefinition.install.version} is installed on some peers of ${channelName}:`;
                        for (const err of queryInstalledErrors) {
                            errorMsg += `\n\t- ${err.message}`;
                        }

                        logger.error(errorMsg);
                        throw new Error(`Could not query whether ${contractDefinition.id}@${contractDefinition.install.version} is installed on some peers of ${channelName}`);
                    }

                    if (listOfPeersInOrganizationToInstallOn.length < 1) {
                        logger.info(`No Peers found to need ${contractDefinition.id}@${contractDefinition.install.version} to be installed for ${channelName}, skipping it`);
                        continue;
                    }

                    const chaincodeInstallErrorsForOrganization = await this._installChaincodeOntoOrganizationPeers(adminForOrganization, contractDefinition, listOfPeersInOrganizationToInstallOn);

                    if (chaincodeInstallErrorsForOrganization.length === 0) {
                        logger.info(`${contractDefinition.id}@${contractDefinition.install.version} successfully installed on ${organization}'s peers: ${listOfPeersInOrganizationToInstallOn.toString()}`);
                    }

                    allChaincodeInstallErrors.push(...chaincodeInstallErrorsForOrganization);
                }

                if (allChaincodeInstallErrors.length > 0) {
                    let errorMsg = `Could not install ${contractDefinition.id}@${contractDefinition.install.version} on some peers of ${channelName}:`;
                    for (const err of allChaincodeInstallErrors) {
                        errorMsg += `\n\t- ${err.message}`;
                    }

                    logger.error(errorMsg);
                    throw new Error(`Could not install ${contractDefinition.id}@${contractDefinition.install.version} on some peers of ${channelName}`);
                }
            }
        }
    }

    /**
     * Install chaincode onto the appropriate Peers for a specific organization
     * @param {*} adminForOrganization the admin fabric client for the organization
     * @param {*} contractDefinition the contract definition that defines the install requirements for the chaincode
     * @param {*} listOfPeersInOrganizationToInstallOn the list of peers in the organization to install on
     * @returns {Promise<[Error]>} Errors encountered during install if any
     * @async
     * @private
     */
    async _installChaincodeOntoOrganizationPeers(adminForOrganization, contractDefinition, listOfPeersInOrganizationToInstallOn) {
        const txId = adminForOrganization.newTransactionID(true);
        /** @{ChaincodeInstallRequest} */
        const request = {
            targets: listOfPeersInOrganizationToInstallOn,
            chaincodePath: contractDefinition.install.language === 'golang' ? contractDefinition.install.path : CaliperUtils.resolvePath(contractDefinition.install.path),
            chaincodeId: contractDefinition.id,
            chaincodeVersion: contractDefinition.install.version,
            chaincodeType: contractDefinition.install.language,
            txId: txId
        };

        // metadata (like CouchDB indices) are only supported since Fabric v1.1
        if (CaliperUtils.checkProperty(contractDefinition.install, 'metadataPath')) {
            request.metadataPath = CaliperUtils.resolvePath(contractDefinition.install.metadataPath);
        }

        // install to necessary peers of org and process the results
        try {
            /** @link{ProposalResponseObject} */
            const propRespObject = await adminForOrganization.installChaincode(request);
            CaliperUtils.assertDefined(propRespObject);

            /** Array of @link{ProposalResponse} objects */
            const proposalResponses = propRespObject[0];
            CaliperUtils.assertDefined(proposalResponses);

            const errors = [];

            proposalResponses.forEach((propResponse, index) => {
                if (propResponse instanceof Error) {
                    const errMsg = `Install proposal error for ${contractDefinition.id}@${contractDefinition.install.version} on ${listOfPeersInOrganizationToInstallOn[index]}: ${propResponse.message}`;
                    errors.push(new Error(errMsg));
                    return;
                }

                /** @link{ProposalResponse} */
                CaliperUtils.assertProperty(propResponse, 'propResponse', 'response');

                /** @link{ResponseObject} */
                const response = propResponse.response;
                CaliperUtils.assertProperty(response, 'response', 'status');

                if (response.status !== 200) {
                    const errMsg = `Unsuccessful install status for ${contractDefinition.id}@${contractDefinition.install.version} on ${listOfPeersInOrganizationToInstallOn[index]}: ${propResponse.response.message}`;
                    errors.push(new Error(errMsg));
                }
            });

            return errors;

        } catch (err) {
            throw new Error(`Couldn't install ${contractDefinition.id}@${contractDefinition.install.version} on peers ${listOfPeersInOrganizationToInstallOn.toString()}: ${err.message}`);
        }
    }

    /**
     * Instantiates the contracts on their channels.
     * @return {boolean} True, if at least one contract was instantiated. Otherwise, false.
     * @private
     * @async
     */
    async _instantiateChaincodes() {
        let atLeastOneChaincodeInstantiated = false;
        const channelNames = this.connectorConfiguration.getAllChannelNames();
        for (const channelName of channelNames) {

            // proceed cc by cc for the channel
            const contractDefinitions = this.connectorConfiguration.getContractDefinitionsForChannelName(channelName);
            for (const contractDefinition of contractDefinitions) {

                if (!contractDefinition.install) {
                    continue;
                }

                logger.info(`Instantiating ${contractDefinition.id}@${contractDefinition.install.version} in ${channelName}. This might take some time...`);

                const peersInChannelByOrganizationMap = await this.connectorConfiguration.getEndorsingPeersInChannelByOrganizationMap();
                const peersInOrganizationMap = peersInChannelByOrganizationMap.get(channelName);
                const mainOrganization = peersInOrganizationMap.keys().next().value;
                const endorsingPeersInChannel = await this._getEndorsingPeersInChannel(channelName);
                const adminForMainOrganization = await this._getAdminClientForOrganization(mainOrganization);

                await this._instantiateChaincodeOnChannel(adminForMainOrganization, channelName, contractDefinition, endorsingPeersInChannel);
                atLeastOneChaincodeInstantiated = true;
            }
        }

        return atLeastOneChaincodeInstantiated;
    }

    /**
     * Instantiate a specific chaincode on a specific channel
     * @param {*} organizationAdminInChannel An Admin whose organization is in the channel
     * @param {*} channelName The name of the channel
     * @param {*} contractDefinition The contract definition that defined the chaincode that was installed and optionally instantiation parameters
     * @param {*} endorsingPeersInChannel All channel endorsing peers that will endorse the instantiation (ensures )
     * @returns {Promise<boolean>} true if the chaincode was successfully instantiated
     */
    async _instantiateChaincodeOnChannel(organizationAdminInChannel, channelName, contractDefinition, endorsingPeersInChannel) {
        /** @link{ChaincodeQueryResponse} */
        let queryResponse;
        try {
            queryResponse = await organizationAdminInChannel.getChannel(channelName, true).queryInstantiatedChaincodes(endorsingPeersInChannel[0], true);
        } catch (err) {
            throw new Error(`Couldn't query whether ${contractDefinition.id}@${contractDefinition.install.version} is instantiated on ${endorsingPeersInChannel[0]}: ${err.message}`);
        }

        CaliperUtils.assertDefined(queryResponse);
        CaliperUtils.assertProperty(queryResponse, 'queryResponse', 'chaincodes');

        if (queryResponse.chaincodes.some(
            cc => cc.name === contractDefinition.id && cc.version === contractDefinition.install.version)) {
            logger.info(`${contractDefinition.id}@${contractDefinition.install.version} is already instantiated in ${channelName}`);
            return;
        }

        const txId = organizationAdminInChannel.newTransactionID(true);
        /** @link{ContractInstantiateUpgradeRequest} */
        const request = {
            targets: endorsingPeersInChannel,
            chaincodeId: contractDefinition.id,
            chaincodeVersion: contractDefinition.install.version,
            chaincodeType: contractDefinition.install.language,  // TODO: is this required ?
            args: contractDefinition.instantiate && contractDefinition.instantiate.initArguments ? contractDefinition.instantiate.initArguments : [],
            fcn: contractDefinition.instantiate && contractDefinition.instantiate.initFunction ? contractDefinition.instantiate.initFunction : 'init',
            transientMap: this._createTransientMap(contractDefinition),
            txId: txId
        };

        // check contract language
        // other contracts types are not supported in every version
        // TODO: maybe this should be in install
        if (!['golang', 'node', 'java'].includes(contractDefinition.install.language)) {
            throw new Error(`${contractDefinition.id}@${contractDefinition.version} in ${channelName}: unknown contract type ${contractDefinition.install.language}`);
        }

        // check private collection configuration
        if (contractDefinition.instantiate && CaliperUtils.checkProperty(contractDefinition.instantiate, 'collectionsConfig')) {
            request['collections-config'] = contractDefinition.instantiate.collectionsConfig;
        }

        if (contractDefinition.instantiate && CaliperUtils.checkProperty(contractDefinition.instantiate, 'endorsementPolicy')) {
            request['endorsement-policy'] = contractDefinition.instantiate.endorsementPolicy;
            // this.networkUtil.getDefaultEndorsementPolicy(channel, { id: ccObject.id, version: ccObject.version }),  // TODO
        }

        /** @link{ProposalResponseObject} */
        let response;
        try {
            response = await organizationAdminInChannel.getChannel(channelName, true).sendInstantiateProposal(request, this.configContractInstantiateTimeout);
        } catch (err) {
            throw new Error(`Couldn't endorse ${contractDefinition.id}@${contractDefinition.install.version} in ${channelName} on peers [${endorsingPeersInChannel.toString()}]: ${err.message}`);
        }

        CaliperUtils.assertDefined(response);

        /** @link{Array<ProposalResponse>} */
        const proposalResponses = response[0];
        /** @link{Proposal} */
        const proposal = response[1];
        CaliperUtils.assertDefined(proposalResponses);
        CaliperUtils.assertDefined(proposal);

        // check each response
        proposalResponses.forEach((propResp, index) => {
            CaliperUtils.assertDefined(propResp);
            // an Error is returned for a rejected proposal
            if (propResp instanceof Error) {
                throw new Error(`Invalid endorsement for ${contractDefinition.id}@${contractDefinition.install.version} in ${channelName} from ${endorsingPeersInChannel[index]}: ${propResp.message}`);
            } else if (propResp.response.status !== 200) {
                throw new Error(`Invalid endorsement for ${contractDefinition.id}@${contractDefinition.install.version} in ${channelName} from ${endorsingPeersInChannel[index]}: status code ${propResp.response.status}`);
            }
        });

        // connect to every event source of every org in the channel
        const eventSources = this._assembleTargetEventSources(organizationAdminInChannel, channelName, endorsingPeersInChannel);
        const eventPromises = [];

        try {
            // NOTE: everything is resolved, errors are signaled through an Error object
            // this makes error handling and reporting easier
            eventSources.forEach((channelEventHub) => {
                const promise = new Promise((resolve) => {
                    const timeoutHandle = setTimeout(() => {
                        // unregister manually
                        channelEventHub.unregisterTxEvent(txId.getTransactionID(), false);
                        resolve(new Error(`Commit timeout for ${contractDefinition.id}@${contractDefinition.install.version} in ${channelName} from ${channelEventHub.getName()}`));
                    }, this.configContractInstantiateEventTimeout);

                    channelEventHub.registerTxEvent(txId.getTransactionID(), (tx, code) => {
                        clearTimeout(timeoutHandle);
                        if (code !== 'VALID') {
                            resolve(new Error(`Invalid commit code for ${contractDefinition.id}@${contractDefinition.install.version} in ${channelName} from ${channelEventHub.getName()}: ${code}`));
                        } else {
                            resolve(code);
                        }
                    }, /* Error handler */ (err) => {
                        clearTimeout(timeoutHandle);
                        resolve(new Error(`Event hub error from ${channelEventHub.getName()} during instantiating ${contractDefinition.id}@${contractDefinition.install.version} in ${channelName}: ${err.message}`));
                    });

                    channelEventHub.connect();
                });

                eventPromises.push(promise);
            });

            /** @link{TransactionRequest} */
            const ordererRequest = {
                txId: txId,
                proposalResponses: proposalResponses,
                proposal: proposal
            };

            /** @link{BroadcastResponse} */
            let broadcastResponse;
            try {
                broadcastResponse = await organizationAdminInChannel.getChannel(channelName, true).sendTransaction(ordererRequest);
            } catch (err) {
                throw new Error(`Orderer error for instantiating ${contractDefinition.id}@${contractDefinition.install.version} in ${channelName}: ${err.message}`);
            }

            CaliperUtils.assertDefined(broadcastResponse);
            CaliperUtils.assertProperty(broadcastResponse, 'broadcastResponse', 'status');

            if (broadcastResponse.status !== 'SUCCESS') {
                throw new Error(`Orderer error for instantiating ${contractDefinition.id}@${contractDefinition.install.version} in ${channelName}: ${broadcastResponse.status}`);
            }

            // since every event promise is resolved, this shouldn't throw an error
            const eventResults = await Promise.all(eventPromises);

            // if we received an error, propagate it
            if (eventResults.some(er => er instanceof Error)) {
                let errMsg = `The following errors occured while instantiating ${contractDefinition.id}@${contractDefinition.install.version} in ${channelName}:`;
                let err; // keep the last error
                for (const eventResult of eventResults) {
                    if (eventResult instanceof Error) {
                        err = eventResult;
                        errMsg += `\n\t- ${eventResult.message}`;
                    }
                }

                logger.error(errMsg);
                throw err;
            }

            logger.info(`Successfully instantiated ${contractDefinition.id}@${contractDefinition.install.version} in ${channelName}`);
            return true;
        } finally {
            eventSources.forEach(channelEventHub => {
                if (channelEventHub.isconnected()) {
                    channelEventHub.disconnect();
                }
            });
        }
    }

    /**
     * Assembles the event sources based on explicitly given target peers.
     * @param {Client} organizationAdminInChannel a fabric client
     * @param {string} channelName The name of channel containing the target peers. Doesn't matter if peer-level event service is used in compatibility mode.
     * @param {string[]} targetPeers The list of peers to connect to.
     * @return {ChannelEventHub[]} The list of event sources.
     * @private
     */
    _assembleTargetEventSources(organizationAdminInChannel, channelName, targetPeers) {
        const eventSources = [];
        for (const peer of targetPeers) {
            const eventHub = organizationAdminInChannel.getChannel(channelName, true).newChannelEventHub(peer);
            eventSources.push(eventHub);
        }

        return eventSources;
    }

    /**
     * Create a transient map from initTransientMap definition in a contract definition
     * @param {*} contractDefinition The contract definition.
     * @returns {Map} the transient Map
     * @private
     */
    _createTransientMap(contractDefinition) {
        const map = {};

        if (!contractDefinition.instantiate || !CaliperUtils.checkProperty(contractDefinition.instantiate, 'initTransientMap')) {
            return map;
        }

        for (const key in contractDefinition.instantiate.initTransientMap) {
            if (!contractDefinition.instantiate.initTransientMap.hasOwnProperty(key)) {
                continue;
            }

            const value = contractDefinition.instantiate.initTransientMap[key];
            map[key.toString()] = Buffer.from(value.toString());
        }

        return map;
    }

    /**
     * get a list of all the endorsing peers in the channel by looking at one of the connection profiles for an organization
     * in the channel
     * @param {*} channelName The name of the channel
     * @async
     * @private
     */
    async _getEndorsingPeersInChannel(channelName) {
        const peersInChannelByOrganizationMap = await this.connectorConfiguration.getEndorsingPeersInChannelByOrganizationMap();
        const peersInOrganizationMap = peersInChannelByOrganizationMap.get(channelName);

        if (peersInOrganizationMap.size === 0) {
            throw new Error(`could not find any organisations with peers for channel ${channelName}`);
        }

        const mainOrganization = peersInOrganizationMap.keys().next().value;
        const connectionProfileDefinition = await this.connectorConfiguration.getConnectionProfileDefinitionForOrganization(mainOrganization);
        return connectionProfileDefinition.getEndorsingPeersInChannel(channelName);
    }

    /**
     * get an admin client instance for the specified organization
     *
     * @param {*} organization organization
     * @async
     * @private
     */
    async _getAdminClientForOrganization(organization) {
        if (!this.aliasNameToFabricClientMap) {
            const clientCreator = new ClientCreator(this.connectorConfiguration);
            this.aliasNameToFabricClientMap = await clientCreator.createFabricClientsForAllIdentities();
        }

        const adminAliasNames = this.connectorConfiguration.getAdminAliasNamesForOrganization(organization);
        if (adminAliasNames.length === 0) {
            throw new Error(`No Organization admin for ${organization} has been declared in the network configuration`);
        }

        return this.aliasNameToFabricClientMap.get(adminAliasNames[0]);
    }
}

module.exports = FabricChaincodeOperations;
