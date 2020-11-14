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
const sinon = require('sinon');
const mockery = require('mockery');
const path = require('path');

const GenerateConfiguration = require('../../utils/GenerateConfiguration');

const IWalletFacadeFactory = require('../../../lib/identity-management/IWalletFacadeFactory');
const IWalletFacade = require('../../../lib/identity-management/IWalletFacade');
const ConnectorConfigurationFactory = require('../../../lib/connector-configuration/ConnectorConfigurationFactory');
const { Client } = require('./ClientStubs');

const basicConfig = '../../sample-configs/BasicConfig.yaml';

describe('When creating Fabric Client instances', () => {
    let ClientCreator;

    before(() => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            useCleanCache: true
        });

        mockery.registerMock('fabric-client', Client);
        mockery.registerMock('fabric-client/package', {version: '1.4.11'});
        ClientCreator = require('../../../lib/connector-versions/v1/ClientCreator');

        Client.reset();
    });

    after(() => {
        mockery.deregisterAll();
        mockery.disable();
    });

    it('should create a client for each identity in the wallet', async () => {
        const stubWalletFacadeFactory = sinon.createStubInstance(IWalletFacadeFactory);
        const stubWalletFacade = sinon.createStubInstance(IWalletFacade);
        stubWalletFacade.getAllIdentityNames.resolves(['user1', 'user2', '_Org2MSP_user3']);
        stubWalletFacade.export.withArgs('user1').resolves({
            mspid: 'Org1MSP',
            certificate: 'cert',
            privateKey: 'key'
        });
        stubWalletFacade.export.withArgs('user2').resolves({
            mspid: 'Org1MSP',
            certificate: 'cert',
            privateKey: 'key'
        });
        stubWalletFacade.export.withArgs('_Org2MSP_user3').resolves({
            mspid: 'Org2MSP',
            certificate: 'cert',
            privateKey: 'key'
        });
        stubWalletFacadeFactory.create.resolves(stubWalletFacade);

        const configFile = new GenerateConfiguration(path.resolve(__dirname, basicConfig)).generateConfigurationFileWithSpecifics(
            {
                caliper: {
                    blockchain: 'fabric',
                    sutOptions: {
                        mutualTls: false
                    }
                }
            }
        );

        const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, stubWalletFacadeFactory);
        const clientCreator = new ClientCreator(connectorConfiguration);
        const identityToClientMap = await clientCreator.createFabricClientsForAllIdentities();
        identityToClientMap.get('user1').should.be.instanceOf(Client);
        identityToClientMap.get('user2').should.be.instanceOf(Client);
        identityToClientMap.get('_Org2MSP_user3').should.be.instanceOf(Client);
        identityToClientMap.size.should.equal(3);
        Client.setTlsClientCertAndKeyCalls.should.equal(0);
    });

    it('should create a client and set mutual TLS when specified in the connection profile', async () => {
        const stubWalletFacadeFactory = sinon.createStubInstance(IWalletFacadeFactory);
        const stubWalletFacade = sinon.createStubInstance(IWalletFacade);
        stubWalletFacade.getAllIdentityNames.resolves(['tlsUser', '_Org2MSP_tlsUser']);
        stubWalletFacade.export.resolves({
            mspid: 'Org1MSP',
            certificate: 'cert',
            privateKey: 'key'
        });
        stubWalletFacade.export.withArgs('_Org2MSP_tlsUser').resolves({
            mspid: 'Org2MSP',
            certificate: 'cert',
            privateKey: 'key'
        });
        stubWalletFacadeFactory.create.resolves(stubWalletFacade);

        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, basicConfig), stubWalletFacadeFactory);
        const clientCreator = new ClientCreator(connectorConfiguration);
        const identityToClientMap = await clientCreator.createFabricClientsForAllIdentities();
        identityToClientMap.get('tlsUser').should.be.instanceOf(Client);
        identityToClientMap.size.should.equal(2);
        Client.setTlsClientCertAndKeyCalls.should.equal(2);
    });

});

