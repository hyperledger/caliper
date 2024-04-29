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
const sinon = require('sinon');
const expect = chai.expect;
const ConfigUtil = require('@hyperledger/caliper-core').ConfigUtil;
const fs = require('fs');
const os = require('os');
const path = require('path');

const { ConnectorFactory } = require('../lib/connectorFactory');
const EthereumConnector = require('../lib/ethereum-connector');

describe('ConnectorFactory', function() {
    let ethereumConnectorStub;
    let tempConfigFilePath;

    beforeEach(() => {
        ethereumConnectorStub = sinon.stub(EthereumConnector.prototype, 'constructor').returns({});
        // Create a temporary file for the network configuration
        tempConfigFilePath = path.join(os.tmpdir(), 'test-network-config.json');

        fs.writeFileSync(tempConfigFilePath, JSON.stringify({
            // Network Configurations
        }));
    });

    afterEach(() => {
        ethereumConnectorStub.restore();

        // Clean up the temporary file
        fs.unlinkSync(tempConfigFilePath);
    });

    it('should return a type of Promise<ConnectorBase>', async function() {
        const workerIndex = 0;
        const connector = ConnectorFactory(workerIndex);
        expect(connector).to.be.an.instanceof(Promise);
    });

    it('should create an instance of EthereumConnector with correct parameters', async function() {
        const workerIndex = 0;
        // path.resolve to get the absolute path of the temporary file
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, path.resolve(tempConfigFilePath));
        const connector = await ConnectorFactory(workerIndex);
        sinon.assert.calledWithNew(EthereumConnector);
        sinon.assert.calledWith(EthereumConnector, workerIndex, 'ethereum');
        expect(connector).to.be.an.instanceof(EthereumConnector);
    });

    it('should handle -1 for the manager process', async function() {
        const workerIndex = -1;
        // path.resolve to get the absolute path of the temporary file
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, path.resolve(tempConfigFilePath));
        const connector = await ConnectorFactory(workerIndex);
        sinon.assert.calledWithNew(EthereumConnector);
        sinon.assert.calledWith(EthereumConnector, workerIndex, 'ethereum');
        expect(connector).to.be.an.instanceof(EthereumConnector);
    });
});