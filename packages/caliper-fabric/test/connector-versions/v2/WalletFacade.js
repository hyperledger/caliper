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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const should = chai.should();
const mockery = require('mockery');

const { Wallets, StubWallet } = require('./V2GatewayStubs');

let WalletFacadeFactory;
let WalletFacade;

describe('When testing a V2 Wallet Facade Implementation', () => {
    before(() => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            useCleanCache: true
        });
        mockery.registerMock('fabric-network', {Wallets});
        WalletFacadeFactory = require('../../../lib/connector-versions/v2/WalletFacadeFactory');
        WalletFacade = require('../../../lib/connector-versions/v2/WalletFacade');
    });

    after(() => {
        mockery.deregisterAll();
        mockery.disable();
    });

    it('A Wallet Facade Factory should create a wallet facade', async () => {
        const walletFacade = await new WalletFacadeFactory().create();
        walletFacade.should.be.instanceOf(WalletFacade);
        const walletFacade2 = await new WalletFacadeFactory().create('dsgdsfdsjfdk');
        walletFacade2.should.be.instanceOf(WalletFacade);
    });

    it('A wallet facade should be able to import and export identities', async () => {
        const walletFacade = await new WalletFacadeFactory().create();
        await walletFacade.import('mspid', 'label', 'cert', 'key');
        const exported = await walletFacade.export('label');
        exported.should.deep.equal({mspid: 'mspid', certificate: 'cert', privateKey: 'key'});
    });

    it('A wallet facade should return null on export if the identity does not exist', async () => {
        const walletFacade = await new WalletFacadeFactory().create();
        const exported = await walletFacade.export('label');
        should.equal(exported, null);
    });

    it('A wallet facade should throw an error if an identity already exists', async () => {
        const walletFacade = await new WalletFacadeFactory().create();
        await walletFacade.import('mspid', 'label', 'cert', 'key');
        await walletFacade.import('mspid', 'label', 'cert', 'key').should.be.rejectedWith(/already exists/);
    });

    it('A wallet facade should get all identity names it has', async () => {
        const walletFacade = await new WalletFacadeFactory().create();
        await walletFacade.import('mspid', 'label', 'cert', 'key');
        await walletFacade.import('mspid', 'bart', 'cert', 'key');
        await walletFacade.import('mspid', 'lisa', 'cert', 'key');
        (await walletFacade.getAllIdentityNames()).should.deep.equal(['label', 'bart', 'lisa']);
    });

    it('A wallet facade should return the real wallet instance', async () => {
        const walletFacade = await new WalletFacadeFactory().create();
        walletFacade.getWallet().should.be.instanceOf(StubWallet);
    });
});
