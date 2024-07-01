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
const sinon = require('sinon');
const expect = require('chai').expect;
const ConfigUtil = require('@hyperledger/caliper-core').ConfigUtil;
const EthereumConnector = require('../lib/ethereum-connector');
describe('EthereumConnector', function () {
    let ConfigFilePath;

    beforeEach(() => {
        ConfigFilePath = path.resolve(
            __dirname,
            './sample-configs/networkconfig.json'
        );
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, ConfigFilePath);
    });

    describe('While installing a Smart Contract, it', () => {
        it('should deploy all contracts successfully when no privacy settings are used', async () => {
            const workerIndex = 0;
            const bcType = 'ethereum';
            const ethereumConnector = new EthereumConnector(workerIndex, bcType);
            const deployContractStub = sinon.stub(ethereumConnector, 'deployContract').resolves({
                options: { address: '0x123' },
            });
            await ethereumConnector.installSmartContract();
            sinon.assert.called(deployContractStub);
            deployContractStub.restore();
        });
    });


    describe('When constructed with an invalid url path', function () {
        it('should throw an error', function () {
            const invalidConfig = path.resolve(
                __dirname,
                './sample-configs/invalidUrlConfig.json'
            );
            ConfigUtil.set(ConfigUtil.keys.NetworkConfig, invalidConfig);
            expect(() => new EthereumConnector(invalidConfig)).to.throw(
                'Ethereum benchmarks must not use http(s) RPC connections, as there is no way to guarantee the ' +
                    'order of submitted transactions when using other transports. For more information, please see ' +
                    'https://github.com/hyperledger/caliper/issues/776#issuecomment-624771622'
            );
        });
    });

    describe('When constructed with absent url path', function () {
        it('should throw an error', function () {
            const invalidConfig = path.resolve(__dirname,'./sample-configs/noUrlConfig.json');
            ConfigUtil.set(ConfigUtil.keys.NetworkConfig, invalidConfig);
            expect(() => new EthereumConnector(invalidConfig)).to.throw(
                'No URL given to access the Ethereum SUT. Please check your network configuration. ' +
                    'Please see https://hyperledger.github.io/caliper/v0.3/ethereum-config/ for more info.'
            );
        });
    });
});
