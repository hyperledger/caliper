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
const UniformRandomValueProvider = require('../../../../../lib/worker/workload/declarative/value-providers/uniform-random-value-provider');

function expectHelper(result, max, min) {
    expect(result).to.be.above(
        min - 1
    );
    expect(result).to.be.below(
        max + 1
    );
}

describe('UniformRandomValueProvider', () => {
    describe('Constructor', () => {
        it('should throw an error on undefined options', () => {
            const wrapper = () => new UniformRandomValueProvider(undefined, {}, {}, {});
            expect(wrapper).to.throw(Error, 'Incorrect options value: undefined');
        });

        it('should throw an error for undefined min in options', () => {
            const options = {
                max: 10,
            };
            const wrapper = () => new UniformRandomValueProvider(options, {}, {}, {});
            expect(wrapper).to.throw(Error, 'Incorrect configuration for min: undefined');
        });

        it('should throw an error for non-number min in options', () => {
            const options = {
                min: 'wrong',
                max: 10
            };
            const wrapper = () => new UniformRandomValueProvider(options, {}, {}, {});
            expect(wrapper).to.throw(Error, 'Incorrect configuration for min: wrong');
        });

        it('should throw an error for undefined max in options', () => {
            const options = {
                min: 10,
            };
            const wrapper = () => new UniformRandomValueProvider(options, {}, {}, {});
            expect(wrapper).to.throw(Error, 'Incorrect configuration for max: undefined');
        });

        it('should throw an error for non-number max in options', () => {
            const options = {
                max: 'wrong',
                min: 10
            };
            const wrapper = () => new UniformRandomValueProvider(options, {}, {}, {});
            expect(wrapper).to.throw(Error, 'Incorrect configuration for max: wrong');
        });
    });
    
    describe('generateValue', () => {
        it('should return a number between 0 to 100', () => {
            const options = {
                min: 0,
                max: 100
            }

            
            const valueProvider = new UniformRandomValueProvider(options, {}, {}, {});
            const result = valueProvider.generateValue();
            
            expectHelper(result, options.max, options.min);
        });

        it('should return a 10 or 11', () => {
            const options = {
                min: 10,
                max: 11
            }

            const valueProvider = new UniformRandomValueProvider(options, {}, {}, {});
            const result = valueProvider.generateValue();
            
            expectHelper(result, options.max, options.min);
        });

        it('should return 10', () => {
            const options = {
                min: 10,
                max: 10
            }

            const valueProvider = new UniformRandomValueProvider(options, {}, {}, {});
            const result = valueProvider.generateValue();
            
            expect(result).to.equal(10);
        });


        it('should return a number between -100 and 0', () => {
            const options = {
                min: 0,
                max: -100
            }

            const valueProvider = new UniformRandomValueProvider(options, {}, {}, {});
            const result = valueProvider.generateValue();

            expectHelper(result, options.min, options.max);
        });
    });
});
