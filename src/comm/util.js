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
const path = require('path');

// comm --> src --> root
const rootDir = path.join('..', '..');


/**
 * Internal Utility class for Caliper
 */
class Util {

    /**
     * Perform a sleep
     * @param {*} ms the time to sleep, in ms
     * @returns {Promise} a completed promise
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Simple log method to output to the console
     * @param {any} msg messages to log
     */
    static log(...msg) {
        // eslint-disable-next-line no-console
        console.log(...msg);
    }

    /**
     * Creates an absolute path from the provided relative path if necessary.
     * @param {String} relOrAbsPath The relative or absolute path to convert to an absolute path.
     *                              Relative paths are considered relative to the Caliper root folder.
     * @return {String} The resolved absolute path.
     */
    static resolvePath(relOrAbsPath) {
        if (!relOrAbsPath) {
            throw new Error('Util.resolvePath: Parameter is undefined');
        }

        if (path.isAbsolute(relOrAbsPath)) {
            return relOrAbsPath;
        }

        return path.join(__dirname, rootDir, relOrAbsPath);
    }
}

module.exports = Util;