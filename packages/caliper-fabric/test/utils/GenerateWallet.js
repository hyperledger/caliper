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

const sinon = require('sinon');
const IWalletFacadeFactory = require('../../lib/identity-management/IWalletFacadeFactory');
const IWalletFacade = require('../../lib/identity-management/IWalletFacade');

/**
 * Class to generate a test wallet environment
 */
class GenerateWallet {

    /**
     * create a standard test wallet environment
     * @returns {object} the stub wallet factory and stub wallet facade
     */
    createStandardTestWalletSetup() {
        const walletFacadeFactory = sinon.createStubInstance(IWalletFacadeFactory);
        const fileSystemWalletFacade = sinon.createStubInstance(IWalletFacade);
        const inMemoryWalletFacade = sinon.createStubInstance(IWalletFacade);
        walletFacadeFactory.create.withArgs().resolves(inMemoryWalletFacade);
        walletFacadeFactory.create.withArgs(sinon.match.string).resolves(fileSystemWalletFacade);

        fileSystemWalletFacade.getAllIdentityNames.resolves(['admin', 'user', 'issuer']);

        const exportedIdentity = {
            mspid : 'Org1MSP',
            certificate : '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----',
            privateKey : '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----',
        };
        fileSystemWalletFacade.export.resolves(exportedIdentity);
        inMemoryWalletFacade.export.resolves(exportedIdentity);

        // simulate what was in the wallet plus add in an org2 admin that would have come from somewhere
        inMemoryWalletFacade.getAllIdentityNames.resolves(['admin', 'user', '_Org2MSP_issuer', '_Org2MSP_admin']);

        return {
            walletFacadeFactory,
            inMemoryWalletFacade
        };
    }
}

module.exports = GenerateWallet;
