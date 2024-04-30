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
const rewire = require('rewire');
const networkConfig = require('../../caliper-tests-integration/ethereum_tests/networkconfig.json');

const EthereumConnector = rewire('../lib/ethereum-connector');
const { ConfigUtil, CaliperUtils } = require('@hyperledger/caliper-core');

describe('EthereumConnector', function() {
    let sandbox = sinon.createSandbox();
    let mockWeb3, mockEEAClient, configStub, mockContract;

    beforeEach(() => {
        mockWeb3 = {
            eth: {
                Contract: sinon.stub(),
                accounts: {
                    wallet: {
                        add: sinon.stub()
                    },
                    create: sinon.stub()
                },
                personal: {
                    unlockAccount: sinon.stub().resolves(true)
                }
            },
            utils: {}
        };
        mockEEAClient = function() {
            return mockWeb3;
        };
        mockContract = {
            deploy: sinon.stub(),
            methods: {
                myMethod: function() {
                    return {
                        call: sinon.stub(),
                        send: sinon.stub()
                    };
                }
            },
            send: sinon.stub().resolves({
                options: {
                    address: '0x123'
                }
            })
        };

        EthereumConnector.__set__('Web3', function() {
            return mockWeb3;
        });
        EthereumConnector.__set__('EEAClient', mockEEAClient);

        // Stub configurations
        configStub = sandbox.stub(ConfigUtil, 'get');
        configStub.withArgs(ConfigUtil.keys.NetworkConfig).returns(networkConfig);
        sandbox.stub(CaliperUtils, 'resolvePath').returnsArg(0);
        sandbox.stub(JSON, 'parse').returns({
            ethereum: {
                url: 'ws://localhost:8546',
                contractDeployerAddress: '0x1234567890',
                transactionConfirmationBlocks: 2,
                contracts: {
                    simple: {
                        path: 'path/to/contract',
                        gas: 3000000
                    }
                }
            }
        });
        sandbox.stub(require, 'main').returns({
            ethereum: {
                url: 'ws://localhost:8546'
            }
        });
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should correctly initialize the EthereumConnector', async () => {
        const connector = new EthereumConnector(0, 'ethereum');
        expect(connector).to.be.instanceOf(EthereumConnector);
        expect(mockWeb3.eth.Contract.called).to.be.false;
    });

    it('should deploy a contract using the EthereumConnector', async () => {
        const connector = new EthereumConnector(0, 'ethereum');
        mockWeb3.eth.Contract.returns(mockContract);
        await connector.installSmartContract();
        expect(mockContract.deploy.called).to.be.true;
    });

    it('should unlock an account if privateKey is not provided', async () => {
        const config = {
            ethereum: {
                url: 'ws://localhost:8546',
                contractDeployerAddress: '0x1234567890',
                contractDeployerAddressPassword: 'password',
                transactionConfirmationBlocks: 2
            }
        };

        configStub.returns(networkConfig);
        if (JSON.parse.restore) {
            JSON.parse.restore();
        }
        sandbox.stub(JSON, 'parse').returns(config);
        const connector = new EthereumConnector(0, 'ethereum');
        await connector.init(true);
        expect(mockWeb3.eth.personal.unlockAccount.calledWith('0x1234567890', 'password', 1000)).to.be.true;
    });
});
