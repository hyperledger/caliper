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
const FormattedStringValueProvider = require('../../../../../lib/worker/workload/declarative/value-providers/formatted-string-value-provider.js');
const ValueProviderFactory = require('../../../../../lib/worker/workload/declarative/value-providers/value-provider-factory');

describe('Formatted String Value Provider', () => {
    describe('Constructor', () =>{
        it('should throw an error on undefined options', () => {
            const wrapper = () => new FormattedStringValueProvider(undefined, {}, {}, {});
            expect(wrapper).to.throw(Error, 'Incorrect options value: undefined');
        });

        it('should throw an error on undefined valueProviderFactory', () => {
            const wrapper = () => new FormattedStringValueProvider({}, {}, {}, undefined);
            expect(wrapper).to.throw(Error, 'Incorrect valueProviderFactory value: undefined');
        });

        it('should throw an error for undefined format', () => {
            const options = {
                parts: []
            };

            const wrapper = () => new FormattedStringValueProvider(options, {}, {}, {});
            expect(wrapper).to.throw(Error, 'Invalid format value: undefined');
        });

        it('should throw an error for non-string format', () => {
            const options = {
                format: [1],
                parts: []
            };

            const wrapper = () => new FormattedStringValueProvider(options, {}, {}, {});
            expect(wrapper).to.throw(Error, 'Invalid format value: 1');
        });

        it('should throw an error for undefined parts', () => {
            const options = {
                format: ''
            };

            const wrapper = () => new FormattedStringValueProvider(options, {}, {}, {});
            expect(wrapper).to.throw(Error, 'Incorrect parts value: undefined');
        });

        it('should throw an error for non-object parts', () => {
            const options = {
                format: '',
                parts: '1'
            };

            const wrapper = () => new FormattedStringValueProvider(options, {}, {}, {});
            expect(wrapper).to.throw(Error, 'Incorrect parts value: 1');
        });

        it('should throw an error for missing part', () => {
            const options = {
                format: 's',
                parts: [
                    {
                        type: 'variable_reference',
                        options: {
                            name: 'marblePrefix',
                        }
                    }
                ]
            };

            const variables = {
                marblePrefix: 5
            };

            const wrapper = () => {
                const valueProviderFactory = new ValueProviderFactory(variables, {});
                valueProviderFactory.createValueProvider('formatted_string', options);
            };
            expect(wrapper).to.throw(Error, `Missing {1} placeholder for subprovider`);

        });

        it('should throw an error for out of bounds placeholder', () => {
            const options = {
                format: '{1}_{10}',
                parts: [
                    {
                        type: 'variable_reference',
                        options: {
                            name: 'marblePrefix',
                        }
                    }
                ]
            };

            const variables = {
                marblePrefix: 5
            };

            const wrapper = () => {
                const valueProviderFactory = new ValueProviderFactory(variables, {});
                valueProviderFactory.createValueProvider('formatted_string', options);
            };
            expect(wrapper).to.throw(Error, 'Out of bound placeholder in format string: 10. Must be in range [1,1]');
        });

    });

    describe('generateValue', () => {
        it('should succesfully create a string for single variable in format', () => {
            const options = {
                format: '{1}_',
                parts: [
                    {
                        type: 'variable_reference',
                        options: {
                            name: 'marblePrefix',
                        }
                    }
                ]
            };

            const variables = {
                marblePrefix: 5
            };


            const result = () => {
                const valueProviderFactory = new ValueProviderFactory(variables, {});
                return valueProviderFactory.createValueProvider('formatted_string', options).generateValue();
            };

            expect(result()).to.equal('5_');

        });

        it('should succesfully create a string for single parameter in format', () => {
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
            };

            const result = () => {
                const valueProviderFactory = new ValueProviderFactory({}, parameters);
                return valueProviderFactory.createValueProvider('formatted_string', options).generateValue();
            };

            expect(result()).to.equal('2_');
        });

        it('should succesfully create a string for one parameter and one variable in format', () => {
            const options = {
                format: '{1}_{2}',
                parts: [
                    {
                        type: 'parameter_reference',
                        options: {
                            name: 'marbleIndex',
                        }
                    },
                    {
                        type: 'variable_reference',
                        options: {
                            name: 'marblePrefix'
                        }
                    }
                ]
            };

            const parameters = {
                marbleIndex: 2
            };

            const variables = {
                marblePrefix: 5
            };

            const result = () => {
                const valueProviderFactory = new ValueProviderFactory(variables, parameters);
                return valueProviderFactory.createValueProvider('formatted_string', options).generateValue();
            };

            expect(result()).to.equal('2_5');
        });

        it('should successfully create a string for one variable repeated twice', () => {
            const options = {
                format: '{1}_{1}',
                parts: [
                    {
                        type: 'variable_reference',
                        options: {
                            name: 'marblePrefix',
                        }
                    }
                ]
            };


            const variables = {
                marblePrefix: 5
            };

            const result = () => {
                const valueProviderFactory = new ValueProviderFactory(variables, {});
                return valueProviderFactory.createValueProvider('formatted_string', options).generateValue();
            };

            expect(result()).to.equal('5_5');
        });

        it('should successfully create a string for one parameter repeated twice', () => {
            const options = {
                format: '{1}_{1}',
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
            };

            const result = () => {
                const valueProviderFactory = new ValueProviderFactory({}, parameters);
                return valueProviderFactory.createValueProvider('formatted_string', options).generateValue();
            };

            expect(result()).to.equal('2_2');
        });
    });
});