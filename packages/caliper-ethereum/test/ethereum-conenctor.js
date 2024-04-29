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
const expect = chai.expect;
const sinon = require('sinon');
const rewire = require('rewire');

const EthereumConnector = rewire('../lib/ethereum-connector');

describe('EthereumConnector', () => {
    let sandbox;
    let mockWeb3;
    let connectorInstance;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        mockWeb3 = {
            eth: {
                Contract: sandbox.stub(),
                accounts: {
                    wallet: {
                        add: sandbox.stub()
                    }
                },
                personal: {
                    unlockAccount: sandbox.stub().resolves(true)
                }
            }
        };

        EthereumConnector.__set__('Web3', function() {
            return mockWeb3;
        });

        connectorInstance = new EthereumConnector(0, 'ethereum');
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('constructor', () => {
        it('should create an instance and set initial properties', () => {
            expect(connectorInstance.workerIndex).to.equal(0);
            expect(connectorInstance.bcType).to.equal('ethereum');
        });
    });

    describe('init', () => {
        it('should initialize successfully with a private key', async () => {
            const result = await connectorInstance.init(false);
            sinon.assert.calledOnce(mockWeb3.eth.accounts.wallet.add);
            expect(result).to.be.undefined;
        });
    });
});
