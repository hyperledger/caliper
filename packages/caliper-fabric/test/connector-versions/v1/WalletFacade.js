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
 * simulate a node sdk v1 wallet
 */
class StubWallet {
    /**
     * Mock V1 wallet implementation
     */
    constructor() {
        this.map = new Map();
    }

    /**
     *
     * @param {*} key b
     * @param {*} value b
     */
    async import(key, value) {
        this.map.set(key, value);
    }

    /**
     *
     * @param {*} key b
     */
    async export(key) {
        return this.map.get(key);
    }

    /**
     *
     */
    async list() {
        return Array.from(this.map.keys());
    }
}

/**
 * InMemoryWallet copy
 */
class InMemoryWallet extends StubWallet {}

/**
 * FileSystemWallet copy
 */
class FileSystemWallet extends StubWallet {}

/**
 * x509walletmixin class
 */
class X509WalletMixin {
    /**
    * @param {*} mspid b
    * @param {*} cert b
    * @param {*} key b
    * @return {*} identity b
    */
    static createIdentity(mspid, cert, key){
        const identity = {
            credentials: {
                cert,
                key
            },
            mspid,
            type: 'X.509',
        };
        return identity;
    }
}

mockery.enable();
mockery.registerMock('fabric-network',  {FileSystemWallet, InMemoryWallet, X509WalletMixin});

const WalletFacadeFactory = require('../../../lib/connector-versions/v1/WalletFacadeFactory');
const WalletFacade = require('../../../lib/connector-versions/v1/WalletFacade');

describe('When testing a V1 Wallet Facade Implementation', () => {

    beforeEach(() => {
        mockery.enable();
        mockery.registerMock('fabric-network',  {FileSystemWallet, InMemoryWallet, X509WalletMixin});
    });

    afterEach(() => {
        mockery.deregisterAll();
        mockery.disable();
    });
    it('A Wallet Facade Factory should create a wallet facade', async () => {
        const walletFacade = await new WalletFacadeFactory().create();
        walletFacade.should.be.instanceOf(WalletFacade);
        const walletFacade2 = await new WalletFacadeFactory().create('optionalString');
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
});
