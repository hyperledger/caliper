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

const configWith2Orgs1AdminInWallet = '../../sample-configs/BasicConfig.yaml';

const { Client, Constants } = require('./ClientStubs');
const { Gateway, Transaction, InMemoryWallet, FileSystemWallet, X509WalletMixin } = require('./V1GatewayStubs');
const ConnectorConfigurationFactory = require('../../../lib/connector-configuration/ConnectorConfigurationFactory');

describe('A Node-SDK V1 (1.4.4) Fabric Gateway', () => {
    let FabricGateway;
    let GenerateWallet;

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

        mockery.registerMock('fabric-network/package', {version: '1.4.4'});
        mockery.registerMock('fabric-client', Client);
        mockery.registerMock('fabric-client/lib/Constants', Constants);

        FabricGateway = require('../../../lib/connector-versions/v1/FabricGateway');
        GenerateWallet = require('../../utils/GenerateWallet');
    });

    after(() => {
        mockery.deregisterAll();
        mockery.disable();
    });

    describe('when submitting a request to fabric using 1.4.4 SDK (< 1.4.5)', () => {
        let fabricGateway;

        beforeEach(async () => {
            Gateway.reset();
            Transaction.reset();
            const {walletFacadeFactory} = new GenerateWallet().createStandardTestWalletSetup();
            const connectorConfiguration = await new ConnectorConfigurationFactory().create(path.resolve(__dirname, configWith2Orgs1AdminInWallet), walletFacadeFactory);
            fabricGateway = new FabricGateway(connectorConfiguration, 1, 'fabric');
            await fabricGateway.getContext();
        });

        afterEach(async () => {
            fabricGateway.releaseContext();
        });

        it('should not target peers', async () => {
            const request = {
                contractId: 'lostMyMarbles',
                contractFunction: 'myFunction',
                contractArguments: ['arg1'],
                invokerIdentity: 'user',
                targetPeers: ['peer1', 'peer2']
            };
            await fabricGateway._sendSingleRequest(request);
            Gateway.channel.should.equal('yourchannel');
            Transaction.submit.should.be.true;
            Transaction.submitArgs.should.deep.equal(['arg1']);
            Transaction.constructorArgs.should.equal('myFunction');
            should.equal(Transaction.endorsingPeers, undefined);

        });
    });
});
