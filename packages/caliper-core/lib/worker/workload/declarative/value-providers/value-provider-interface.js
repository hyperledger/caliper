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
/**
 * Interface for value providers
 */
class ValueProviderInterface {
    /**
     * Initialize an instance of ValueProviderInterface
     * @param {object} options The user provided options for value provider
     * @param {object} variables Store of variables managed by workload module
     * @param {object} parameters Store of workload parameters provided by the user through the round configuration
     * @param {object} valueProviderFactory ValueProviderFactory object reference
     */
    constructor(
        options,
        variables,
        parameters,
        valueProviderFactory
    ) {
        this.options = options;
        this.variables = variables;
        this.parameters = parameters;
        this.valueProviderFactory = valueProviderFactory;
    }
    /**
     * Generate values for corresponding options provided
     * @returns {object} Generated Value
     */
    generateValue() {
        throw new Error('generateValue() must be implemented');
        // eslint-disable-next-line no-unreachable
        return undefined;
    }
}

module.exports = ValueProviderInterface;
