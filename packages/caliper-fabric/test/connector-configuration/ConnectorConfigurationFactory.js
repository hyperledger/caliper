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

const ConnectorConfigurationFactory = require('../../lib/connector-configuration/ConnectorConfigurationFactory');
const ConnectorConfiguration = require('../../lib/connector-configuration/ConnectorConfiguration');
const GenerateWallet = require('../utils/GenerateWallet');

describe('A Connector Configuration Factory', () => {
    const {walletFacadeFactory} = new GenerateWallet().createStandardTestWalletSetup();

    it('should accept a valid YAML file', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.yaml', walletFacadeFactory);
        connectorConfiguration.should.be.instanceOf(ConnectorConfiguration);
    });

    it('should accept a valid JSON file', async () => {
        const connectorConfiguration = await new ConnectorConfigurationFactory().create('./test/sample-configs/BasicConfig.json', walletFacadeFactory);
        connectorConfiguration.should.be.instanceOf(ConnectorConfiguration);
    });

    it('should throw an error if not a valid YAML file', async () => {
        await new ConnectorConfigurationFactory().create('./sample-configs/invalid.yaml', walletFacadeFactory).should.be.rejectedWith(/Failed to parse the .*invalid.yaml/);
    });

    it('should throw an error if not a valid JSON file', async () => {
        await new ConnectorConfigurationFactory().create('./sample-configs/invalid.json', walletFacadeFactory).should.be.rejectedWith(/Failed to parse the .*invalid.json/);
    });

    it('should throw an error if no file exists', async () => {
        await new ConnectorConfigurationFactory().create('/path/to/nonexistent/config.yaml').should.be.rejectedWith(/Failed to parse the \/path\/to\/nonexistent\/config.yaml/);
    });
});
