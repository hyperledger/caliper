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

const v2ConfigWithSingleUser = '../../sample-configs/BasicConfigWithStaticCCP.yaml';

const { Client, Channel, ChannelEventHub, Constants } = require('./ClientStubs');
const IWalletFacade = require('../../../lib/identity-management/IWalletFacade');
const IWalletFacadeFactory = require('../../../lib/identity-management/IWalletFacadeFactory');
const GenerateConfiguration = require('../../utils/GenerateConfiguration');
const ConnectorConfigurationFactory = require('../../../lib/connector-configuration/ConnectorConfigurationFactory');
const ExportedIdentity = require('../../../lib/identity-management/ExportedIdentity');

describe('A Node-SDK V1 Fabric Non Gateway', () => {
    const stubWalletFacadeFactory = sinon.createStubInstance(IWalletFacadeFactory);

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
        const stubWalletFacade = sinon.createStubInstance(IWalletFacade);
        stubWalletFacadeFactory.create.resolves(stubWalletFacade);
        stubWalletFacade.getAllIdentityNames.returns(['User1']);
        stubWalletFacade.export.resolves(new ExportedIdentity('Org1MSP', 'cert', 'key'));
    });

    it('should be able to initialise in preperation for use by a caliper master', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, v2ConfigWithSingleUser), stubWalletFacadeFactory);
        const fabricNonGateway = new FabricNonGateway(connectorConfiguration, 1, 'fabric');
        await fabricNonGateway.init().should.not.be.rejected;
    });

    it('should do nothing when attempting to install a smart contract', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, v2ConfigWithSingleUser), stubWalletFacadeFactory);
        const fabricNonGateway = new FabricNonGateway(connectorConfiguration, 1, 'fabric');
        await fabricNonGateway.installSmartContract().should.not.be.rejected;
    });

    it('should return a context when preparing for use by a caliper worker', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, v2ConfigWithSingleUser), stubWalletFacadeFactory);
        const fabricNonGateway = new FabricNonGateway(connectorConfiguration, 1, 'fabric');
        const context = await fabricNonGateway.getContext();
        context.should.be.instanceOf(FabricConnectorContext);
    });

    it('should return the same context when requested multiple times', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, v2ConfigWithSingleUser), stubWalletFacadeFactory);
        const fabricNonGateway = new FabricNonGateway(connectorConfiguration, 1, 'fabric');
        const context = await fabricNonGateway.getContext();
        const context2 = await fabricNonGateway.getContext();
        context2.should.equal(context);
    });

    it('should create Clients when a context is first requested', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, v2ConfigWithSingleUser), stubWalletFacadeFactory);
        const fabricNonGateway = new FabricNonGateway(connectorConfiguration, 1, 'fabric');
        const context = await fabricNonGateway.getContext();
        context.should.be.instanceOf(FabricConnectorContext);
        Client.loadFromConfigCalls.should.equal(1);
    });

    it('should disconnect eventhubs and close channels when a context is released', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, v2ConfigWithSingleUser), stubWalletFacadeFactory);
        const fabricNonGateway = new FabricNonGateway(connectorConfiguration, 1, 'fabric');
        await fabricNonGateway.getContext();
        await fabricNonGateway.releaseContext();
        Channel.closeCalls.should.equal(2);
        ChannelEventHub.disconnectCalls.should.equal(2);
    });

    it('should throw an error if channel fails to initialize', async () => {
        Channel.throwOnInitialize(new Error('init-failure'));
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, v2ConfigWithSingleUser), stubWalletFacadeFactory);
        const fabricNonGateway = new FabricNonGateway(connectorConfiguration, 1, 'fabric');
        await fabricNonGateway.getContext().should.be.rejectedWith(/init-failure/);
    });

    describe('when interacting with a fabric network', () => {
        let fabricNonGateway;

        beforeEach(async () => {
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, v2ConfigWithSingleUser), stubWalletFacadeFactory);
            fabricNonGateway = new FabricNonGateway(connectorConfiguration, 1, 'fabric');
            await fabricNonGateway.getContext();
        });

        afterEach(async () => {
            await fabricNonGateway.releaseContext();
        });

        describe('should throw an error', () => {
            it('when no invokerIdentity provided', async () => {
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: '',
                    invokerIdentity: ''
                };
                await fabricNonGateway._sendSingleRequest(request).should.be.rejectedWith(/No invokerIdentity provided/);
                request.invokerIdentity = null;
                await fabricNonGateway._sendSingleRequest(request).should.be.rejectedWith(/No invokerIdentity provided/);
                delete request.invokerIdentity;
                await fabricNonGateway._sendSingleRequest(request).should.be.rejectedWith(/No invokerIdentity provided/);
            });

            it('when invokerIdentity not known', async () => {
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
                    invokerIdentity: 'User1'
                };
                await fabricNonGateway._sendSingleRequest(request).should.be.rejectedWith(/No contracts for invokerIdentity User1 in Org7 found/);
            });

            it('when contractFunction not provided', async () => {
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: '',
                    invokerIdentity: 'User1'
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
                    invokerIdentity: 'User1'
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
                    invokerIdentity: 'User1',
                };
                await fabricNonGateway._sendSingleRequest(request).should.be.rejectedWith(/Could not find details for contract ID not-a-valid-contract-id/);
            });
        });

        describe('by making a submit request', () => {
            it('should succeed, set clientIdentity and return with an appropriate TxStatus', async () => {
                const args = ['arg1', 'arg2'];
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    contractArguments: args,
                    invokerIdentity: 'User1',
                };
                const txStatus = await fabricNonGateway._sendSingleRequest(request);
                txStatus.should.be.instanceOf(TxStatus);
                txStatus.GetID().should.equal('1');
                txStatus.GetStatus().should.equal('success');
                txStatus.GetResult().should.equal('proposalResponse');
                txStatus.IsVerified().should.be.true;
                Client.setTlsClientCertAndKeyCalls.should.equal(1);
                Client.setTlsClientCertAndKeyArgs.should.deep.equal(['cert', 'key']);
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
                    invokerIdentity: 'User1'
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
                    invokerIdentity: 'User1'
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
                    invokerIdentity: 'User1',
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
                    invokerIdentity: 'User1',
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
                    invokerIdentity: 'User1',
                    targetOrganizations: 'Org2MSP'
                };
                await fabricNonGateway._sendSingleRequest(request);
                Channel.sendTransactionProposalArgs.targets.length.should.equal(1);
                Channel.sendTransactionProposalArgs.targets[0].should.equal('peer0.org1.example.com');
            });

            it('should ignore target Peers when not an array', async () => {
                const request = {
                    contractId: 'lostMyMarbles',
                    contractFunction: 'myFunction',
                    contractArguments: ['arg1'],
                    invokerIdentity: 'User1',
                    targetPeers: 'peer2'
                };
                await fabricNonGateway._sendSingleRequest(request);
                Channel.sendTransactionProposalArgs.targets.length.should.equal(1);
                Channel.sendTransactionProposalArgs.targets[0].should.equal('peer0.org1.example.com');
            });

            it('should use peer targeting only when both target peers and target orgs specified', async () => {
                const request = {
                    contractId: 'lostMyMarbles',
                    contractFunction: 'myFunction',
                    contractArguments: ['arg1'],
                    invokerIdentity: 'User1',
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
                    invokerIdentity: 'User1',
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
                    invokerIdentity: 'User1',
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
                    invokerIdentity: 'User1',
                };
                Channel.failOnSendTransaction();
                const txStatus = await fabricNonGateway._sendSingleRequest(request);
                txStatus.should.be.instanceOf(TxStatus);
                txStatus.GetID().should.equal('1');
                txStatus.GetStatus().should.equal('failed');
                txStatus.GetResult().should.equal('');
                txStatus.IsVerified().should.be.true;
            });

            it('should not set the client identity on a gateway when mutual TLS is not specified', async () => {
                Client.reset();
                const configFile = new GenerateConfiguration(path.resolve(__dirname, v2ConfigWithSingleUser)).generateConfigurationFileWithSpecifics(
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
                connectorConfiguration.isMutualTLS().should.be.false;
                fabricNonGateway = new FabricNonGateway(connectorConfiguration, 1, 'fabric');
                await fabricNonGateway.getContext();
                const args = ['arg1', 'arg2'];
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    contractArguments: args,
                    invokerIdentity: 'User1',
                };
                await fabricNonGateway._sendSingleRequest(request);
                Client.setTlsClientCertAndKeyCalls.should.equal(0);
            });
        });

        describe('by making an evaluate request', () => {
            it('should succeed, set clientIdentity and return with an appropriate TxStatus', async () => {
                const args = ['arg1', 'arg2'];
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    contractArguments: args,
                    invokerIdentity: 'User1',
                    readOnly: true
                };
                const txStatus = await fabricNonGateway._sendSingleRequest(request);
                txStatus.GetID().should.equal('1');
                txStatus.GetStatus().should.equal('success');
                txStatus.GetResult().should.equal('evaluateResponse');
                txStatus.IsVerified().should.be.true;

                Client.setTlsClientCertAndKeyCalls.should.equal(1);
                Client.setTlsClientCertAndKeyArgs.should.deep.equal(['cert', 'key']);
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
                    invokerIdentity: 'User1',
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
                    invokerIdentity: 'User1',
                    targetOrganizations,
                    readOnly: true
                };
                await fabricNonGateway._sendSingleRequest(request);

                Channel.sendTransactionCalls.should.equal(0);
                Channel.queryByChaincodeCalls.should.equal(1);
                Channel.queryByChaincodeArgs.targets.length.should.equal(1);
            });

            it('should return an appropriate TxStatus when evaluating a transaction throws an error', async () => {
                const args = ['arg1', 'arg2'];
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    contractArguments: args,
                    invokerIdentity: 'User1',
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
