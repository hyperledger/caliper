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

const FabricNetwork = require('../lib/fabricNetwork');

const chai = require('chai');
const should = chai.should();

describe('FabricNetwork', () => {

    describe('constructor', () => {

        it('should throw if networkConfig is not provided', () => {
            (() => {
                new FabricNetwork();
            }).should.throw('[FabricNetwork.constructor] Parameter "networkConfig" is neither a file path nor an object');
        });
    });

    describe('usesOrganizationWallets', () => {

        it('should return false if the org does not have an organizationWallets stanza', () => {
            const config = {};
            const fabricNetwork = new FabricNetwork(config);
            fabricNetwork.usesOrganizationWallets().should.be.false;
        });

        it('should return false if the org does not have any organizationWallets specified', () => {
            const config = {
                organizationWallets: {},
            };
            const fabricNetwork = new FabricNetwork(config);
            fabricNetwork.usesOrganizationWallets().should.be.false;
        });

        it('should return true if the org does have a organizationWallets specified', () => {
            const config = {
                organizationWallets: {
                    Org0: {
                        path: 'myPath'
                    }
                },
            };
            const fabricNetwork = new FabricNetwork(config);
            fabricNetwork.usesOrganizationWallets().should.be.true;
        });
    });

    describe('getWalletPathForOrganization', () => {

        it('should return undefined if the org does not have a wallet specified', () => {
            const config = {
                organizationWallets: {},
            };
            const fabricNetwork = new FabricNetwork(config);
            should.not.exist(fabricNetwork.getWalletPathForOrganization('myOrg'));

        });

        it('should return a filepath for a correctly defined and reference wallet', () => {
            const config = {
                organizationWallets: {
                    Org0: {
                        path: 'myWalletPath'
                    },
                    Org1: {
                        path: 'myWalletOtherPath'
                    }
                }
            };
            const fabricNetwork = new FabricNetwork(config);
            fabricNetwork.getWalletPathForOrganization('Org0').endsWith('myWalletPath').should.be.true;
        });
    });


    describe('getWalletPathForClient', () => {

        it('should return undefined if the client does not have a wallet specified for its organization', () => {
            const config = {
                organizationWallets: {},
                clients: {
                    myClient: {
                        client: {
                            organization: 'Org0'
                        }
                    }
                }
            };
            const fabricNetwork = new FabricNetwork(config);
            should.not.exist(fabricNetwork.getWalletPathForClient('myClient'));

        });

        it('should return a filepath for a correctly defined and reference wallet', () => {
            const config = {
                organizationWallets: {
                    Org0: {
                        path: 'myWalletPath'
                    },
                    Org1: {
                        path: 'myWalletOtherPath'
                    }
                },
                clients: {
                    myClient: {
                        client: {
                            organization: 'Org0'
                        }
                    }
                }
            };
            const fabricNetwork = new FabricNetwork(config);
            fabricNetwork.getWalletPathForClient('myClient').endsWith('myWalletPath').should.be.true;
        });
    });

});
