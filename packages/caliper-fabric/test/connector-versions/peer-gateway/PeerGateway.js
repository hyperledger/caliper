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
const sinon = require('sinon');
const path = require('path');
const { ConfigUtil } = require('@hyperledger/caliper-core');

const configWith2Orgs1AdminInWallet = '../../sample-configs/BasicConfig.yaml';
const configWith2Orgs1AdminInWalletNotMutual = '../../sample-configs/PeerGatewayNetworkConfigNotMutual.yaml';

const { grpc, connect, crypto, signers, Gateway, Transaction, Network, GrpcClient } = require('./PeerGatewayStubs');
const ConnectorConfigurationFactory = require('../../../lib/connector-configuration/ConnectorConfigurationFactory');

describe('A Fabric Peer Gateway sdk gateway', () => {

    let PeerGateway;
    let GenerateWallet;
    let FabricConnectorContext;
    let TxStatus;

    before(() => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            useCleanCache: true
        });

        mockery.registerMock('@hyperledger/fabric-gateway', {
            signers,
            connect
        });

        mockery.registerMock('@hyperledger/fabric-gateway/package', {version: '1.0.1'});

        mockery.registerMock('crypto', crypto);

        mockery.registerMock('Date', Date);

        mockery.registerMock('@grpc/grpc-js', grpc);

        PeerGateway = require('../../../lib/connector-versions/peer-gateway/PeerGateway');

        GenerateWallet = require('../../utils/GenerateWallet');
        FabricConnectorContext = require('../../../lib/FabricConnectorContext');
        TxStatus = require('@hyperledger/caliper-core').TxStatus;

    });

    after(() => {
        mockery.deregisterAll();
        mockery.disable();
    });

    let walletFacadeFactory;

    beforeEach(() => {
        Gateway.reset();
        GrpcClient.reset();
        const walletSetup = new GenerateWallet().createStandardTestWalletSetup();
        walletFacadeFactory = walletSetup.walletFacadeFactory;
    });

    it('should be able to initialise in preparation for use by a caliper manager', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWallet), walletFacadeFactory);
        const peerGateway = new PeerGateway(connectorConfiguration, 1, 'fabric');
        await peerGateway.init().should.not.be.rejected;
    });

    it('should be able to initialise in preparation for use by a caliper manager when mutual tls is false', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWalletNotMutual), walletFacadeFactory);
        const peerGateway = new PeerGateway(connectorConfiguration, 1, 'fabric');
        await peerGateway.init().should.not.be.rejected;
    });

    it('should do nothing when attempting to install a smart contract', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWalletNotMutual), walletFacadeFactory);
        const peerGateway = new PeerGateway(connectorConfiguration, 1, 'fabric');
        await peerGateway.installSmartContract().should.not.be.rejected;
    });

    it('should throw an error and not return a context when preparing for use by a caliper worker when mutual tls is enabled (true)', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWallet), walletFacadeFactory);
        const peerGateway = new PeerGateway(connectorConfiguration, 1, 'fabric');
        await peerGateway.getContext().should.be.rejectedWith('Mutual tls is not supported with the Peer Gateway Connector');
    });

    it('should return a context when preparing for use by a caliper worker', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWalletNotMutual), walletFacadeFactory);
        const peerGateway = new PeerGateway(connectorConfiguration, 1, 'fabric');
        const context = await peerGateway.getContext();
        context.should.be.instanceOf(FabricConnectorContext);
    });

    it('should return the same context when requested multiple times', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWalletNotMutual), walletFacadeFactory);
        const peerGateway = new PeerGateway(connectorConfiguration, 1, 'fabric');
        const context = await peerGateway.getContext();
        const context2 = await peerGateway.getContext();
        context2.should.equal(context);
    });


    it('should pass a defined grpcClient in the gateway options', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWalletNotMutual), walletFacadeFactory);
        const peerGateway = new PeerGateway(connectorConfiguration, 1, 'fabric');
        await peerGateway.getContext();
        for(const args of Gateway.connectArgs){
            args.client.should.be.instanceOf(GrpcClient);
        }
    });

    it('should pass the default timeout in the gateway options', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWalletNotMutual), walletFacadeFactory);
        const peerGateway = new PeerGateway(connectorConfiguration, 1, 'fabric');
        const now = new Date();
        const clock = sinon.useFakeTimers(now.getTime());
        await peerGateway.getContext();
        Gateway.connectArgs[0].evaluateOptions().should.be.deep.equal({deadline: now.getTime() + 60000});
        clock.restore();
    });

    it('should pass the timeout from invokeOrQuery in the gateway options', async () => {
        ConfigUtil.set(ConfigUtil.keys.Fabric.Timeout.InvokeOrQuery, 99);
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWalletNotMutual), walletFacadeFactory);
        const peerGateway = new PeerGateway(connectorConfiguration, 1, 'fabric');
        const now = new Date();
        const clock = sinon.useFakeTimers(now.getTime());
        await peerGateway.getContext();
        Gateway.connectArgs[0].evaluateOptions().should.be.deep.equal({deadline: now.getTime() + 99000});
        clock.restore();
        ConfigUtil.set(ConfigUtil.keys.Fabric.Timeout.InvokeOrQuery, null);
    });

    it('should create a single unique client for each organization using the first peer details in that organization', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWalletNotMutual), walletFacadeFactory);
        const peerGateway = new PeerGateway(connectorConfiguration, 1, 'fabric');
        await peerGateway.getContext();
        GrpcClient.constructed.should.equal(2);
        GrpcClient.options[0].hostnameOverride.should.deep.equal('peer0.org1.example.com');
        GrpcClient.options[1].hostnameOverride.should.deep.equal('peer0.org2.example.com');
    });

    it('should create one Gateway for each identity', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWalletNotMutual), walletFacadeFactory);
        const peerGateway = new PeerGateway(connectorConfiguration, 1, 'fabric');
        await peerGateway.getContext();
        Gateway.constructed.should.equal(4);
    });


    it('should create a Gateway with the specified created identity', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWalletNotMutual), walletFacadeFactory);
        const peerGateway = new PeerGateway(connectorConfiguration, 1, 'fabric');
        await peerGateway.getContext();
        Gateway.connectArgs[0].identity.should.deep.equal({mspId: 'Org1MSP', credentials: Buffer.from('-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----')});
    });

    it('should a attempt to create a grpc client with default grpc options when not provided through the connection profile', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWalletNotMutual), walletFacadeFactory);
        const peerGateway = new PeerGateway(connectorConfiguration, 1, 'fabric');
        await peerGateway.getContext();
        GrpcClient.options[0].should.deep.equal({
            'grpc.http2.max_pings_without_data': 0 ,
            'grpc.http2.min_time_between_pings_ms': 120000 ,
            'grpc.keepalive_permit_without_calls': 1 ,
            'grpc.keepalive_timeout_ms': 20000 ,
            'grpc.keepalive_time_ms': 120000,
            'grpc.max_receive_message_length' : -1,
            'grpc.max_send_message_length' : -1,
            'grpc.ssl_target_name_override' : 'peer0.org1.example.com',
            'hostnameOverride' : 'peer0.org1.example.com'
        });
    });

    it('should a attempt to create a grpc client with provided grpc options from the connectionProfile (not using default ones and overring with right key when required)', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWalletNotMutual), walletFacadeFactory);
        const peerGateway = new PeerGateway(connectorConfiguration, 1, 'fabric');
        await peerGateway.getContext();
        GrpcClient.options[1].should.deep.equal({
            'grpc.http2.max_pings_without_data': 1 ,
            'grpc.http2.min_time_between_pings_ms': 100000 ,
            'grpc.keepalive_permit_without_calls': 2 ,
            'grpc.keepalive_time_ms': 100000 ,
            'grpc.keepalive_timeout_ms': 10000 ,
            'grpc.max_receive_message_length' : 20,
            'grpc.max_send_message_length' : 20,
            'hostnameOverride' : 'peer0.org2.example.com'
        });
    });

    it('should attempt to create a grpcs if a grpcs endpoint is passed for the peer', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWalletNotMutual), walletFacadeFactory);
        const peerGateway = new PeerGateway(connectorConfiguration, 1, 'fabric');
        await peerGateway.getContext();
        GrpcClient.tlsCred[0].should.deep.equal('secure');
    });

    it('should attempt to create a grpc if a grpc endpoint is passed for the peer', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWalletNotMutual), walletFacadeFactory);
        const peerGateway = new PeerGateway(connectorConfiguration, 1, 'fabric');
        await peerGateway.getContext();
        GrpcClient.tlsCred[1].should.deep.equal('insecure');
    });

    it('should disconnect all Gateways when a context is released', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWalletNotMutual), walletFacadeFactory);
        const peerGateway = new PeerGateway(connectorConfiguration, 1, 'fabric');
        await peerGateway.getContext();
        await peerGateway.releaseContext();
        Gateway.closed.should.equal(4);
    });

    it('should close all grpc clients when a context is released', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWalletNotMutual), walletFacadeFactory);
        const peerGateway = new PeerGateway(connectorConfiguration, 1, 'fabric');
        await peerGateway.getContext();
        await peerGateway.releaseContext();
        GrpcClient.closed.should.equal(2);
    });

    describe('when submitting a request to fabric', () => {
        let peerGateway;

        beforeEach(async () => {
            Transaction.reset();
            Network.reset();
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWalletNotMutual), walletFacadeFactory);
            peerGateway = new PeerGateway(connectorConfiguration, 1, 'fabric');
            await peerGateway.getContext();
        });

        afterEach(async () => {
            await peerGateway.releaseContext();
        });

        describe('should throw an error', () => {
            it('when invokerIdentity is not known', async () => {
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    invokerIdentity: 'NoOne',
                };
                await peerGateway._sendSingleRequest(request).should.be.rejectedWith(/No contracts for invokerIdentity NoOne found/);
            });

            it('when invokerMspId is not known', async () => {
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    invokerMspId: 'Org7',
                    invokerIdentity: 'admin'
                };
                await peerGateway._sendSingleRequest(request).should.be.rejectedWith(/No contracts for invokerIdentity admin in Org7 found/);
            });

            it('when contractFunction not provided', async () => {
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: '',
                    invokerIdentity: 'admin'
                };
                await peerGateway._sendSingleRequest(request).should.be.rejectedWith(/No contractFunction provided/);
                request.contractFunction = null;
                await peerGateway._sendSingleRequest(request).should.be.rejectedWith(/No contractFunction provided/);
                delete request.contractFunction;
                await peerGateway._sendSingleRequest(request).should.be.rejectedWith(/No contractFunction provided/);
            });

            it('when no contractId provided', async () => {
                const request = {
                    channel: 'mychannel',
                    contractId: '',
                    contractFunction: '',
                    invokerIdentity: 'admin'
                };
                await peerGateway._sendSingleRequest(request).should.be.rejectedWith(/No contractId provided/);
                request.contractId = null;
                await peerGateway._sendSingleRequest(request).should.be.rejectedWith(/No contractId provided/);
                delete request.contractId;
                await peerGateway._sendSingleRequest(request).should.be.rejectedWith(/No contractId provided/);
            });

            it('when channel provided but contractId is not a valid chaincode id', async () => {
                const request = {
                    channel: 'yourchannel',
                    contractId: 'findingMyMarbles',
                    contractFunction: 'myFunction',
                    invokerIdentity: 'admin',
                };
                await peerGateway._sendSingleRequest(request).should.be.rejectedWith(/Unable to find specified contract findingMyMarbles on channel yourchannel/);
            });

            it('when no channel provided and contract id is not a valid contract id', async () => {
                const request = {
                    channel: '',
                    contractId: 'not-a-valid-contract-id',
                    contractFunction: '',
                    invokerIdentity: 'admin',
                };
                await peerGateway._sendSingleRequest(request).should.be.rejectedWith(/Could not find details for contract ID not-a-valid-contract-id/);
            });

            it('when targetPeers is specified', async () => {
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    invokerIdentity: 'admin',
                    targetPeers: 'peer0.org2.example.com'
                };
                await peerGateway._sendSingleRequest(request).should.be.rejectedWith(/targetPeers option is not supported by the Peer Gateway connector, use targetOrganizations instead/);
            });
        });

        describe('when making a submit request', () => {
            it('should succeed if status is successful and return with an appropriate TxStatus', async () => {
                const args = ['arg1', 'arg2'];
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    contractArguments: args,
                    invokerIdentity: 'admin',
                };
                const txStatus = await peerGateway._sendSingleRequest(request);
                txStatus.should.be.instanceOf(TxStatus);
                txStatus.GetID().should.equal('1');
                txStatus.GetStatus().should.equal('success');
                txStatus.GetResult().should.equal('submitResponse');
                txStatus.IsVerified().should.be.true;

                Transaction.submit.should.be.true;
                Transaction.submitArgs.should.deep.equal(args);
                Transaction.constructorArgs.should.equal('myFunction');
                chai.expect(Transaction.endorsingOrgs).to.be.null;
                chai.expect(Transaction.transient).to.be.null;

                Transaction.reset();

                request.readOnly = false;
                await peerGateway._sendSingleRequest(request);
                Transaction.submit.should.be.true;
                Transaction.submitArgs.should.deep.equal(args);
                Transaction.constructorArgs.should.equal('myFunction');
            });

            it('should fail if status is not successful and return with an appropriate TxStatus', async () => {
                const args = ['arg1', 'arg2'];
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    contractArguments: args,
                    invokerIdentity: 'admin',
                };
                Transaction.fail();
                const txStatus = await peerGateway._sendSingleRequest(request);
                txStatus.should.be.instanceOf(TxStatus);
                txStatus.GetStatus().should.equal('failed');
                txStatus.GetResult().should.equal('');
                txStatus.IsVerified().should.be.true;
                txStatus.GetID().should.equal('1');

                Transaction.submit.should.be.true;
                Transaction.submitArgs.should.deep.equal(args);
                Transaction.constructorArgs.should.equal('myFunction');
            });

            it('should set the transientMap', async () => {
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    transientMap: {'param1': 'value1', 'param2': 'value2'},
                    invokerIdentity: 'admin'
                };
                await peerGateway._sendSingleRequest(request);
                Transaction.submit.should.be.true;
                Transaction.submitArgs.should.deep.equal([]);
                Transaction.transient.should.deep.equal({
                    'param1': Buffer.from('value1'),
                    'param2': Buffer.from('value2')
                });
                Transaction.constructorArgs.should.equal('myFunction');
            });

            it('should set the endorsing organisations if targetOrganizations is specified', async () => {
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    targetOrganizations: ['myOrg1', 'myOrg2', 'myOrg3'],
                    invokerIdentity: 'admin'
                };
                await peerGateway._sendSingleRequest(request);
                Transaction.submit.should.be.true;
                Transaction.submitArgs.should.deep.equal([]);
                Transaction.endorsingOrgs.should.deep.equal(['myOrg1', 'myOrg2', 'myOrg3']);
                Transaction.constructorArgs.should.equal('myFunction');
            });

            it('should not set endorsing organisations if it is not an array', async () => {
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    targetOrganizations: 'myOrg1',
                    invokerIdentity: 'admin'
                };
                await peerGateway._sendSingleRequest(request);
                Transaction.submit.should.be.true;
                Transaction.submitArgs.should.deep.equal([]);
                chai.expect(Transaction.endorsingOrgs).to.be.null;
                Transaction.constructorArgs.should.equal('myFunction');
            });

            it('should not set endorsing organisations if it is an empty array', async () => {
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    targetOrganizations: [],
                    invokerIdentity: 'admin'
                };
                await peerGateway._sendSingleRequest(request);
                Transaction.submit.should.be.true;
                Transaction.submitArgs.should.deep.equal([]);
                chai.expect(Transaction.endorsingOrgs).to.be.null;
                Transaction.constructorArgs.should.equal('myFunction');
            });

            it('should look up the channel and chaincode id from contractId when no channel provided', async () => {
                const request = {
                    contractId: 'lostMyMarbles',
                    contractFunction: 'myFunction',
                    contractArguments: ['arg1'],
                    invokerIdentity: 'admin'
                };
                await peerGateway._sendSingleRequest(request);
                Gateway.channel.should.equal('yourchannel');
                Network.getContractArgs.should.equal('marbles');
                Transaction.submit.should.be.true;
                Transaction.submitArgs.should.deep.equal(['arg1']);
                Transaction.constructorArgs.should.equal('myFunction');
            });

            it('should return an appropriate TxStatus if submit throws an error', async () => {
                const args = ['arg1', 'arg2'];
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    contractArguments: args,
                    invokerIdentity: 'admin',
                };
                const err = new Error('submit-failure');
                err.details= [{address:'anaddress', message:'an error'},{},'something'];
                Transaction.throwOnCall(err);
                const txStatus = await peerGateway._sendSingleRequest(request);
                txStatus.should.be.instanceOf(TxStatus);
                txStatus.GetStatus().should.equal('failed');
                txStatus.GetResult().should.equal('');
                txStatus.IsVerified().should.be.true;
                txStatus.GetID().should.equal('1');
            });

            it('should succeed when no invokerIdentity provided', async () => {
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    invokerIdentity: ''
                };
                let txStatus = await peerGateway._sendSingleRequest(request);
                txStatus.should.be.instanceOf(TxStatus);
                txStatus.GetID().should.equal('1');
                txStatus.GetStatus().should.equal('success');
                txStatus.GetResult().should.equal('submitResponse');
                txStatus.IsVerified().should.be.true;

                request.invokerIdentity = null;
                txStatus = await peerGateway._sendSingleRequest(request);
                txStatus.should.be.instanceOf(TxStatus);

                delete request.invokerIdentity;
                txStatus = await peerGateway._sendSingleRequest(request);
                txStatus.should.be.instanceOf(TxStatus);
            });
        });

        describe('when making an evaluate request', () => {
            it('should succeed and return with an appropriate TxStatus', async () => {
                const args = ['arg1', 'arg2'];
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    contractArguments: args,
                    invokerIdentity: 'admin',
                    readOnly: true
                };
                const txStatus = await peerGateway._sendSingleRequest(request);
                txStatus.GetID().should.equal('1');
                txStatus.GetStatus().should.equal('success');
                txStatus.GetResult().should.equal('evaluateResponse');
                txStatus.IsVerified().should.be.true;

                Transaction.evaluate.should.be.true;
                Transaction.evaluateArgs.should.deep.equal(args);
                Transaction.constructorArgs.should.equal('myFunction');
            });

            it('should return an appropriate TxStatus if evaluate throws an error', async () => {
                const args = ['arg1', 'arg2'];
                const request = {
                    channel: 'mychannel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    contractArguments: args,
                    invokerIdentity: 'admin',
                    readOnly: true
                };
                const err = new Error('submit-failure');
                Transaction.throwOnCall(err);
                const txStatus = await peerGateway._sendSingleRequest(request);
                txStatus.should.be.instanceOf(TxStatus);
                txStatus.GetStatus().should.equal('failed');
                txStatus.GetResult().should.equal('');
                txStatus.IsVerified().should.be.true;
                txStatus.GetID().should.equal('1');
            });
        });
    });
});
