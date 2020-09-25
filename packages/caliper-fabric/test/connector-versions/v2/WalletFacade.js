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
chai.should();
const mockery = require('mockery');

/**
 * simulate a node sdk v2 wallet
 */
class StubWallet {
    /**
     * Mock V2 wallet implementation
     */
    constructor() {
        this.map = new Map();
    }

    /**
     *
     * @param {*} key b
     * @param {*} value b
     */
    async put(key, value) {
        this.map.set(key, value);
    }

    /**
     *
     * @param {*} key b
     */
    async get(key) {
        return this.map.get(key);
    }

    /**
     *
     */
    async list() {
        return Array.from(this.map.keys());
    }
}

const Wallets = {
    newInMemoryWallet: async () => {
        return new StubWallet();
    },
    newFileSystemWallet: async(walletPath) => {
        return new StubWallet();
    }
};

mockery.enable();
mockery.registerMock('fabric-network', {Wallets});

const WalletFacadeFactory = require('../../../lib/connector-versions/v2/WalletFacadeFactory');
const WalletFacade = require('../../../lib/connector-versions/v2/WalletFacade');

describe('When testing a V2 Wallet Facade Implementation', () => {

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

    it('should unregister and disable mockery', () => {
        mockery.deregisterAll();
        mockery.disable();
    });
});
