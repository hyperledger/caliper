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
 *
 */
class ConnectionProfileDefinition {

    /**
     * @param {*} ConnectionProfileConfiguration The Connection Profile Configuration
     */
    constructor(ConnectionProfileConfiguration) {
        this.connectionProfile = ConnectionProfileConfiguration.loadedConnectionProfile;
        this.dynamicConnectionProfile = typeof ConnectionProfileConfiguration.discover === 'boolean' ? ConnectionProfileConfiguration.discover : false;
        this.TLSEnabled = false;

        if (this._searchForPropertyValues(this.connectionProfile, 'url', /grpcs|https/).length > 0) {
            this.TLSEnabled = true;
        }

    }

    /**
     * @returns {*} The Connection profile
     */
    getConnectionProfile() {
        return this.connectionProfile;
    }

    /**
     * @returns {boolean} Whether this connection profile is dynamic (ie should use discovery) or static
     */
    isDynamicConnectionProfile() {
        return this.dynamicConnectionProfile;
    }

    /**
     * Returns whether the connection profile is using TLS somewhere or not
     * @returns {boolean} true if at least 1 entry has grpcs or https
     */
    isTLSEnabled() {
        return this.TLSEnabled;
    }

    /**
     * Search for a property name, whose value matches the regex
     * Don't need to handle arrays at this time
     *
     * @param {*} object the object to search and update
     * @param {string} propertyName a property name in the configuration
     * @param {regexp} propertyValueMatch a regex pattern the value has to match against
     * @returns {[*]} an array of the object properties that have a matching value
     *
     */
    _searchForPropertyValues(object, propertyName, propertyValueMatch) {
        const foundProperties = [];

        for (const objectKey in object) {
            if (objectKey === propertyName &&
                propertyValueMatch.test(object[objectKey])) {
                foundProperties.push(object[objectKey]);
            } else {
                if (typeof object[objectKey] === 'object') {
                    foundProperties.push(...this._searchForPropertyValues(object[objectKey], propertyName, propertyValueMatch));
                }
            }

        }

        return foundProperties;
    }

}

module.exports = ConnectionProfileDefinition;
