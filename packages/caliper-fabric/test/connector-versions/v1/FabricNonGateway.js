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
const path = require('path');

const configWith2Orgs1AdminInWallet = '../../sample-configs/BasicConfigWithStaticCCP.yaml';
const configWith2Orgs1AdminInWalletWithDiscover = '../../sample-configs/BasicConfig.yaml';

const { Client, Channel, ChannelEventHub, Constants } = require('./ClientStubs');
const GenerateConfiguration = require('../../utils/GenerateConfiguration');
const GenerateWallet = require('../../utils/GenerateWallet');
const ConnectorConfigurationFactory = require('../../../lib/connector-configuration/ConnectorConfigurationFactory');

describe('A Node-SDK V1 Fabric Non Gateway', () => {
    let stubWalletFacadeFactory;
    let FabricNonGateway;
    let FabricConnectorContext;
    let TxStatus;

    before(() => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            useCleanCache: true
        });

        mockery.registerMock('fabric-client', Client);
        mockery.registerMock('fabric-client/lib/Constants', Constants);
        mockery.registerMock('fabric-client/package', {version: '1.4.11'});
        mockery.registerMock('./FabricChannelOperations', class {
            /** */
            async createChannelsAndJoinPeers() {}
        });
        mockery.registerMock('./FabricChaincodeOperations', class {
            /** */
            async installAndInstantiateChaincodes() {}
        });

        FabricNonGateway = require('../../../lib/connector-versions/v1/FabricNonGateway');
        FabricConnectorContext = require('../../../lib/FabricConnectorContext');
        TxStatus = require('@hyperledger/caliper-core').TxStatus;
    });

    after(() => {
        mockery.deregisterAll();
        mockery.disable();
    });

    beforeEach(() => {
        Client.reset();
        Channel.reset();
        ChannelEventHub.reset();
        const walletSetup = new GenerateWallet().createStandardTestWalletSetup();
        stubWalletFacadeFactory = walletSetup.walletFacadeFactory;
    });

    it('should be able to initialise in preperation for use by a caliper master', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWallet), stubWalletFacadeFactory);
        const fabricNonGateway = new FabricNonGateway(connectorConfiguration, 1, 'fabric');
        await fabricNonGateway.init().should.not.be.rejected;
    });

    it('should throw an error if the connection profile is defined with discover when initalizing for use by caliper master', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWalletWithDiscover), stubWalletFacadeFactory);
        const fabricNonGateway = new FabricNonGateway(connectorConfiguration, 1, 'fabric');
        await fabricNonGateway.init().should.be.rejectedWith(/Connection profiles for the organization\(s\).*Org1MSP.*have been specified as discover which is not allowed/);
    });

    it('should do nothing when requested install a smart contract when the configuration doesn\'t require it', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWallet), stubWalletFacadeFactory);
        const fabricNonGateway = new FabricNonGateway(connectorConfiguration, 1, 'fabric');
        await fabricNonGateway.installSmartContract().should.not.be.rejected;
    });

    it('should return a context when preparing for use by a caliper worker', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWallet), stubWalletFacadeFactory);
        const fabricNonGateway = new FabricNonGateway(connectorConfiguration, 1, 'fabric');
        const context = await fabricNonGateway.getContext();
        context.should.be.instanceOf(FabricConnectorContext);
    });

    it('should return the same context when requested multiple times', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWallet), stubWalletFacadeFactory);
        const fabricNonGateway = new FabricNonGateway(connectorConfiguration, 1, 'fabric');
        const context = await fabricNonGateway.getContext();
        const context2 = await fabricNonGateway.getContext();
        context2.should.equal(context);
    });

    it('should throw an error if the connection profile is defined with discover when getting a context', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWalletWithDiscover), stubWalletFacadeFactory);
        const fabricNonGateway = new FabricNonGateway(connectorConfiguration, 1, 'fabric');
        await fabricNonGateway.getContext().should.be.rejectedWith(/Connection profiles for the organization\(s\).*Org1MSP.*have been specified as discover which is not allowed/);
    });


    it('should create Clients and set tls identity when a context is first requested', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWallet), stubWalletFacadeFactory);
        const fabricNonGateway = new FabricNonGateway(connectorConfiguration, 1, 'fabric');
        const context = await fabricNonGateway.getContext();
        context.should.be.instanceOf(FabricConnectorContext);
        Client.loadFromConfigCalls.should.equal(4);
        Client.setTlsClientCertAndKeyCalls.should.equal(4);
        Client.setTlsClientCertAndKeyArgs.should.deep.equal(['-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----', '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----']);
    });

    it('should create Clients and not set tls identity when a context is first requested when mutualTls is set to false', async () => {
        const configFile = new GenerateConfiguration(path.resolve(__dirname, configWith2Orgs1AdminInWallet)).generateConfigurationFileReplacingProperties('mutualTls', false);
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, stubWalletFacadeFactory);
        connectorConfiguration.isMutualTLS().should.be.false;
        const fabricNonGateway = new FabricNonGateway(connectorConfiguration, 1, 'fabric');
        const context = await fabricNonGateway.getContext();
        context.should.be.instanceOf(FabricConnectorContext);
        Client.loadFromConfigCalls.should.equal(4);
        Client.setTlsClientCertAndKeyCalls.should.equal(0);
    });

    it('should disconnect eventhubs and close channels when a context is released', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWallet), stubWalletFacadeFactory);
        const fabricNonGateway = new FabricNonGateway(connectorConfiguration, 1, 'fabric');
        await fabricNonGateway.getContext();
        await fabricNonGateway.releaseContext();
        Channel.closeCalls.should.equal(8);
        ChannelEventHub.disconnectCalls.should.equal(2);
    });

    describe('when interacting with a fabric network', () => {
        let fabricNonGateway;

        beforeEach(async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWallet), stubWalletFacadeFactory);
            fabricNonGateway = new FabricNonGateway(connectorConfiguration, 1, 'fabric');
            await fabricNonGateway.getContext();
        });

        afterEach(async () => {
            await fabricNonGateway.releaseContext();
        });

        describe('should throw an error', () => {
            it('when invokerIdentity is not known', async () => {
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    invokerIdentity: 'NoOne',
                };
                await fabricNonGateway._sendSingleRequest(request).should.be.rejectedWith(/No contracts for invokerIdentity NoOne found/);
            });

            it('when invokerMspId is not known', async () => {
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    invokerMspId: 'Org7',
                    invokerIdentity: 'user'
                };
                await fabricNonGateway._sendSingleRequest(request).should.be.rejectedWith(/No contracts for invokerIdentity user in Org7 found/);
            });

            it('when contractFunction not provided', async () => {
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: '',
                    invokerIdentity: 'user'
                };
                await fabricNonGateway._sendSingleRequest(request).should.be.rejectedWith(/No contractFunction provided/);
                request.contractFunction = null;
                await fabricNonGateway._sendSingleRequest(request).should.be.rejectedWith(/No contractFunction provided/);
                delete request.contractFunction;
                await fabricNonGateway._sendSingleRequest(request).should.be.rejectedWith(/No contractFunction provided/);
            });

            it('when no contractId provided', async () => {
                const request = {
                    channel: 'mychannel',
                    contractId: '',
                    contractFunction: '',
                    invokerIdentity: 'user'
                };
                await fabricNonGateway._sendSingleRequest(request).should.be.rejectedWith(/No contractId provided/);
                request.contractId = null;
                await fabricNonGateway._sendSingleRequest(request).should.be.rejectedWith(/No contractId provided/);
                delete request.contractId;
                await fabricNonGateway._sendSingleRequest(request).should.be.rejectedWith(/No contractId provided/);
            });

            it('when no channel provided and contract id is not a valid contract id', async () => {
                const request = {
                    channel: '',
                    contractId: 'not-a-valid-contract-id',
                    contractFunction: '',
                    invokerIdentity: 'user',
                };
                await fabricNonGateway._sendSingleRequest(request).should.be.rejectedWith(/Could not find details for contract ID not-a-valid-contract-id/);
            });
        });

        describe('by making a submit request', () => {
            it('should succeed and return with an appropriate TxStatus', async () => {
                const args = ['arg1', 'arg2'];
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    contractArguments: args,
                    invokerIdentity: 'user',
                };
                const txStatus = await fabricNonGateway._sendSingleRequest(request);
                txStatus.should.be.instanceOf(TxStatus);
                txStatus.GetID().should.equal('1');
                txStatus.GetStatus().should.equal('success');
                txStatus.GetResult().should.equal('proposalResponse');
                txStatus.IsVerified().should.be.true;
                Channel.sendTransactionProposalCalls.should.equal(1);
                Channel.sendTransactionCalls.should.equal(1);
                Channel.queryByChaincodeCalls.should.equal(0);
                Channel.sendTransactionProposalArgs.fcn.should.equal('myFunction');
                Channel.sendTransactionProposalArgs.args.should.deep.equal(['arg1', 'arg2']);
                Channel.sendTransactionProposalArgs.chaincodeId.should.equal('marbles');

                request.readOnly = false;
                await fabricNonGateway._sendSingleRequest(request);
                Channel.sendTransactionProposalCalls.should.equal(2);
                Channel.sendTransactionCalls.should.equal(2);
                Channel.queryByChaincodeCalls.should.equal(0);
            });

            it('should set the transientMap', async () => {
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    transientMap: {'param1': Buffer.from('value1'), 'param2': Buffer.from('value2')},  // NOTE: Differs from gateway connectors
                    invokerIdentity: 'user'
                };
                await fabricNonGateway._sendSingleRequest(request);

                Channel.sendTransactionProposalArgs.fcn.should.equal('myFunction');
                Channel.sendTransactionProposalArgs.transientMap.should.deep.equal({
                    'param1': Buffer.from('value1'),
                    'param2': Buffer.from('value2')
                });
                Channel.sendTransactionProposalArgs.chaincodeId.should.equal('marbles');
            });

            it('should look up the channel and chaincode id from contractId when no channel provided', async () => {
                const request = {
                    contractId: 'lostMyMarbles',
                    contractFunction: 'myFunction',
                    contractArguments: ['arg1'],
                    invokerIdentity: 'user'
                };
                await fabricNonGateway._sendSingleRequest(request);
                Channel.sendTransactionProposalArgs.fcn.should.equal('myFunction');
                Channel.sendTransactionProposalArgs.args.should.deep.equal(['arg1']);
                Channel.sendTransactionProposalArgs.chaincodeId.should.equal('marbles');
                Client.getChannelArgs.should.equal('yourchannel');
            });

            it('should passthrough the targetPeers value to targets (NOTE: Differs from Gateway Implementations)', async () => {
                const request = {
                    contractId: 'lostMyMarbles',
                    contractFunction: 'myFunction',
                    contractArguments: ['arg1'],
                    invokerIdentity: 'user',
                    targetPeers: ['peer1', 'peer3', 'peer4']
                };
                await fabricNonGateway._sendSingleRequest(request);
                Channel.sendTransactionCalls.should.equal(1);
                Channel.queryByChaincodeCalls.should.equal(0);
                Channel.sendTransactionProposalArgs.targets.should.deep.equal(['peer1', 'peer3', 'peer4']);
            });

            it('should set target peers to all peers in each of the specified endorsing organisations', async () => {
                const targetOrganizations = ['Org1MSP', 'Org3MSP'];
                const request = {
                    contractId: 'lostMyMarbles',
                    contractFunction: 'myFunction',
                    contractArguments: ['arg1'],
                    invokerIdentity: 'user',
                    targetOrganizations
                };
                await fabricNonGateway._sendSingleRequest(request);
                Channel.sendTransactionProposalArgs.targets.length.should.equal(2);
                Channel.sendTransactionProposalArgs.targets[0].getName().should.equal('peer1');
                Channel.sendTransactionProposalArgs.targets[1].getName().should.equal('peer3');
            });

            it('should ignore target organizations when not an array', async () => {
                const request = {
                    contractId: 'lostMyMarbles',
                    contractFunction: 'myFunction',
                    contractArguments: ['arg1'],
                    invokerIdentity: 'user',
                    targetOrganizations: 'Org2MSP'
                };
                await fabricNonGateway._sendSingleRequest(request);
                Channel.sendTransactionProposalArgs.targets.length.should.equal(2);
                Channel.sendTransactionProposalArgs.targets[0].should.equal('peer0.org1.example.com');
                Channel.sendTransactionProposalArgs.targets[1].should.equal('peer0.org2.example.com');
            });

            it('should ignore target Peers when not an array', async () => {
                const request = {
                    contractId: 'lostMyMarbles',
                    contractFunction: 'myFunction',
                    contractArguments: ['arg1'],
                    invokerIdentity: 'user',
                    targetPeers: 'peer2'
                };
                await fabricNonGateway._sendSingleRequest(request);
                Channel.sendTransactionProposalArgs.targets.length.should.equal(2);
                Channel.sendTransactionProposalArgs.targets[0].should.equal('peer0.org1.example.com');
                Channel.sendTransactionProposalArgs.targets[1].should.equal('peer0.org2.example.com');
            });

            it('should use peer targeting only when both target peers and target orgs specified', async () => {
                const request = {
                    contractId: 'lostMyMarbles',
                    contractFunction: 'myFunction',
                    contractArguments: ['arg1'],
                    invokerIdentity: 'user',
                    targetPeers: ['peer1'],
                    targetOrganizations: ['Org1MSP']
                };
                await fabricNonGateway._sendSingleRequest(request);
                Channel.sendTransactionProposalArgs.targets.length.should.equal(1);
                Channel.sendTransactionProposalArgs.targets[0].should.equal('peer1');
            });

            it('should return an appropriate TxStatus if sendTransactionProposal throws an error', async () => {
                const args = ['arg1', 'arg2'];
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    contractArguments: args,
                    invokerIdentity: 'user',
                };
                Channel.throwOnSendTransactionProposal(new Error('submit-failure'));
                const txStatus = await fabricNonGateway._sendSingleRequest(request);
                txStatus.should.be.instanceOf(TxStatus);
                txStatus.GetID().should.equal('1');
                txStatus.GetStatus().should.equal('failed');
                txStatus.GetResult().should.equal('');
                txStatus.IsVerified().should.be.true;
            });

            it('should return an appropriate TxStatus if sendTransaction throws an error', async () => {
                const args = ['arg1', 'arg2'];
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    contractArguments: args,
                    invokerIdentity: 'user',
                };
                Channel.throwOnSendTransaction(new Error('submit-failure'));
                const txStatus = await fabricNonGateway._sendSingleRequest(request);
                txStatus.should.be.instanceOf(TxStatus);
                txStatus.GetID().should.equal('1');
                txStatus.GetStatus().should.equal('failed');
                txStatus.GetResult().should.equal('');
                txStatus.IsVerified().should.be.true;
            });

            it('should return an appropriate TxStatus if sendTransaction doesnt return SUCCESS', async () => {
                const args = ['arg1', 'arg2'];
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    contractArguments: args,
                    invokerIdentity: 'user',
                };
                Channel.failOnSendTransaction();
                const txStatus = await fabricNonGateway._sendSingleRequest(request);
                txStatus.should.be.instanceOf(TxStatus);
                txStatus.GetID().should.equal('1');
                txStatus.GetStatus().should.equal('failed');
                txStatus.GetResult().should.equal('');
                txStatus.IsVerified().should.be.true;
            });

            it('should succeed when no invokerIdentity provided', async () => {
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    invokerIdentity: ''
                };
                let txStatus = await fabricNonGateway._sendSingleRequest(request);
                txStatus.should.be.instanceOf(TxStatus);
                txStatus.GetID().should.equal('1');
                txStatus.GetStatus().should.equal('success');
                txStatus.GetResult().should.equal('proposalResponse');
                txStatus.IsVerified().should.be.true;

                request.invokerIdentity = null;
                txStatus = await fabricNonGateway._sendSingleRequest(request);
                txStatus.should.be.instanceOf(TxStatus);

                delete request.invokerIdentity;
                txStatus = await fabricNonGateway._sendSingleRequest(request);
                txStatus.should.be.instanceOf(TxStatus);
            });
        });

        describe('by making an evaluate request', () => {
            it('should succeed and return with an appropriate TxStatus', async () => {
                const args = ['arg1', 'arg2'];
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    contractArguments: args,
                    invokerIdentity: 'user',
                    readOnly: true
                };
                const txStatus = await fabricNonGateway._sendSingleRequest(request);
                txStatus.GetID().should.equal('1');
                txStatus.GetStatus().should.equal('success');
                txStatus.GetResult().should.equal('evaluateResponse');
                txStatus.IsVerified().should.be.true;

                Channel.sendTransactionCalls.should.equal(0);
                Channel.queryByChaincodeCalls.should.equal(1);
                Channel.queryByChaincodeArgs.fcn.should.equal('myFunction');
                Channel.queryByChaincodeArgs.args.should.deep.equal(['arg1', 'arg2']);
                Channel.queryByChaincodeArgs.chaincodeId.should.equal('marbles');
            });

            it('should passthrough the targetPeers value to targets (NOTE: Differs from Gateway Implementations)', async () => {
                const request = {
                    contractId: 'lostMyMarbles',
                    contractFunction: 'myFunction',
                    contractArguments: ['arg1'],
                    invokerIdentity: 'user',
                    targetPeers: ['peer1', 'peer3', 'peer4'],
                    readOnly: true
                };
                await fabricNonGateway._sendSingleRequest(request);
                Channel.sendTransactionCalls.should.equal(0);
                Channel.queryByChaincodeCalls.should.equal(1);
                Channel.queryByChaincodeArgs.targets.should.deep.equal(['peer1', 'peer3', 'peer4']);
            });

            it('should ignore target organisations', async () => {
                const targetOrganizations = ['Org1MSP', 'Org3MSP'];
                const request = {
                    contractId: 'lostMyMarbles',
                    contractFunction: 'myFunction',
                    contractArguments: ['arg1'],
                    invokerIdentity: 'user',
                    targetOrganizations,
                    readOnly: true
                };
                await fabricNonGateway._sendSingleRequest(request);

                Channel.sendTransactionCalls.should.equal(0);
                Channel.queryByChaincodeCalls.should.equal(1);
                Channel.queryByChaincodeArgs.targets.length.should.equal(2);
            });

            it('should return an appropriate TxStatus when evaluating a transaction throws an error', async () => {
                const args = ['arg1', 'arg2'];
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    contractArguments: args,
                    invokerIdentity: 'user',
                    readOnly: true
                };
                Channel.throwOnQueryByChaincode(new Error('query-failure'));
                const txStatus = await fabricNonGateway._sendSingleRequest(request);
                txStatus.should.be.instanceOf(TxStatus);
                txStatus.GetID().should.equal('1');
                txStatus.GetStatus().should.equal('failed');
                txStatus.GetResult().should.equal('');
                txStatus.IsVerified().should.be.true;
            });
        });
    });
});
