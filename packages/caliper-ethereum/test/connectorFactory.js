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
const ConfigUtil = require('@hyperledger/caliper-core').ConfigUtil;
const path = require('path');

const { ConnectorFactory } = require('../lib/connectorFactory');
const EthereumConnector = require('../lib/ethereum-connector');

describe('ConnectorFactory', function () {
    let tempConfigFilePath;

    beforeEach(() => {
        tempConfigFilePath = path.resolve(
            __dirname,
            './sample-configs/networkconfig.json'
        );
        ConfigUtil.set(ConfigUtil.keys.NetworkConfig, tempConfigFilePath);
    });

    const workerIndices = [0, 1, 2];
    workerIndices.forEach((workerIndex) => {
        it(`should create an instance of EthereumConnector with workerIndex ${workerIndex}`, async function () {
            const connector = await ConnectorFactory(workerIndex);
            expect(connector).to.be.an.instanceof(EthereumConnector);
            expect(connector.workerIndex).to.equal(workerIndex);
        });
    });

    it('should handle -1 for the manager process', async function () {
        const workerIndex = -1;
        const connector = await ConnectorFactory(workerIndex);
        expect(connector).to.be.an.instanceof(EthereumConnector);
        expect(connector.workerIndex).to.equal(workerIndex);
    });
});
