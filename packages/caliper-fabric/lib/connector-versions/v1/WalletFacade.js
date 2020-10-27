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

const IWalletFacade = require('../../identity-management/IWalletFacade');
const ExportedIdentity = require('../../identity-management/ExportedIdentity');
const {FileSystemWallet, InMemoryWallet, X509WalletMixin} = require('fabric-network');

/**
 * a Facade for the V1 Wallet implementation
 */
class WalletFacade extends IWalletFacade {

    /**
     *
     * @param {string} [walletPath] an optional path to a file system wallet
     */
    constructor(walletPath) {
        super();
        this.wallet = null;
        if (!walletPath) {
            this.wallet = new InMemoryWallet();
        } else {
            this.wallet = new FileSystemWallet(walletPath);
        }
    }

    /**
     * Import an identity
     *
     * @param {string} mspId The mspId that owns the identity
     * @param {string} identityName The name of the identity
     * @param {string} certificate The identity certificate
     * @param {string} privateKey The identity private key
     */
    async import(mspId, identityName, certificate, privateKey) {
        const exists = await this.wallet.exists(identityName);

        if (exists) {
            throw new Error(`${identityName} already exists in the wallet`);
        }

        const identity = X509WalletMixin.createIdentity(mspId, certificate, privateKey);
        await this.wallet.import(identityName, identity);
    }

    /**
     * Export an identity
     *
     * @param {string} identityName The identity to export
     * @returns {Promise<ExportedIdentity>} The exported identity or null if it doesn't exist
     * @async
     */
    async export(identityName) {
        const exported = await this.wallet.export(identityName);
        if (exported) {
            return new ExportedIdentity(exported.mspId, exported.certificate, exported.privateKey);
        }
        return null;
    }

    /**
     * Get all the identity names in the wallet
     *
     * @returns {Promise<[string]>} all the identity names in the wallet
     * @async
     */
    async getAllIdentityNames() {
        return await this.wallet.getAllLabels();
    }

    /**
     * @returns {*} wallet
     */
    getWallet() {
        return this.wallet;
    }
}

module.exports = WalletFacade;
