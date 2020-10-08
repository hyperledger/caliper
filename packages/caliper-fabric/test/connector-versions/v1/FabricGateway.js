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
const mockery = require('mockery');
const path = require('path');

const DefaultEventHandlerStrategies = {};
const DefaultQueryHandlerStrategies = {};

const v2ConfigWithNoIdentities = '../../sample-configs/NoIdentitiesNetworkConfig.yaml';
const v2ConfigWithSingleUser = '../../sample-configs/BasicConfig.yaml';

const { Gateway, Transaction, InMemoryWallet, FileSystemWallet, X509WalletMixin } = require('./V1GatewayStubs');
const GenerateConfiguration = require('../../utils/GenerateConfiguration');
const ConnectorConfigurationFactory = require('../../../lib/connector-configuration/ConnectorConfigurationFactory');

describe('A Node-SDK V1 Fabric Gateway', () => {
    let FabricGateway;
    let WalletFacadeFactory;
    let FabricConnectorContext;
    let TxStatus;

    before(() => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            useCleanCache: true
        });

        mockery.registerMock('fabric-network', {
            DefaultEventHandlerStrategies,
            DefaultQueryHandlerStrategies,
            InMemoryWallet,
            FileSystemWallet,
            X509WalletMixin,
            Gateway
        });

        mockery.registerMock('fabric-network/package', {version: '1.4.11'});

        FabricGateway = require('../../../lib/connector-versions/v1/FabricGateway');
        WalletFacadeFactory = require('../../../lib/connector-versions/v1/WalletFacadeFactory');
        FabricConnectorContext = require('../../../lib/FabricConnectorContext');
        TxStatus = require('@hyperledger/caliper-core').TxStatus;
    });

    after(() => {
        mockery.deregisterAll();
        mockery.disable();
    });

    it('should be able to initialise in preperation for use by a caliper master', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, v2ConfigWithSingleUser), new WalletFacadeFactory());
        const fabricGateway = new FabricGateway(connectorConfiguration, 1, 'fabric');
        await fabricGateway.init().should.not.be.rejected;
    });

    it('should do nothing when attempting to install a smart contract', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, v2ConfigWithNoIdentities), new WalletFacadeFactory());
        const fabricGateway = new FabricGateway(connectorConfiguration, 1, 'fabric');
        await fabricGateway.installSmartContract().should.not.be.rejected;
    });

    it('should return a context when preparing for use by a caliper worker', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, v2ConfigWithNoIdentities), new WalletFacadeFactory());
        const fabricGateway = new FabricGateway(connectorConfiguration, 1, 'fabric');
        const context = await fabricGateway.getContext();
        context.should.be.instanceOf(FabricConnectorContext);
    });

    it('should return the same context when requested multiple times', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, v2ConfigWithNoIdentities), new WalletFacadeFactory());
        const fabricGateway = new FabricGateway(connectorConfiguration, 1, 'fabric');
        const context = await fabricGateway.getContext();
        const context2 = await fabricGateway.getContext();
        context2.should.equal(context);
    });

    it('should create Gateways when a context is first requested', async () => {
        Gateway.reset();
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, v2ConfigWithSingleUser), new WalletFacadeFactory());
        const fabricGateway = new FabricGateway(connectorConfiguration, 1, 'fabric');
        const context = await fabricGateway.getContext();
        context.should.be.instanceOf(FabricConnectorContext);
        Gateway.constructed.should.equal(1);
        Gateway.reset();
    });

    it('should disconnect Gateways when a context is released', async () => {
        Gateway.reset();
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, v2ConfigWithSingleUser), new WalletFacadeFactory());
        const fabricGateway = new FabricGateway(connectorConfiguration, 1, 'fabric');
        await fabricGateway.getContext();
        await fabricGateway.releaseContext();
        Gateway.disconnected.should.equal(1);
        Gateway.reset();
    });

    it('should throw an error if gateway connection fails ', async () => {
        Gateway.throwOnCall(new Error('connect-failure'));
        const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, v2ConfigWithSingleUser), new WalletFacadeFactory());
        const fabricGateway = new FabricGateway(connectorConfiguration, 1, 'fabric');
        await fabricGateway.getContext().should.be.rejectedWith(/connect-failure/);
    });

    describe('when submitting a request to fabric', () => {
        let fabricGateway;

        beforeEach(async () => {
            Gateway.reset();
            Transaction.reset();
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, v2ConfigWithSingleUser), new WalletFacadeFactory());
            fabricGateway = new FabricGateway(connectorConfiguration, 1, 'fabric');
            await fabricGateway.getContext();
        });

        afterEach(async () => {
            fabricGateway.releaseContext();
        });

        describe('should throw an error', () => {
            it('when no invokerIdentity provided', async () => {
                const request = {
                    channel: 'my-channel',
                    contractId: 'marbles',
                    contractFunction: '',
                    invokerIdentity: ''
                };
                await fabricGateway._sendSingleRequest(request).should.be.rejectedWith(/No invokerIdentity provided/);
                request.invokerIdentity = null;
                await fabricGateway._sendSingleRequest(request).should.be.rejectedWith(/No invokerIdentity provided/);
                delete request.invokerIdentity;
                await fabricGateway._sendSingleRequest(request).should.be.rejectedWith(/No invokerIdentity provided/);
            });

            it('when invokerIdentity not known', async () => {
                const request = {
                    channel: 'my-channel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    invokerIdentity: 'NoOne',
                };
                await fabricGateway._sendSingleRequest(request).should.be.rejectedWith(/No contracts for invokerIdentity NoOne found/);
            });

            it('when invokerMspId is not known', async () => {
                const request = {
                    channel: 'my-channel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    invokerMspId: 'Org7',
                    invokerIdentity: 'User1'
                };
                await fabricGateway._sendSingleRequest(request).should.be.rejectedWith(/No contracts for invokerIdentity User1 in Org7 found/);
            });

            it('when contractFunction not provided', async () => {
                const request = {
                    channel: 'my-channel',
                    contractId: 'marbles',
                    contractFunction: '',
                    invokerIdentity: 'User1'
                };
                await fabricGateway._sendSingleRequest(request).should.be.rejectedWith(/No contractFunction provided/);
                request.contractFunction = null;
                await fabricGateway._sendSingleRequest(request).should.be.rejectedWith(/No contractFunction provided/);
                delete request.contractFunction;
                await fabricGateway._sendSingleRequest(request).should.be.rejectedWith(/No contractFunction provided/);
            });

            it('when no contractId provided', async () => {
                const request = {
                    channel: 'my-channel',
                    contractId: '',
                    contractFunction: '',
                    invokerIdentity: 'User1'
                };
                await fabricGateway._sendSingleRequest(request).should.be.rejectedWith(/No contractId provided/);
                request.contractId = null;
                await fabricGateway._sendSingleRequest(request).should.be.rejectedWith(/No contractId provided/);
                delete request.contractId;
                await fabricGateway._sendSingleRequest(request).should.be.rejectedWith(/No contractId provided/);
            });

            it('when channel provided but contractId is not a valid chaincode id', async () => {
                const request = {
                    channel: 'your-channel',
                    contractId: 'lostMyMarbles',
                    contractFunction: 'myFunction',
                    invokerIdentity: 'User1'
                };
                await fabricGateway._sendSingleRequest(request).should.be.rejectedWith(/Unable to find specified contract lostMyMarbles on channel your-channel/);
            });

            it('when no channel provided and contract id is not a valid contract id', async () => {
                const request = {
                    channel: '',
                    contractId: 'not-a-valid-contract-id',
                    contractFunction: '',
                    invokerIdentity: 'User1',
                };
                await fabricGateway._sendSingleRequest(request).should.be.rejectedWith(/Could not find details for contract ID not-a-valid-contract-id/);
            });
        });

        describe('when making a submit request', () => {
            it('should succeed, set clientIdentity and return with an appropraite TxStatus', async () => {
                const args = ['arg1', 'arg2'];
                const request = {
                    channel: 'my-channel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    contractArguments: args,
                    invokerIdentity: 'User1',
                };
                const txStatus = await fabricGateway._sendSingleRequest(request);
                txStatus.should.be.instanceOf(TxStatus);
                txStatus.GetID().should.equal('1');
                txStatus.GetStatus().should.equal('success');
                txStatus.GetResult().should.equal('submitResponse');
                txStatus.IsVerified().should.be.true;

                Gateway.connectArgs[1].clientTlsIdentity.should.equal('User1');

                Transaction.submit.should.be.true;
                Transaction.submitArgs.should.deep.equal(args);
                Transaction.constructorArgs.should.equal('myFunction');
                Transaction.reset();

                request.readOnly = false;
                await fabricGateway._sendSingleRequest(request);
                Transaction.submit.should.be.true;
                Transaction.submitArgs.should.deep.equal(args);
                Transaction.constructorArgs.should.equal('myFunction');
            });

            it('should set the transientMap', async () => {
                const request = {
                    channel: 'my-channel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    transientMap: {'param1': 'value1', 'param2': 'value2'},
                    invokerIdentity: 'User1'
                };
                await fabricGateway._sendSingleRequest(request);
                Transaction.submit.should.be.true;
                Transaction.submitArgs.should.deep.equal([]);
                Transaction.transient.should.deep.equal({
                    'param1': Buffer.from('value1'),
                    'param2': Buffer.from('value2')
                });
                Transaction.constructorArgs.should.equal('myFunction');
            });

            it('should look up the channel and chaincode id from contractId when no channel provided', async () => {
                const request = {
                    contractId: 'lostMyMarbles',
                    contractFunction: 'myFunction',
                    contractArguments: ['arg1'],
                    invokerIdentity: 'User1'
                };
                await fabricGateway._sendSingleRequest(request);
                Gateway.channel.should.equal('your-channel');
                Transaction.submit.should.be.true;
                Transaction.submitArgs.should.deep.equal(['arg1']);
                Transaction.constructorArgs.should.equal('myFunction');
            });

            it('should find the appropriate peer based on name when using peer targeting', async () => {
                const request = {
                    contractId: 'lostMyMarbles',
                    contractFunction: 'myFunction',
                    contractArguments: ['arg1'],
                    invokerIdentity: 'User1',
                    targetPeers: ['peer1', 'peer3', 'peer4']
                };
                await fabricGateway._sendSingleRequest(request);
                Gateway.channel.should.equal('your-channel');
                Transaction.submit.should.be.true;
                Transaction.submitArgs.should.deep.equal(['arg1']);
                Transaction.constructorArgs.should.equal('myFunction');
                Transaction.endorsingPeers.length.should.equal(2);
                Transaction.endorsingPeers[0].name.should.equal('peer1');
                Transaction.endorsingPeers[1].name.should.equal('peer3');
            });

            it('should set endorsing organisations', async () => {
                const targetOrganizations = ['Org1MSP', 'Org3MSP'];
                const request = {
                    contractId: 'lostMyMarbles',
                    contractFunction: 'myFunction',
                    contractArguments: ['arg1'],
                    invokerIdentity: 'User1',
                    targetOrganizations
                };
                await fabricGateway._sendSingleRequest(request);
                Gateway.channel.should.equal('your-channel');
                Transaction.submit.should.be.true;
                Transaction.submitArgs.should.deep.equal(['arg1']);
                Transaction.constructorArgs.should.equal('myFunction');
                Transaction.endorsingOrganizations.should.deep.equal(targetOrganizations);
            });

            it('should ignore target organizations when not an array', async () => {
                const request = {
                    contractId: 'lostMyMarbles',
                    contractFunction: 'myFunction',
                    contractArguments: ['arg1'],
                    invokerIdentity: 'User1',
                    targetOrganizations: 'Org1MSP'
                };
                await fabricGateway._sendSingleRequest(request);
                Gateway.channel.should.equal('your-channel');
                Transaction.submit.should.be.true;
                Transaction.submitArgs.should.deep.equal(['arg1']);
                Transaction.constructorArgs.should.equal('myFunction');
                should.equal(Transaction.endorsingOrganizations, undefined);
            });

            it('should ignore target Peers when not an array', async () => {
                const request = {
                    contractId: 'lostMyMarbles',
                    contractFunction: 'myFunction',
                    contractArguments: ['arg1'],
                    invokerIdentity: 'User1',
                    targetPeers: 'peer1'
                };
                await fabricGateway._sendSingleRequest(request);
                Gateway.channel.should.equal('your-channel');
                Transaction.submit.should.be.true;
                Transaction.submitArgs.should.deep.equal(['arg1']);
                Transaction.constructorArgs.should.equal('myFunction');
                should.equal(Transaction.endorsingPeers, undefined);
            });

            it('should not target peers when no valid target peers are provided', async () => {
                const request = {
                    contractId: 'lostMyMarbles',
                    contractFunction: 'myFunction',
                    contractArguments: ['arg1'],
                    invokerIdentity: 'User1',
                    targetPeers: ['NotPeer1', 'NotPeer2']
                };
                await fabricGateway._sendSingleRequest(request);
                Gateway.channel.should.equal('your-channel');
                Transaction.submit.should.be.true;
                Transaction.submitArgs.should.deep.equal(['arg1']);
                Transaction.constructorArgs.should.equal('myFunction');
                should.equal(Transaction.endorsingPeers, undefined);
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
                await fabricGateway._sendSingleRequest(request);
                Gateway.channel.should.equal('your-channel');
                Transaction.submit.should.be.true;
                Transaction.submitArgs.should.deep.equal(['arg1']);
                Transaction.constructorArgs.should.equal('myFunction');
                Transaction.endorsingPeers.length.should.equal(1);
                Transaction.endorsingPeers[0].name.should.equal('peer1');
                should.equal(Transaction.endorsingOrganizations, undefined);
            });

            it('should return an appropriate TxStatus if submit throws an error', async () => {
                const args = ['arg1', 'arg2'];
                const request = {
                    channel: 'my-channel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    contractArguments: args,
                    invokerIdentity: 'User1',
                };
                Transaction.throwOnCall(new Error('submit-failure'));
                const txStatus = await fabricGateway._sendSingleRequest(request);
                txStatus.should.be.instanceOf(TxStatus);
                txStatus.GetID().should.equal('1');
                txStatus.GetStatus().should.equal('failed');
                txStatus.GetResult().should.equal('');
                txStatus.IsVerified().should.be.false;
            });

            it('should not set the client identity on a gateway when mutual TLS is not specified', async () => {
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

                const connectorConfiguration = await new ConnectorConfigurationFactory().create(configFile, new WalletFacadeFactory());
                connectorConfiguration.isMutualTLS().should.be.false;
                fabricGateway = new FabricGateway(connectorConfiguration, 1, 'fabric');
                await fabricGateway.getContext();
                const args = ['arg1', 'arg2'];
                const request = {
                    channel: 'my-channel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    contractArguments: args,
                    invokerIdentity: 'User1',
                };
                await fabricGateway._sendSingleRequest(request);
                should.equal(Gateway.connectArgs[1].clientTlsIdentity, undefined);
            });
        });

        describe('when making an evaluate request', () => {
            it('should succeed, set clientIdentity and return with an appropraite TxStatus', async () => {
                const args = ['arg1', 'arg2'];
                const request = {
                    channel: 'my-channel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    contractArguments: args,
                    invokerIdentity: 'User1',
                    readOnly: true
                };
                const txStatus = await fabricGateway._sendSingleRequest(request);
                txStatus.GetID().should.equal('1');
                txStatus.GetStatus().should.equal('success');
                txStatus.GetResult().should.equal('evaluateResponse');
                txStatus.IsVerified().should.be.true;

                Gateway.connectArgs[1].clientTlsIdentity.should.equal('User1');

                Transaction.evaluate.should.be.true;
                Transaction.evaluateArgs.should.deep.equal(args);
                Transaction.constructorArgs.should.equal('myFunction');
            });

            it('should ignore peer targeting when evaluating a transaction', async () => {
                const request = {
                    contractId: 'lostMyMarbles',
                    contractFunction: 'myFunction',
                    contractArguments: ['arg1'],
                    invokerIdentity: 'User1',
                    targetPeers: ['peer1', 'peer3', 'peer4'],
                    readOnly: true
                };
                await fabricGateway._sendSingleRequest(request);
                Transaction.evaluate.should.be.true;
                should.equal(Transaction.endorsingPeers, undefined);
            });

            it('should ignore target organisations when evaluating a transaction', async () => {
                const targetOrganizations = ['Org1MSP', 'Org3MSP'];
                const request = {
                    contractId: 'lostMyMarbles',
                    contractFunction: 'myFunction',
                    contractArguments: ['arg1'],
                    invokerIdentity: 'User1',
                    targetOrganizations,
                    readOnly: true
                };
                await fabricGateway._sendSingleRequest(request);
                Transaction.evaluate.should.be.true;
                should.equal(Transaction.endorsingOrganizations, undefined);
            });

            it('should return an appropriate TxStatus if evaluate throws an error', async () => {
                const args = ['arg1', 'arg2'];
                const request = {
                    channel: 'my-channel',
                    contractId: 'marbles',
                    contractFunction: 'myFunction',
                    contractArguments: args,
                    invokerIdentity: 'User1',
                    readOnly: true
                };
                Transaction.throwOnCall(new Error('submit-failure'));
                const txStatus = await fabricGateway._sendSingleRequest(request);
                txStatus.should.be.instanceOf(TxStatus);
                txStatus.GetID().should.equal('1');
                txStatus.GetStatus().should.equal('failed');
                txStatus.GetResult().should.equal('');
                txStatus.IsVerified().should.be.false;
            });
        });
    });
});
