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
const VariableReferenceValueProvider = require('../../../../../lib/worker/workload/declarative/value-providers/variable-reference-value-provider');

describe('VariableReferenceValueProvider', () => {
    describe('Constructor', () => {
        it('should throw an error on undefined options', () => {
            const wrapper = () => new VariableReferenceValueProvider(undefined, {}, {}, {});
            expect(wrapper).to.throw(Error, 'Incorrect options value: undefined');
        });

        it('should throw an error on undefined parameters', () => {
            const wrapper = () => new VariableReferenceValueProvider({}, undefined, {}, {});
            expect(wrapper).to.throw(Error, 'Incorrect variables value: undefined');
        });
        it('should throw an error on undefined name in options', () => {
            const options = {};
            const variables = {
                marbleNumber: 1
            };

            const wrapper = () => new VariableReferenceValueProvider(options, variables, {}, {});
            expect(wrapper).to.throw(Error, 'Incorrect variable name: undefined');
        });

        it('should throw an error on non-string name in options', () =>{
            const options = {
                name: 3
            };
            const variables = {
                marbleNumber: 1
            };

            const wrapper = () => new VariableReferenceValueProvider(options, variables, {}, {});
            expect(wrapper).to.throw(Error, 'Incorrect variable name: 3');
        });

        it('should throw an error on undefined name in variables', () => {
            const options = {
                name: 'marbleName'
            };
            const variables = {
                marbleNumber: 1
            };

            const wrapper = () => new VariableReferenceValueProvider(options, variables, {}, {});
            expect(wrapper).to.throw(Error, 'Variable marbleName cannot be found among available variables');
        });
    });

    describe('generateValue', () => {
        it('should return a numerical variable value', () => {
            const options = {
                name: 'marbleNumber'
            };
            const variables = {
                marbleNumber: 1
            };

            const valueProvider = new VariableReferenceValueProvider(options, variables, {}, {});
            const result = valueProvider.generateValue();
            
            expect(result).to.equal(1);
        });

        it('should return a string variable value', () => {
            const options = {
                name: 'marbleNumber'
            };
            const variables = {
                marbleNumber: 'answer'
            };

            const valueProvider = new VariableReferenceValueProvider(options, variables, {}, {});
            const result = valueProvider.generateValue();
            
            expect(result).to.equal('answer');
        });
    });
});