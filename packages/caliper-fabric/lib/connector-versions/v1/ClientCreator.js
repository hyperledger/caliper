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

const FabricClient = require('fabric-client');
const {CaliperUtils} = require('@hyperledger/caliper-core');

const logger = CaliperUtils.getLogger('connectors/v1/ClientCreator');


/** */
class ClientCreator {

    /**
     * @param {*} connectorConfiguration the connector configuration instance
     */
    constructor(connectorConfiguration) {
        this.connectorConfiguration = connectorConfiguration;
        this.walletFacade = this.connectorConfiguration.getWalletFacade();
    }

    /**
     * create a Fabric Client for all the identities in the network configuration
     * @async
     */
    async createFabricClientsForAllIdentities() {
        const clientMaps = [];
        for (const organization of this.connectorConfiguration.getOrganizations()) {
            clientMaps.push(await this._createFabricClientsForAllIdentitiesInOrganization(organization));
        }
        // merge the array of maps into a single map
        const aliasNameToFabricClientMap = clientMaps.reduce((combined, single) => new Map([...combined, ...single]), new Map());

        return aliasNameToFabricClientMap;
    }

    /**
     * @param {*} mspId the mspid of the organization to create fabric clients
     * @returns {Promise<Map>} map of aliasNames to equivalent Fabric Client instance
     * @async
     * @private
     */
    async _createFabricClientsForAllIdentitiesInOrganization(mspId) {
        const aliasNameToFabricClientMap = new Map();
        const aliasNamesForOrganization = await this.connectorConfiguration.getAliasNamesForOrganization(mspId);
        const connectionProfile = (await this.connectorConfiguration.getConnectionProfileDefinitionForOrganization(mspId)).getConnectionProfile();

        for (const aliasName of aliasNamesForOrganization) {
            const fabricClientForAliasName = await this._createClientForAliasNameInOrganization(connectionProfile, aliasName);
            aliasNameToFabricClientMap.set(aliasName, fabricClientForAliasName);
        }

        return aliasNameToFabricClientMap;
    }

    /**
     * @param {*} connectionProfile the connection profile
     * @param {string} aliasName the aliasName in the wallet to use for the identity of the client
     * @returns {Promise<Client>} The fabric client instance
     * @async
     * @private
     */
    async _createClientForAliasNameInOrganization(connectionProfile, aliasName) {
        logger.info(`creating fabric client for ${aliasName}`);
        const fabricClient = FabricClient.loadFromConfig(connectionProfile);
        const exportedIdentity = await this.walletFacade.export(aliasName);

        // Rather than catch any errors from this call, will let errors be sent
        // directly up cause we won't do anything useful with the error unless the
        // error itself is not helpful.
        await fabricClient.createUser({
            username: aliasName,
            mspid: exportedIdentity.mspid,
            cryptoContent: {
                privateKeyPEM: Buffer.from(exportedIdentity.privateKey),
                signedCertPEM: Buffer.from(exportedIdentity.certificate)
            },
            skipPersistence: true
        });

        if (this.connectorConfiguration.isMutualTLS()) {
            fabricClient.setTlsClientCertAndKey(exportedIdentity.certificate, exportedIdentity.privateKey);
        }

        return fabricClient;
    }
}

module.exports = ClientCreator;
