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
const {Wallets} = require('fabric-network');

/**
 * a Facade for the V2 Wallet implementation
 */
class WalletFacade extends IWalletFacade {

    /**
     */
    constructor() {
        super();
        this.wallet = null;
    }

    /**
     * initialize this WalletFacade
     *
     * @param {string} [walletPath] an optional path to a file system wallet
     */
    async initialize(walletPath) {
        if (!walletPath) {
            this.wallet = await Wallets.newInMemoryWallet();
        } else {
            this.wallet = await Wallets.newFileSystemWallet(walletPath);
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
        const exists = await this.wallet.get(identityName);

        if (exists) {
            throw new Error(`${identityName} already exists in the wallet`);
        }

        const identity = {
            credentials: {
                certificate,
                privateKey
            },
            mspId,
            type: 'X.509',
        };
        await this.wallet.put(identityName, identity);
    }

    /**
     * Export an identity
     *
     * @param {string} identityName The identity to export
     * @returns {Promise<ExportedIdentity>} The exported identity or null if it doesn't exist
     * @async
     */
    async export(identityName) {
        const exported = await this.wallet.get(identityName);
        if (exported) {
            return new ExportedIdentity(exported.mspId, exported.credentials.certificate, exported.credentials.privateKey);
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
        return await this.wallet.list();
    }

    /**
     * @returns {*} wallet
     */
    getWallet() {
        return this.wallet;
    }
}

module.exports = WalletFacade;
