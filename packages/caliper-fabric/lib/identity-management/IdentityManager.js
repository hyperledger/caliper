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
const CaliperUtils = require('@hyperledger/caliper-core').CaliperUtils;
const fs = require('fs').promises;

const Logger = CaliperUtils.getLogger('IdentityManager');

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
        this.adminAliasNames = [];
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
     * @param {string} mspId The msp ID of the organization that owns the identity, will use the default mspId if no value provided
     * @param {string} identityName the identity name the organization it associates with the identity
     * @returns {string} the unique alias name that will be in the wallet
     */
    generateAliasNameFromOrganizationAndIdentityName(mspId, identityName) {
        if (!mspId ||
            mspId.length === 0 ||
            mspId === this.defaultMspId) {

            return identityName;
        }

        return `${this._getPrefixForIdentityNameFromOrganisation(mspId)}${identityName}`;
    }

    /**
     * Get a list of all the alias names for an organization that will be in the wallet
     * @param {string} mspId the msp ID of the organization, if not provided will use the default organization.
     * @returns {Promise<string[]>} a list of all the aliases (including admin specified) or a blank array if there are none
     * @async
     */
    async getAliasNamesForOrganization(mspId) {
        const aliasNames = await this.inMemoryWalletFacade.getAllIdentityNames();
        return this._getAliasNamesInOrganization(aliasNames, mspId);
    }

    /**
     * Get a list of admin alias names for an organization
     * @param {string} mspId the msp ID of the organization, if not provided will use the default organization.
     * @returns {string[]} list of admin alias names or empty if none
     */
    getAdminAliasNamesForOrganization(mspId) {
        return this._getAliasNamesInOrganization(this.adminAliasNames, mspId);
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
     * @returns {*} returns an agnostic wallet implementation
     */
    getWalletFacade() {
        return this.inMemoryWalletFacade;
    }

    /**
     * extract alias names for a specific organization
     * @param {string[]} aliasNames the complete list of alias names to search
     * @param {string} mspId the organization msp ID, if not provided then use the default
     * @returns {string[]} the list of alias names for that organization or an empty array if none
     */
    _getAliasNamesInOrganization(aliasNames, mspId) {
        if (!mspId || mspId.length === 0) {
            mspId = this.defaultMspId;
        }

        return aliasNames.filter((aliasName) => {
            if (mspId !== this.defaultMspId) {
                return aliasName.startsWith(this._getPrefixForIdentityNameFromOrganisation(mspId));
            }
            return aliasName.search(/^_..*_/) === -1;
        });
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
     * @param {*} isAdmin true if the identity is an organization admin identity
     * @param {*} certificate The pem encoded certificate
     * @param {*} privateKey The pem encoded private key
     * @async
     * @private
     */
    async _addToWallet(mspId, identityName, isAdmin, certificate, privateKey) {
        const alias = this.generateAliasNameFromOrganizationAndIdentityName(mspId, identityName);
        Logger.info(`Adding ${identityName} (admin=${isAdmin}) as ${alias} for organization ${mspId}`);

        try {
            await this.inMemoryWalletFacade.import(mspId, alias, certificate, privateKey);
            if (isAdmin) {
                this.adminAliasNames.push(alias);
            }
        } catch(err) {
            if (err.message.includes('already exists')) {
                const extraInsert = mspId ? `within organization ${mspId}` : '';
                throw new Error(`Identity ${identityName} has been declared in more than 1 place ${extraInsert}`);
            }

            throw err;
        }
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
                        await this._extractIdentitiesFromCertificateAndPrivateKeyArray(organization.mspid, organization.identities.certificates);
                    }

                    if (organization.identities.wallet) {
                        await this._extractIdentitiesFromWallet(organization.mspid, organization.identities.wallet);
                    }

                    if (organization.identities.credentialStore) {
                        await this._extractIdentitiesFromCredentialStore(organization.mspid, organization.identities.credentialStore);
                    }

                }
            }
        } else {
            throw new Error('No organizations have been defined');
        }
    }

    /**
     * Extract identities from a fabric node sdk 1.4 credential store and store in the in memory wallet
     * @param {string} mspId mspId of the organisation
     * @param {*} credentialStore the credential store information
     * @async
     * @private
     */
    async _extractIdentitiesFromCredentialStore(mspId, credentialStore) {
        // TODO: To be implemented
    }

    /**
     * Extract identities from a version specific wallet and store in the in memory wallet
     * @param {string} mspId mspId of the organisation
     * @param {*} wallet the wallet information from the configuration file
     * @async
     * @private
     */
    async _extractIdentitiesFromWallet(mspId, wallet) {
        if (!wallet.path) {
            throw new Error(`No path to the wallet for ${mspId} was supplied`);
        }

        const walletPath = CaliperUtils.resolvePath(wallet.path);

        try {
            const statOfpath = await fs.stat(walletPath);
            if (!statOfpath.isDirectory()) {
                throw new Error(`The wallet path property ${walletPath} does not point to a directory for ${mspId}`);
            }
        } catch(err) {
            if (err.errno === -2 || err.errno === -4058) {
                throw new Error(`The wallet path property ${walletPath} does not point to an existing directory for ${mspId}`);
            }
            throw err;
        }

        const walletFacade = await this.walletFacadeFactory.create(walletPath);
        const adminIdentityNames = wallet.adminNames || [];
        const allIdentityNames = await walletFacade.getAllIdentityNames();

        for (const identityName of allIdentityNames) {
            const identity = await walletFacade.export(identityName);
            if (identity.mspid === mspId) {
                const isAdmin = adminIdentityNames.includes(identityName);
                await this._addToWallet(mspId, identityName, isAdmin, identity.certificate, identity.privateKey);
            }
        }
    }

    /**
     * Extract the identities from the array of certificates and store in the in memory wallet
     *
     * @param {string} mspId mspId of the organisation
     * @param {[*]} certificates Array of identities
     * @async
     * @private
     */
    async _extractIdentitiesFromCertificateAndPrivateKeyArray(mspId, certificates) {
        if (!Array.isArray(certificates) || certificates.length === 0) {
            throw new Error(`No valid entries in certificates property for organization ${mspId}`);
        }

        for (const identity of certificates) {

            if (!identity.name || !identity.clientSignedCert || !identity.clientPrivateKey) {
                throw new Error(`A valid entry in certificates for organization ${mspId} must have a name, clientSignedCert and clientPrivateKey entry`);
            }

            const certificate = await this._extractPEMFromPathOrPEMDefinition(identity.clientSignedCert, 'clientSignedCert', identity.name, mspId);
            const privateKey = await this._extractPEMFromPathOrPEMDefinition(identity.clientPrivateKey, 'clientPrivateKey', identity.name, mspId);
            const isAdmin = (identity.admin !== undefined && (identity.admin === true || identity.admin === 'true'));
            await this._addToWallet(mspId, identity.name, isAdmin, certificate, privateKey);
        }
    }

    /**
     * Extract the PEM from a file or the embedded definition
     *
     * @param {*} CertificateOrPrivateKeyDefinition The clientSignedCert or clientPrivateKey property in the configuration
     * @param {string} propertyNameBeingProcessed A string of the provided property
     * @param {string} identityName The name associated with this identity
     * @param {string} mspId mspId of the organisation
     * @returns {Promise<string>} the PEM
     * @async
     * @private
     */
    async _extractPEMFromPathOrPEMDefinition(CertificateOrPrivateKeyDefinition, propertyNameBeingProcessed, identityName, mspId) {
        let pem;

        if (CertificateOrPrivateKeyDefinition.path) {
            pem = await this._extractPEMFromPath(CertificateOrPrivateKeyDefinition.path, propertyNameBeingProcessed, identityName, mspId);
        } else if (CertificateOrPrivateKeyDefinition.pem) {
            pem = this._extractPEMFromPEM(CertificateOrPrivateKeyDefinition.pem, propertyNameBeingProcessed, identityName, mspId);
        } else {
            throw new Error(`No path or pem property specified for ${propertyNameBeingProcessed} for name ${identityName} in organization ${mspId}`);
        }

        return pem;
    }

    /**
     * Extract the PEM from the file pointed to by the path
     *
     * @param {string} pathToPEMFile The path to the file containing the PEM information
     * @param {string} propertyNameBeingProcessed A string of the provided property
     * @param {string} identityName The name associated with this identity
     * @param {string} mspId mspId of the organisation
     * @returns {Promise<string>} the PEM
     * @async
     * @private
     */
    async _extractPEMFromPath(pathToPEMFile, propertyNameBeingProcessed, identityName, mspId) {
        const configPath = CaliperUtils.resolvePath(pathToPEMFile);

        try {
            await fs.stat(configPath);
        } catch(err) {
            if (err.errno === -2 || err.errno === -4058) {
                throw new Error(`path property does not point to a file that exists for ${propertyNameBeingProcessed} for name ${identityName} in organization ${mspId}`);
            }
            throw err;
        }

        const pem = (await fs.readFile(configPath)).toString();

        if (!pem.startsWith('-----BEGIN ')) {
            throw new Error(`path property does not point to a valid pem file for ${propertyNameBeingProcessed} for name ${identityName} in organization ${mspId}`);
        }

        return pem;
    }

    /**
     * Extract the embedded PEM from the config, which could be base64 encoded
     *
     * @param {string} pem the embedded pem property value
     * @param {string} propertyNameBeingProcessed A string of the provided property
     * @param {string} identityName The name associated with this identity
     * @param {string} mspId mspId of the organisation
     * @returns {Promise<string>} the PEM
     * @async
     * @private
     */
    _extractPEMFromPEM(pem, propertyNameBeingProcessed, identityName, mspId) {
        if (pem.startsWith('-----BEGIN ')) {
            return pem;
        }

        const decodedPEM = Buffer.from(pem, 'base64').toString();

        if (!decodedPEM.startsWith('-----BEGIN ')) {
            throw new Error(`pem property not valid for ${propertyNameBeingProcessed} for name ${identityName} in organization ${mspId}`);
        }

        return decodedPEM;
    }
}

module.exports = IdentityManager;
