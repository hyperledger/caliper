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

const ContractFunctionParameter = require('./contract-function-parameter');
/**
 * Base class representing a contract function
 */
class ContractFunction {
    /**
     * @param {object} functionReference Function to be initialised
     * @param {object} valueProviderFactory Factory object for creating Value provider objects
     */
    constructor(functionReference, valueProviderFactory) {
        this.parameters = {};
        for(const parameterObject of functionReference.parameters) {
            this.parameters[parameterObject.name] = new ContractFunctionParameter(parameterObject, valueProviderFactory);
        }
    }

    /**
     * Generates and returns information about function and its parameters
     * @returns {object} Object containing information about selected function parameter values
     */
    generateCallArguments() {
        let generatedValues = {};
        for(const parameterKey of Object.keys(this.parameters)) {
            this.generatedValues[parameterKey] = this.parameters[parameterKey].generateValue();
        }
        return generatedValues;
    }
}

module.exports = ContractFunction;