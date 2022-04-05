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

const { Constants } = require('./connector-versions/v1/ClientStubs');
const { ConnectorFactory } = require('../lib/FabricConnectorFactory');
const { ConfigUtil } = require('@hyperledger/caliper-core');

const unsupportedConfig = './sample-configs/LegacyNetworkConfig.yaml';
const v2Config = './sample-configs/NoIdentitiesNetworkConfig.yaml';
const unknownVersionConfig = './sample-configs/UnknownVersionConfig.yaml';
const peerGatewayConfig = './sample-configs/BasicConfig.yaml';

const DefaultEventHandlerStrategies = {};
const DefaultQueryHandlerStrategies = {};

/* eslint-disable require-jsdoc */

class InMemoryWallet {
    import() {}
    getAllLabels() {return ['user'];}
    list() {return ['user'];}
}

const AlternativeWallets = {
    newInMemoryWallet: async () => {
        return new InMemoryWallet();
    }
};

/** */
class X509WalletMixin {
    static createIdentity() {}
}

const buffer = {
    toBytes: () => {return '';}
};
const initCredentialStores = () => {};
const getUserContext = () => {};
const setUserContext = () => {};
const getIdentity = () => {return {
    certificate: '',
    _signer: {_key: buffer},
    key: buffer
};};
const createUser = () => { return {
    getIdentity,
    getSigningIdentity: getIdentity
};};
const getCertificateAuthority = () => { return {
    enroll: getIdentity
};};
const loadFromConfig = () => { return {
    loadFromConfig,
    initCredentialStores,
    getUserContext,
    setUserContext,
    createUser,
    getCertificateAuthority
};};


describe('A Fabric Connector Factory', () => {
    beforeEach(() => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            useCleanCache: true
        });
    });

    afterEach(() => {
        mockery.deregisterAll();
        mockery.disable();
    });

    it('should throw an error if a version 1.0 network configuration is used', async () => {
        mockery.registerMock('fabric-network', {
            DefaultEventHandlerStrategies,
            DefaultQueryHandlerStrategies,
            InMemoryWallet,
            X509WalletMixin
        });
        mockery.registerMock('fabric-network/package', {version: '1.4.11'});
        mockery.registerMock('fabric-client', {
            loadFromConfig
        });
        mockery.registerMock('fabric-client/package', {version: '1.4.11'});
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, path.resolve(__dirname, unsupportedConfig));
        ConfigUtil.set(ConfigUtil.keys.Fabric.Gateway.Enabled, true);
        await ConnectorFactory(1).should.be.rejectedWith(/Network configuration version 1.0 is not supported anymore, please use version 2/);
        mockery.deregisterAll();
    });

    it('should create a V1 Gateway connector when a 1.4 fabric library is bound and gateway is specified', async () => {
        mockery.registerMock('fabric-network', {
            DefaultEventHandlerStrategies,
            DefaultQueryHandlerStrategies,
            InMemoryWallet,
            X509WalletMixin
        });
        mockery.registerMock('fabric-network/package', {version: '1.4.11'});
        mockery.registerMock('fabric-client', {
        });
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, path.resolve(__dirname, v2Config));
        ConfigUtil.set(ConfigUtil.keys.Fabric.Gateway.Enabled, true);
        const connector = await ConnectorFactory(1);
        connector.constructor.name.should.equal('V1FabricGateway');
        mockery.deregisterAll();
    });

    it('should create a V2 Gateway connector when a 2.x fabric library is bound', async () => {
        mockery.registerMock('fabric-network', {
            DefaultEventHandlerStrategies,
            DefaultQueryHandlerStrategies,
            Wallets: AlternativeWallets
        });
        mockery.registerMock('fabric-network/package', {version: '2.2.1'});
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, path.resolve(__dirname, v2Config));
        ConfigUtil.set(ConfigUtil.keys.Fabric.Gateway.Enabled, false);
        const connector = await ConnectorFactory(1);
        connector.constructor.name.should.equal('V2FabricGateway');
        mockery.deregisterAll();
    });

    it('should create a V1 Fabric connector if a 1.4 fabric library is bound gateway not specified', async () => {
        mockery.registerMock('fabric-network', {
            DefaultEventHandlerStrategies,
            DefaultQueryHandlerStrategies,
            InMemoryWallet,
            X509WalletMixin
        });
        mockery.registerMock('fabric-network/package', {version: '1.4.11'});
        mockery.registerMock('fabric-client', {
            loadFromConfig
        });
        mockery.registerMock('fabric-client/lib/Constants', Constants);
        mockery.registerMock('fabric-client/package', {version: '1.4.11'});
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, path.resolve(__dirname, v2Config));
        ConfigUtil.set(ConfigUtil.keys.Fabric.Gateway.Enabled, false);
        const connector = await ConnectorFactory(1);
        connector.constructor.name.should.equal('V1Fabric');
        mockery.deregisterAll();
    });

    it('should create a Peer Gateway Fabric connector if a 1.x fabric-gateway library is bound', async () => {
        mockery.registerMock('@hyperledger/fabric-gateway', {});
        mockery.registerMock('@hyperledger/fabric-gateway/package', {version: '1.0.1'});
        mockery.registerMock('@grpc/grpc-js', {});
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, path.resolve(__dirname, peerGatewayConfig));
        ConfigUtil.set(ConfigUtil.keys.Fabric.Gateway.Enabled, false);
        const connector = await ConnectorFactory(1);
        connector.constructor.name.should.equal('PeerGateway');
        mockery.deregisterAll();
    });

    it('should throw an error if no fabric library is bound', async () => {
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, path.resolve(__dirname, peerGatewayConfig));
        ConfigUtil.set(ConfigUtil.keys.Fabric.Gateway.Enabled, true);
        await ConnectorFactory(1).should.be.rejectedWith(/Unable to detect required Fabric binding packages/);
    });

    it('should throw an error if fabric-gateway library bound is not than v1.x', async () => {
        mockery.registerMock('@hyperledger/fabric-gateway', {});
        mockery.registerMock('@hyperledger/fabric-gateway/package', {version: '0.5.0'});
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, path.resolve(__dirname, peerGatewayConfig));
        ConfigUtil.set(ConfigUtil.keys.Fabric.Gateway.Enabled, true);
        await ConnectorFactory(1).should.be.rejectedWith(/Installed fabric-gateway SDK version 0.5.0 did not match any compatible Fabric connectors/);
        mockery.deregisterAll();
        mockery.registerMock('@hyperledger/fabric-gateway', {});
        mockery.registerMock('@hyperledger/fabric-gateway/package', {version: '2.5.0'});
        await ConnectorFactory(1).should.be.rejectedWith(/Installed fabric-gateway SDK version 2.5.0 did not match any compatible Fabric connectors/);
        mockery.deregisterAll();
    });

    it('should throw an error if fabric network library bound is not v1.4, v2.x', async () => {
        mockery.registerMock('fabric-network', {});
        mockery.registerMock('fabric-network/package', {version: '3.0.0'});
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, path.resolve(__dirname, v2Config));
        ConfigUtil.set(ConfigUtil.keys.Fabric.Gateway.Enabled, true);
        await ConnectorFactory(1).should.be.rejectedWith(/Installed fabric-network SDK version 3.0.0 did not match any compatible Fabric connectors/);
        mockery.deregisterAll();
    });

    it('should throw an error if both fabric-network and fabric-gateway are bound', async () => {
        mockery.registerMock('fabric-network', {});
        mockery.registerMock('fabric-network/package', {version: '3.0.0'});
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, path.resolve(__dirname, v2Config));
        ConfigUtil.set(ConfigUtil.keys.Fabric.Gateway.Enabled, true);
        mockery.registerMock('@hyperledger/fabric-gateway', {});
        mockery.registerMock('@hyperledger/fabric-gateway/package', {version: '1.0.1'});
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, path.resolve(__dirname, peerGatewayConfig));
        ConfigUtil.set(ConfigUtil.keys.Fabric.Gateway.Enabled, true);
        await ConnectorFactory(1).should.be.rejectedWith(/Multiple bindings for fabric have been detected, you need to unbind one or more to ensure only a single bind is present to continue/);
        mockery.deregisterAll();
    });


    it('should throw a generic error if network configuration version is not 1.0 or 2.0', async () => {
        mockery.registerMock('fabric-network', {});
        mockery.registerMock('fabric-network/package', {version: '1.4.11'});
        mockery.registerMock('fabric-client', {});
        mockery.registerMock('fabric-client/package', {version: '1.4.11'});
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, path.resolve(__dirname, unknownVersionConfig));
        ConfigUtil.set(ConfigUtil.keys.Fabric.Gateway.Enabled, true);
        await ConnectorFactory(1).should.be.rejectedWith(/Unknown network configuration version 3.0.0 specified/);
        mockery.deregisterAll();
    });

});
