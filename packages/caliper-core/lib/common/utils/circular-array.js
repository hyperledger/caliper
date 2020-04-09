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
 * Create an Array that has a maximum length and will overwrite existing entries when additional items are added to the array
 */
class CircularArray extends Array {

    /**
     * Constructor
     * @param {number} maxLength maximum length of array
     */
    constructor(maxLength) {
        super();
        this.pointer = 0;
        this.maxLength = maxLength;
    }

    /**
     * Add entry into array
     * @param {any} element the element to add to the array
     */
    add(element) {
        if (this.length === this.maxLength) {
            this[this.pointer] = element;
        } else {
            this.push(element);
        }
        this.pointer = (this.pointer + 1) % this.maxLength;
    }
}

module.exports = CircularArray;
