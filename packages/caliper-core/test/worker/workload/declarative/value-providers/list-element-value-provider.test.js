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
const ListElementValueProvider = require('../../../../../lib/worker/workload/declarative/value-providers/list-element-value-provider');
const ValueProviderFactory = require('../../../../../lib/worker/workload/declarative/value-providers/value-provider-factory');

describe('List Element Value Provider', () => {
    describe('Constructor', () => {
        it('should throw an error on undefined options', () => {
            const wrapper = () =>
                new ListElementValueProvider(undefined, {}, {}, {});
            expect(wrapper).to.throw(Error, 'Incorrect options value: undefined');
        });

        it('should throw an error on undefined valueProviderFactory', () => {
            const wrapper = () =>
                new ListElementValueProvider({}, {}, {}, undefined);
            expect(wrapper).to.throw(Error, 'Missing factory for list element value provider');
        });

        it('should throw an error on undefined value for list', () => {
            const options = {
                selector: {}
            };
            const wrapper = () => new ListElementValueProvider(options, {}, {}, {});
            expect(wrapper).to.throw(Error, 'Incorrect value for list: undefined');
        });

        it('should throw an error on wrong type for list', () => {
            const options = {
                list: 22,
                selector: {}
            };
            const wrapper = () => new ListElementValueProvider(options, {}, {}, {});
            expect(wrapper).to.throw(Error, 'Incorrect value for list: 22');
        });

        it('should throw an error on an empty list', () => {
            const options = {
                list: [],
                selector: {}
            };
            const wrapper = () => new ListElementValueProvider(options, {}, {}, {});
            expect(wrapper).to.throw(Error, 'Empty list not allowed in List element value provider');
        });

        it('should throw an error on undefined selector in options', () => {
            const options = {
                list: ['one']
            };

            const wrapper = () => new ListElementValueProvider(options, {}, {}, {});

            expect(wrapper).to.throw(Error, 'Incorrect value for selector: undefined');
        });
        it('should throw an error on wrong value for selector', () => {
            const options = {
                list: ['one'],
                selector: 22
            };

            const wrapper = () => new ListElementValueProvider(options, {}, {}, {});

            expect(wrapper).to.throw(Error, 'Incorrect value for selector: 22');
        });
    });

    describe('generateValue', () => {
        it('should run successfully and return corresponding list element', () => {
            const options = {
                list: ['one', 'two', 'three'],
                selector: {
                    type: 'variable_reference',
                    options: {
                        name: 'marblePrefix'
                    }
                }
            };

            const variables = {
                marblePrefix: 0
            };

            const result = () => {
                const valueProviderFactory = new ValueProviderFactory(variables, {});
                return valueProviderFactory.createValueProvider('list_element', options).generateValue();
            };

            expect(result()).to.equal('one');
        });

    });
});
