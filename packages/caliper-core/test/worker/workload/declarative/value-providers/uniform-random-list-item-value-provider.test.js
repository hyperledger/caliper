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

const UniformRandomListItemValueProvider = require('../../../../../lib/worker/workload/declarative/value-providers/uniform-random-list-item-value-provider');

describe('UniformRandomListItemValueProvider', () => {

    describe('Constructor', () => {
        it('should throw an error on undefined referenceList', () => {
            const wrapper = () => new UniformRandomListItemValueProvider(undefined);
            expect(wrapper).to.throw(Error, 'Incorrect value for reference list: undefined');
        });

        it('should throw an error on empty referenceList', () => {
            const wrapper = () => new UniformRandomListItemValueProvider([]);
            expect(wrapper).to.throw(Error, 'Incorrect value for reference list: ');
        });
    });

    describe('generateValue', () => {
        it('should return a valid list item value', () => {
            const result = () => new UniformRandomListItemValueProvider([1, 2, 3]).generateValue();
            expect([1, 2, 3]).to.include(result());
        });
    });
});