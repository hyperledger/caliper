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
const ConnectorConfiguration = require('../lib/ConnectorConfiguration');

describe('An Adapter Configuration Factory', () => {
    it('should accept a valid YAML file', () => {
        (() => {
            const connectorConfiguration = new ConnectorConfigurationFactory().create('./test/sampleConfigs/BasicConfig.yaml');
            connectorConfiguration.should.be.instanceOf(ConnectorConfiguration);
        }).should.not.throw();
    });

    it('should accept a valid JSON file', () => {
        (() => {
            const connectorConfiguration = new ConnectorConfigurationFactory().create('./test/sampleConfigs/BasicConfig.json');
            connectorConfiguration.should.be.instanceOf(ConnectorConfiguration);
        }).should.not.throw();
    });

    it('should throw an error if not a valid YAML file', () => {
        (() => {
            new ConnectorConfigurationFactory().create('./sampleConfigs/invalid.yaml');
        }).should.throw(/Failed to parse the .*invalid.yaml/);
    });

    it('should throw an error if not a valid JSON file', () => {
        (() => {
            new ConnectorConfigurationFactory().create('./sampleConfigs/invalid.json');
        }).should.throw(/Failed to parse the .*invalid.json/);
    });

    it('should throw an error if no file exists', () => {
        (() => {
            new ConnectorConfigurationFactory().create('/path/to/nonexistent/config.yaml');
        }).should.throw(/Failed to parse the \/path\/to\/nonexistent\/config.yaml/);
    });
});
