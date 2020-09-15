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

/**
 * A class to handle identities defined via the connector configuration
 */
class IdentityManager {

    /**
     * @param {IWalletFacadeFactory} walletFacadeFactory instance of a WalletFacadeFactory used to create wallet facades
     * @param {*} organizations The organizations block from the connector configuration
     */
    constructor(walletFacadeFactory, organizations) {
        this.walletFacadeFactory = walletFacadeFactory;
        this.organizations = organizations;
        this.defaultMspId = null;
        this.inMemoryWalletFacade = null;
    }

    /**
     * initialize this Identity Manager
     * @async
     */
    async initialize() {
        this.inMemoryWalletFacade = await this.walletFacadeFactory.create();
        await this._parseOrganizations();
    }

    /**
     * Get an alias name which can be used with a wallet for the unique identity name
     * @param {string} mspId The msp ID of the organization that owns the identity
     * @param {string} identityName the identity name the organization it associates with the identity
     * @returns {string} the unique alias name that will be in the wallet
     */
    getAliasNameFromOrganizationAndIdentityName(mspId, identityName) {
        if (mspId === this.defaultMspId) {
            return identityName;
        }

        return `${this._getPrefixForIdentityNameFromOrganisation(mspId)}${identityName}`;
    }

    /**
     * Get a list of all the alias names for an organization that will be in the wallet
     * @param {string} mspId the msp ID of the organization
     * @returns {string[]} a list of all the aliases or a blank array if there are none
     * @async
     */
    async getAliasNamesForOrganization(mspId) {
        const walletIdentityNames = await this.inMemoryWalletFacade.getAllIdentityNames();

        return walletIdentityNames.filter((identityName) => {
            if (mspId !== this.defaultMspId) {
                return identityName.startsWith(this._getPrefixForIdentityNameFromOrganisation(mspId));
            }

            return identityName.search(/^_..*_/) === -1;
        });
    }

    /**
     * Get the fabric node sdk version specific in memory wallet instance containing
     * all the loaded identities
     * @returns {*} a fabric node sdk version specific in memory wallet
     */
    getWallet() {
        return this.inMemoryWalletFacade.getWallet();
    }

    /**
     * Define and return the non default organization prefix
     * @param {string} mspId The msp ID
     * @returns {string} The alias prefix
     * @private
     */
    _getPrefixForIdentityNameFromOrganisation(mspId) {
        return `_${mspId}_`;
    }

    /**
     * Add an identity to the in memory wallet
     * @param {*} mspId The msp ID of the organization
     * @param {*} identityName The identity name that represents the identity for the organization
     * @param {*} certificate The pem encoded certificate
     * @param {*} privateKey The pem encoded private key
     * @async
     * @private
     */
    async _addToWallet(mspId, identityName, certificate, privateKey) {
        const alias = this.getWalletAliasFromOrganizationAndIdentityName(mspId, identityName);
        this.inMemoryWalletFacade.import(alias, mspId, certificate, privateKey);
    }

    /**
     * Parse the organizations block
     * @private
     * @async
     */
    async _parseOrganizations() {
        if (this.organizations &&
            Array.isArray(this.organizations) &&
            this.organizations.length > 0) {
            this.defaultMspId = this.organizations[0].mspid;
            if (!this.defaultMspId || this.defaultMspId.length === 0) {
                throw new Error('No mspid has been defined for the first organization');
            }

            for (const organizationIndex in this.organizations) {
                const organization = this.organizations[organizationIndex];

                if (organizationIndex !== '0') {
                    if (organization.mspid === this.defaultMspId) {
                        throw new Error('More than 1 organization with the same mspid is not allowed');
                    }
                    if (!organization.mspid || organization.mspid.length === 0) {
                        throw new Error('At least 1 organization has not specified the mspid property');
                    }
                }

                if (organization.identities) {

                    if (organization.identities.certificates) {
                        this._extractIdentitiesFromCertificateAndPrivateKeyArray(organization.identities.certificates);
                    }

                    if (organization.identities.wallet) {
                        await this._extractIdentitiesFromWallet(organization.identities.wallet);
                    }

                    if (organization.identities.credentialStore) {
                        await this._extractIdentitiesFromCredentialStore(organization.identities.credentialStore);
                    }

                }
            }
        } else {
            throw new Error('No organizations have been defined');
        }
    }

    /**
     * Extract identities from a fabric node sdk 1.4 credential store and store in the in memory wallet
     * @param {*} credentialStore the credential store information
     * @async
     * @private
     */
    async _extractIdentitiesFromCredentialStore(credentialStore) {
        // TODO: To be implemented
    }

    /**
     * Extract identities from a version specific wallet and store in the in memory wallet
     * @param {*} wallet the wallet information
     * @async
     * @private
     */
    async _extractIdentitiesFromWallet(wallet) {
        // TODO: To be implemented
    }

    /**
     * Extract the identities from the array of identities and store in the in memory wallet
     * @param {[*]} identities Array of identities
     * @private
     */
    _extractIdentitiesFromCertificateAndPrivateKeyArray(identities) {
        // TODO: To be implemented
        // TODO: Support both direct pem and b64 encoded pem
        // TODO: Support both absolute, relative paths as well as env prefixed ?
    }
}

module.exports = IdentityManager;
