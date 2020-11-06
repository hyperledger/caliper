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
 * Define the interface for a WalletFacade implementation
 */
class IWalletFacade {

    /**
     * Export an identity from a wallet in the form
     * <code>
     * {
     *     mspid: 'AnMspId',
     *     certificate: 'pem encoded string',
     *     privateKey: 'pem encoded string'
     * }
     * </code>
     * @param {string} identityName the identity name that uniquely identifies the identity in the wrapped wallet
     * @returns {Promise<ExportedIdentity>} an object that represents the identity
     * @async
     */
    async export(identityName) {
        throw new Error('Abstract method called');
    }

    /**
     * Import an identity into a wallet
     * @param {string} mspid the mspid of the organization that owns this identity
     * @param {string} identityName the identity name that uniquely identifies the identity in the wallet
     * @param {string} certificate pem encoded string of the certificate
     * @param {string} privateKey pem encoded string of the private key
     * @async
     */
    async import(mspid, identityName, certificate, privateKey) {
        throw new Error('Abstract method called');
    }

    /**
     * Return a list of all the unique identity names in the wallet
     * @returns {Promise<string[]>} a list of the unique identity names
     * @async
     */
    async getAllIdentityNames() {
        throw new Error('Abstract method called');
    }

    /**
     * Returns the instance of the version specific wrapped wallet
     */
    getWallet() {
        throw new Error('Abstract method called');
    }
}

module.exports = IWalletFacade;
