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
 * Base class for element selection
 */
class UniformRandomListItemValueProvider {
    /**
     * @param {array} referenceList List from which element has to be selected
     */
    constructor(referenceList) {
        this.referenceList = referenceList;
        if(this.referenceList === undefined || this.referenceList.length === 0) {
            throw new Error(`Incorrect value for reference list: ${this.referenceList}`);
        }

    }

    /**
     * @returns {object} element from referenceList
     */
    generateValue() {
        return this.referenceList[Math.floor(Math.random() * (this.referenceList.length))];
    }
}

module.exports = UniformRandomListItemValueProvider;