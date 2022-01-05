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
 * Class for instanciating parameters
 */
class ContractFunctionParameter {
    /**
     * Initialises an instance of ContractFunctionParameter
     * @param {array} parameterReference Parameter to be generated
     * @param {object} valueProviderFactory Factory object for creating Value provider objects
     */
    constructor(parameterReference, valueProviderFactory) {
        this.valueProvider = valueProviderFactory.createValueProvider(parameterReference.type, parameterReference.options);
    }

    /**
     * Generates value for the function parameters
     * @returns {object} Object containing parameter values
     */
    generateValue() {
        return this.valueProvider.generateValue();
    }
}

module.exports = ContractFunctionParameter;