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

const IdentityManager = require('./IdentityManager');

/**
 * Factory to create an IdentityManager instance
 */
class IdentityManagerFactory {

    /**
     * Create an IdentityManager instance
     * @param {IWalletFacadeFactory} walletFacadeFactory instance of a WalletFacadeFactory used to create wallet facades
     * @param {*} organizations The organizations block from the connector configuration
     * @returns {Promise<IdentityManager>} an instance of an IdentityManager
     * @async
     */
    async create(walletFacadeFactory, organizations) {
        const identityManager = new IdentityManager(walletFacadeFactory, organizations);
        await identityManager.initialize();

        return identityManager;
    }
}

module.exports = IdentityManagerFactory;
