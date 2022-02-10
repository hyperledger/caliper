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

const ValueProviderInterface = require('./value-provider-interface');

/**
 * Class with implementation of ListElementValueProvider
 */
class ListElementValueProvider extends ValueProviderInterface {
    /**
     * Initialize an instance of ListElementValueProvider
     * @param {object} options The user provided options for value provider
     * @param {object} variables Store of variables managed by workload module
     * @param {object} parameters Store of workload parameters provided by the user through the round configuration
     * @param {object} valueProviderFactory ValueProviderFactory object reference
     */
    constructor(options, variables, parameters, valueProviderFactory) {
        super(options, variables, parameters, valueProviderFactory);

        if(this.options === undefined) {
            throw new Error(`Incorrect options value: ${this.options}`);
        }

        if(this.valueProviderFactory === undefined){
            throw new Error('Missing factory for list element value provider');
        }

        if(this.options.list === undefined || !Array.isArray(this.options.list)) {
            throw new Error(`Incorrect value for list: ${this.options.list}`);
        }

        if(this.options.list.length === 0){
            throw new Error('Empty list not allowed in List element value provider');
        }

        if(this.options.selector === undefined || typeof this.options.selector !== 'object') {
            throw new Error(`Incorrect value for selector: ${this.options.selector}`);
        }

        this.list = this.options.list;

        this.selector = this.valueProviderFactory.createValueProvider(this.options.selector.type, this.options.selector.options);
    }
    /**
     * Returns value for corresponding variable/parameter value from the list
     * @returns {any} value for parameter according to options.name
     */
    generateValue() {
        return this.list[this.selector.generateValue() % this.list.length];
    }
}

module.exports = ListElementValueProvider;
