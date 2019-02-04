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

const compareVersions = require('compare-versions');

/**
 * Encapsulates a semantic version number and provides comparison functions between versions.
 */
class Version {
    /**
     * Creates and initializes a new instance of the Version class.
     * @param {string} versionString The version string to encapsulate.
     */
    constructor(versionString) {
        this.versionString = versionString;
    }

    /**
     * Checks whether this version equals to the given version.
     * @param {string} version The version string to compare against.
     * @return {boolean} True, if this version equals to the given version. Otherwise false.
     */
    equalsTo(version) {
        return compareVersions(this.versionString, version) === 0;
    }

    /**
     * Checks whether this version is strictly greater than the given version.
     * @param {string} version The version string to compare against.
     * @return {boolean} True, if this version is strictly greater than the given version. Otherwise false.
     */
    greaterThan(version) {
        return compareVersions(this.versionString, version) > 0;
    }

    /**
     * Checks whether this version is greater than or equals to the given version.
     * @param {string} version The version string to compare against.
     * @return {boolean} True, if this version is greater than or equals to the given version. Otherwise false.
     */
    greaterThanOrEqualsTo(version) {
        return compareVersions(this.versionString, version) >= 0;
    }

    /**
     * Checks whether this version is strictly less than the given version.
     * @param {string} version The version string to compare against.
     * @return {boolean} True, if this version is strictly less than the given version. Otherwise false.
     */
    lessThan(version) {
        return compareVersions(this.versionString, version) < 0;
    }

    /**
     * Checks whether this version is less than or equals to the given version.
     * @param {string} version The version string to compare against.
     * @return {boolean} True, if this version is less than or equals to the given version. Otherwise false.
     */
    lessThanOrEqualsTo(version) {
        return compareVersions(this.versionString, version) <= 0;
    }

    /**
     * Returns the string representation of the version.
     * @return {string} The string representation of the version.
     */
    toString() {
        return this.versionString;
    }
}

module.exports = Version;