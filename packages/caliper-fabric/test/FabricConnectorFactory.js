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
const { Wallets } = require('./connector-versions/v2/V2GatewayStubs');
const { ConnectorFactory } = require('../lib/FabricConnectorFactory');
const { ConfigUtil } = require('@hyperledger/caliper-core');

const legacyConfig = './sample-configs/LegacyNetworkConfig.yaml';
const v2Config = './sample-configs/NoIdentitiesNetworkConfig.yaml';
const unknownVersionConfig = './sample-configs/UnknownVersionConfig.yaml';

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

mockery.enable({
    warnOnReplace: false,
    warnOnUnregistered: false
});

describe('A Fabric Connector Factory', () => {
    after(() => {
        mockery.deregisterAll();
        mockery.disable();
    });

    it('should create a legacy V1 Gateway connector if a 1.4 fabric library is bound and usegateway was specified', async () => {
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
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, path.resolve(__dirname, legacyConfig));
        ConfigUtil.set(ConfigUtil.keys.Fabric.Gateway.Enabled, true);
        const connector = await ConnectorFactory(1);
        connector.constructor.name.should.equal('LegacyV1FabricGateway');
        mockery.deregisterAll();
    });

    it('should create a legacy V2 Gateway connector if a 2.x fabric library is bound and usegateway was specified', async () => {
        mockery.registerMock('./registrarHelper', {
            newWithNetwork: () => ''
        });
        mockery.registerMock('fabric-network', {
            DefaultEventHandlerStrategies,
            DefaultQueryHandlerStrategies,
            Wallets
        });
        mockery.registerMock('fabric-network/package', {version: '2.2.1'});
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, path.resolve(__dirname, legacyConfig));
        ConfigUtil.set(ConfigUtil.keys.Fabric.Gateway.Enabled, true);
        const connector = await ConnectorFactory(1);
        connector.constructor.name.should.equal('LegacyV2FabricGateway');
        mockery.deregisterAll();
    });

    it('should create a new V1 Gateway connector when a 1.4 fabric library is bound, usegateway was specified and a v2 network config', async () => {
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

    it('should create a new V2 Gateway connector when a 2.x fabric library is bound, usegateway was specified and a v2 network config', async () => {
        mockery.registerMock('fabric-network', {
            DefaultEventHandlerStrategies,
            DefaultQueryHandlerStrategies,
            Wallets: AlternativeWallets
        });
        mockery.registerMock('fabric-network/package', {version: '2.2.1'});
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, path.resolve(__dirname, v2Config));
        ConfigUtil.set(ConfigUtil.keys.Fabric.Gateway.Enabled, true);
        const connector = await ConnectorFactory(1);
        connector.constructor.name.should.equal('V2FabricGateway');
        mockery.deregisterAll();
    });

    it('should create a legacy V1 Fabric connector if a 1.4 fabric library is bound and usegateway was not specified', async () => {
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
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, path.resolve(__dirname, legacyConfig));
        ConfigUtil.set(ConfigUtil.keys.Fabric.Gateway.Enabled, false);
        const connector = await ConnectorFactory(1);
        connector.constructor.name.should.equal('LegacyV1Fabric');
        mockery.deregisterAll();
    });

    it('should create a new V1 Fabric connector if a 1.4 fabric library is bound and usegateway was not specified', async () => {
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


    it('should throw an error if no fabric library is bound', async () => {
        // Can't test this with mockery because really need require to fail trying to
        // find `fabric-network` or `fabric-client`
    });

    it('should throw an error if fabric library bound is not V1 or V2', async () => {
        mockery.registerMock('fabric-network', {});
        mockery.registerMock('fabric-network/package', {version: '3.0.0'});
        mockery.registerMock('fabric-client', {});
        mockery.registerMock('fabric-client/package', {version: '3.0.0'});
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, path.resolve(__dirname, v2Config));
        ConfigUtil.set(ConfigUtil.keys.Fabric.Gateway.Enabled, true);
        await ConnectorFactory(1).should.be.rejectedWith(/Installed SDK version 3.0.0 did not match any compatible Fabric connectors/);
        mockery.deregisterAll();
    });

    it('should throw an error version if not for legacy or the new connector', async () => {
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
