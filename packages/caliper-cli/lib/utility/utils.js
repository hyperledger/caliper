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
 * utility functions for CLI
 */
class Utils {

    /**
     * Utility function to check for singleton values
     * @param {string[]} passedArgs arguments passed by user
     * @param {string[]} uniqueArgs arguments that must be unique
     * @returns {boolean} boolean true if passes check
     */
    static checkSingleton(passedArgs, uniqueArgs) {
        uniqueArgs.forEach((e) => {
            if (Array.isArray(passedArgs[e])) {
                throw new Error(`Option [${e}] can only be specified once`);
            }
        });
        return true;
    }
}

module.exports = Utils;
