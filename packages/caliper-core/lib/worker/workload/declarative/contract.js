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

const ContractFunction = require('./contract-function');
const UniformRandomListItemValueProvider = require('./value-providers/uniform-random-list-item-value-provider');
/**
 * Base class representing a contract
 */
class Contract {
    /**
     * Constructor for initialising Contract
     * @param {array} contract List of functions sent by declarative workload module
     * @param {object} valueProviderFactory Factory object for creating Value provider objects
     */
    constructor(contract, valueProviderFactory) {
        this.functions = {};
        for(const functionObject of contract.functions) {
            this.functions[functionObject.name] = new ContractFunction(functionObject, valueProviderFactory);
        }
        this.functionSelector = new UniformRandomListItemValueProvider(Object.keys(this.functions));
    }
    /**
     * Returns generated contract information
     * @returns {object} Initialised functions in Contract object
     */
    generateCallArguments() {
        return this.functions[this.functionSelector.generateValue()].generateCallArguments();
    }
}

module.exports = Contract;