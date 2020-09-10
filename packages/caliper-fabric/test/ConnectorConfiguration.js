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
const should = chai.should();

const ConnectorConfigurationFactory = require('../lib/ConnectorConfigurationFactory');
const GenerateConfiguration = require('./utils/GenerateConfiguration');

describe('A valid Adapter Configuration', () => {

    describe('for mutual TLS', () => {
        it('should report true if specified as true in the configuration', () => {
            const connectorConfiguration = new ConnectorConfigurationFactory().create('./test/sampleConfigs/BasicConfig.yaml');
            connectorConfiguration.isMutualTLS().should.be.true;
        });

        it('should report false if specified as false in the configuration', () => {
            const configFile = new GenerateConfiguration('./test/sampleConfigs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    caliper: {
                        blockchain: 'fabric',
                        sutOptions: {
                            mutualTls: false
                        }
                    }
                }
            );
            const connectorConfiguration = new ConnectorConfigurationFactory().create(configFile);
            connectorConfiguration.isMutualTLS().should.be.false;
        });

        it('should report false if not specified in the configuration', () => {
            const configFile = new GenerateConfiguration('./test/sampleConfigs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    caliper: {
                        blockchain: 'fabric'
                    }
                }
            );
            const connectorConfiguration = new ConnectorConfigurationFactory().create(configFile);
            connectorConfiguration.isMutualTLS().should.be.false;
        });
    });

    describe('for Channel name retrieval', () => {
        it('should provide a list of all the channel names', () => {
            const connectorConfiguration = new ConnectorConfigurationFactory().create('./test/sampleConfigs/BasicConfig.yaml');
            const channelNames = connectorConfiguration.getAllChannelNames();
            channelNames.length.should.equal(2);
            channelNames[0].should.equal('my-channel', 'your-channel');
        });

        it('should provide an empty list of channel names if channel section not defined', () => {
            const configFile = new GenerateConfiguration().generateConfigurationFileWithSpecifics(
                {
                    caliper: {
                        blockchain: 'fabric'
                    }
                }
            );
            const connectorConfiguration = new ConnectorConfigurationFactory().create(configFile);
            const channelNames = connectorConfiguration.getAllChannelNames();
            channelNames.length.should.equal(0);
        });

        it('should provide an empty list of channel names if channel section is empty', () => {
            const configFile = new GenerateConfiguration('./test/sampleConfigs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: []
                }
            );
            const connectorConfiguration = new ConnectorConfigurationFactory().create(configFile);
            const channelNames = connectorConfiguration.getAllChannelNames();
            channelNames.length.should.equal(0);
        });

        it('should provide an empty list of channel names if channel section is not an array', () => {
            const configFile = new GenerateConfiguration('./test/sampleConfigs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: {}
                }
            );
            const connectorConfiguration = new ConnectorConfigurationFactory().create(configFile);
            const channelNames = connectorConfiguration.getAllChannelNames();
            channelNames.length.should.equal(0);
        });
    });

    describe('for Channel creation', () => {
        it('should provide a list with a single channel name that requires creation', () => {
            const connectorConfiguration = new ConnectorConfigurationFactory().create('./test/sampleConfigs/BasicConfig.yaml');
            const channelNames = connectorConfiguration.getChannelNamesForCreation();
            channelNames.length.should.equal(1);
            channelNames[0].should.equal('my-channel');
        });

        it('should provide an empty list if no channels require creation', () => {
            const configFile = new GenerateConfiguration('./test/sampleConfigs/BasicConfig.yaml').generateConfigurationFileReplacingProperties(
                'create',
                false
            );
            const connectorConfiguration = new ConnectorConfigurationFactory().create(configFile);
            const channelNames = connectorConfiguration.getChannelNamesForCreation();
            channelNames.length.should.equal(0);
        });

        it('should provide a list with more than 1 channel name that requires creation', () => {
            const configFile = new GenerateConfiguration('./test/sampleConfigs/BasicConfig.yaml').generateConfigurationFileReplacingProperties(
                'create',
                true
            );
            const connectorConfiguration = new ConnectorConfigurationFactory().create(configFile);
            const channelNames = connectorConfiguration.getChannelNamesForCreation();
            channelNames.length.should.equal(2);
            channelNames.should.deep.equal(['my-channel', 'your-channel']);
        });

        it('should provide an empty list of channel names if channel section not defined', () => {
            const configFile = new GenerateConfiguration().generateConfigurationFileWithSpecifics(
                {
                    caliper: {
                        blockchain: 'fabric'
                    }
                }
            );
            const connectorConfiguration = new ConnectorConfigurationFactory().create(configFile);
            const channelNames = connectorConfiguration.getChannelNamesForCreation();
            channelNames.length.should.equal(0);
        });

        it('should provide an empty list of channel names if channel section is empty', () => {
            const configFile = new GenerateConfiguration('./test/sampleConfigs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: []
                }
            );
            const connectorConfiguration = new ConnectorConfigurationFactory().create(configFile);
            const channelNames = connectorConfiguration.getChannelNamesForCreation();
            channelNames.length.should.equal(0);
        });

        it('should provide an empty list of channel names if channel section is not an array', () => {
            const configFile = new GenerateConfiguration('./test/sampleConfigs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: {}
                }
            );
            const connectorConfiguration = new ConnectorConfigurationFactory().create(configFile);
            const channelNames = connectorConfiguration.getChannelNamesForCreation();
            channelNames.length.should.equal(0);
        });

        it('should be able retrieve a channel definition if it exists', () => {
            const connectorConfiguration = new ConnectorConfigurationFactory().create('./test/sampleConfigs/BasicConfig.yaml');
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

        it('should return null if no channel definition exists', () => {
            const connectorConfiguration = new ConnectorConfigurationFactory().create('./test/sampleConfigs/BasicConfig.yaml');
            const channelDefinition = connectorConfiguration.getDefinitionForChannelName('non-existant');
            should.equal(channelDefinition, null);
        });

        it('should return null for a channel definition if channel section not defined', () => {
            const configFile = new GenerateConfiguration().generateConfigurationFileWithSpecifics(
                {
                    caliper: {
                        blockchain: 'fabric'
                    }
                }
            );
            const connectorConfiguration = new ConnectorConfigurationFactory().create(configFile);
            const channelDefinition = connectorConfiguration.getDefinitionForChannelName('my-channel');
            should.equal(channelDefinition, null);
        });

        it('should return null for a channel definition if channel section is empty', () => {
            const configFile = new GenerateConfiguration('./test/sampleConfigs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: []
                }
            );
            const connectorConfiguration = new ConnectorConfigurationFactory().create(configFile);
            const channelDefinition = connectorConfiguration.getDefinitionForChannelName('my-channel');
            should.equal(channelDefinition, null);
        });

        it('should return null for a channel definition if channel section is not an array', () => {
            const configFile = new GenerateConfiguration('./test/sampleConfigs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: {}
                }
            );
            const connectorConfiguration = new ConnectorConfigurationFactory().create(configFile);
            const channelDefinition = connectorConfiguration.getDefinitionForChannelName('my-channel');
            should.equal(channelDefinition, null);
        });
    });

    describe('for finding the Contract Definitions For a Channel Name', ()=> {
        it('should return the contract definitions for the specified channel if there are contracts', () => {
            const connectorConfiguration = new ConnectorConfigurationFactory().create('./test/sampleConfigs/BasicConfig.yaml');
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

        it('should return an empty array if there are no contracts for the specified channel', () => {
            const configFile = new GenerateConfiguration('./test/sampleConfigs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: [{
                        channelName: 'my-channel',
                        contracts: []
                    }]
                });
            const connectorConfiguration = new ConnectorConfigurationFactory().create(configFile);
            const contractDef = connectorConfiguration.getContractDefinitionsForChannelName('my-channel');
            contractDef.length.should.equal(0);
        });
        it('should return an empty array if there are no channels', () => {
            const configFile = new GenerateConfiguration('./test/sampleConfigs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: {}
                });
            const connectorConfiguration = new ConnectorConfigurationFactory().create(configFile);
            const contractDef = connectorConfiguration.getContractDefinitionsForChannelName('my-channel');
            contractDef.length.should.equal(0);
        });

        it('should return an empty array if there is not contract property', () => {
            const configFile = new GenerateConfiguration('./test/sampleConfigs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    channels: [{
                        channelName: 'my-channel',
                    }]
                });
            const connectorConfiguration = new ConnectorConfigurationFactory().create(configFile);
            const contractDef = connectorConfiguration.getContractDefinitionsForChannelName('my-channel');
            contractDef.should.deep.equal([]);
        });
    });
});
