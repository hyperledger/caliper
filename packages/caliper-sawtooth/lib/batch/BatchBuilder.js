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
 * Batch builder class
 */
class BatchBuilder {
    /**
     * Constructor
     */
    constructor() {
    }

    /**
     * Build batch
     * @param {*} args transactions arguments
     */
    buildBatch(args) {
        throw new Error('buildBatch is not implemented for this application!!');
    }

    /**
     * Calculate address
     * @param {String} name address name
     */
    calculateAddress(name) {
        throw new Error('calculateAddress is not implemented for this application!!');
    }

}

module.exports = BatchBuilder;
