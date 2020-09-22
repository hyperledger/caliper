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
const sinon = require('sinon');

const ConnectorConfigurationFactory = require('../../lib/connector-configuration/ConnectorConfigurationFactory');
const GenerateConfiguration = require('../utils/GenerateConfiguration');
const IWalletFacadeFactory = require('../../lib/identity-management/IWalletFacadeFactory');
const IWalletFacade = require('../../lib/identity-management/IWalletFacade');
const ConnectionProfileDefinition = require('../../lib/connector-configuration/ConnectionProfileDefinition');

describe('A valid Connector Configuration', () => {

    const walletFacadeFactory = sinon.createStubInstance(IWalletFacadeFactory);
    const walletFacade = sinon.createStubInstance(IWalletFacade);
    walletFacadeFactory.create.resolves(walletFacade);

    describe('for mutual TLS', () => {
        it('should report true if specified as true in the configuration', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
            connectorConfiguration.isMutualTLS().should.be.true;
        });

        it('should report false if specified as false in the configuration', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    caliper: {
                        blockchain: 'fabric',
                        sutOptions: {
                            mutualTls: false
                        }
                    }
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            connectorConfiguration.isMutualTLS().should.be.false;
        });

        it('should report false if not specified in the configuration', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    caliper: {
                        blockchain: 'fabric'
                    }
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            connectorConfiguration.isMutualTLS().should.be.false;
        });
    });

    describe('for Channel name retrieval', () => {
        it('should provide a list of all the channel names', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
            const channelNames = connectorConfiguration.getAllChannelNames();
            channelNames.length.should.equal(2);
            channelNames[0].should.equal('my-channel', 'your-channel');
        });

        it('should provide an empty list of channel names if channel section not defined', async () => {
            const configFile = new GenerateConfiguration().generateConfigurationFileWithSpecifics(
                {
                    caliper: {
                        blockchain: 'fabric'
                    },
                    organizations: [
                        {
                            mspid: 'Org1MSP'
                        }
                    ]
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const channelNames = connectorConfiguration.getAllChannelNames();
            channelNames.length.should.equal(0);
        });

        it('should provide an empty list of channel names if channel section is empty', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: []
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const channelNames = connectorConfiguration.getAllChannelNames();
            channelNames.length.should.equal(0);
        });

        it('should provide an empty list of channel names if channel section is not an array', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: {}
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const channelNames = connectorConfiguration.getAllChannelNames();
            channelNames.length.should.equal(0);
        });
    });

    describe('for Channel creation', () => {
        it('should provide a list with a single channel name that requires creation', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
            const channelNames = connectorConfiguration.getChannelNamesForCreation();
            channelNames.length.should.equal(1);
            channelNames[0].should.equal('my-channel');
        });

        it('should provide an empty list if no channels require creation', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileReplacingProperties(
                'create',
                false
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const channelNames = connectorConfiguration.getChannelNamesForCreation();
            channelNames.length.should.equal(0);
        });

        it('should provide a list with more than 1 channel name that requires creation', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileReplacingProperties(
                'create',
                true
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const channelNames = connectorConfiguration.getChannelNamesForCreation();
            channelNames.length.should.equal(2);
            channelNames.should.deep.equal(['my-channel', 'your-channel']);
        });

        it('should provide an empty list of channel names if channel section not defined', async () => {
            const configFile = new GenerateConfiguration().generateConfigurationFileWithSpecifics(
                {
                    caliper: {
                        blockchain: 'fabric'
                    },
                    organizations: [
                        {
                            mspid: 'Org1MSP'
                        }
                    ]
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const channelNames = connectorConfiguration.getChannelNamesForCreation();
            channelNames.length.should.equal(0);
        });

        it('should provide an empty list of channel names if channel section is empty', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: []
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const channelNames = connectorConfiguration.getChannelNamesForCreation();
            channelNames.length.should.equal(0);
        });

        it('should provide an empty list of channel names if channel section is not an array', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: {}
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const channelNames = connectorConfiguration.getChannelNamesForCreation();
            channelNames.length.should.equal(0);
        });

        it('should be able retrieve a channel definition if it exists', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
            const channelDefinition = connectorConfiguration.getDefinitionForChannelName('my-channel');
            channelDefinition.should.deep.equal(
                { capabilities: [],
                    consortium: 'SampleConsortium2',
                    msps: [ 'Org1MSP', 'Org2MSP' ],
                    version: 0,
                    orderers: [ 'orderer0.example.com', 'orderer1.example.com' ],
                    peers: {
                        'peer0.org1.example.com': { eventSource: true },
                        'peer0.org2.example.com': { eventSource: true }
                    }
                }
            );
        });

        it('should return null if no channel definition exists', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
            const channelDefinition = connectorConfiguration.getDefinitionForChannelName('non-existant');
            should.equal(channelDefinition, null);
        });

        it('should return null for a channel definition if channel section not defined', async () => {
            const configFile = new GenerateConfiguration().generateConfigurationFileWithSpecifics(
                {
                    caliper: {
                        blockchain: 'fabric'
                    },
                    organizations: [
                        {
                            mspid: 'Org1MSP'
                        }
                    ]
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const channelDefinition = connectorConfiguration.getDefinitionForChannelName('my-channel');
            should.equal(channelDefinition, null);
        });

        it('should return null for a channel definition if channel section is empty', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: []
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const channelDefinition = connectorConfiguration.getDefinitionForChannelName('my-channel');
            should.equal(channelDefinition, null);
        });

        it('should return null for a channel definition if channel section is not an array', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: {}
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const channelDefinition = connectorConfiguration.getDefinitionForChannelName('my-channel');
            should.equal(channelDefinition, null);
        });
    });

    describe('for finding the Contract Definitions For a Channel Name', () => {
        it('should return the contract definitions for the specified channel if there are contracts', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
            const result=[{
                id: 'marbles',
                contractID: 'myMarbles',
                version: 'v0',
                language: 'golang',
                path: 'marbles/go',
                metadataPath: 'src/marbles/go/metadata'}];
            const contractDef =connectorConfiguration.getContractDefinitionsForChannelName('my-channel');
            contractDef.should.deep.equal(result);
        });

        it('should return an empty array if there are no contracts for the specified channel', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: [{
                        channelName: 'my-channel',
                        contracts: []
                    }]
                });
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const contractDef = connectorConfiguration.getContractDefinitionsForChannelName('my-channel');
            contractDef.length.should.equal(0);
        });
        it('should return an empty array if there are no channels', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: {}
                });
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const contractDef = connectorConfiguration.getContractDefinitionsForChannelName('my-channel');
            contractDef.length.should.equal(0);
        });

        it('should return an empty array if there is not contract property', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: [{
                        channelName: 'my-channel',
                    }]
                });
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const contractDef = connectorConfiguration.getContractDefinitionsForChannelName('my-channel');
            contractDef.should.deep.equal([]);
        });
    });

    describe('when getting a list of alias names from an organisation', () => {

        const stubWalletFacadeFactory = sinon.createStubInstance(IWalletFacadeFactory);
        const stubWalletFacade = sinon.createStubInstance(IWalletFacade);
        stubWalletFacadeFactory.create.resolves(stubWalletFacade);
        stubWalletFacade.getAllIdentityNames.resolves(['admin', 'user', '_org2MSP_admin', '_org2MSP_issuer']);

        it('should return the correct aliases for the default organisation', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', stubWalletFacadeFactory);
            await connectorConfiguration.getAliasNamesForOrganization('org1MSP').should.eventually.deep.equal(['admin', 'user']);
        });

        it('should return the correct aliases for a non default organisation', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', stubWalletFacadeFactory);
            await connectorConfiguration.getAliasNamesForOrganization('org2MSP').should.eventually.deep.equal(['_org2MSP_admin', '_org2MSP_issuer']);
        });

        it('should return the an empty array if there are no aliases for the organization', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', stubWalletFacadeFactory);
            await connectorConfiguration.getAliasNamesForOrganization('org3MSP').should.eventually.deep.equal([]);
        });
    });

    describe('when getting a connection profile definition', () => {

        it('should throw an error if the connection profile file doesn\'t exist', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.json', walletFacadeFactory);
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('org2MSP')
                .should.be.rejectedWith(/No connection profile file found/);
        });

        it('should throw an error if the requested organization doesn\'t exist', async () => {
            const configFile = new GenerateConfiguration().generateConfigurationFileWithSpecifics(
                {
                    caliper: {
                        blockchain: 'fabric'
                    },
                    organizations: [
                        {
                            mspid: 'Org1MSP'
                        }
                    ]
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('org2MSP')
                .should.be.rejectedWith(/No organization defined for org2MSP/);
        });

        it('should return a connection profile definition if a valid json file is provided', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.json', walletFacadeFactory);
            const connectionProfileDefinition = await connectorConfiguration.getConnectionProfileDefinitionForOrganization('org1MSP');
            connectionProfileDefinition.should.be.instanceOf(ConnectionProfileDefinition);
            connectionProfileDefinition.isDynamicConnectionProfile().should.be.true;
            connectionProfileDefinition.getConnectionProfile().name.should.equal('test-network-org1');
        });

        it('should return a connection profile definition if a valid yaml is provided', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
            const connectionProfileDefinition = await connectorConfiguration.getConnectionProfileDefinitionForOrganization('org1MSP');
            connectionProfileDefinition.should.be.instanceOf(ConnectionProfileDefinition);
            connectionProfileDefinition.isDynamicConnectionProfile().should.be.true;
            connectionProfileDefinition.getConnectionProfile().name.should.equal('test-network-org1');
        });

        it('should throw an error if a invalid json file is provided', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileReplacingProperties(
                'path',
                './test/sample-configs/invalid.json'
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('org1MSP').should.be.rejectedWith(/Failed to parse the .*invalid.json/);
        });

        it('should throw an error if a invalid yaml is provided', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileReplacingProperties(
                'path',
                './test/sample-configs/invalid.yaml'
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('org1MSP').should.be.rejectedWith(/Failed to parse the .*invalid.yaml/);
        });

        it('should not attempt to load the connection profile more than once', async () => {

            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.json', walletFacadeFactory);
            sinon.spy(connectorConfiguration, '_loadConnectionProfile');
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('org1MSP');
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('org1MSP');
            sinon.assert.calledOnce(connectorConfiguration._loadConnectionProfile);
        });

    });

    it('should return the list of mspid\'s defined when getting the list of organizations', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.json', walletFacadeFactory);
        connectorConfiguration.getOrganizations().should.deep.equal(['org1MSP', 'org2MSP']);
    });

    it('should return a wallet for the alias when requested', async () => {
        const stubWalletFacadeFactory = sinon.createStubInstance(IWalletFacadeFactory);
        const stubWalletFacade = sinon.createStubInstance(IWalletFacade);
        stubWalletFacadeFactory.create.resolves(stubWalletFacade);
        stubWalletFacade.getWallet.returns('IamAwallet');
        const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', stubWalletFacadeFactory);
        await connectorConfiguration.getWalletForAliasName('alias1').should.equal('IamAwallet');
        await connectorConfiguration.getWalletForAliasName('alias2').should.equal('IamAwallet');
    });



    describe('when generating an alias name', () => {
        it('should not prefix for the default organisation', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
            connectorConfiguration.getAliasNameFromOrganizationAndIdentityName('org1MSP', 'admin').should.equal('admin');

        });

        it('should prefix for the non default organisation', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
            connectorConfiguration.getAliasNameFromOrganizationAndIdentityName('org2MSP', 'admin').should.equal('_org2MSP_admin');
        });
    });
});
