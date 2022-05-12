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
const GenerateWallet = require('../utils/GenerateWallet');
const ConnectionProfileDefinition = require('../../lib/connector-configuration/ConnectionProfileDefinition');

const networkConfigWithNoIdentities = './test/sample-configs/NoIdentitiesNetworkConfig.yaml';
const YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet = './test/sample-configs/BasicConfig.yaml';
const JsonNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet = './test/sample-configs/BasicConfig.json';
const YamlNetworkConfigWithPeer = './test/sample-configs/NetworkConfigWithPeers.yaml';
const JsonNetworkConfigWithPeer = './test/sample-configs/NetworkConfigWithPeers.json';
const expectedConnectionProfile = {
    name: 'network',
    version: '1.0.0',
    client: { organization: 'Org1MSP' },
    organizations: {
        Org1MSP: {
            mspid: 'Org1MSP', peers: [
                'Org1MSP_peer0.org1.example.com:7051',
                'Org1MSP_peer1.org1.example.com:7052'
            ]
        }
    },
    peers: {
        'Org1MSP_peer0.org1.example.com:7051': {
            url: 'grpcs://peer0.org1.example.com:7051',
            tlsCACerts: {
                pem: '-----BEGIN CERTIFICATE-----\n' +
                    'MIICWDCCAf6gAwIBAgIRAMpSgWFjDHOohXa0R6e9THgwCgYIKoZIzj0EAwIwdjEL\n' +
                    'MAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNhbiBG\n' +
                    'cmFuY2lzY28xGTAXBgNVBAoTEG9yZzEuZXhhbXBsZS5jb20xHzAdBgNVBAMTFnRs\n' +
                    'c2NhLm9yZzEuZXhhbXBsZS5jb20wHhcNMjAwOTA3MTE0MjAwWhcNMzAwOTA1MTE0\n' +
                    'MjAwWjB2MQswCQYDVQQGEwJVUzETMBEGA1UECBMKQ2FsaWZvcm5pYTEWMBQGA1UE\n' +
                    'BxMNU2FuIEZyYW5jaXNjbzEZMBcGA1UEChMQb3JnMS5leGFtcGxlLmNvbTEfMB0G\n' +
                    'A1UEAxMWdGxzY2Eub3JnMS5leGFtcGxlLmNvbTBZMBMGByqGSM49AgEGCCqGSM49\n' +
                    'AwEHA0IABMdLvSUDIjWYuBw4YVvJEW6ifFLymOAX7GKY6btVPDlkdeJ8vZErXLMz\n' +
                    'JWjivr/L5V2YnZqv0OWPMMfPv+zH+RGjbTBrMA4GA1UdDwEB/wQEAwIBpjAdBgNV\n' +
                    'HSUEFjAUBggrBgEFBQcDAgYIKwYBBQUHAwEwDwYDVR0TAQH/BAUwAwEB/zApBgNV\n' +
                    'HQ4EIgQg5fOhyzwaLKm3t54/H4b0aTe7/nGPyJZNh9IFRK6fDaAwCgYIKoZIzj0E\n' +
                    'AwIDSAAwRQIhAKEny//JY7GXZ/THsQIvUTYmXsjP/bLTI/VuLX7TzcefAiBYoSyY\n' +
                    'y90rdprI6Mp6RPiqjVf02P5ZC86UkP0Vw4pfiQ==\n' +
                    '-----END CERTIFICATE-----\n'
            },
            grpcOptions: { 'grpc.ssl-target-name-overide': 'override' }
        },
        'Org1MSP_peer1.org1.example.com:7052': {
            url: 'grpc://peer1.org1.example.com:7052',
            grpcOptions: { 'grpc.keepalive': 100 }
        }
    }
};

const networkConfigWithoutPeersOrConnProfile = './test/sample-configs/NoConnProfileOrPeersNetworkConfig.yaml';

describe('A valid Connector Configuration', () => {
    let walletFacadeFactory;
    let inMemoryWalletFacade;

    beforeEach(() => {
        const walletSetup = new GenerateWallet().createStandardTestWalletSetup();
        walletFacadeFactory = walletSetup.walletFacadeFactory;
        inMemoryWalletFacade = walletSetup.inMemoryWalletFacade;
    });

    describe('for mutual TLS', () => {
        it('should report true if specified as true in the configuration', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            connectorConfiguration.isMutualTLS().should.be.true;
        });

        it('should report false if specified as false in the configuration', async () => {
            const configFile = new GenerateConfiguration(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet).generateConfigurationFileWithSpecifics(
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
            const configFile = new GenerateConfiguration(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet).generateConfigurationFileWithSpecifics(
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
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            const channelNames = connectorConfiguration.getAllChannelNames();
            channelNames.length.should.equal(3);
            channelNames[0].should.equal('mychannel', 'somechannel', 'yourchannel');
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
            const configFile = new GenerateConfiguration(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet).generateConfigurationFileWithSpecifics(
                {
                    channels: []
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const channelNames = connectorConfiguration.getAllChannelNames();
            channelNames.length.should.equal(0);
        });

        it('should provide an empty list of channel names if channel section is not an array', async () => {
            const configFile = new GenerateConfiguration(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet).generateConfigurationFileWithSpecifics(
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
        it('should provide a list of the channel names that requires creation', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            const channelNames = connectorConfiguration.getChannelNamesForCreation();
            channelNames.length.should.equal(2);
            channelNames[0].should.equal('mychannel');
        });

        it('should provide an empty list if no channels require creation', async () => {
            const configFile = new GenerateConfiguration(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet).generateConfigurationFileReplacingProperties(
                'create',
                false
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const channelNames = connectorConfiguration.getChannelNamesForCreation();
            channelNames.length.should.equal(0);
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
            const configFile = new GenerateConfiguration(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet).generateConfigurationFileWithSpecifics(
                {
                    channels: []
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const channelNames = connectorConfiguration.getChannelNamesForCreation();
            channelNames.length.should.equal(0);
        });

        it('should provide an empty list of channel names if channel section is not an array', async () => {
            const configFile = new GenerateConfiguration(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet).generateConfigurationFileWithSpecifics(
                {
                    channels: {}
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const channelNames = connectorConfiguration.getChannelNamesForCreation();
            channelNames.length.should.equal(0);
        });

        it('should be able retrieve a channel creation definition if it exists', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            const channelDefinition = connectorConfiguration.getCreationDefinitionForChannelName('mychannel');
            channelDefinition.should.deep.equal({
                buildTransaction: {
                    capabilities: [],
                    consortium: 'SampleConsortium2',
                    msps: ['Org1MSP', 'Org2MSP'],
                    version: 0
                }
            });
        });

        it('should return null if no channel definition exists', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            const channelDefinition = connectorConfiguration.getCreationDefinitionForChannelName('non-existant');
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
            const channelDefinition = connectorConfiguration.getCreationDefinitionForChannelName('mychannel');
            should.equal(channelDefinition, null);
        });

        it('should return null for a channel definition if channel section is empty', async () => {
            const configFile = new GenerateConfiguration(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet).generateConfigurationFileWithSpecifics(
                {
                    channels: []
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const channelDefinition = connectorConfiguration.getCreationDefinitionForChannelName('mychannel');
            should.equal(channelDefinition, null);
        });

        it('should return null for a channel definition if channel section is not an array', async () => {
            const configFile = new GenerateConfiguration(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet).generateConfigurationFileWithSpecifics(
                {
                    channels: {}
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const channelDefinition = connectorConfiguration.getCreationDefinitionForChannelName('mychannel');
            should.equal(channelDefinition, null);
        });
    });

    describe('for finding the Contract Definitions For a Channel Name', () => {
        it('should throw an error if contracts have the same ID', async () => {
            const configFile = new GenerateConfiguration(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet).generateConfigurationFileReplacingProperties('contractID', 'replicatedID');
            await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory).should.be.rejectedWith(/replicatedID has already been defined in the configuration/);
        });

        it('should return the contract definitions for the specified channel if there are contracts', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            const result = [{
                id: 'marbles',
                contractID: 'myMarbles',
                install: {
                    version: 'v0',
                    language: 'golang',
                    path: 'marbles/go',
                    metadataPath: 'src/marbles/go/metadata'
                },
                instantiate: {
                    initFunction: 'init',
                    initArguments: [],
                    initTransientMap: {
                        key1: 'value1',
                        key2: 'value2'
                    },
                    endorsementPolicy: '',
                    collectionsConfig: ''
                }
            }];

            const contractDefinitions = connectorConfiguration.getContractDefinitionsForChannelName('mychannel');
            contractDefinitions.should.deep.equal(result);
        });

        it('should return an empty array if there are no contracts for the specified channel', async () => {
            const configFile = new GenerateConfiguration(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet).generateConfigurationFileWithSpecifics(
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
            const configFile = new GenerateConfiguration(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet).generateConfigurationFileWithSpecifics(
                {
                    channels: {}
                });
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            const contractDef = connectorConfiguration.getContractDefinitionsForChannelName('mychannel');
            contractDef.length.should.equal(0);
        });

        it('should return an empty array if there is not contract property', async () => {
            const configFile = new GenerateConfiguration(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet).generateConfigurationFileWithSpecifics(
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
        it('should return the correct aliases for the default organisation', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            await connectorConfiguration.getAliasNamesForOrganization('Org1MSP').should.eventually.deep.equal(['admin', 'user']);
        });

        it('should return the correct aliases for a non default organisation', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            await connectorConfiguration.getAliasNamesForOrganization('Org2MSP').should.eventually.deep.equal(['_Org2MSP_issuer', '_Org2MSP_admin']);
        });

        it('should return an empty array when there are no aliases for the organization', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            await connectorConfiguration.getAliasNamesForOrganization('org3MSP').should.eventually.deep.equal([]);
        });
    });

    describe('when getting a connection profile definition when a connection profile is referenced in the network configuration', () => {
        it('should throw an error if the connection profile information is not provided', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(networkConfigWithoutPeersOrConnProfile, walletFacadeFactory);
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP')
                .should.be.rejectedWith(/No connection profile or peers entry for organization Org1MSP has been defined/);
        });

        it('should throw an error if the connection profile file doesn\'t exist', async () => {
            const configFile = new GenerateConfiguration(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet).generateConfigurationFileReplacingProperties(
                'path',
                '/some/non/existant/path',
                'connectionProfile'
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org2MSP')
                .should.be.rejectedWith(/No connection profile file found/);
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP')
                .should.be.rejectedWith(/No connection profile file found/);
        });

        it('should throw an error if the connection profile path property doesn\'t exist', async () => {
            const configFile = new GenerateConfiguration(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet).generateConfigurationFileWithSpecifics(
                {
                    organizations: [
                        {
                            mspid: 'Org1MSP',
                            identities: {
                                certificates: [
                                    {
                                        name: 'User1',
                                        clientPrivateKey: {
                                            pem: '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----'
                                        },
                                        clientSignedCert: {
                                            pem: '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----'
                                        }
                                    }
                                ]
                            },
                            connectionProfile: {
                                discover: true
                            }
                        }
                    ]
                }
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP')
                .should.be.rejectedWith(/No path for the connection profile for organization Org1MSP has been defined/);
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

        it('should return a connection profile definition if a valid network config json file is provided', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(JsonNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            const connectionProfileDefinition = await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP');
            connectionProfileDefinition.should.be.instanceOf(ConnectionProfileDefinition);
            connectionProfileDefinition.isDynamicConnectionProfile().should.be.true;
            connectionProfileDefinition.getConnectionProfile().name.should.equal('test-network-org1');
        });

        it('should return a connection profile definition if a valid network config yaml file is provided', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            const connectionProfileDefinition = await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP');
            connectionProfileDefinition.should.be.instanceOf(ConnectionProfileDefinition);
            connectionProfileDefinition.isDynamicConnectionProfile().should.be.true;
            connectionProfileDefinition.getConnectionProfile().name.should.equal('test-network-org1');
        });

        it('should throw an error if a file containing invalid json is provided for the connection profile', async () => {
            const configFile = new GenerateConfiguration(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet).generateConfigurationFileReplacingProperties(
                'path',
                './test/sample-configs/invalid.json',
                'connectionProfile'
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP').should.be.rejectedWith(/Failed to parse the .*invalid.json/);
        });

        it('should throw an error if a file containing invalid yaml is provided for the connection profile', async () => {
            const configFile = new GenerateConfiguration(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet).generateConfigurationFileReplacingProperties(
                'path',
                './test/sample-configs/invalid.yaml',
                'connectionProfile'
            );
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, walletFacadeFactory);
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP').should.be.rejectedWith(/Failed to parse the .*invalid.yaml/);
        });

        it('should not attempt to load the connection profile more than once', async () => {

            const connectorConfiguration = await new ConnectorConfigurationFactory().create(JsonNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            sinon.spy(connectorConfiguration, '_loadConnectionProfile');
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP');
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP');
            sinon.assert.calledOnce(connectorConfiguration._loadConnectionProfile);
        });
    });

    describe('when getting a connection profile definition when peers are provided in the network configuration', () => {
        it('should throw an error if no peers or connection profile are provided', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(networkConfigWithoutPeersOrConnProfile, walletFacadeFactory);
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP')
                .should.be.rejectedWith(/No connection profile or peers entry for organization Org1MSP has been defined/);
        });

        it('should throw an error if a peer doesn\'t have an endpoint specified', async () => {
            let networkConfig = new GenerateConfiguration(networkConfigWithoutPeersOrConnProfile).generateConfigurationFileWithSpecifics({
                organizations: [
                    {
                        mspid: 'Org1MSP',
                        peers: [
                            {
                                endpont: 'peer0.org1.example.com:7051'
                            }
                        ]
                    }
                ]
            });

            let connectorConfiguration = await new ConnectorConfigurationFactory().create(networkConfig, walletFacadeFactory);
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP')
                .should.be.rejectedWith(/Peers are defined for organization Org1MSP but one or more entries do not have an endpoint defined/);

            networkConfig = new GenerateConfiguration(networkConfigWithoutPeersOrConnProfile).generateConfigurationFileWithSpecifics({
                organizations: [
                    {
                        mspid: 'Org1MSP',
                        peers: [
                            {
                                endpoint: 'peer0.org1.example.com:7051'
                            },
                            {
                                endpont: 'peer1.org1.example.com:7052'
                            }

                        ]
                    }
                ]
            });

            connectorConfiguration = await new ConnectorConfigurationFactory().create(networkConfig, walletFacadeFactory);
            await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP')
                .should.be.rejectedWith(/Peers are defined for organization Org1MSP but one or more entries do not have an endpoint defined/);
        });

        it('should throw an error if the TlsCACert for the peer isn\'t specified in pem or path format', async () => {
            const networkConfig = new GenerateConfiguration(networkConfigWithoutPeersOrConnProfile).generateConfigurationFileWithSpecifics({
                organizations: [
                    {
                        mspid: 'Org1MSP',
                        peers: [
                            {
                                endpoint: 'peer0.org1.example.com:7051',
                                tlsCACerts: {
                                    pth: 'path/to/some/file'
                                }
                            }
                        ]
                    }
                ]
            });
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(networkConfig, walletFacadeFactory);
            const connectionProfileDefinition = await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP');
            await connectionProfileDefinition.getTlsCACertsForPeer('Org1MSP_peer0.org1.example.com:7051')
                .should.be.rejectedWith(/No valid tls cert option provided in the Org1MSP_peer0.org1.example.com:7051.tlsCACerts property of connection profile/);
        });

        it('should throw an error if the TlsCACert for the peer specified in path cannot be found', async () => {
            const networkConfig = new GenerateConfiguration(networkConfigWithoutPeersOrConnProfile).generateConfigurationFileWithSpecifics({
                organizations: [
                    {
                        mspid: 'Org1MSP',
                        peers: [
                            {
                                endpoint: 'peer0.org1.example.com:7051',
                                tlsCACerts: {
                                    path: 'path/to/nonexistent/file'
                                }
                            }
                        ]
                    }
                ]
            });
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(networkConfig, walletFacadeFactory);
            const connectionProfileDefinition = await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP');
            await connectionProfileDefinition.getTlsCACertsForPeer('Org1MSP_peer0.org1.example.com:7051')
                .should.be.rejectedWith(/path property does not point to a file that exists at .* for Org1MSP_peer0.org1.example.com:7051/);
        });

        const checkValidConnectionProfileDefinition = async (networkConfig) => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(networkConfig, walletFacadeFactory);
            const connectionProfileDefinition = await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP');
            connectionProfileDefinition.should.be.instanceOf(ConnectionProfileDefinition);
            connectionProfileDefinition.isDynamicConnectionProfile().should.be.true;
            connectionProfileDefinition.getConnectionProfile().should.deep.equal(expectedConnectionProfile);
            connectionProfileDefinition.getPeersListForOrganization('Org1MSP').should.deep.equal([
                'Org1MSP_peer0.org1.example.com:7051',
                'Org1MSP_peer1.org1.example.com:7052',
            ]);
            connectionProfileDefinition.getTlsCACertsForPeer('Org1MSP_peer0.org1.example.com:7051').should.not.be.undefined;
            connectionProfileDefinition.isTLSRequiredForEndpoint('Org1MSP_peer0.org1.example.com:7051').should.be.true;
            connectionProfileDefinition.isTLSRequiredForEndpoint('Org1MSP_peer1.org1.example.com:7052').should.be.false;
        };

        it('should return a connection profile definition if a valid json network config file is provided', async () => {
            await checkValidConnectionProfileDefinition(JsonNetworkConfigWithPeer);
        });

        it('should return a connection profile definition if a valid yaml network config file is provided', async () => {
            await checkValidConnectionProfileDefinition(YamlNetworkConfigWithPeer);
        });

        const checkURL = async (networkConfig, url) => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(networkConfig, walletFacadeFactory);
            const connectionProfileDefinition = await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP');
            const firstPeerId = connectionProfileDefinition.getPeersListForOrganization('Org1MSP')[0];
            firstPeerId.should.equal('Org1MSP_peer0.org1.example.com:7051');
            connectionProfileDefinition.getConnectionProfile().peers[firstPeerId].url.should.equal(url);
            connectionProfileDefinition.getGrpcEndPointForPeer(firstPeerId).should.equal(url.replace(/grpc:\/\/|grpcs:\/\//, ''));
        };

        it('should create a connection profile with a peer url of grpc if tlsCaCerts not provided', async () => {
            const networkConfig = new GenerateConfiguration(networkConfigWithoutPeersOrConnProfile).generateConfigurationFileWithSpecifics({
                organizations: [
                    {
                        mspid: 'Org1MSP',
                        peers: [
                            {
                                endpoint: 'peer0.org1.example.com:7051'
                            }
                        ]
                    }
                ]
            });
            await checkURL(networkConfig, 'grpc://peer0.org1.example.com:7051');
        });

        it('should create a connection profile with a peer url of grpcs if tlsCaCerts provided', async () => {
            const networkConfig = new GenerateConfiguration(networkConfigWithoutPeersOrConnProfile).generateConfigurationFileWithSpecifics({
                organizations: [
                    {
                        mspid: 'Org1MSP',
                        peers: [
                            {
                                endpoint: 'peer0.org1.example.com:7051',
                                tlsCACerts: {
                                    path: 'path/to/nonexistent/file'
                                }
                            }
                        ]
                    }
                ]
            });
            await checkURL(networkConfig, 'grpcs://peer0.org1.example.com:7051');
        });

        it('should return grpcOptions when specified', async () => {
            const networkConfig = new GenerateConfiguration(networkConfigWithoutPeersOrConnProfile).generateConfigurationFileWithSpecifics({
                organizations: [
                    {
                        mspid: 'Org1MSP',
                        peers: [
                            {
                                endpoint: 'peer0.org1.example.com:7051',
                                grpcOptions: {
                                    'grpc.opt': 'stuff'
                                }
                            }
                        ]
                    }
                ]
            });
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(networkConfig, walletFacadeFactory);
            const connectionProfileDefinition = await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP');
            const firstPeerId = connectionProfileDefinition.getPeersListForOrganization('Org1MSP')[0];
            firstPeerId.should.equal('Org1MSP_peer0.org1.example.com:7051');
            connectionProfileDefinition.getConnectionProfile().peers[firstPeerId].grpcOptions.should.deep.equal({
                'grpc.opt': 'stuff'
            });
            connectionProfileDefinition.getGrpcOptionsForPeer(firstPeerId).should.deep.equal({
                'grpc.opt': 'stuff'
            });
        });

        it('should return a blank object for grpcOptions if no grpc options specified', async () => {
            const networkConfig = new GenerateConfiguration(networkConfigWithoutPeersOrConnProfile).generateConfigurationFileWithSpecifics({
                organizations: [
                    {
                        mspid: 'Org1MSP',
                        peers: [
                            {
                                endpoint: 'peer0.org1.example.com:7051'
                            }
                        ]
                    }
                ]
            });
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(networkConfig, walletFacadeFactory);
            const connectionProfileDefinition = await connectorConfiguration.getConnectionProfileDefinitionForOrganization('Org1MSP');
            const firstPeerId = connectionProfileDefinition.getPeersListForOrganization('Org1MSP')[0];
            firstPeerId.should.equal('Org1MSP_peer0.org1.example.com:7051');
            should.equal(connectionProfileDefinition.getConnectionProfile().peers[firstPeerId].grpcOptions, undefined);
            connectionProfileDefinition.getGrpcOptionsForPeer(firstPeerId).should.deep.equal({});
        });
    });

    describe('when getting the in memory wallet that contains all identities', () => {
        it('should return the wallet facade when requested', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            await connectorConfiguration.getWalletFacade().should.equal(inMemoryWalletFacade);
        });

        it('should return a wallet when requested', async () => {
            inMemoryWalletFacade.getWallet.returns('IamAwallet');
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            await connectorConfiguration.getWallet().should.equal('IamAwallet');
        });
    });

    describe('when getting an alias name', () => {
        it('should get an appropriate alias name when mspid and identity name provided', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            connectorConfiguration.getAliasNameForOrganizationAndIdentityName('Org1MSP', 'admin').should.equal('admin');
            connectorConfiguration.getAliasNameForOrganizationAndIdentityName('Org2MSP', 'issuer').should.equal('_Org2MSP_issuer');
        });

        it('should get an appropriate alias name when no mspid is provided', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            connectorConfiguration.getAliasNameForOrganizationAndIdentityName('', 'admin').should.equal('admin');
            connectorConfiguration.getAliasNameForOrganizationAndIdentityName(null, 'user').should.equal('user');
            connectorConfiguration.getAliasNameForOrganizationAndIdentityName(undefined, 'user').should.equal('user');
        });

        it('should get an appropriate alias name when no identity is provided', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            connectorConfiguration.getAliasNameForOrganizationAndIdentityName('Org1MSP').should.equal('admin');
            connectorConfiguration.getAliasNameForOrganizationAndIdentityName('Org2MSP').should.equal('_Org2MSP_issuer');
            connectorConfiguration.getAliasNameForOrganizationAndIdentityName('Org2MSP', '').should.equal('_Org2MSP_issuer');
            connectorConfiguration.getAliasNameForOrganizationAndIdentityName('Org2MSP', null).should.equal('_Org2MSP_issuer');

        });

        it('should get an appropriate alias name when no mspid or identity is provided', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            connectorConfiguration.getAliasNameForOrganizationAndIdentityName().should.equal('admin');
        });

    });

    describe('when getting contract details by id', () => {
        it('should return the right contract details', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            connectorConfiguration.getContractDetailsForContractId('myMarbles').should.deep.equal({ channel: 'mychannel', id: 'marbles' });
            connectorConfiguration.getContractDetailsForContractId('lostMyMarbles').should.deep.equal({ channel: 'yourchannel', id: 'marbles' });
        });

        it('should return undefined if id not found', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            should.equal(connectorConfiguration.getContractDetailsForContractId('NoMarbles'), undefined);
        });

        it('should set the contract id property to the id property of the contract if the contract id property is not specified', async () => {
            const configFile = new GenerateConfiguration(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet).generateConfigurationFileWithSpecifics(
                {
                    channels: [
                        {
                            channelName: 'mychannel',
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
            connectorConfiguration.getContractDetailsForContractId('foundmarbles').should.deep.equal({ channel: 'mychannel', id: 'foundmarbles' });
        });
    });

    describe('when getting the orderers in channel', () => {
        it('should return a map of channel names with their orderers', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(JsonNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            const orderersInChannelMap = await connectorConfiguration.getOrderersInChannelMap();
            orderersInChannelMap.size.should.equal(2);
            orderersInChannelMap.get('mychannel').should.deep.equal(['orderer0.example.com', 'orderer1.example.com']);
            orderersInChannelMap.get('yourchannel').should.deep.equal(['orderer0.example.com', 'orderer1.example.com']);
        });
        it('should throw an error if a channel cannot be found in any of the connection profiles', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            await connectorConfiguration.getOrderersInChannelMap()
                .should.be.rejectedWith(/No orderers could be found for channel somechannel/);
        });
    });

    describe('when getting channel/orgs/endorsing peers map', () => {
        it('should return a correct map', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfigWithStaticCCP.yaml', walletFacadeFactory);
            const endorsingPeersInChannelByOrganization = await connectorConfiguration.getEndorsingPeersInChannelByOrganizationMap();
            endorsingPeersInChannelByOrganization.size.should.equal(2);
            const mychannelMap = endorsingPeersInChannelByOrganization.get('mychannel');
            mychannelMap.size.should.equal(2);
            mychannelMap.get('Org1MSP').should.deep.equal(['peer0.org1.example.com', 'peer1.org1.example.com']);
            mychannelMap.get('Org2MSP').should.deep.equal(['peer0.org2.example.com']);
            const yourchannelMap = endorsingPeersInChannelByOrganization.get('yourchannel');
            yourchannelMap.size.should.equal(2);
            yourchannelMap.get('Org1MSP').should.deep.equal(['peer0.org1.example.com']);
            yourchannelMap.get('Org2MSP').should.deep.equal(['peer0.org2.example.com']);
        });

        it('should throw an error if a channel cannot be found in any of the connection profiles', async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(JsonNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
            await connectorConfiguration.getEndorsingPeersInChannelByOrganizationMap()
                .should.be.rejectedWith(/No channel mychannel defined in the connection profile for organization Org1MSP/);
        });
    });

    it('should return the list of mspid\'s defined when getting the list of organizations', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(JsonNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
        connectorConfiguration.getOrganizations().should.deep.equal(['Org1MSP', 'Org2MSP']);
    });

    it('should return the correct aliases for defined admins', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(YamlNetworkConfigWithConnProfileAnd2Orgs1AdminInWallet, walletFacadeFactory);
        connectorConfiguration.getAdminAliasNamesForOrganization('Org1MSP').should.deep.equal(['admin']);
    });

    it('show throw an error if an organization has no identities defined', async () => {
        await new ConnectorConfigurationFactory().create(networkConfigWithNoIdentities, new GenerateWallet().createEmptyTestWalletSetup().walletFacadeFactory)
            .should.be.rejectedWith(/Organization Org1MSP has been defined without at least 1 identity associated with it/);
    });
});
