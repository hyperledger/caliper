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

const IWalletFacadeFactory = require('../../identity-management/IWalletFacadeFactory');
const WalletFacade = require('./WalletFacade');

/**
 * Factory for a V2 Wallet Facade
 */
class WalletFacadeFactory extends IWalletFacadeFactory {

    /**
     * create a V2 Wallet Facade
     *
     * @param {string} [walletPath] optional path to a file system wallet
     */
    async create(walletPath) {
        const walletFacade = new WalletFacade();
        await walletFacade.initialize(walletPath);
        return walletFacade;
    }
}

module.exports = WalletFacadeFactory;
