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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
chai.should();
const path = require('path');
const fs = require('fs');

const ConnectionProfileDefinition = require('../../lib/connector-configuration/ConnectionProfileDefinition');

describe('A Connection Profile Definition', async () => {
    const connectionProfile = fs.readFileSync(path.resolve(__dirname, '../sample-configs/Org1ConnectionProfile.json'));

    it('should the provided connection profile and whether it is dynamic or not', () => {
        const providedConnectionPofile = JSON.parse(connectionProfile.toString());
        let  connectionProfileDefinition = new ConnectionProfileDefinition({
            loadedConnectionProfile: providedConnectionPofile,
            discover: true
        });
        connectionProfileDefinition.getConnectionProfile().should.equal(providedConnectionPofile);
        connectionProfileDefinition.isDynamicConnectionProfile().should.equal(true);

        connectionProfileDefinition = new ConnectionProfileDefinition({
            loadedConnectionProfile: providedConnectionPofile,
            discover: false
        });
        connectionProfileDefinition.isDynamicConnectionProfile().should.equal(false);

        connectionProfileDefinition = new ConnectionProfileDefinition({
            loadedConnectionProfile: providedConnectionPofile
        });
        connectionProfileDefinition.isDynamicConnectionProfile().should.equal(false);
    });


    it('should return true if a connection profile is using tls', () => {
        const connectionProfileDefinition = new ConnectionProfileDefinition({
            loadedConnectionProfile: JSON.parse(connectionProfile.toString()),
            discover: true
        });
        connectionProfileDefinition.isTLSEnabled().should.equal(true);
    });

    it('should return false if a connection profile is not using tls', () => {
        const alteredConnectionProfile = JSON.parse(connectionProfile.toString());
        alteredConnectionProfile.peers['peer0.org1.example.com'].url = 'grpc://localhost:7051';
        alteredConnectionProfile.certificateAuthorities['ca.org1.example.com'].url = 'http://localhost:7054';
        const connectionProfileDefinition = new ConnectionProfileDefinition({
            loadedConnectionProfile: alteredConnectionProfile,
            discover: true
        });
        connectionProfileDefinition.isTLSEnabled().should.equal(false);
    });

});
