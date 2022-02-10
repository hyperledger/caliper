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
 * Class with implementation of VariableReferenceValueProvider
 */
class VariableReferenceValueProvider extends ValueProviderInterface {
    /**
     * Initialize an instance of VariableReferenceValueProvider
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

        if(this.variables === undefined) {
            throw new Error(`Incorrect variables value: ${this.variables}`);
        }

        if (
            this.options.name === undefined ||
            typeof this.options.name !== 'string'
        ) {
            throw new Error(
                `Incorrect variable name: ${options.name}`
            );
        }

        if (this.variables[this.options.name] === undefined) {
            throw new Error(`Variable ${this.options.name} cannot be found among available variables`);
        }
    }
    /**
     * Generates value for corresponding variable
     * @returns {any} value for variable according to options.name
     */
    generateValue() {
        return this.variables[this.options.name];
    }
}

module.exports = VariableReferenceValueProvider;
