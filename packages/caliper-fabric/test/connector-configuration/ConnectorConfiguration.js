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
    let walletFacadeFactory;
    let walletFacade;
    beforeEach(() => {
        walletFacadeFactory = sinon.createStubInstance(IWalletFacadeFactory);
        walletFacade = sinon.createStubInstance(IWalletFacade);
        walletFacade.getAllIdentityNames.resolves([]);
        walletFacadeFactory.create.resolves(walletFacade);
    });

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
            channelNames[0].should.equal('mychannel', 'yourchannel');
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
            channelNames[0].should.equal('mychannel');
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
            channelNames.should.deep.equal(['mychannel', 'yourchannel']);
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
            const channelDefinition = connectorConfiguration.getDefinitionForChannelName('mychannel');
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
            const channelDefinition = connectorConfiguration.getDefinitionForChannelName('mychannel');
            should.equal(channelDefinition, null);
        });

        it('should return null for a channel definition if channel section is empty', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: []
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const channelDefinition = connectorConfiguration.getDefinitionForChannelName('mychannel');
            should.equal(channelDefinition, null);
        });

        it('should return null for a channel definition if channel section is not an array', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: {}
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const channelDefinition = connectorConfiguration.getDefinitionForChannelName('mychannel');
            should.equal(channelDefinition, null);
        });
    });

    describe('for finding the Contract Definitions For a Channel Name', () => {
        it('should throw an error if contracts have the same ID', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileReplacingProperties('contractID', 'replicatedID');
            await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory).should.be.rejectedWith(/replicatedID has already been defined in the configuration/);
        });

        it('should return the contract definitions for the specified channel if there are contracts', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
            const result=[{
                id: 'marbles',
                contractID: 'myMarbles',
                version: 'v0',
                language: 'golang',
                path: 'marbles/go',
                metadataPath: 'src/marbles/go/metadata'}];
            const contractDef =connectorConfiguration.getContractDefinitionsForChannelName('mychannel');
            contractDef.should.deep.equal(result);
        });

        it('should return an empty array if there are no contracts for the specified channel', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: [{
                        channelName: 'mychannel',
                        contracts: []
                    }]
                });
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const contractDef = connectorConfiguration.getContractDefinitionsForChannelName('mychannel');
            contractDef.length.should.equal(0);
        });

        it('should return an empty array if there are no channels', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: {}
                });
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const contractDef = connectorConfiguration.getContractDefinitionsForChannelName('mychannel');
            contractDef.length.should.equal(0);
        });

        it('should return an empty array if there is not contract property', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: [{
                        channelName: 'mychannel',
                    }]
                });
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const contractDef = connectorConfiguration.getContractDefinitionsForChannelName('mychannel');
            contractDef.should.deep.equal([]);
        });
    });

    describe('when getting a list of alias names from an organisation', () => {
        beforeEach(() => {
            walletFacade.getAllIdentityNames.resolves(['admin', 'user', '_Org2MSP_admin', '_Org2MSP_issuer']);
            const testIdentity = {
                mspid : 'Org1MSP',
                certificate : '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----',
                privateKey : '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----',
            };
            walletFacade.export.resolves(testIdentity);
        });

        it('should return the correct aliases for the default organisation', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
            await connectorConfiguration.getAliasNamesForOrganization('Org1MSP').should.eventually.deep.equal(['admin', 'user']);
        });

        it('should return the correct aliases for a non default organisation', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
            await connectorConfiguration.getAliasNamesForOrganization('Org2MSP').should.eventually.deep.equal(['_Org2MSP_admin', '_Org2MSP_issuer']);
        });

        it('should return an empty array when there are no aliases for the organization', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
            await connectorConfiguration.getAliasNamesForOrganization('org3MSP').should.eventually.deep.equal([]);
        });
    });

    describe('when getting a connection profile definition', () => {
        it('should throw an error if the connection profile information is not provided', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/NoConnectionProfileNetworkConfig.yaml', walletFacadeFactory);
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP')
                .should.be.rejectedWith(/No connection profile entry for organization Org1MSP has been defined/);
        });

        it('should throw an error if the connection profile file doesn\'t exist', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.json', walletFacadeFactory);
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org2MSP')
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
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org2MSP')
                .should.be.rejectedWith(/No organization defined for Org2MSP/);
        });

        it('should return a connection profile definition if a valid json file is provided', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.json', walletFacadeFactory);
            const connectionProfileDefinition = await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP');
            connectionProfileDefinition.should.be.instanceOf(ConnectionProfileDefinition);
            connectionProfileDefinition.isDynamicConnectionProfile().should.be.true;
            connectionProfileDefinition.getConnectionProfile().name.should.equal('test-network-org1');
        });

        it('should return a connection profile definition if a valid yaml is provided', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
            const connectionProfileDefinition = await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP');
            connectionProfileDefinition.should.be.instanceOf(ConnectionProfileDefinition);
            connectionProfileDefinition.isDynamicConnectionProfile().should.be.true;
            connectionProfileDefinition.getConnectionProfile().name.should.equal('test-network-org1');
        });

        it('should throw an error if a invalid json file is provided', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileReplacingProperties(
                'path',
                './test/sample-configs/invalid.json',
                'connectionProfile'
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP').should.be.rejectedWith(/Failed to parse the .*invalid.json/);
        });

        it('should throw an error if a invalid yaml is provided', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileReplacingProperties(
                'path',
                './test/sample-configs/invalid.yaml',
                'connectionProfile'
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP').should.be.rejectedWith(/Failed to parse the .*invalid.yaml/);
        });

        it('should not attempt to load the connection profile more than once', async () => {

            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.json', walletFacadeFactory);
            sinon.spy(connectorConfiguration, '_loadConnectionProfile');
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP');
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP');
            sinon.assert.calledOnce(connectorConfiguration._loadConnectionProfile);
        });
    });

    describe('when getting the in memory wallet that contains all identities', () => {
        it('should return the wallet facade when requested', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
            await connectorConfiguration.getWalletFacade().should.equal(walletFacade);
        });

        it('should return a wallet when requested', async () => {
            walletFacade.getWallet.returns('IamAwallet');
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
            await connectorConfiguration.getWallet().should.equal('IamAwallet');
        });
    });

    describe('when generating an alias name', () => {
        it('should not prefix for the default organisation', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
            connectorConfiguration.getAliasNameFromOrganizationAndIdentityName('Org1MSP', 'admin').should.equal('admin');
        });

        it('should prefix for the non default organisation', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
            connectorConfiguration.getAliasNameFromOrganizationAndIdentityName('Org2MSP', 'admin').should.equal('_Org2MSP_admin');
        });
    });

    describe('when getting contract details by id', () => {
        it('should return the right contract details', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
            connectorConfiguration.getContractDetailsForContractId('myMarbles').should.deep.equal({channel: 'mychannel', id: 'marbles'});
            connectorConfiguration.getContractDetailsForContractId('lostMyMarbles').should.deep.equal({channel: 'yourchannel', id: 'marbles'});
        });

        it('should return undefined if id not found', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
            should.equal(connectorConfiguration.getContractDetailsForContractId('NoMarbles'), undefined);
        });

        it('should set the contract id property to the id property of the contract if the contract id property is not specified', async () => {
            const configFile = new GenerateConfiguration('./test/sample-configs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: [
                        {
                            channelName: 'mychannel',
                            create: false,
                            contracts: [
                                {
                                    id: 'foundmarbles',
                                    version: 'v0',
                                    language: 'node',
                                    path: 'marbles/src',
                                    metadataPath: 'marbles/metadata'
                                }
                            ]
                        }
                    ]
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            connectorConfiguration.getContractDetailsForContractId('foundmarbles').should.deep.equal({channel: 'mychannel', id: 'foundmarbles'});
        });
    });

    it('should return the list of mspid\'s defined when getting the list of organizations', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.json', walletFacadeFactory);
        connectorConfiguration.getOrganizations().should.deep.equal(['Org1MSP', 'Org2MSP']);
    });

    it('should return the correct aliases for defined admins', async () => {
        walletFacade.getAllIdentityNames.resolves(['User1', 'admin']);

        const testIdentity = {
            mspid : 'Org1MSP',
            certificate : '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----',
            privateKey : '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----',
        };
        walletFacade.export.resolves(testIdentity);
        const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
        connectorConfiguration.getAdminAliasNamesForOrganization('Org1MSP').should.deep.equal(['admin']);
    });
});
