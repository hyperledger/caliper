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

const path = require('path');
const expect = require('chai').expect;
const sinon = require('sinon');
const ConfigUtil = require('@hyperledger/caliper-core').ConfigUtil;
const EthereumConnector = require('../lib/ethereum-connector');

describe('EthereumConnector', function() {
    let ethereumConnectorStub;
    let tempConfigFilePath;

    beforeEach(() => {
        ethereumConnectorStub = sinon.stub(EthereumConnector, 'constructor').returns({});
        tempConfigFilePath = path.resolve(__dirname, '../../caliper-tests-integration/ethereum_tests/networkconfig.json');
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, tempConfigFilePath);
    });

    afterEach(() => {
        ethereumConnectorStub.restore();
    });

    describe('constructor', () => {
        it('should create a new EthereumConnector instance', () => {
            const ethereumConnector = new EthereumConnector(0, 'ethereum');
            expect(ethereumConnector).to.be.instanceOf(EthereumConnector);
        });
    });

    describe('installSmartContract', () => {
        it('should throw an error when the specified contract path does not exist', async () => {
            const ethereumConnector = new EthereumConnector(0, 'ethereum');
            const contractDetails = {
                path: './nonexistent/contract.sol'
            };
            try {
                await ethereumConnector.installSmartContract(contractDetails);
            } catch (err) {
                expect(err.message).to.contain('Cannot find module');
            }
        });
    });

    describe('init', () => {
        it('should throw an error when the specified contract path does not exist', async () => {
            const ethereumConnector = new EthereumConnector(0, 'ethereum');
            const contractDetails = {
                path: './nonexistent/contract.sol'
            };

            try {
                await ethereumConnector.init(contractDetails);
            } catch (err) {
                expect(err.message).to.contain('connection not open');
            }
        });
    });
});
