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
const FormattedStringValueProvider = require('../../../../../lib/worker/workload/declarative/value-providers/formatted-string-value-provider');
const ListElementValueProvider = require('../../../../../lib/worker/workload/declarative/value-providers/list-element-value-provider');
const ParameterReferenceValueProvider = require('../../../../../lib/worker/workload/declarative/value-providers/parameter-reference-value-provider');
const UniformRandomValueProvider = require('../../../../../lib/worker/workload/declarative/value-providers/uniform-random-value-provider');
const expect = chai.expect;
const ValueProviderFactory = require('../../../../../lib/worker/workload/declarative/value-providers/value-provider-factory');
const VariableReferenceValueProvider = require('../../../../../lib/worker/workload/declarative/value-providers/variable-reference-value-provider');

describe('Value Provider Factory', () => {

    describe('createValueProvider', () => {

        it('should throw an error on undefined type', () => {
            const wrapper = () => new ValueProviderFactory ({}, {}).createValueProvider(undefined, {});
            expect(wrapper).to.throw(Error, 'Invalid value for type: undefined');
        });

        it('should return list element value provider', () => {
            const options = {
                list: ['one', 'two', 'three'],
                selector: {
                    type: 'variable_reference',
                    options: {
                        name: 'marblePrefix'
                    }
                }
            }

            const variables = {
                marblePrefix: 0
            };
            
            const wrapper = () => new ValueProviderFactory(variables, {}).createValueProvider('list_element', options);
            expect(wrapper() instanceof ListElementValueProvider).to.equal(true);
        });

        it('should return parameter reference value provider', () => {
            const options = {
                name: 'marbleNumber'
            };
            const parameters = {
                marbleNumber: 'answer'
            };

            const wrapper = () => new ValueProviderFactory({}, parameters).createValueProvider('parameter_reference', options);
            expect(wrapper() instanceof ParameterReferenceValueProvider).to.equal(true);
        });

        it('should return variable reference value provider', () => {
            const options = {
                name: 'marbleNumber'
            };
            const variables = {
                marbleNumber: 'answer'
            };

            const wrapper = () => new ValueProviderFactory(variables, {}).createValueProvider('variable_reference', options);
            expect(wrapper() instanceof VariableReferenceValueProvider).to.equal(true);
        });

        it('should return uniform random value provider', () => {
            const options = {
                min: 0,
                max: 10
            }

            const wrapper = () => new ValueProviderFactory({}, {}).createValueProvider('uniform_random', options);
            expect(wrapper() instanceof UniformRandomValueProvider).to.equal(true);
        });

        it('should return formatted string value provider', () => {
            const options = {
                format: '{1}_',
                parts: [
                    {
                        type: 'parameter_reference',
                        options: {
                          name: 'marbleIndex',
                        }
                    }
                ]
            };

            const parameters = {
                marbleIndex: 2
            }

            const wrapper = () => new ValueProviderFactory({}, parameters).createValueProvider('formatted_string', options);
            expect(wrapper() instanceof FormattedStringValueProvider).to.equal(true);
        });

        it('should throw an error on invalid type', () => {
            const options = {
                format: '{1}_',
                parts: [
                    {
                        type: 'parameter',
                        options: {
                          name: 'marbleIndex',
                        }
                    }
                ]
            };

            const parameters = {
                marbleIndex: 2
            }

            const wrapper = () => new ValueProviderFactory({}, parameters).createValueProvider('parameter', options);
            expect(wrapper).to.throw(Error, 'Unknown value provider type: parameter');
        });
    });
});