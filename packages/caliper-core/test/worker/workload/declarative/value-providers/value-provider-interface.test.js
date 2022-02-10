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
const ValueProviderInterface = require('../../../../../lib/worker/workload/declarative/value-providers/value-provider-interface');

describe('ValueProviderInterface', () => {
    describe('Constructor', () => {

        it('should initialise successfully for undefined valueProviderFactory', () => {
            const wrapper = () => new ValueProviderInterface({}, {}, {}, undefined);
            wrapper();
        });


        it('should initialise successfully options undefined', () => {
            const wrapper = () => new ValueProviderInterface(undefined, {},{}, {});
            wrapper();
        });

        it('should initialise successfully variables undefined', () => {
            const wrapper = () => new ValueProviderInterface({}, undefined, {}, {});
            wrapper();
        });

        it('should initialise successfully with four objects passed', () => {
            const wrapper = () => new ValueProviderInterface({}, {}, {}, {});
            wrapper();
        });

        it('should initialise successfully all constructor parameters undefined', () => {
            const wrapper = () => new ValueProviderInterface(undefined, undefined, undefined, undefined);
            wrapper();
        });
    });

    describe('generateValue', () => {
        it('should throw an error for unimplemented generateValue()', () => {
            const wrapper = () => new ValueProviderInterface({}, {}, {}, {}).generateValue();
            expect(wrapper).to.throw(Error, 'generateValue() must be implemented');
        });
    });
});
