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
 * Value class provider for formatted strings based on other value providers.
 */
class FormattedStringValueProvider extends ValueProviderInterface {
    /**
     * Initialize an instance of FormattedStringValueProvider
     * @param {object} options The user provided options for value provider
     * @param {object} variables Store of variables managed by workload module
     * @param {object} parameters Store of workload parameters provided by the user through the round configuration
     * @param {object} valueProviderFactory ValueProviderFactory object reference
     */
    constructor(options, variables, parameters, valueProviderFactory) {
        super(options, variables, parameters, valueProviderFactory);

        if (this.options === undefined) {
            throw new Error(`Incorrect options value: ${this.options}`);
        }

        if (this.valueProviderFactory === undefined) {
            throw new Error(`Incorrect valueProviderFactory value: ${this.valueProviderFactory}`);
        }

        if (
            this.options.format === undefined ||
            typeof this.options.format !== 'string'
        ) {
            throw new Error(`Invalid format value: ${this.options.format}`);
        }

        if (!Array.isArray(this.options.parts)) {
            throw new Error(`Incorrect parts value: ${this.options.parts}`);
        }

        this.format = this.options.format;
        this.parts = this.options.parts;
        const partLength = this.parts.length;
        this.subproviders = [];

        let regExp = new RegExp('[{][1-9]+[0-9]*[}]', 'g');
        let matches = this.format.match(regExp) || [];
        this.indexRegexPatterns = new Array(partLength).fill(-1);

        for(const match of matches) {
            const subMatch = match.slice(1, -1);
            const index = Number(subMatch);
            if (index < 1 || index > partLength) {
                throw new Error(`Out of bound placeholder in format string: ${index}. Must be in range [1,${partLength}]`);
            }
            this.indexRegexPatterns[index - 1] = new RegExp(`\\{${subMatch}\\}`, 'g'); // regexp({01})
        }

        this.indexRegexPatterns.forEach((value, index) => {
            if (value === -1) {
                // TODO: convert to warning later
                throw new Error(`Missing {${index + 1}} placeholder for subprovider`);
            }
        });

        this.parts.forEach((element) => {
            const subprovider = this.valueProviderFactory.createValueProvider(
                element.type,
                element.options
            );
            this.subproviders.push(subprovider);
        });
    }
    /**
     * Generates value for corresponding parameter
     * @returns {string} value for parameter according to options.name
     */
    generateValue() {
        let result = `${this.format}`;

        this.subproviders.forEach((subprovider, index) => {
            const value = subprovider.generateValue();
            result = result.replace(this.indexRegexPatterns[index], value);
        });
        return result;
    }
}

module.exports = FormattedStringValueProvider;
