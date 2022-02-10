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
 * Class with implementation of ParameterReferenceValueProvider
 */
class ParameterReferenceValueProvider extends ValueProviderInterface {
    /**
     * Initialize an instance of ParameterReferenceValueProvider
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

        if(this.parameters === undefined) {
            throw new Error(`Incorrect parameters value: ${this.parameters}`);
        }

        if (
            this.options.name === undefined ||
            typeof this.options.name !== 'string'
        ) {
            throw new Error(
                `Incorrect parameter name: ${options.name}`
            );
        }

        if (this.parameters[this.options.name] === undefined) {
            throw new Error(`Parameter ${this.options.name} cannot be found among available parameters`);
        }
    }
    /**
     * Generates value for corresponding parameter
     * @returns {any} value for parameter according to options.name
     */
    generateValue() {
        return this.parameters[this.options.name];
    }
}

module.exports = ParameterReferenceValueProvider;
