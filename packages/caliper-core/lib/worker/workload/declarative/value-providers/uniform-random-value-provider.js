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
 * Class with implementation of UniformRandomValueProvider
 */
class UniformRandomValueProvider extends ValueProviderInterface {
    /**
     * Initialize an instance of UniformRandomValueProvider
     * @param {object} options The user provided options for value provider
     * @param {object} variables Store of variables managed by workload module
     * @param {object} parameters Store of workload parameters provided by the user through the round configuration
     * @param {object} valueProviderFactory ValueProviderFactory object reference
     */
    constructor(options, variables, parameters, valueProviderFactory) {
        super(options, variables, parameters, valueProviderFactory);

        if (this.options === undefined){
            throw new Error(`Incorrect options value: ${this.options}`);
        }

        if (this.options.min === undefined || typeof this.options.min !== 'number') {
            throw new Error(
                `Incorrect configuration for min: ${this.options.min}`
            );
        }

        if (this.options.max === undefined || typeof this.options.max !== 'number') {
            throw new Error(
                `Incorrect configuration for max: ${this.options.max}`
            );
        }

        /**
         * Minimum possible generated Random Number from given range in options
         * @type {number}
         */
        this.min = this.options.min;

        /**
         * Maximum possible generated Random Number from given range in options
         * @type {number}
         */
        this.max = this.options.max;

        if (this.min > this.max) {
            const temp = this.min;
            this.min = this.max;
            this.max = temp;
        }
    }
    /**
     * Generate values for corresponding options provided
     * @returns {number} Generated random value in given inclusive range
     */
    generateValue() {
        return Math.floor(Math.random() * (this.max - this.min + 1)) + this.min;
    }
}

module.exports = UniformRandomValueProvider;
