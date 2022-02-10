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

const VariableReferenceValueProvider = require('./variable-reference-value-provider');
const ParameterReferenceValueProvider = require('./parameter-reference-value-provider');
const FormattedStringValueProvider = require('./formatted-string-value-provider');
const ListElementValueProvider = require('./list-element-value-provider');
const UniformRandomValueProvider = require('./uniform-random-value-provider');

/**
 * Factory class for transparently creating value provider instances
 * based on user configurations.
 */
class ValueProviderFactory {
    /**
     * Initialize an instance of ValueProviderFactory
    * @param {object} variables Store of variables managed by workload module
    * @param {object} parameters Store of workload parameters provided by the user through the round configuration
    */
    constructor(variables, parameters) {
        this.variables = variables;
        this.parameters = parameters;
    }
    /**
    * Creates and returns a new instance of value provider based on provided parameters
    * @param {object} type The type of value provider to create
    * @param {object} options The user-provided options for the value provider
    * @returns {object} Returns the crated ValueProviderInterface
    */
    createValueProvider(type, options) {
        if (type === undefined) {
            throw new Error(`Invalid value for type: ${typeof type}`);
        }

        let ValueProviderType;
        switch(type) {
        case 'variable_reference':
            ValueProviderType = VariableReferenceValueProvider;
            break;

        case 'parameter_reference':
            ValueProviderType = ParameterReferenceValueProvider;
            break;

        case 'formatted_string':
            ValueProviderType = FormattedStringValueProvider;
            break;

        case 'list_element':
            ValueProviderType = ListElementValueProvider;
            break;

        case 'uniform_random':
            ValueProviderType = UniformRandomValueProvider;
            break;

        default:
            throw new Error(`Unknown value provider type: ${type}`);
        }

        return new ValueProviderType(
            options,
            this.variables,
            this.parameters,
            this
        );
    }
}

module.exports = ValueProviderFactory;
