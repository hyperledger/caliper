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
const ConfigUtil = require('@hyperledger/caliper-core').ConfigUtil;
const EthereumConnector = require('../lib/ethereum-connector');

describe('EthereumConnector', function() {
    let tempConfigFilePath;

    beforeEach(() => {
        tempConfigFilePath = path.resolve(__dirname, './sample-configs/networkconfig.json');
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, tempConfigFilePath);
    });


    describe('EthereumConnector.installSmartContract', () => {
        it('should throw an error when the specified contract path does not exist', async () => {
            const invalidConfig = {
                contracts: {
                    nonexistent: {
                        path:  'src/simple/simple.sol'
                    }
                }
            };
            const ethereumConnector = new EthereumConnector(invalidConfig);

            try {
                await ethereumConnector.installSmartContract();
            } catch (err) {
                expect(err.message).to.contain('Cannot find module');
            }
        });
    });

    describe('EthereumConnector.init', () => {
        it('should throw an error when the specified contract path does not exist', async () => {
            const ethereumConnector = new EthereumConnector(0, 'ethereum');
            const contractDetails = {
                path: 'src/simple/nonexistent.sol'
            };

            try {
                await ethereumConnector.init(contractDetails);
            } catch (err) {
                expect(err.message).to.contain('connection not open');
            }
        });
    });
});

describe('EthereumConnector.checkConfig()', function () {
    beforeEach(() => {
        const invalidConfig = path.resolve(
            __dirname,
            './sample-configs/invalidconfig.json'
        );
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, invalidConfig);
    });
    it('should throw an error for an incorrect url path', function () {
        const invalidConfig = path.resolve(
            __dirname,
            './sample-configs/invalidUrlConfig.json'
        );
        expect(() => new EthereumConnector(invalidConfig)).to.throw();
    });
});
