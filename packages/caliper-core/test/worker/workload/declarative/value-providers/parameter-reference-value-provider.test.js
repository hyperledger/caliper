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
const ParameterReferenceValueProvider = require('../../../../../lib/worker/workload/declarative/value-providers/parameter-reference-value-provider');

describe('ParameterReferenceValueProvider', () => {
    describe('Constructor', () => {
        it('should throw an error on undefined options', () => {
            const wrapper = () => new ParameterReferenceValueProvider(undefined, {}, {}, {});
            expect(wrapper).to.throw(Error, 'Incorrect options value: undefined');
        });

        it('should throw an error on undefined parameters', () => {
            const wrapper = () => new ParameterReferenceValueProvider({}, {}, undefined, {});
            expect(wrapper).to.throw(Error, 'Incorrect parameters value: undefined');
        });
        it('should throw an error on undefined name in options', () => {
            const options = {};
            const parameters = {
                marbleNumber: 1
            };

            const wrapper = () => new ParameterReferenceValueProvider(options, {}, parameters, {});
            expect(wrapper).to.throw(Error, 'Incorrect parameter name: undefined');
        });

        it('should throw an error on non-string name in options', () =>{
            const options = {
                name: 2
            };
            const parameters = {
                marbleNumber: 1
            };

            const wrapper = () => new ParameterReferenceValueProvider(options, {}, parameters, {});
            expect(wrapper).to.throw(Error, 'Incorrect parameter name: 2');
        });

        it('should throw an error on undefined name in parameters', () => {
            const options = {
                name: 'marbleName'
            };
            const parameters = {
                marbleNumber: 1
            };

            const wrapper = () => new ParameterReferenceValueProvider(options, {}, parameters, {});
            expect(wrapper).to.throw(Error, 'Parameter marbleName cannot be found among available parameters');
        });
    });

    describe('generateValue', () => {
        it('should return a numerical parameter value', () => {
            const options = {
                name: 'marbleNumber'
            };
            const parameters = {
                marbleNumber: 1
            };
            const valueProvider = new ParameterReferenceValueProvider(options, {}, parameters, {});
            const result = valueProvider.generateValue();
            
            expect(result).to.equal(1);
        });

        it('should return a string parameter value', () => {
            const options = {
                name: 'marbleNumber'
            };
            const parameters = {
                marbleNumber: 'answer'
            };

            const valueProvider = new ParameterReferenceValueProvider(options, {}, parameters, {});
            const result = valueProvider.generateValue();
            
            expect(result).to.equal('answer');
        });
    });
});