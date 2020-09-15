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
        this.dynamicConnectionProfile = ConnectionProfileConfiguration.discover;
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
}

module.exports = ConnectionProfileDefinition;
