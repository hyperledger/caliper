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
chai.should();

const ConnectorConfigurationFactory = require('../lib/ConnectorConfigurationFactory');
const GenerateConfiguration = require('./utils/GenerateConfiguration');

describe('A valid Adapter Configuration', () => {

    describe('for mutual TLS', () => {
        it('should report true if specified as true in the configuration', () => {
            const connectorConfiguration = new ConnectorConfigurationFactory().create('./test/sampleConfigs/BasicConfig.yaml');
            connectorConfiguration.isMutualTLS().should.be.true;
        });

        it('should report false if specified as false in the configuration', () => {
            const configFile = new GenerateConfiguration('./test/sampleConfigs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    caliper: {
                        blockchain: 'fabric',
                        sutOptions: {
                            mutualTls: false
                        }
                    }
                }
            );
            const connectorConfiguration = new ConnectorConfigurationFactory().create(configFile);
            connectorConfiguration.isMutualTLS().should.be.false;
        });

        it('should report false if not specified in the configuration', () => {
            const configFile = new GenerateConfiguration('./test/sampleConfigs/BasicConfig.yaml').generateConfigurationFileWithSpecifics(
                {
                    caliper: {
                        blockchain: 'fabric'
                    }
                }
            );
            const connectorConfiguration = new ConnectorConfigurationFactory().create(configFile);
            connectorConfiguration.isMutualTLS().should.be.false;
        });

    });
});
