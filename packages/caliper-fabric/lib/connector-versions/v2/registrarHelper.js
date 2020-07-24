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
const { Wallets } = require('fabric-network');
const { CaliperUtils } = require('@hyperledger/caliper-core');
const logger = CaliperUtils.getLogger('identityHelper');
const FabricCAServices = require('fabric-ca-client');

/**
 * Helper for registering and enrolling with a Certificate Authority
 */
class RegistrarHelper {

    /**
     * Retrieve an initialized RegistrarHelper
     * @param {FabricNetwork} networkUtil the network
     */
    static async newWithNetwork(networkUtil) {
        logger.debug('Entering newWithNetwork');
        const identityHelper = new RegistrarHelper(networkUtil);
        await identityHelper.initialize();
        logger.debug('Exiting newWithNetwork');
        return identityHelper;
    }

    /**
     * Constructor
     * @param {FabricNetwork} networkUtil the network
     */
    constructor(networkUtil) {
        this.networkUtil = networkUtil;
        this.registrarInfo = new Map();
    }

    /**
     * Initialize the helper
     */
    async initialize() {
        logger.debug('Entering initialize');
        // Use a wallet for convenience
        this.wallet = await Wallets.newInMemoryWallet();

        // Loop over all known orgs to configure accessible CAs
        for (const orgName of this.networkUtil.getOrganizations()) {
            logger.debug(`Operating on organization ${orgName}`);
            const caName = this.networkUtil.getCertificateAuthorityOfOrganization(orgName);
            const caObject = this.networkUtil.getCertificateAuthority(caName);
            if (caObject) {
                logger.debug(`Retrieved Certificate Authority for organization ${orgName}`);
                const tlsOptions = {
                    trustedRoots: [],
                    verify: caObject.verify || false
                };
                const orgCA = new FabricCAServices(caObject.url, tlsOptions, caName);

                const registrarInfo = this.networkUtil.getRegistrarOfOrganization(orgName);
                if (registrarInfo) {
                    logger.debug(`Retrieved Registrar information for organization ${orgName}`);
                    const registrarName = this.getRegistrarNameForOrg(orgName);
                    const registrarEnrollment = await this.enrollUser(orgCA, registrarInfo.enrollId, registrarInfo.enrollSecret);
                    const registrarIdentity = {
                        credentials: {
                            certificate: registrarEnrollment.certificate,
                            privateKey: registrarEnrollment.key.toBytes(),
                        },
                        mspId: this.networkUtil.getMspIdOfOrganization(orgName),
                        type: 'X.509',
                    };
                    await this.wallet.put(registrarName, registrarIdentity);
                    this.registrarInfo.set(orgName, {orgCA, registrarName});
                } else {
                    logger.warn(`No registrar information for org ${orgName}; unable to enrol users`);
                }
            } else {
                logger.warn(`No CA provided for org ${orgName}; unable to enrol users`);
                continue;
            }
        }
        logger.debug('Exiting initialize');
    }

    /**
     * Retrieve the registrar name for the passed org
     * @param {string} orgName the org name
     * @returns {string} the registrar name
     */
    getRegistrarNameForOrg(orgName) {
        return `registrar.${orgName}`;
    }

    /**
     * Check if a registrar exists for a passed org name
     * @param {string} orgName the organization name
     * @returns {boolean} boolean true if registrar exists; otherwise false
     */
    registrarExistsForOrg(orgName) {
        return this.registrarInfo.has(orgName);
    }

    /**
     * Register a user and return an enrollment secret
     * @param {string} orgName the organization to register under
     * @param {string} userID The user identity name to be registered
     */
    async registerUserForOrg(orgName, userID) {
        logger.debug(`Entering registerUserForOrg for organization ${orgName} userID ${userID}`);
        const registrarInfo = this.registrarInfo.get(orgName);
        const affiliation = this.networkUtil.getAffiliationOfUser(userID);
        const userSecret =  await this.registerUser(registrarInfo, userID, { affiliation });
        logger.debug('Exiting registerUserForOrg');
        return userSecret;
    }

    /**
     * Register a userID through a CA using an admin identity
     * @param {object} registrarInfo {orgCA, registrarName} Registrar information used to perform the registration action
     * @param {string} userID The user identity name to be registered
     * @param {object} options options to be used during registration
     */
    async registerUser(registrarInfo, userID, options = {}) {
        logger.debug(`Entering registerUser for userID ${userID}`);
        const identity = await this.wallet.get(registrarInfo.registrarName);
        const provider = this.wallet.getProviderRegistry().getProvider(identity.type);
        const user = await provider.getUserContext(identity, registrarInfo.registrarName);

        const userSecret = `${userID}_secret`;
        const registerRequest = {
            enrollmentID: userID,
            enrollmentSecret: userSecret,
            affiliation: options.affiliation || 'org1',  // or eg. org1.department1
            attrs: [],
            maxEnrollments: options.maxEnrollments || -1,  // infinite enrollment by default
            role: options.role || 'client'
        };

        if (options.issuer) {
            // Everyone caliper creates can register clients.
            registerRequest.attrs.push({
                name: 'hf.Registrar.Roles',
                value: 'client'
            });

            // Everyone caliper creates can register clients that can register clients.
            registerRequest.attrs.push({
                name: 'hf.Registrar.Attributes',
                value: 'hf.Registrar.Roles, hf.Registrar.Attributes'
            });
        }

        let idAttributes = options.attributes;
        if (typeof idAttributes === 'string') {
            try {
                idAttributes = JSON.parse(idAttributes);
            } catch (error) {
                throw new Error('attributes provided are not valid JSON. ' + error);
            }
        }

        for (const attribute in idAttributes) {
            registerRequest.attrs.push({
                name: attribute,
                value: idAttributes[attribute]
            });
        }

        try {
            await registrarInfo.orgCA.register(registerRequest, user);
        } catch (error) {
            // Might fail if previously registered, in which case pass back the known secret
            if (error.toString().includes(`Identity '${userID}' is already registered`)) {
                logger.warn(`Identity ${userID} is already registered`);
                return userSecret;
            } else {
                throw error;
            }
        }

        logger.debug('Exiting registerUser');
        return userSecret;
    }

    /**
     * Enroll a user for the organization using the enrollment secret
     * @param {string} orgName the organization to enrol under
     * @param {string} clientName the client name to enrol
     * @param {string} enrollmentSecret the enrollment secret
     * @return {Promise<{key: ECDSA_KEY, certificate: string}>} The resulting private key and certificate.
     */
    async enrollUserForOrg(orgName, clientName, enrollmentSecret) {
        logger.debug(`Entering enrollUserForOrg for organization ${orgName} and identity name ${clientName}`);
        const caDetails = this.registrarInfo.get(orgName);
        const enrollment = await this.enrollUser(caDetails.orgCA, clientName, enrollmentSecret);
        logger.debug('Exiting enrollUserForOrg');
        return enrollment;
    }

    /**
     * Enrolls the given user through its corresponding CA.
     * @param {CertificateAuthority} ca The certificate authority object whose user must be enrolled.
     * @param {string} id The enrollment ID.
     * @param {string} secret The enrollment secret.
     * @return {Promise<{key: ECDSA_KEY, certificate: string}>} The resulting private key and certificate.
     * @private
     * @async
     */
    async enrollUser(ca, id, secret) {
        logger.debug(`Entering enrollUser with enrollment ID ${id}`);
        // this call will throw an error if the CA configuration is not found
        // this error should propagate up
        try {
            const enrollment = await ca.enroll({
                enrollmentID: id,
                enrollmentSecret: secret
            });
            logger.debug('Exiting enrollUser');
            return enrollment;
        } catch (err) {
            throw new Error(`Couldn't enroll 'user' ${id}: ${err.message}`);
        }
    }

}

module.exports = RegistrarHelper;
