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
const ContractFunctionParameter = require('../../../../lib/worker/workload/declarative/contract-function-parameter');
const ValueProviderFactory = require('../../../../lib/worker/workload/declarative/value-providers/value-provider-factory');
describe('Contract Function Parameter', () => {
    describe('generateValue', () => {
        it('should successfully return specified value', () => {
            const variables = {
                'marbleName': 'firstMarble'
            };

            const parameters = {
                'marbleNumber': 5
            };

            const parameter = {
                'name': 'marbleName',
                'type': 'formatted_string',
                'options': {
                    'format': '{1}_{2}',
                    'parts': [
                        {
                            'type': 'parameter_reference',
                            'options': { 'name': 'marbleNumber' }
                        },
                        {
                            'type': 'variable_reference',
                            'options': { 'name': 'marbleName' }
                        }
                    ]
                }
            };
            const valueProviderFactory = new ValueProviderFactory(variables, parameters);
            const result = () => new ContractFunctionParameter(parameter, valueProviderFactory).generateValue();

            expect(result()).to.equal('5_firstMarble');
        });
    });
});