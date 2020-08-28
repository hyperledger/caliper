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

const CaliperUtils = require('../../../lib/common/utils/caliper-utils');
const ConfigUtil = require('../../../lib/common/config/config-util');
const Constants = require('../../../lib/common/utils/constants');

const chai = require('chai');
chai.should();

describe('caliper utilities', () => {


    describe('When augmenting the urls', () => {
        const myHttpUrl = 'http://test.com:9090';
        const myHttpsUrl = 'https://test.com:9090';

        afterEach(() => {
            ConfigUtil.set(ConfigUtil.keys.Auth[Constants.AuthComponents.PushGateway].UserName, undefined);
            ConfigUtil.set(ConfigUtil.keys.Auth[Constants.AuthComponents.PushGateway].Password, undefined);
        });

        it('should return the unaltered URL if no basic auth parameters for the component are detected', () => {
            CaliperUtils.augmentUrlWithBasicAuth(myHttpUrl, Constants.AuthComponents.PushGateway).should.equal(myHttpUrl);
        });

        it('should throw if the URL is invalid', () => {
            (() => {
                ConfigUtil.set(ConfigUtil.keys.Auth[Constants.AuthComponents.PushGateway].UserName, 'penguin');
                ConfigUtil.set(ConfigUtil.keys.Auth[Constants.AuthComponents.PushGateway].Password, 'madagascar');
                CaliperUtils.augmentUrlWithBasicAuth('badUrl', Constants.AuthComponents.PushGateway);
            }).should.throw('Invalid URL: badUrl');
        });

        it('should augment a valid http URL with basic auth', () => {
            ConfigUtil.set(ConfigUtil.keys.Auth[Constants.AuthComponents.PushGateway].UserName, 'penguin');
            ConfigUtil.set(ConfigUtil.keys.Auth[Constants.AuthComponents.PushGateway].Password, 'madagascar');
            CaliperUtils.augmentUrlWithBasicAuth(myHttpUrl, Constants.AuthComponents.PushGateway).should.equal('http://penguin:madagascar@test.com:9090/');
        });

        it('should augment a valid https URL with basic auth', () => {
            ConfigUtil.set(ConfigUtil.keys.Auth[Constants.AuthComponents.PushGateway].UserName, 'penguin');
            ConfigUtil.set(ConfigUtil.keys.Auth[Constants.AuthComponents.PushGateway].Password, 'madagascar');
            CaliperUtils.augmentUrlWithBasicAuth(myHttpsUrl, Constants.AuthComponents.PushGateway).should.equal('https://penguin:madagascar@test.com:9090/');
        });
    });

});
