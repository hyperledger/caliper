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

/* eslint-disable require-jsdoc */

class ClientStub {

    static loadFromConfig() {
        ClientStub.loadFromConfigCalls++;
        return new ClientStub();
    }

    createUser(...args) {
        ClientStub.createUser++;
        this.createUserArgs = args;
    }

    setTlsClientCertAndKey(...args) {
        ClientStub.setTlsClientCertAndKeyCalls++;
        this.setTlsClientCertAndKeyArgs = args;
    }

    static reset() {
        ClientStub.loadFromConfigCalls = 0;
        ClientStub.createUser = 0;
        ClientStub.setTlsClientCertAndKeyCalls = 0;
    }
}

module.exports = ClientStub;
