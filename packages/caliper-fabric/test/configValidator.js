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

const ConfigValidator = require('../lib/configValidator.js');

const chai = require('chai');
chai.should();

const arrow = '\u21B3';

/**
 * Returns the property name prefixed with an arrow symbol.
 * @param {string} propertyName The text to prefix.
 * @return {string} The prefixed text.
 */
function prop(propertyName) {
    return `${arrow} ${propertyName}`;
}

describe('Class: ConfigValidator', () => {
    // General remarks:
    // - variables "outside" the "it" functions are always reset at the appropriate hierarchy
    // - variables "outside" the "it" functions are always initialized to assist code completion
    // - every test category/hierarchy starts with a test for accepting the valid configuration
    // - the tests are grouped by according to the config property hierarchy

    // these vars have the same structure for every test, thus can be global
    let flowOptions = {
        performStart: true,
        performInit: true,
        performInstall: true,
        performTest: true,
        performEnd: true
    };

    let discovery = false;
    let gateway = false;
    let tls = undefined;

    // reset the global vars before every test
    beforeEach(() => {
        flowOptions = {
            performStart: true,
            performInit: true,
            performInstall: true,
            performTest: true,
            performEnd: true
        };

        discovery = false;
        gateway = false;
        tls = undefined;
    });

    describe('Function: validateNetwork', () => {
        let config = {
            name: 'Fabric',
            version: '1.0',
            'mutual-tls': false,
            caliper: {
                blockchain: 'fabric'
            },
            clients: {
                'client0.org1.example.com': {
                    client: {
                        organization: 'Org1',
                        credentialStore: {
                            path: 'path',
                            cryptoStore: {
                                path: 'path'
                            }
                        },

                        clientPrivateKey: {
                            path: 'path'
                        },
                        clientSignedCert: {
                            path: 'path'
                        }
                    }
                },
                'client0.org2.example.com': {
                    client: {
                        organization: 'Org2',
                        credentialStore: {
                            path: 'path',
                            cryptoStore: {
                                path: 'path'
                            }
                        },

                        clientPrivateKey: {
                            path: 'path'
                        },
                        clientSignedCert: {
                            path: 'path'
                        }
                    }
                }
            },
            channels: {
                channel1: {
                    created: false,
                    configBinary: 'path',
                    orderers: ['orderer.example.com'],
                    peers: {
                        'peer0.org1.example.com': {},
                        'peer0.org2.example.com': {}
                    },
                    contracts: [ { id: 'drm', version: 'v0' } ]
                },
                channel2: {
                    created: false,
                    configBinary: 'path',
                    orderers: ['orderer.example.com'],
                    peers: {
                        'peer0.org1.example.com': {},
                        'peer0.org2.example.com': {}
                    },
                    contracts: [ { id: 'drm', contractID: 'drm2', version: 'v0' } ]
                }
            },
            organizations: {
                Org1: {
                    mspid: 'Org1MSP',
                    peers: [
                        'peer0.org1.example.com'
                    ],
                    certificateAuthorities: [
                        'ca.org1.example.com'
                    ]
                },
                Org2: {
                    mspid: 'Org2MSP',
                    peers: [
                        'peer0.org2.example.com'
                    ],
                    certificateAuthorities: [
                        'ca.org2.example.com'
                    ]
                }
            },
            orderers: {
                'orderer.example.com': {
                    url: 'grpcs://localhost:7051',
                    tlsCACerts: {
                        path: 'my/path/tocert'
                    }
                }
            },
            peers: {
                'peer0.org1.example.com': {
                    url: 'grpcs://localhost:7051',
                    tlsCACerts: {
                        path: 'my/path/tocert'
                    }
                },
                'peer0.org2.example.com': {
                    url: 'grpcs://localhost:7051',
                    tlsCACerts: {
                        path: 'my/path/tocert'
                    }
                }
            },
            certificateAuthorities: {
                'ca.org1.example.com': {
                    url: 'https://localhost:7054',
                    tlsCACerts: {
                        path: 'my/path/tocert'
                    },
                    registrar: [
                        { enrollId: 'admin1', enrollSecret: 'secret1' },
                        { enrollId: 'admin2', enrollSecret: 'secret2' }
                    ]
                },
                'ca.org2.example.com': {
                    url: 'https://localhost:7054',
                    tlsCACerts: {
                        path: 'my/path/tocert'
                    },
                    registrar: [
                        { enrollId: 'admin1', enrollSecret: 'secret1' },
                        { enrollId: 'admin2', enrollSecret: 'secret2' }
                    ]
                }
            }
        };
        const configString = JSON.stringify(config);

        beforeEach(() => {
            config = JSON.parse(configString);
        });

        /**
         * Wraps the actual call, so "should" can call this function without parameters
         */
        function call() {
            ConfigValidator.validateNetwork(config, flowOptions, discovery, gateway);
        }

        it('should not throw for a valid value', () => {
            call.should.not.throw();
        });

        describe('Flow consistency', () => {
            it('should throw when using discovery without the gateway mode', () => {
                const err = 'Use of discovery is only supported through a gateway transaction';
                discovery = true;
                gateway = false;
                call.should.throw(err);
            });

            it('should throw when using discovery with init phase', () => {
                const err = 'Use of service discovery is only valid with a `caliper-flow-only-test` flag';
                discovery = true;
                gateway = true;
                flowOptions.performStart = flowOptions.performInstall = flowOptions.performTest = flowOptions.performEnd = false;
                call.should.throw(err);
            });

            it('should throw when using discovery with install phase', () => {
                const err = 'Use of service discovery is only valid with a `caliper-flow-only-test` flag';
                discovery = true;
                gateway = true;
                flowOptions.performStart = flowOptions.performInit = flowOptions.performTest = flowOptions.performEnd = false;
                call.should.throw(err);
            });

            it('should not throw when omitting top sections in script-only flow', () => {
                flowOptions.performInit = flowOptions.performInstall = flowOptions.performTest = false;
                delete config.certificateAuthorities;
                delete config.clients;
                delete config.peers;
                delete config.orderers;
                delete config.organizations;
                delete config.channels;
                call.should.not.throw();
            });

            it('should detect incorrect peer TLS based on orderer TLS', () => {
                const err = 'Invalid "peer0.org1.example.com" peer configuration: child "url" fails because ["url" with value "grpc://localhost:7051" fails to match the required pattern: /^grpcs:\\/\\//]';
                delete config.certificateAuthorities;
                delete config.organizations.Org1.certificateAuthorities;
                delete config.organizations.Org2.certificateAuthorities;
                delete config.peers['peer0.org1.example.com'].tlsCACerts;
                config.peers['peer0.org1.example.com'].url = 'grpc://localhost:7051';
                call.should.throw(err);
            });

            it('should detect incorrect peer TLS based on other peer when CAs and orderers are missing', () => {
                const err = 'Invalid "peer0.org2.example.com" peer configuration: child "url" fails because ["url" with value "grpc://localhost:7051" fails to match the required pattern: /^grpcs:\\/\\//]';
                flowOptions.performStart = flowOptions.performInit = flowOptions.performInstall = flowOptions.performEnd = false;
                discovery = true;
                gateway = true;
                delete config.certificateAuthorities;
                delete config.organizations.Org1.certificateAuthorities;
                delete config.organizations.Org2.certificateAuthorities;
                delete config.orderers;
                delete config.channels.channel1.orderers;
                delete config.channels.channel2.orderers;
                delete config.peers['peer0.org2.example.com'].tlsCACerts;
                config.peers['peer0.org2.example.com'].url = 'grpc://localhost:7051';
                call.should.throw(err);
            });

        });

        describe('Peer references', () => {
            it('should throw when a non-existing peer is referenced in an organization', () => {
                const err = 'Invalid "Org1" organization configuration: child "peers" fails because ["peers" at position 1 fails because ["1" must be one of [peer0.org1.example.com, peer0.org2.example.com]]]';
                config.organizations.Org1.peers.push('peer5.org1.example.com');
                call.should.throw(err);
            });

            it('should throw when a non-existing peer is referenced in a channel', () => {
                const err = 'Invalid "channel1" channel configuration: child "peers" fails because ["peer5.org1.example.com" is not allowed]';
                config.channels.channel1.peers['peer5.org1.example.com'] = {};
                call.should.throw(err);
            });

            it('should throw when a non-existing peer is referenced in a contract', () => {
                const err = 'Invalid "channel1" channel configuration: child "contracts" fails because ["contracts" at position 0 fails because [child "targetPeers" fails because ["targetPeers" at position 0 fails because ["0" must be one of [peer0.org1.example.com, peer0.org2.example.com]]]]]';
                config.channels.channel1.contracts[0].targetPeers = ['peer5.org1.example.com'];
                call.should.throw(err);
            });
        });

        describe('Orderer references', () => {
            it('should throw when a non-existing orderer is referenced in a channel', () => {
                const err = 'Invalid "channel1" channel configuration: child "orderers" fails because ["orderers" at position 1 fails because ["1" must be one of [orderer.example.com]]]';
                config.channels.channel1.orderers.push('orderer5.example.com');
                call.should.throw(err);
            });
        });

        describe('CA references', () => {
            it('should throw when a non-existing CA is referenced in an organization', () => {
                const err = 'Invalid "Org1" organization configuration: child "certificateAuthorities" fails because ["certificateAuthorities" at position 1 fails because ["1" must be one of [ca.org1.example.com, ca.org2.example.com]]]';
                config.organizations.Org1.certificateAuthorities.push('ca5.org1.example.com');
                call.should.throw(err);
            });
        });

        describe('MSP ID references', () => {
            it('should throw when a non-existing MSP ID is referenced in a channel definition ', () => {
                const err = 'Invalid "channel1" channel configuration: child "definition" fails because [child "msps" fails because ["msps" at position 1 fails because ["1" must be one of [Org1MSP, Org2MSP]]]]';
                delete config.channels.channel1.configBinary;
                config.channels.channel1.definition = {
                    capabilities : [],
                    consortium : 'SampleConsortium',
                    msps : [ 'Org1MSP', 'Org5MSP' ],
                    version : 0
                };
                call.should.throw(err);
            });

            it('should throw when a non-existing MSP ID is referenced in a contract endorsement policy', () => {
                const err = 'Invalid "channel1" channel configuration: child "contracts" fails because ["contracts" at position 1 fails because [child "endorsement-policy" fails because [child "identities" fails because ["identities" at position 0 fails because [child "role" fails because [child "mspId" fails because ["mspId" must be one of [Org1MSP, Org2MSP]]]]]]]]';
                config.channels.channel1.contracts.push({
                    id: 'marbles',
                    contractID: 'ContractMarbles',
                    version: 'v0',
                    language: 'golang',
                    path: 'path',
                    'endorsement-policy': {
                        identities: [
                            { role: { name: 'member', mspId: 'Org1MSP' }},
                            { role: { name: 'member', mspId: 'Org2MSP' }}
                        ],
                        policy: {
                            '2-of': [
                                { 'signed-by': 1},
                                { '1-of': [{ 'signed-by': 0 }, { 'signed-by': 1 }]}
                            ]
                        }
                    }
                });

                config.channels.channel1.contracts[1]['endorsement-policy'].identities[0].role.mspId = 'Org5MSP';
                call.should.throw(err);
            });

            it('should throw when a non-existing MSP ID is referenced in a contract collections config policy', () => {
                const err = 'Invalid "channel1" channel configuration: child "contracts" fails because ["contracts" at position 1 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "identities" fails because ["identities" at position 0 fails because [child "role" fails because [child "mspId" fails because ["mspId" must be one of [Org1MSP, Org2MSP]]]]]]]]]]';
                config.channels.channel1.contracts.push({
                    id: 'marbles',
                    contractID: 'ContractMarbles',
                    version: 'v0',
                    language: 'golang',
                    path: 'path',
                    'collections-config': [{
                        name: 'name',
                        policy: {
                            identities: [
                                {role: {name: 'member', mspId: 'Org1MSP'}},
                                {role: {name: 'member', mspId: 'Org2MSP'}}
                            ],
                            policy: {
                                '2-of': [
                                    {'signed-by': 1},
                                    {'1-of': [{'signed-by': 0}, {'signed-by': 1}]}
                                ]
                            }
                        },
                        requiredPeerCount: 1,
                        maxPeerCount: 2,
                        blockToLive: 0
                    }]
                });

                config.channels.channel1.contracts[1]['collections-config'][0].policy.identities[0].role.mspId = 'Org5MSP';
                call.should.throw(err);
            });
        });

        describe('TLS consistency', () => {
            it('should throw for inconsistent TLS protocol in CAs', () => {
                const err = 'Invalid "ca.org2.example.com" CA configuration: child "url" fails because ["url" with value "https://localhost:7054" fails to match the required pattern: /^http:\\/\\//]';
                delete config.certificateAuthorities['ca.org1.example.com'].tlsCACerts;
                config.certificateAuthorities['ca.org1.example.com'].url = 'http://localhost:7054';
                call.should.throw(err);
            });

            it('should throw for inconsistent TLS protocol in peers', () => {
                const err = 'Invalid "peer0.org1.example.com" peer configuration: child "url" fails because ["url" with value "grpc://localhost:7051" fails to match the required pattern: /^grpcs:\\/\\//]';
                delete config.peers['peer0.org1.example.com'].tlsCACerts;
                config.peers['peer0.org1.example.com'].url = 'grpc://localhost:7051';
                call.should.throw(err);
            });

            it('should throw for inconsistent TLS protocol in peer eventing', () => {
                const err = 'Invalid "peer0.org1.example.com" peer configuration: child "eventUrl" fails because ["eventUrl" with value "grpc://localhost:7051" fails to match the required pattern: /^grpcs:\\/\\//]';
                config.peers['peer0.org1.example.com'].eventUrl = 'grpc://localhost:7051';
                call.should.throw(err);
            });

            it('should throw for inconsistent TLS protocol in orderers', () => {
                const err = 'Invalid "orderer.example.com" orderer configuration: child "url" fails because ["url" with value "grpc://localhost:7051" fails to match the required pattern: /^grpcs:\\/\\//]';
                delete config.orderers['orderer.example.com'].tlsCACerts;
                config.orderers['orderer.example.com'].url = 'grpc://localhost:7051';
                call.should.throw(err);
            });
        });

        describe('Peer eventing consistency', () => {
            it('should throw for inconsistent event URL usage among peers', () => {
                const err = 'Invalid "peer0.org2.example.com" peer configuration: child "eventUrl" fails because ["eventUrl" is required]';
                config.peers['peer0.org1.example.com'].eventUrl = 'grpcs://localhost:7053';
                call.should.throw(err);
            });
        });

        describe('Informative errors', () => {
            it('should throw an informative error about invalid client configuration', () => {
                const err = 'Invalid "client0.org1.example.com" client configuration: "affiliation" is not allowed';
                config.clients['client0.org1.example.com'].affiliation = 'aff1';
                call.should.throw(err);
            });
        });
    });

    describe('Function: _validateTopLevel', () => {
        // good practice for auto complete and easy backup
        let config = {
            name: 'Fabric',
            version: '1.0',
            'mutual-tls': false,
            caliper: {
                blockchain: 'fabric',
                command: { start: 'start command', end: 'end command' }
            },
            info: { info1: 'some info' },
            clients: { client1: {} },
            channels: { channel1: {} },
            organizations: { org1: {} },
            orderers: { orderer1: {} },
            peers: { peer1: {} },
            certificateAuthorities: { ca1: {} }
        };
        const configString = JSON.stringify(config);

        beforeEach(() => {
            config = JSON.parse(configString);
        });

        /**
         * Wraps the actual call, so "should" can call this function without parameters
         */
        function call() {
            ConfigValidator._validateTopLevel(config, flowOptions, discovery, tls);
        }

        it('should not throw for a valid value', () => {
            call.should.not.throw();
        });

        it('should throw for unknown child property', () => {
            const err = '"unknown" is not allowed';
            config.unknown = '';
            call.should.throw(err);
        });

        describe(prop('name'), () => {
            it('should throw for missing required property', () => {
                const err = 'child "name" fails because ["name" is required]';
                delete config.name;
                call.should.throw(err);
            });

            it('should throw for an empty string value', () => {
                const err = 'child "name" fails because ["name" is not allowed to be empty, "name" length must be at least 1 characters long]';
                config.name = '';
                call.should.throw(err);
            });

            it('should throw for a non-string value', () => {
                const err = 'child "name" fails because ["name" must be a string]';
                config.name = true;
                call.should.throw(err);
            });
        });

        describe(prop('version'), () => {
            it('should throw for missing required property', () => {
                const err = 'child "version" fails because ["version" is required]';
                delete config.version;
                call.should.throw(err);
            });

            it('should throw for an invalid string value', () => {
                const err = 'child "version" fails because ["version" must be one of [1.0]]';
                config.version = '2.0';
                call.should.throw(err);
            });

            it('should throw for a non-string value', () => {
                const err = 'child "version" fails because ["version" must be a string]';
                config.version = true;
                call.should.throw(err);
            });
        });

        describe(prop('mutual-tls'), () => {
            it('should not throw for missing optional property', () => {
                delete config['mutual-tls'];
                call.should.not.throw();
            });

            it('should not throw for any valid value when TLS is not known', () => {
                config['mutual-tls'] = false;
                call.should.not.throw();
                config['mutual-tls'] = true;
                call.should.not.throw();
            });

            it('should throw for a non-boolean value', () => {
                const err = 'child "mutual-tls" fails because ["mutual-tls" must be a boolean]';
                config['mutual-tls'] = 'yes';
                call.should.throw(err);
            });

            it('should not throw when set to "true" with server TLS', () => {
                tls = true;
                config['mutual-tls'] = true;
                call.should.not.throw();
            });

            it('should throw when set to "true" without server TLS', () => {
                const err = 'child "mutual-tls" fails because ["mutual-tls" must be one of [false]]';
                tls = false;
                config['mutual-tls'] = true;
                call.should.throw(err);
            });
        });

        describe(prop('organizationWallets'), () => {
            it('should not throw for missing optional property', () => {
                call.should.not.throw();
            });

            it('should not throw for a correctly defined object', () => {
                config.organizationWallets = {
                    org0: {
                        path : 'myWalletPath'
                    },
                    org1: {
                        path : 'myOtherWalletPath'
                    }
                };
                call.should.not.throw();
            });

            it('should throw for a non-object value', () => {
                const err = 'child "organizationWallets" fails because ["organizationWallets" must be an object]';
                config.organizationWallets = 'yes';
                call.should.throw(err);
            });

        });

        describe(prop('caliper'), () => {
            const err = 'child "caliper" fails because ["caliper" is required]';
            it('should throw for missing required property', () => {
                delete config.caliper;
                call.should.throw(err);
            });

            it('should throw for non-object value', () => {
                const err = 'child "caliper" fails because ["caliper" must be an object]';
                config.caliper = '';
                call.should.throw(err);
            });

            it('should throw for unknown child property', () => {
                const err = 'child "caliper" fails because ["unknown" is not allowed]';
                config.caliper.unknown = '';
                call.should.throw(err);
            });

            describe(prop('blockchain'), () => {
                it('should throw for missing required property', () => {
                    const err = 'child "caliper" fails because [child "blockchain" fails because ["blockchain" is required]]';
                    delete config.caliper.blockchain;
                    call.should.throw(err);
                });

                it('should throw for an invalid string value', () => {
                    const err = 'child "caliper" fails because [child "blockchain" fails because ["blockchain" must be one of [fabric]]]';
                    config.caliper.blockchain = 'ethereum';
                    call.should.throw(err);
                });

                it('should throw for a non-string value', () => {
                    const err = 'child "caliper" fails because [child "blockchain" fails because ["blockchain" must be a string]]';
                    config.caliper.blockchain = true;
                    call.should.throw(err);
                });
            });

            describe(prop('command'), () => {
                it('should throw for a non-object value', () => {
                    const err = 'child "caliper" fails because [child "command" fails because ["command" must be an object]]';
                    config.caliper.command = '';
                    call.should.throw(err);
                });

                it('should not throw for missing optional property', () => {
                    delete config.caliper.command;
                    call.should.not.throw();
                });

                it('should throw for an empty object value', () => {
                    const err = 'child "caliper" fails because [child "command" fails because ["value" must contain at least one of [start, end]]]';
                    delete config.caliper.command.start;
                    delete config.caliper.command.end;
                    call.should.throw(err);
                });

                it('should throw for unknown child property', () => {
                    const err = 'child "caliper" fails because [child "command" fails because ["unknown" is not allowed]]';
                    config.caliper.command.unknown = '';
                    call.should.throw(err);
                });

                it('should not throw for only missing the optional "start" child property', () => {
                    delete config.caliper.command.start;
                    call.should.not.throw();
                });

                it('should not throw for only missing the optional "end" child property', () => {
                    delete config.caliper.command.end;
                    call.should.not.throw();
                });

                describe(prop('start'), () => {
                    it('should throw for an empty string value', () => {
                        const err = 'child "caliper" fails because [child "command" fails because [child "start" fails because ["start" is not allowed to be empty, "start" length must be at least 1 characters long]]]';
                        config.caliper.command.start = '';
                        call.should.throw(err);
                    });

                    it('should throw for a non-string value', () => {
                        const err = 'child "caliper" fails because [child "command" fails because [child "start" fails because ["start" must be a string]]]';
                        config.caliper.command.start = true;
                        call.should.throw(err);
                    });
                });

                describe(prop('end'), () => {
                    it('should throw for an empty string property', () => {
                        const err = 'child "caliper" fails because [child "command" fails because [child "end" fails because ["end" is not allowed to be empty, "end" length must be at least 1 characters long]]]';
                        config.caliper.command.end = '';
                        call.should.throw(err);
                    });

                    it('should throw for a non-string value', () => {
                        const err = 'child "caliper" fails because [child "command" fails because [child "end" fails because ["end" must be a string]]]';
                        config.caliper.command.end = true;
                        call.should.throw(err);
                    });
                });
            });
        });

        describe(prop('info'), () => {
            it('should not throw for missing optional property', () => {
                delete config.info;
                call.should.not.throw();
            });

            it('should not throw for empty value', () => {
                config.info = {};
                call.should.not.throw();
            });

            it('should throw for a non-object value', () => {
                const err = 'child "info" fails because ["info" must be an object]';
                config.info = 'yes';
                call.should.throw(err);
            });
        });

        describe(prop('clients'), () => {
            it('should throw for missing required property', () => {
                const err = 'child "clients" fails because ["clients" is required]';
                delete config.clients;
                call.should.throw(err);
            });

            it('should throw for a non-object value', () => {
                const err = 'child "clients" fails because ["clients" must be an object]';
                config.clients = 'yes';
                call.should.throw(err);
            });

            it('should not throw for missing property when only scripts are executed', () => {
                flowOptions.performInit = flowOptions.performInstall = flowOptions.performTest = false;
                delete config.clients;
                call.should.not.throw();
            });
        });

        describe(prop('channels'), () => {
            it('should throw for missing required property', () => {
                const err = 'child "channels" fails because ["channels" is required]';
                delete config.channels;
                call.should.throw(err);
            });

            it('should throw for a non-object value', () => {
                const err = 'child "channels" fails because ["channels" must be an object]';
                config.channels = 'yes';
                call.should.throw(err);
            });

            it('should not throw for missing property when only scripts are executed', () => {
                flowOptions.performInit = flowOptions.performInstall = flowOptions.performTest = false;
                delete config.channels;
                call.should.not.throw();
            });
        });

        describe(prop('organizations'), () => {
            it('should throw for missing required property', () => {
                const err = 'child "organizations" fails because ["organizations" is required]';
                delete config.organizations;
                call.should.throw(err);
            });

            it('should throw for a non-object value', () => {
                const err = 'child "organizations" fails because ["organizations" must be an object]';
                config.organizations = 'yes';
                call.should.throw(err);
            });

            it('should not throw for missing property when only scripts are executed', () => {
                flowOptions.performInit = flowOptions.performInstall = flowOptions.performTest = false;
                delete config.organizations;
                call.should.not.throw();
            });
        });

        describe(prop('orderers'), () => {
            it('should throw for missing required property', () => {
                const err = 'child "orderers" fails because ["orderers" is required]';
                delete config.orderers;
                call.should.throw(err);
            });

            it('should throw for a non-object value', () => {
                const err = 'child "orderers" fails because ["orderers" must be an object]';
                config.orderers = 'yes';
                call.should.throw(err);
            });

            it('should not throw for missing property when only scripts are executed', () => {
                flowOptions.performInit = flowOptions.performInstall = flowOptions.performTest = false;
                delete config.orderers;
                call.should.not.throw();
            });

            it('should not throw for missing property in discovery mode', () => {
                discovery = true;
                delete config.orderers;
                call.should.not.throw();
            });
        });

        describe(prop('peers'), () => {
            it('should throw for missing required property', () => {
                const err = 'child "peers" fails because ["peers" is required]';
                delete config.peers;
                call.should.throw(err);
            });

            it('should throw for a non-object value', () => {
                const err = 'child "peers" fails because ["peers" must be an object]';
                config.peers = 'yes';
                call.should.throw(err);
            });

            it('should not throw for missing property when only scripts are executed', () => {
                flowOptions.performInit = flowOptions.performInstall = flowOptions.performTest = false;
                delete config.peers;
                call.should.not.throw();
            });
        });

        describe(prop('certificateAuthorities'), () => {
            it('should not throw for missing optional property', () => {
                delete config.certificateAuthorities;
                call.should.not.throw();
            });

            it('should throw for a non-object value', () => {
                const err = 'child "certificateAuthorities" fails because ["certificateAuthorities" must be an object]';
                config.certificateAuthorities = 'yes';
                call.should.throw(err);
            });
        });
    });

    describe('Function: validateCertificateAuthority', () => {
        let config = {
            url: 'https://localhost:7054',
            httpOptions:  {
                verify: false
            },
            tlsCACerts: {
                path: 'my/path/tocert'
            },
            registrar: [
                { enrollId: 'admin1', enrollSecret: 'secret1' },
                { enrollId: 'admin2', enrollSecret: 'secret2' }
            ]
        };
        const configString = JSON.stringify(config);

        let configNoRegistrar = {
            url: 'https://localhost:7054',
            httpOptions:  {
                verify: false
            },
            tlsCACerts: {
                path: 'my/path/tocert'
            }
        };
        const configStringNoRegistrar = JSON.stringify(configNoRegistrar);

        // reset the local config before every test
        beforeEach(() => {
            config = JSON.parse(configString);
            configNoRegistrar = JSON.parse(configStringNoRegistrar);
        });

        /**
         * Wraps the actual call, so "should" can call this function without parameters
         */
        function call() {
            ConfigValidator.validateCertificateAuthority(config, tls, 'required');
        }

        /**
         * Wraps the actual call, so "should" can call this function without parameters
         */
        function callNoRegistrar() {
            ConfigValidator.validateCertificateAuthority(configNoRegistrar, tls, 'optional');
        }

        it('should not throw for a valid value', () => {
            call.should.not.throw();
        });

        it('should not throw for a valid value', () => {
            callNoRegistrar.should.not.throw();
        });

        it('should throw for an unknown child property', () => {
            const err = '"unknown" is not allowed';
            config.unknown = '';
            call.should.throw(err);
        });

        describe(prop('url'), () => {
            it('should throw for missing required property', () => {
                const err = 'child "url" fails because ["url" is required]';
                delete config.url;
                call.should.throw(err);
            });

            it('should throw for an empty string value', () => {
                const err = 'child "url" fails because ["url" is not allowed to be empty, "url" must be a valid uri, "url" with value "" fails to match the required pattern: /^(https|http):\\/\\//]';
                delete config.tlsCACerts;
                config.url = '';
                call.should.throw(err);
            });

            it('should throw for a non-string value', () => {
                const err = 'child "url" fails because ["url" must be a string]';
                delete config.tlsCACerts;
                config.url = true;
                call.should.throw(err);
            });

            it('should throw for a wrong protocol value', () => {
                const err = 'child "url" fails because ["url" with value "grpc://localhost:7054" fails to match the required pattern: /^(https|http):\\/\\//]';
                delete config.tlsCACerts;
                config.url = 'grpc://localhost:7054';
                call.should.throw(err);
            });

            it('should throw for a non-URI value', () => {
                const err = 'child "url" fails because ["url" must be a valid uri, "url" with value "invalid" fails to match the required pattern: /^(https|http):\\/\\//]';
                delete config.tlsCACerts;
                config.url = 'invalid';
                call.should.throw(err);
            });

            it('should not throw for any valid protocol value when TLS is not known', () => {
                config.url = 'https://localhost:7054';
                call.should.not.throw();

                delete config.tlsCACerts;
                config.url = 'http://localhost:7054';
                call.should.not.throw();
            });

            it('should throw for a non-TLS protocol when TLS is set', () => {
                const err = 'child "url" fails because ["url" with value "http://localhost:7054" fails to match the required pattern: /^https:\\/\\//]';
                tls = true;
                delete config.tlsCACerts;
                config.url = 'http://localhost:7054';
                call.should.throw(err);
            });

            it('should throw for a TLS protocol when TLS is not set', () => {
                const err = 'child "url" fails because ["url" with value "https://localhost:7054" fails to match the required pattern: /^http:\\/\\//]';
                tls = false;
                config.url = 'https://localhost:7054';
                call.should.throw(err);
            });
        });

        describe(prop('httpOptions'), () => {
            it('should not throw for missing optional property', () => {
                delete config.httpOptions;
                call.should.not.throw();
            });

            it('should throw for a non-object value', () => {
                const err = 'child "httpOptions" fails because ["httpOptions" must be an object]';
                config.httpOptions = 'yes';
                call.should.throw(err);
            });
        });

        describe(prop('tlsCACerts'), () => {
            it('should throw for a non-object value', () => {
                const err = 'child "tlsCACerts" fails because ["tlsCACerts" must be an object]';
                config.tlsCACerts = 'yes';
                call.should.throw(err);
            });

            it('should throw for an empty value', () => {
                const err = 'child "tlsCACerts" fails because ["value" must contain at least one of [pem, path]]';
                config.tlsCACerts = {};
                call.should.throw(err);
            });

            it('should throw for missing required property when using TLS', () => {
                const err = 'child "tlsCACerts" fails because ["tlsCACerts" is required]';
                delete config.tlsCACerts;
                call.should.throw(err);
            });

            it('should not throw for missing property when not using TLS', () => {
                delete config.tlsCACerts;
                config.url = 'http://localhost:7054';
                call.should.not.throw();
            });

            it('should throw for forbidden property when not using TLS', () => {
                const err = 'child "tlsCACerts" fails because ["tlsCACerts" is not allowed]';
                config.url = 'http://localhost:7054';
                call.should.throw(err);
            });

            it('should throw when setting both "path" and "pem" child properties', () => {
                const err = 'child "tlsCACerts" fails because ["value" contains a conflict between exclusive peers [pem, path]]';
                config.tlsCACerts.pem = 'asdf';
                call.should.throw(err);
            });

            it('should throw for unknown child property', () => {
                const err = 'child "tlsCACerts" fails because ["unknown" is not allowed]';
                config.tlsCACerts.unknown = '';
                call.should.throw(err);
            });

            describe(prop('path'), () => {
                it('should throw for an empty string value', () => {
                    const err = 'child "tlsCACerts" fails because [child "path" fails because ["path" is not allowed to be empty, "path" length must be at least 1 characters long]]';
                    config.tlsCACerts.path = '';
                    call.should.throw(err);
                });

                it('should throw for a non-string value', () => {
                    const err = 'child "tlsCACerts" fails because [child "path" fails because ["path" must be a string]]';
                    config.tlsCACerts.path = true;
                    call.should.throw(err);
                });
            });

            describe(prop('pem'), () => {
                beforeEach(() => {
                    delete config.tlsCACerts.path;
                });

                it('should not throw when setting property instead of sibling "path" property', () => {
                    config.tlsCACerts.pem = 'asdf';
                    call.should.not.throw();
                });

                it('should throw for a non-string value', () => {
                    const err = 'child "tlsCACerts" fails because [child "pem" fails because ["pem" must be a string]]';
                    config.tlsCACerts.pem = true;
                    call.should.throw(err);
                });

                it('should throw for an empty string value', () => {
                    const err = 'child "tlsCACerts" fails because [child "pem" fails because ["pem" is not allowed to be empty, "pem" length must be at least 1 characters long]]';
                    config.tlsCACerts.pem = '';
                    call.should.throw(err);
                });
            });
        });

        describe(prop('registrar'), () => {
            it('should throw for missing required property', () => {
                const err = 'child "registrar" fails because ["registrar" is required]';
                delete config.registrar;
                call.should.throw(err);
            });

            it('should throw for a non-array value', () => {
                const err = 'child "registrar" fails because ["registrar" must be an array]';
                config.registrar = 'yes';
                call.should.throw(err);
            });

            it('should throw for an empty array value', () => {
                const err = 'child "registrar" fails because ["registrar" must contain at least 1 items]';
                config.registrar = [];
                call.should.throw(err);
            });

            it('should throw for an undefined array item', () => {
                const err = 'child "registrar" fails because ["registrar" must not be a sparse array]';
                config.registrar[2] = undefined;
                call.should.throw(err);
            });

            describe(prop('[item].enrollId'), () => {
                it('should throw for an item with a non-string value', () => {
                    const err = 'child "registrar" fails because ["registrar" at position 0 fails because [child "enrollId" fails because ["enrollId" must be a string]]]';
                    config.registrar[0].enrollId = true;
                    call.should.throw(err);
                });

                it('should throw for an item with an empty string value', () => {
                    const err = 'child "registrar" fails because ["registrar" at position 0 fails because [child "enrollId" fails because ["enrollId" is not allowed to be empty, "enrollId" length must be at least 1 characters long]]]';
                    config.registrar[0].enrollId = '';
                    call.should.throw(err);
                });

                it('should throw for an item with a duplicate value', () => {
                    const err = 'child "registrar" fails because ["registrar" position 1 contains a duplicate value]';
                    config.registrar[1].enrollId = 'admin1';
                    call.should.throw(err);
                });
            });

            describe(prop('[item].enrollSecret'), () => {
                it('should throw for an item with a non-string value', () => {
                    const err = 'child "registrar" fails because ["registrar" at position 0 fails because [child "enrollSecret" fails because ["enrollSecret" must be a string]]]';
                    config.registrar[0].enrollSecret = true;
                    call.should.throw(err);
                });

                it('should throw for an item with an empty string value', () => {
                    const err = 'child "registrar" fails because ["registrar" at position 0 fails because [child "enrollSecret" fails because ["enrollSecret" is not allowed to be empty, "enrollSecret" length must be at least 1 characters long]]]';
                    config.registrar[0].enrollSecret = '';
                    call.should.throw(err);
                });
            });
        });
    });

    describe('Function: validatePeer', () => {
        let config = {
            url: 'grpcs://localhost:7051',
            eventUrl: 'grpcs://localhost:7053',
            grpcOptions:  {
                'ssl-target-name-override': 'peer0.org1.example.com',
            },
            tlsCACerts: {
                path: 'my/path/tocert'
            }
        };

        let eventUrl = true;
        const configString = JSON.stringify(config);

        beforeEach(() => {
            config = JSON.parse(configString);
            eventUrl = true;
        });

        /**
         * Wraps the actual call, so "should" can call this function without parameters
         */
        function call() {
            ConfigValidator.validatePeer(config, tls, eventUrl);
        }

        it('should not throw for a valid value', () => {
            call.should.not.throw();
        });

        it('should throw for an unknown child property', () => {
            const err = '"unknown" is not allowed';
            config.unknown = '';
            call.should.throw(err);
        });

        describe(prop('url'), () => {
            it('should throw for missing required property', () => {
                const err = 'child "url" fails because ["url" is required]';
                delete config.url;
                call.should.throw(err);
            });

            it('should throw for a non-string value', () => {
                const err = 'child "url" fails because ["url" must be a string]. child "eventUrl" fails because ["eventUrl" with value "grpcs://localhost:7053" fails to match the required pattern: /^grpc:\\/\\//]';
                delete config.tlsCACerts;
                config.url = true;
                call.should.throw(err);
            });

            it('should throw for a wrong protocol value', () => {
                const err = 'child "url" fails because ["url" with value "https://localhost:7054" fails to match the required pattern: /^(grpcs|grpc):\\/\\//]';
                delete config.tlsCACerts;
                delete config.eventUrl;
                config.url = 'https://localhost:7054';
                call.should.throw(err);
            });

            it('should throw for a non-URI value', () => {
                const err = 'child "url" fails because ["url" must be a valid uri, "url" with value "invalid" fails to match the required pattern: /^(grpcs|grpc):\\/\\//]';
                delete config.tlsCACerts;
                delete config.eventUrl;
                config.url = 'invalid';
                call.should.throw(err);
            });

            it('should not throw for any valid protocol value when TLS is not known', () => {
                config.url = 'grpcs://localhost:7054';
                call.should.not.throw();

                delete config.tlsCACerts;
                config.eventUrl = 'grpc://localhost:7054';
                config.url = 'grpc://localhost:7054';
                call.should.not.throw();
            });

            it('should throw for a non-TLS protocol when TLS is set', () => {
                const err = 'child "url" fails because ["url" with value "grpc://localhost:7054" fails to match the required pattern: /^grpcs:\\/\\//]';
                tls = true;
                delete config.tlsCACerts;
                config.eventUrl = 'grpc://localhost:7054';
                config.url = 'grpc://localhost:7054';
                call.should.throw(err);
            });

            it('should throw for a TLS protocol when TLS is not set', () => {
                const err = 'child "url" fails because ["url" with value "grpcs://localhost:7054" fails to match the required pattern: /^grpc:\\/\\//]';
                tls = false;
                config.url = 'grpcs://localhost:7054';
                call.should.throw(err);
            });
        });

        describe(prop('eventUrl'), () => {
            it('should not throw for missing optional property', () => {
                eventUrl = false;
                delete config.eventUrl;
                call.should.not.throw();
            });

            it('should throw for missing property when other peers also set it', () => {
                const err = 'child "eventUrl" fails because ["eventUrl" is required]';
                delete config.eventUrl;
                call.should.throw(err);
            });

            it('should throw for a non-string value', () => {
                const err = 'child "eventUrl" fails because ["eventUrl" must be a string]';
                config.eventUrl = true;
                call.should.throw(err);
            });

            it('should throw for a non-URI value', () => {
                const err = 'child "eventUrl" fails because ["eventUrl" must be a valid uri, "eventUrl" with value "invalid" fails to match the required pattern: /^grpcs:\\/\\//]';
                config.eventUrl = 'invalid';
                call.should.throw(err);
            });

            it('should throw for a mismatching protocol value', () => {
                const err = 'child "eventUrl" fails because ["eventUrl" with value "grpc://localhost:7054" fails to match the required pattern: /^grpcs:\\/\\//]';
                config.eventUrl = 'grpc://localhost:7054';
                call.should.throw(err);
            });
        });

        describe(prop('grpcOptions'), () => {
            it('should not throw for missing optional property', () => {
                delete config.grpcOptions;
                call.should.not.throw();
            });

            it('should throw for a non-object value', () => {
                const err = 'child "grpcOptions" fails because ["grpcOptions" must be an object]';
                config.grpcOptions = 'yes';
                call.should.throw(err);
            });
        });

        describe(prop('tlsCACerts'), () => {
            it('should throw for a non-object value', () => {
                const err = 'child "tlsCACerts" fails because ["tlsCACerts" must be an object]';
                config.tlsCACerts = 'yes';
                call.should.throw(err);
            });

            it('should throw for an empty value', () => {
                const err = 'child "tlsCACerts" fails because ["value" must contain at least one of [pem, path]]';
                config.tlsCACerts = {};
                call.should.throw(err);
            });

            it('should throw for missing required property when using TLS', () => {
                const err = 'child "tlsCACerts" fails because ["tlsCACerts" is required]';
                delete config.tlsCACerts;
                call.should.throw(err);
            });

            it('should not throw for missing property when not using TLS', () => {
                delete config.tlsCACerts;
                config.url = 'grpc://localhost:7054';
                config.eventUrl = 'grpc://localhost:7054';
                call.should.not.throw();
            });

            it('should throw for forbidden property when not using TLS', () => {
                const err = 'child "tlsCACerts" fails because ["tlsCACerts" is not allowed]';
                config.url = 'grpc://localhost:7054';
                config.eventUrl = 'grpc://localhost:7054';
                call.should.throw(err);
            });

            it('should throw when setting both "path" and "pem" child properties', () => {
                const err = 'child "tlsCACerts" fails because ["value" contains a conflict between exclusive peers [pem, path]]';
                config.tlsCACerts.pem = 'asdf';
                call.should.throw(err);
            });

            it('should throw for unknown child property', () => {
                const err = 'child "tlsCACerts" fails because ["unknown" is not allowed]';
                config.tlsCACerts.unknown = '';
                call.should.throw(err);
            });

            describe(prop('path'), () => {
                it('should throw for an empty string value', () => {
                    const err = 'child "tlsCACerts" fails because [child "path" fails because ["path" is not allowed to be empty, "path" length must be at least 1 characters long]]';
                    config.tlsCACerts.path = '';
                    call.should.throw(err);
                });

                it('should throw for a non-string value', () => {
                    const err = 'child "tlsCACerts" fails because [child "path" fails because ["path" must be a string]]';
                    config.tlsCACerts.path = true;
                    call.should.throw(err);
                });
            });

            describe(prop('pem'), () => {
                beforeEach(() => {
                    delete config.tlsCACerts.path;
                });

                it('should not throw when setting property instead of sibling "path" property', () => {
                    config.tlsCACerts.pem = 'asdf';
                    call.should.not.throw();
                });

                it('should throw for a non-string value', () => {
                    const err = 'child "tlsCACerts" fails because [child "pem" fails because ["pem" must be a string]]';
                    config.tlsCACerts.pem = true;
                    call.should.throw(err);
                });

                it('should throw for an empty string value', () => {
                    const err = 'child "tlsCACerts" fails because [child "pem" fails because ["pem" is not allowed to be empty, "pem" length must be at least 1 characters long]]';
                    config.tlsCACerts.pem = '';
                    call.should.throw(err);
                });
            });
        });
    });

    describe('Function: validateOrderer', () => {
        let config = {
            url: 'grpcs://localhost:7051',
            grpcOptions:  {
                'ssl-target-name-override': 'orderer.example.com',
            },
            tlsCACerts: {
                path: 'my/path/tocert'
            }
        };
        const configString = JSON.stringify(config);

        beforeEach(() => {
            config = JSON.parse(configString);
        });

        /**
         * Wraps the actual call, so "should" can call this function without parameters
         */
        function call() {
            ConfigValidator.validateOrderer(config, tls);
        }

        it('should not throw for a valid value', () => {
            call.should.not.throw();
        });

        it('should throw for an unknown child property', () => {
            const err = '"unknown" is not allowed';
            config.unknown = '';
            call.should.throw(err);
        });

        describe(prop('url'), () => {
            it('should throw for missing required property', () => {
                const err = 'child "url" fails because ["url" is required]';
                delete config.url;
                call.should.throw(err);
            });

            it('should throw for a non-string value', () => {
                const err = 'child "url" fails because ["url" must be a string]';
                delete config.tlsCACerts;
                config.url = true;
                call.should.throw(err);
            });

            it('should throw for a wrong protocol value', () => {
                const err = 'child "url" fails because ["url" with value "https://localhost:7054" fails to match the required pattern: /^(grpcs|grpc):\\/\\//]';
                delete config.tlsCACerts;
                config.url = 'https://localhost:7054';
                call.should.throw(err);
            });

            it('should throw for a non-URI value', () => {
                const err = 'child "url" fails because ["url" must be a valid uri, "url" with value "invalid" fails to match the required pattern: /^(grpcs|grpc):\\/\\//]';
                delete config.tlsCACerts;
                config.url = 'invalid';
                call.should.throw(err);
            });

            it('should not throw for any valid protocol value when TLS is not known', () => {
                config.url = 'grpcs://localhost:7054';
                call.should.not.throw();

                delete config.tlsCACerts;
                config.url = 'grpc://localhost:7054';
                call.should.not.throw();
            });

            it('should throw for a non-TLS protocol when TLS is set', () => {
                const err = 'child "url" fails because ["url" with value "grpc://localhost:7054" fails to match the required pattern: /^grpcs:\\/\\//]';
                tls = true;
                delete config.tlsCACerts;
                config.url = 'grpc://localhost:7054';
                call.should.throw(err);
            });

            it('should throw for a TLS protocol when TLS is not set', () => {
                const err = 'child "url" fails because ["url" with value "grpcs://localhost:7054" fails to match the required pattern: /^grpc:\\/\\//]';
                tls = false;
                config.url = 'grpcs://localhost:7054';
                call.should.throw(err);
            });
        });

        describe(prop('grpcOptions'), () => {
            it('should not throw for missing optional property', () => {
                delete config.grpcOptions;
                call.should.not.throw();
            });

            it('should throw for a non-object value', () => {
                const err = 'child "grpcOptions" fails because ["grpcOptions" must be an object]';
                config.grpcOptions = 'yes';
                call.should.throw(err);
            });
        });

        describe(prop('tlsCACerts'), () => {
            it('should throw for a non-object value', () => {
                const err = 'child "tlsCACerts" fails because ["tlsCACerts" must be an object]';
                config.tlsCACerts = 'yes';
                call.should.throw(err);
            });

            it('should throw for an empty value', () => {
                const err = 'child "tlsCACerts" fails because ["value" must contain at least one of [pem, path]]';
                config.tlsCACerts = {};
                call.should.throw(err);
            });

            it('should throw for missing required property when using TLS', () => {
                const err = 'child "tlsCACerts" fails because ["tlsCACerts" is required]';
                delete config.tlsCACerts;
                call.should.throw(err);
            });

            it('should not throw for missing property when not using TLS', () => {
                delete config.tlsCACerts;
                config.url = 'grpc://localhost:7054';
                call.should.not.throw();
            });

            it('should throw for forbidden property when not using TLS', () => {
                const err = 'child "tlsCACerts" fails because ["tlsCACerts" is not allowed]';
                config.url = 'grpc://localhost:7054';
                call.should.throw(err);
            });

            it('should throw when setting both "path" and "pem" child properties', () => {
                const err = 'child "tlsCACerts" fails because ["value" contains a conflict between exclusive peers [pem, path]]';
                config.tlsCACerts.pem = 'asdf';
                call.should.throw(err);
            });

            it('should throw for unknown child property', () => {
                const err = 'child "tlsCACerts" fails because ["unknown" is not allowed]';
                config.tlsCACerts.unknown = '';
                call.should.throw(err);
            });

            describe(prop('path'), () => {
                it('should throw for an empty string value', () => {
                    const err = 'child "tlsCACerts" fails because [child "path" fails because ["path" is not allowed to be empty, "path" length must be at least 1 characters long]]';
                    config.tlsCACerts.path = '';
                    call.should.throw(err);
                });

                it('should throw for a non-string value', () => {
                    const err = 'child "tlsCACerts" fails because [child "path" fails because ["path" must be a string]]';
                    config.tlsCACerts.path = true;
                    call.should.throw(err);
                });
            });

            describe(prop('pem'), () => {
                beforeEach(() => {
                    delete config.tlsCACerts.path;
                });

                it('should not throw when setting property instead of sibling "path" property', () => {
                    config.tlsCACerts.pem = 'asdf';
                    call.should.not.throw();
                });

                it('should throw for a non-string value', () => {
                    const err = 'child "tlsCACerts" fails because [child "pem" fails because ["pem" must be a string]]';
                    config.tlsCACerts.pem = true;
                    call.should.throw(err);
                });

                it('should throw for an empty string value', () => {
                    const err = 'child "tlsCACerts" fails because [child "pem" fails because ["pem" is not allowed to be empty, "pem" length must be at least 1 characters long]]';
                    config.tlsCACerts.pem = '';
                    call.should.throw(err);
                });
            });
        });
    });

    describe('Function: validateOrganization', () => {
        let config = {
            mspid: 'Org1MSP',
            peers: [
                'peer0.org1.example.com',
                'peer1.org1.example.com'
            ],
            certificateAuthorities: [
                'ca0.org1.example.com',
                'ca1.org1.example.com'
            ],
            adminPrivateKey: {
                path: 'path'
            },
            signedCert: {
                path: 'path'
            }
        };
        const configString = JSON.stringify(config);

        beforeEach(() => {
            config = JSON.parse(configString);
        });

        /**
         * Wraps the actual call, so "should" can call this function without parameters
         */
        function call() {
            ConfigValidator.validateOrganization(config,
                ['peer0.org1.example.com', 'peer1.org1.example.com'],
                ['ca0.org1.example.com', 'ca1.org1.example.com']);
        }

        it('should not throw for a valid value', () => {
            call.should.not.throw();
        });

        it('should throw for an unknown child property', () => {
            const err = '"unknown" is not allowed';
            config.unknown = '';
            call.should.throw(err);
        });

        describe(prop('mspid'), () => {
            it('should throw for missing required property', () => {
                const err = 'child "mspid" fails because ["mspid" is required]';
                delete config.mspid;
                call.should.throw(err);
            });

            it('should throw for a non-string value', () => {
                const err = 'child "mspid" fails because ["mspid" must be a string]';
                config.mspid = true;
                call.should.throw(err);
            });

            it('should throw for an empty string value', () => {
                const err = 'child "mspid" fails because ["mspid" is not allowed to be empty, "mspid" length must be at least 1 characters long]';
                config.mspid = '';
                call.should.throw(err);
            });
        });

        describe(prop('peers'), () => {
            it('should not throw for missing optional property', () => {
                delete config.peers;
                call.should.not.throw();
            });

            it('should throw for a non-array value', () => {
                const err = 'child "peers" fails because ["peers" must be an array]';
                config.peers = true;
                call.should.throw(err);
            });

            it('should throw for an empty array value', () => {
                const err = 'child "peers" fails because ["peers" must contain at least 1 items]';
                config.peers = [];
                call.should.throw(err);
            });

            it('should throw for an undefined element', () => {
                const err = 'child "peers" fails because ["peers" must not be a sparse array]';
                config.peers.push(undefined);
                call.should.throw(err);
            });

            it('should throw for a duplicate reference', () => {
                const err = 'child "peers" fails because ["peers" position 2 contains a duplicate value]';
                config.peers.push('peer0.org1.example.com');
                call.should.throw(err);
            });

            it('should throw for a non-existing reference', () => {
                const err = 'child "peers" fails because ["peers" at position 2 fails because ["2" must be one of [peer0.org1.example.com, peer1.org1.example.com]]]';
                config.peers.push('peer3.org1.example.com');
                call.should.throw(err);
            });
        });

        describe(prop('certificateAuthorities'), () => {
            it('should not throw for missing optional property', () => {
                delete config.certificateAuthorities;
                call.should.not.throw();
            });

            it('should throw for a non-array value', () => {
                const err = 'child "certificateAuthorities" fails because ["certificateAuthorities" must be an array]';
                config.certificateAuthorities = true;
                call.should.throw(err);
            });

            it('should throw for an empty array value', () => {
                const err = 'child "certificateAuthorities" fails because ["certificateAuthorities" must contain at least 1 items]';
                config.certificateAuthorities = [];
                call.should.throw(err);
            });

            it('should throw for an undefined element', () => {
                const err = 'child "certificateAuthorities" fails because ["certificateAuthorities" must not be a sparse array]';
                config.certificateAuthorities.push(undefined);
                call.should.throw(err);
            });

            it('should throw for a duplicate reference', () => {
                const err = 'child "certificateAuthorities" fails because ["certificateAuthorities" position 2 contains a duplicate value]';
                config.certificateAuthorities.push('ca0.org1.example.com');
                call.should.throw(err);
            });

            it('should throw for a non-existing reference', () => {
                const err = 'child "certificateAuthorities" fails because ["certificateAuthorities" at position 2 fails because ["2" must be one of [ca0.org1.example.com, ca1.org1.example.com]]]';
                config.certificateAuthorities.push('ca5.org1.example.com');
                call.should.throw(err);
            });
        });

        describe(prop('adminPrivateKey'), () => {
            it('should not throw for missing property when sibling "signedCert" not set either', () => {
                delete config.adminPrivateKey;
                delete config.signedCert;
                call.should.not.throw();
            });

            it('should throw for not setting together with sibling "signedCert" property', () => {
                const err = '"value" contains [adminPrivateKey] without its required peers [signedCert]';
                delete config.signedCert;
                call.should.throw(err);
            });

            it('should throw for a non-object value', () => {
                const err = 'child "adminPrivateKey" fails because ["adminPrivateKey" must be an object]';
                config.adminPrivateKey = 'yes';
                call.should.throw(err);
            });

            it('should throw for an empty value', () => {
                const err = 'child "adminPrivateKey" fails because ["value" must contain at least one of [pem, path]]';
                config.adminPrivateKey = {};
                call.should.throw(err);
            });

            it('should throw when setting both "path" and "pem" child properties', () => {
                const err = 'child "adminPrivateKey" fails because ["value" contains a conflict between exclusive peers [pem, path]]';
                config.adminPrivateKey.pem = 'asdf';
                call.should.throw(err);
            });

            it('should throw for unknown child property', () => {
                const err = 'child "adminPrivateKey" fails because ["unknown" is not allowed]';
                config.adminPrivateKey.unknown = '';
                call.should.throw(err);
            });

            describe(prop('path'), () => {
                it('should throw for an empty string value', () => {
                    const err = 'child "adminPrivateKey" fails because [child "path" fails because ["path" is not allowed to be empty, "path" length must be at least 1 characters long]]';
                    config.adminPrivateKey.path = '';
                    call.should.throw(err);
                });

                it('should throw for a non-string value', () => {
                    const err = 'child "adminPrivateKey" fails because [child "path" fails because ["path" must be a string]]';
                    config.adminPrivateKey.path = true;
                    call.should.throw(err);
                });
            });

            describe(prop('pem'), () => {
                beforeEach(() => {
                    delete config.adminPrivateKey.path;
                });

                it('should not throw when setting property instead of sibling "path" property', () => {
                    config.adminPrivateKey.pem = 'asdf';
                    call.should.not.throw();
                });

                it('should throw for a non-string value', () => {
                    const err = 'child "adminPrivateKey" fails because [child "pem" fails because ["pem" must be a string]]';
                    config.adminPrivateKey.pem = true;
                    call.should.throw(err);
                });

                it('should throw for an empty string value', () => {
                    const err = 'child "adminPrivateKey" fails because [child "pem" fails because ["pem" is not allowed to be empty, "pem" length must be at least 1 characters long]]';
                    config.adminPrivateKey.pem = '';
                    call.should.throw(err);
                });
            });
        });

        describe(prop('signedCert'), () => {
            it('should throw for not setting together with sibling "adminPrivateKey" property', () => {
                const err = '"value" contains [signedCert] without its required peers [adminPrivateKey]';
                delete config.adminPrivateKey;
                call.should.throw(err);
            });

            it('should throw for a non-object value', () => {
                const err = 'child "signedCert" fails because ["signedCert" must be an object]';
                config.signedCert = 'yes';
                call.should.throw(err);
            });

            it('should throw for an empty value', () => {
                const err = 'child "signedCert" fails because ["value" must contain at least one of [pem, path]]';
                config.signedCert = {};
                call.should.throw(err);
            });

            it('should throw when setting both "path" and "pem" child properties', () => {
                const err = 'child "signedCert" fails because ["value" contains a conflict between exclusive peers [pem, path]]';
                config.signedCert.pem = 'asdf';
                call.should.throw(err);
            });

            it('should throw for unknown child property', () => {
                const err = 'child "signedCert" fails because ["unknown" is not allowed]';
                config.signedCert.unknown = '';
                call.should.throw(err);
            });

            describe(prop('path'), () => {
                it('should throw for an empty string value', () => {
                    const err = 'child "signedCert" fails because [child "path" fails because ["path" is not allowed to be empty, "path" length must be at least 1 characters long]]';
                    config.signedCert.path = '';
                    call.should.throw(err);
                });

                it('should throw for a non-string value', () => {
                    const err = 'child "signedCert" fails because [child "path" fails because ["path" must be a string]]';
                    config.signedCert.path = true;
                    call.should.throw(err);
                });
            });

            describe(prop('pem'), () => {
                beforeEach(() => {
                    delete config.signedCert.path;
                });

                it('should not throw when setting property instead of sibling "path" property', () => {
                    config.signedCert.pem = 'asdf';
                    call.should.not.throw();
                });

                it('should throw for a non-string value', () => {
                    const err = 'child "signedCert" fails because [child "pem" fails because ["pem" must be a string]]';
                    config.signedCert.pem = true;
                    call.should.throw(err);
                });

                it('should throw for an empty string value', () => {
                    const err = 'child "signedCert" fails because [child "pem" fails because ["pem" is not allowed to be empty, "pem" length must be at least 1 characters long]]';
                    config.signedCert.pem = '';
                    call.should.throw(err);
                });
            });
        });
    });

    describe('Function: validateOrganizationWallets', () => {
        let config = {
            org0: {
                path : 'myWalletPath'
            },
            org1: {
                path : 'myOtherWalletPath'
            }
        };

        const validOrgs = ['org0', 'org1'];
        const configString = JSON.stringify(config);


        // reset the config before every test
        beforeEach(() => {
            config = JSON.parse(configString);
        });

        /**
         * Wraps the actual call, so "should" can call this function without parameters
         */
        function call() {
            ConfigValidator.validateOrganizationWallets(config, validOrgs);
        }

        it('should not throw for a valid value', () => {
            call.should.not.throw();
        });

        it('should throw for an invalid org name', () => {
            const err = '"value" must be one of [org0, org1]';
            config = {
                org0: {
                    path : 'myWalletPath'
                },
                orgNotHere: {
                    path : 'myOtherWalletPath'
                }
            };
            call.should.throw(err);
        });

        it('should throw for a missing path', () => {
            const err = 'child "path" fails because ["path" is required]';
            config = {
                org0: {},
                org1: {
                    path : 'myOtherWalletPath'
                }
            };
            call.should.throw(err);
        });

        it('should throw for a non-string value for the path', () => {
            const err = 'child "path" fails because ["path" must be a string]';
            config = {
                org0: {
                    path : 1
                },
                org1: {
                    path : 'myOtherWalletPath'
                }
            };
            call.should.throw(err);
        });

        it('should throw for invalid additional items within the object', () => {
            const err = 'child "path" fails because ["path" must be a string]. "aNumber" is not allowed';
            config = {
                org0: {
                    path : 1,
                    aNumber : 1
                },
                org1: {
                    path : 'myOtherWalletPath'
                }
            };
            call.should.throw(err);
        });

    });

    describe('Function: validateClient', () => {
        let config = {
            client: {
                organization: 'Org1',
                credentialStore: {
                    path: 'path',
                    cryptoStore: {
                        path: 'path'
                    }
                },

                clientPrivateKey: {
                    path: 'path'
                },
                clientSignedCert: {
                    path: 'path'
                },
                connection: {
                    timeout: {
                        peer: {
                            endorser: 120,
                            eventHub: 60,
                            eventReg: 3
                        },
                        orderer: 30
                    },
                }
                // other properties are added during the tests
            }
        };

        const configString = JSON.stringify(config);
        let hasOrgWallet = false;

        // reset the config before every test
        beforeEach(() => {
            hasOrgWallet = false;
            config = JSON.parse(configString);
        });

        /**
         * Wraps the actual call, so "should" can call this function without parameters
         */
        function call() {
            ConfigValidator.validateClient(config,
                ['Org1', 'Org2'], hasOrgWallet);
        }

        it('should not throw for a valid value', () => {
            call.should.not.throw();
        });

        describe(prop('client'), () => {
            it('should throw for missing property', () => {
                const err = 'child "client" fails because ["client" is required]';
                delete config.client;
                call.should.throw(err);
            });

            it('should throw for a non-object value', () => {
                const err = 'child "client" fails because ["client" must be an object]';
                config.client = true;
                call.should.throw(err);
            });

            it('should throw for unknown child property', () => {
                const err = '"unknown" is not allowed';
                config.unknown = 'invalid';
                call.should.throw(err);
            });

            it('should throw if "clientSignedCert" is set without "clientPrivateKey"', () => {
                const err = 'child "client" fails because ["value" contains [clientSignedCert] without its required peers [clientPrivateKey]]';
                delete config.client.clientPrivateKey;
                call.should.throw(err);
            });

            it('should throw if "affiliation" is set together with client materials', () => {
                const err = 'child "client" fails because ["value" contains a conflict between exclusive peers [affiliation, enrollmentSecret, clientSignedCert]]';
                config.client.affiliation = 'aff';
                call.should.throw(err);
            });

            it('should throw if "enrollmentSecret" is set together with client materials', () => {
                const err = 'child "client" fails because ["value" contains a conflict between exclusive peers [affiliation, enrollmentSecret, clientSignedCert]]';
                config.client.enrollmentSecret = 'secret';
                call.should.throw(err);
            });

            it('should throw if "enrollmentSecret" is set together with "affiliation"', () => {
                const err = 'child "client" fails because ["value" contains a conflict between exclusive peers [affiliation, enrollmentSecret, clientSignedCert]]';
                delete config.client.clientPrivateKey;
                delete config.client.clientSignedCert;
                config.client.affiliation = 'aff';
                config.client.enrollmentSecret = 'secret';
                call.should.throw(err);
            });

            it('should throw if no credential options are set when not using a wallet', () => {
                const err = 'child "client" fails because ["value" must contain at least one of [affiliation, enrollmentSecret, clientSignedCert]]';
                delete config.client.affiliation;
                delete config.client.clientPrivateKey;
                delete config.client.clientSignedCert;
                hasOrgWallet = false;
                call.should.throw(err);
            });

            it('should not throw if no credential options are set when using a wallet', () => {
                delete config.client.affiliation;
                delete config.client.clientPrivateKey;
                delete config.client.clientSignedCert;
                delete config.client.credentialStore;
                hasOrgWallet = true;
                call.should.not.throw();
            });

            describe(prop('organization'), () => {
                it('should throw for missing required property', () => {
                    const err = 'child "client" fails because [child "organization" fails because ["organization" is required]]';
                    delete config.client.organization;
                    call.should.throw(err);
                });

                it('should throw for a non-string value', () => {
                    const err = 'child "client" fails because [child "organization" fails because ["organization" must be a string]]';
                    config.client.organization = true;
                    call.should.throw(err);
                });

                it('should throw for a non-existing reference', () => {
                    const err = 'child "client" fails because [child "organization" fails because ["organization" must be one of [Org1, Org2]]]';
                    config.client.organization = 'Org5';
                    call.should.throw(err);
                });
            });

            describe(prop('credentialStore'), () => {
                it('should throw for missing required property', () => {
                    const err = 'child "client" fails because [child "credentialStore" fails because ["credentialStore" is required]]';
                    delete config.client.credentialStore;
                    call.should.throw(err);
                });

                it('should throw for a non-object value', () => {
                    const err = 'child "client" fails because [child "credentialStore" fails because ["credentialStore" must be an object]]';
                    config.client.credentialStore = true;
                    call.should.throw(err);
                });

                it('should throw for property when using a wallet', () => {
                    delete config.client.clientPrivateKey;
                    delete config.client.clientSignedCert;
                    const err = 'child "client" fails because [child "credentialStore" fails because ["credentialStore" is not allowed]]';
                    hasOrgWallet = true;
                    call.should.throw(err);
                });

                it('should throw for unknown child property', () => {
                    const err = 'child "client" fails because [child "credentialStore" fails because ["unknown" is not allowed]]';
                    config.client.credentialStore.unknown = 'invalid';
                    call.should.throw(err);
                });

                describe(prop('path'), () => {
                    it('should throw for missing required property', () => {
                        const err = 'child "client" fails because [child "credentialStore" fails because [child "path" fails because ["path" is required]]]';
                        delete config.client.credentialStore.path;
                        call.should.throw(err);
                    });

                    it('should throw for a non-string value', () => {
                        const err = 'child "client" fails because [child "credentialStore" fails because [child "path" fails because ["path" must be a string]]]';
                        config.client.credentialStore.path = true;
                        call.should.throw(err);
                    });

                    it('should throw for an empty string value', () => {
                        const err = 'child "client" fails because [child "credentialStore" fails because [child "path" fails because ["path" is not allowed to be empty, "path" length must be at least 1 characters long]]]';
                        config.client.credentialStore.path = '';
                        call.should.throw(err);
                    });
                });

                describe(prop('cryptoStore'), () => {
                    it('should throw for missing required property', () => {
                        const err = 'child "client" fails because [child "credentialStore" fails because [child "cryptoStore" fails because ["cryptoStore" is required]]]';
                        delete config.client.credentialStore.cryptoStore;
                        call.should.throw(err);
                    });

                    it('should throw for a non-object value', () => {
                        const err = 'child "client" fails because [child "credentialStore" fails because [child "cryptoStore" fails because ["cryptoStore" must be an object]]]';
                        config.client.credentialStore.cryptoStore = true;
                        call.should.throw(err);
                    });

                    describe(prop('path'), () => {
                        it('should throw for missing required property', () => {
                            const err = 'child "client" fails because [child "credentialStore" fails because [child "cryptoStore" fails because [child "path" fails because ["path" is required]]]]';
                            delete config.client.credentialStore.cryptoStore.path;
                            call.should.throw(err);
                        });

                        it('should throw for a non-string value', () => {
                            const err = 'child "client" fails because [child "credentialStore" fails because [child "cryptoStore" fails because [child "path" fails because ["path" must be a string]]]]';
                            config.client.credentialStore.cryptoStore.path = true;
                            call.should.throw(err);
                        });

                        it('should throw for an empty string value', () => {
                            const err = 'child "client" fails because [child "credentialStore" fails because [child "cryptoStore" fails because [child "path" fails because ["path" is not allowed to be empty, "path" length must be at least 1 characters long]]]]';
                            config.client.credentialStore.cryptoStore.path = '';
                            call.should.throw(err);
                        });
                    });
                });
            });

            describe(prop('clientPrivateKey'), () => {
                it('should throw for property when using a wallet', () => {
                    const err = 'child "client" fails because [child "clientPrivateKey" fails because ["clientPrivateKey" is not allowed]]';
                    hasOrgWallet = true;
                    delete config.client.credentialStore;
                    delete config.client.clientSignedCert;
                    call.should.throw(err);
                });

                it('should throw for a non-object value', () => {
                    const err = 'child "client" fails because [child "clientPrivateKey" fails because ["clientPrivateKey" must be an object]]';
                    config.client.clientPrivateKey = 'yes';
                    call.should.throw(err);
                });

                it('should throw for an empty value', () => {
                    const err = 'child "client" fails because [child "clientPrivateKey" fails because ["value" must contain at least one of [pem, path]]]';
                    config.client.clientPrivateKey = {};
                    call.should.throw(err);
                });

                it('should throw when setting both "path" and "pem" child properties', () => {
                    const err = 'child "client" fails because [child "clientPrivateKey" fails because ["value" contains a conflict between exclusive peers [pem, path]]]';
                    config.client.clientPrivateKey.pem = 'asdf';
                    call.should.throw(err);
                });

                it('should throw for unknown child property', () => {
                    const err = 'child "client" fails because [child "clientPrivateKey" fails because ["unknown" is not allowed]]';
                    config.client.clientPrivateKey.unknown = '';
                    call.should.throw(err);
                });

                describe(prop('path'), () => {
                    it('should throw for an empty string value', () => {
                        const err = 'child "client" fails because [child "clientPrivateKey" fails because [child "path" fails because ["path" is not allowed to be empty, "path" length must be at least 1 characters long]]]';
                        config.client.clientPrivateKey.path = '';
                        call.should.throw(err);
                    });

                    it('should throw for a non-string value', () => {
                        const err = 'child "client" fails because [child "clientPrivateKey" fails because [child "path" fails because ["path" must be a string]]]';
                        config.client.clientPrivateKey.path = true;
                        call.should.throw(err);
                    });
                });

                describe(prop('pem'), () => {
                    beforeEach(() => {
                        delete config.client.clientPrivateKey.path;
                    });

                    it('should not throw when setting property instead of sibling "path" property', () => {
                        config.client.clientPrivateKey.pem = 'asdf';
                        call.should.not.throw();
                    });

                    it('should throw for a non-string value', () => {
                        const err = 'child "client" fails because [child "clientPrivateKey" fails because [child "pem" fails because ["pem" must be a string]]]';
                        config.client.clientPrivateKey.pem = true;
                        call.should.throw(err);
                    });

                    it('should throw for an empty string value', () => {
                        const err = 'child "client" fails because [child "clientPrivateKey" fails because [child "pem" fails because ["pem" is not allowed to be empty, "pem" length must be at least 1 characters long]]]';
                        config.client.clientPrivateKey.pem = '';
                        call.should.throw(err);
                    });
                });
            });

            describe(prop('clientSignedCert'), () => {
                it('should throw for property when using a wallet', () => {
                    const err = 'child "client" fails because [child "clientSignedCert" fails because ["clientSignedCert" is not allowed]]';
                    hasOrgWallet = true;
                    delete config.client.credentialStore;
                    delete config.client.clientPrivateKey;
                    call.should.throw(err);
                });

                it('should throw for a non-object value', () => {
                    const err = 'child "client" fails because [child "clientSignedCert" fails because ["clientSignedCert" must be an object]]';
                    config.client.clientSignedCert = 'yes';
                    call.should.throw(err);
                });

                it('should throw for an empty value', () => {
                    const err = 'child "client" fails because [child "clientSignedCert" fails because ["value" must contain at least one of [pem, path]]]';
                    config.client.clientSignedCert = {};
                    call.should.throw(err);
                });

                it('should throw when setting both "path" and "pem" child properties', () => {
                    const err = 'child "client" fails because [child "clientSignedCert" fails because ["value" contains a conflict between exclusive peers [pem, path]]]';
                    config.client.clientSignedCert.pem = 'asdf';
                    call.should.throw(err);
                });

                it('should throw for unknown child property', () => {
                    const err = 'child "client" fails because [child "clientSignedCert" fails because ["unknown" is not allowed]]';
                    config.client.clientSignedCert.unknown = '';
                    call.should.throw(err);
                });

                describe(prop('path'), () => {
                    it('should throw for an empty string value', () => {
                        const err = 'child "client" fails because [child "clientSignedCert" fails because [child "path" fails because ["path" is not allowed to be empty, "path" length must be at least 1 characters long]]]';
                        config.client.clientSignedCert.path = '';
                        call.should.throw(err);
                    });

                    it('should throw for a non-string value', () => {
                        const err = 'child "client" fails because [child "clientSignedCert" fails because [child "path" fails because ["path" must be a string]]]';
                        config.client.clientSignedCert.path = true;
                        call.should.throw(err);
                    });
                });

                describe(prop('pem'), () => {
                    beforeEach(() => {
                        delete config.client.clientSignedCert.path;
                    });

                    it('should not throw when setting property instead of sibling "path" property', () => {
                        config.client.clientSignedCert.pem = 'asdf';
                        call.should.not.throw();
                    });

                    it('should throw for a non-string value', () => {
                        const err = 'child "client" fails because [child "clientSignedCert" fails because [child "pem" fails because ["pem" must be a string]]]';
                        config.client.clientSignedCert.pem = true;
                        call.should.throw(err);
                    });

                    it('should throw for an empty string value', () => {
                        const err = 'child "client" fails because [child "clientSignedCert" fails because [child "pem" fails because ["pem" is not allowed to be empty, "pem" length must be at least 1 characters long]]]';
                        config.client.clientSignedCert.pem = '';
                        call.should.throw(err);
                    });
                });
            });

            describe(prop('connection'), () => {
                it('should not throw for missing optional property', () => {
                    delete config.client.connection;
                    call.should.not.throw();
                });

                it('should throw for a non-object value', () => {
                    const err = 'child "client" fails because [child "connection" fails because ["connection" must be an object]]';
                    config.client.connection = true;
                    call.should.throw(err);
                });

                it('should throw for an unknown child property', () => {
                    const err = 'child "client" fails because [child "connection" fails because ["unknown" is not allowed]]';
                    config.client.connection.unknown = '';
                    call.should.throw(err);
                });

                describe(prop('timeout'), () => {
                    it('should throw for missing property', () => {
                        const err = 'child "client" fails because [child "connection" fails because [child "timeout" fails because ["timeout" is required]]]';
                        delete config.client.connection.timeout;
                        call.should.throw(err);
                    });

                    it('should throw for a non-object value', () => {
                        const err = 'child "client" fails because [child "connection" fails because [child "timeout" fails because ["timeout" must be an object]]]';
                        config.client.connection.timeout = true;
                        call.should.throw(err);
                    });

                    it('should throw for an empty value', () => {
                        const err = 'child "client" fails because [child "connection" fails because [child "timeout" fails because ["value" must contain at least one of [peer, orderer]]]]';
                        config.client.connection.timeout = {};
                        call.should.throw(err);
                    });

                    it('should throw for an unknown child property', () => {
                        const err = 'child "client" fails because [child "connection" fails because [child "timeout" fails because ["unknown" is not allowed]]]';
                        config.client.connection.timeout.unknown = '';
                        call.should.throw(err);
                    });

                    describe(prop('peer'), () => {
                        it('should not throw for missing optional property', () => {
                            delete config.client.connection.timeout.peer;
                            call.should.not.throw();
                        });

                        it('should throw for a non-object value', () => {
                            const err = 'child "client" fails because [child "connection" fails because [child "timeout" fails because [child "peer" fails because ["peer" must be an object]]]]';
                            config.client.connection.timeout.peer = true;
                            call.should.throw(err);
                        });

                        it('should throw for an empty value', () => {
                            const err = 'child "client" fails because [child "connection" fails because [child "timeout" fails because [child "peer" fails because ["value" must contain at least one of [endorser, eventHub, eventReg]]]]]';
                            config.client.connection.timeout.peer = {};
                            call.should.throw(err);
                        });

                        it('should throw for an unknown child property', () => {
                            const err = 'child "client" fails because [child "connection" fails because [child "timeout" fails because [child "peer" fails because ["unknown" is not allowed]]]]';
                            config.client.connection.timeout.peer.unknown = '';
                            call.should.throw(err);
                        });

                        describe(prop('endorser'), () => {
                            it('should not throw for missing optional property', () => {
                                delete config.client.connection.timeout.peer.endorser;
                                call.should.not.throw();
                            });

                            it('should throw for a non-number value', () => {
                                const err = 'child "client" fails because [child "connection" fails because [child "timeout" fails because [child "peer" fails because [child "endorser" fails because ["endorser" must be a number]]]]]';
                                config.client.connection.timeout.peer.endorser = true;
                                call.should.throw(err);
                            });

                            it('should throw for a negative value', () => {
                                const err = 'child "client" fails because [child "connection" fails because [child "timeout" fails because [child "peer" fails because [child "endorser" fails because ["endorser" must be a positive number]]]]]';
                                config.client.connection.timeout.peer.endorser = -10;
                                call.should.throw(err);
                            });
                        });

                        describe(prop('eventHub'), () => {
                            it('should not throw for missing optional property', () => {
                                delete config.client.connection.timeout.peer.eventHub;
                                call.should.not.throw();
                            });

                            it('should throw for a non-number value', () => {
                                const err = 'child "client" fails because [child "connection" fails because [child "timeout" fails because [child "peer" fails because [child "eventHub" fails because ["eventHub" must be a number]]]]]';
                                config.client.connection.timeout.peer.eventHub = true;
                                call.should.throw(err);
                            });

                            it('should throw for a negative value', () => {
                                const err = 'child "client" fails because [child "connection" fails because [child "timeout" fails because [child "peer" fails because [child "eventHub" fails because ["eventHub" must be a positive number]]]]]';
                                config.client.connection.timeout.peer.eventHub = -10;
                                call.should.throw(err);
                            });
                        });

                        describe(prop('eventReg'), () => {
                            it('should not throw for missing optional property', () => {
                                delete config.client.connection.timeout.peer.eventReg;
                                call.should.not.throw();
                            });

                            it('should throw for a non-number value', () => {
                                const err = 'child "client" fails because [child "connection" fails because [child "timeout" fails because [child "peer" fails because [child "eventReg" fails because ["eventReg" must be a number]]]]]';
                                config.client.connection.timeout.peer.eventReg = true;
                                call.should.throw(err);
                            });

                            it('should throw for a negative value', () => {
                                const err = 'child "client" fails because [child "connection" fails because [child "timeout" fails because [child "peer" fails because [child "eventReg" fails because ["eventReg" must be a positive number]]]]]';
                                config.client.connection.timeout.peer.eventReg = -10;
                                call.should.throw(err);
                            });
                        });
                    });

                    describe(prop('orderer'), () => {
                        it('should not throw for missing optional property', () => {
                            delete config.client.connection.timeout.orderer;
                            call.should.not.throw();
                        });

                        it('should throw for a non-number value', () => {
                            const err = 'child "client" fails because [child "connection" fails because [child "timeout" fails because [child "orderer" fails because ["orderer" must be a number]]]]';
                            config.client.connection.timeout.orderer = true;
                            call.should.throw(err);
                        });

                        it('should throw for a negative value', () => {
                            const err = 'child "client" fails because [child "connection" fails because [child "timeout" fails because [child "orderer" fails because ["orderer" must be a positive number]]]]';
                            config.client.connection.timeout.orderer = -10;
                            call.should.throw(err);
                        });
                    });
                });
            });

            describe(prop('affiliation'), () => {
                beforeEach(() => {
                    delete config.client.clientPrivateKey;
                    delete config.client.clientSignedCert;
                });

                it('should throw for property when using a wallet', () => {
                    const err = 'child "client" fails because [child "affiliation" fails because ["affiliation" is not allowed]]';
                    hasOrgWallet = true;
                    delete config.client.credentialStore;
                    config.client.affiliation = 'aff';
                    call.should.throw(err);
                });

                it('should not throw for setting it without client materials', () => {
                    config.client.affiliation = 'aff';
                    call.should.not.throw();
                });

                it('should throw for a non-string value', () => {
                    const err = 'child "client" fails because [child "affiliation" fails because ["affiliation" must be a string]]';
                    config.client.affiliation = true;
                    call.should.throw(err);
                });

                it('should throw for an empty string', () => {
                    const err = 'child "client" fails because [child "affiliation" fails because ["affiliation" is not allowed to be empty, "affiliation" length must be at least 1 characters long]]';
                    config.client.affiliation = '';
                    call.should.throw(err);
                });
            });

            describe(prop('attributes'), () => {
                beforeEach(() => {
                    delete config.client.clientPrivateKey;
                    delete config.client.clientSignedCert;
                    config.client.affiliation = 'aff';
                });

                it('should throw for property when using a wallet', () => {
                    const err = 'child "client" fails because [child "affiliation" fails because ["affiliation" is not allowed]]';
                    hasOrgWallet = true;
                    delete config.client.credentialStore;
                    config.client.affiliation = 'aff';
                    call.should.throw(err);
                });

                it('should not throw for setting it without client materials but with affiliation', () => {
                    config.client.attributes = [ {name: 'attr1', value: 'val1', ecert: true}, {name: 'attr2', value: 'val2'}];
                    call.should.not.throw();
                });

                it('should throw if set without affiliation', () => {
                    const err = 'child "client" fails because ["attributes" missing required peer "affiliation", "value" must contain at least one of [affiliation, enrollmentSecret, clientSignedCert]]';
                    delete config.client.affiliation;
                    config.client.attributes = [ {name: 'attr1', value: 'val1', ecert: true}, {name: 'attr2', value: 'val2'}];
                    call.should.throw(err);
                });

                it('should throw for a non-array value', () => {
                    const err = 'child "client" fails because [child "attributes" fails because ["attributes" must be an array]]';
                    config.client.attributes = true;
                    call.should.throw(err);
                });

                it('should throw for an empty value', () => {
                    const err = 'child "client" fails because [child "attributes" fails because ["attributes" must contain at least 1 items]]';
                    config.client.attributes = [];
                    call.should.throw(err);
                });

                it('should throw for an undefined value', () => {
                    const err = 'child "client" fails because [child "attributes" fails because ["attributes" must not be a sparse array]]';
                    config.client.attributes = [undefined];
                    call.should.throw(err);
                });

                it('should throw for an unknown child property of an item', () => {
                    const err = 'child "client" fails because [child "attributes" fails because ["attributes" at position 1 fails because ["unknown" is not allowed]]]';
                    config.client.attributes = [ {name: 'attr1', value: 'val1', ecert: true}, {name: 'attr2', value: 'val2', unknown: ''}];
                    call.should.throw(err);
                });

                describe(prop('[item].name'), () => {
                    it('should throw for duplicate names', () => {
                        const err = 'child "client" fails because [child "attributes" fails because ["attributes" position 1 contains a duplicate value]]';
                        config.client.attributes = [ {name: 'attr1', value: 'val1', ecert: true}, {name: 'attr1', value: 'val2'}];
                        call.should.throw(err);
                    });

                    it('should throw for name with empty string', () => {
                        const err = 'child "client" fails because [child "attributes" fails because ["attributes" at position 1 fails because [child "name" fails because ["name" is not allowed to be empty, "name" length must be at least 1 characters long]]]]';
                        config.client.attributes = [ {name: 'attr1', value: 'val1', ecert: true}, {name: '', value: 'val2'}];
                        call.should.throw(err);
                    });

                    it('should throw for missing name', () => {
                        const err = 'child "client" fails because [child "attributes" fails because ["attributes" at position 0 fails because [child "name" fails because ["name" is required]]]]';
                        config.client.attributes = [ {value: 'val1', ecert: true}, {name: 'attr1', value: 'val2'}];
                        call.should.throw(err);
                    });
                });

                describe(prop('[item].value'), () => {
                    it('should throw for missing value', () => {
                        const err = 'child "client" fails because [child "attributes" fails because ["attributes" at position 0 fails because [child "value" fails because ["value" is required]]]]';
                        config.client.attributes = [ {name: 'attr1', ecert: true}, {name: 'attr2', value: 'val2'}];
                        call.should.throw(err);
                    });
                });

                describe(prop('[item].ecert'), () => {
                    it('should throw for non-boolean value', () => {
                        const err = 'child "client" fails because [child "attributes" fails because ["attributes" at position 0 fails because [child "ecert" fails because ["ecert" must be a boolean]]]]';
                        config.client.attributes = [ {name: 'attr1', value: 'val1', ecert: 'ecert'}, {name: 'attr2', value: 'val2'}];
                        call.should.throw(err);
                    });
                });
            });

            describe(prop('enrollmentSecret'), () => {
                beforeEach(() => {
                    delete config.client.clientPrivateKey;
                    delete config.client.clientSignedCert;
                });

                it('should throw for property when using a wallet', () => {
                    const err = 'child "client" fails because [child "enrollmentSecret" fails because ["enrollmentSecret" is not allowed]]';
                    hasOrgWallet = true;
                    delete config.client.credentialStore;
                    config.client.enrollmentSecret = 'secret';
                    call.should.throw(err);
                });

                it('should not throw for if set without client materials', () => {
                    config.client.enrollmentSecret = 'secret';
                    call.should.not.throw();
                });

                it('should throw for a non-string value', () => {
                    const err = 'child "client" fails because [child "enrollmentSecret" fails because ["enrollmentSecret" must be a string]]';
                    config.client.enrollmentSecret = true;
                    call.should.throw(err);
                });

                it('should throw for an empty string value', () => {
                    const err = 'child "client" fails because [child "enrollmentSecret" fails because ["enrollmentSecret" is not allowed to be empty, "enrollmentSecret" length must be at least 1 characters long]]';
                    config.client.enrollmentSecret = '';
                    call.should.throw(err);
                });
            });
        });
    });

    describe('Function: validateChannel', () => {
        let config = {
            created: false,
            configBinary: 'path',
            orderers: ['orderer.example.com'],
            peers: {
                'peer0.org1.example.com': {
                    eventSource: true,
                    endorsingPeer: true,
                    chaincodeQuery: true,
                    ledgerQuery: true
                },
                'peer0.org2.example.com': {
                    eventSource: true,
                    endorsingPeer: true,
                    chaincodeQuery: true,
                    ledgerQuery: true
                }
            },
            contracts: [
                {
                    id: 'marbles',
                    contractID: 'ContractMarbles',
                    version: 'v0',
                    language: 'golang',
                    path: 'path',
                    metadataPath: 'path',
                    targetPeers: ['peer0.org1.example.com', 'peer0.org2.example.com'],
                    'endorsement-policy': {
                        identities: [
                            { role: { name: 'member', mspId: 'Org1MSP' }},
                            { role: { name: 'member', mspId: 'Org2MSP' }}
                        ],
                        policy: {
                            '2-of': [
                                { 'signed-by': 1},
                                { '1-of': [{ 'signed-by': 0 }, { 'signed-by': 1 }]}
                            ]
                        }
                    },
                    init: [],
                    function: 'init',
                    initTransientMap: {
                        key: 'value'
                    },
                    'collections-config': [
                        {
                            name: 'name',
                            policy: {
                                identities: [
                                    {role: {name: 'member', mspId: 'Org1MSP'}},
                                    {role: {name: 'member', mspId: 'Org2MSP'}}
                                ],
                                policy: {
                                    '2-of': [
                                        {'signed-by': 1},
                                        {'1-of': [{'signed-by': 0}, {'signed-by': 1}]}
                                    ]
                                }
                            },
                            requiredPeerCount: 1,
                            maxPeerCount: 2,
                            blockToLive: 0
                        },
                        {
                            name: 'name2',
                            policy: {
                                identities: [
                                    {role: {name: 'member', mspId: 'Org1MSP'}},
                                    {role: {name: 'member', mspId: 'Org2MSP'}}
                                ],
                                policy: {
                                    '2-of': [
                                        {'signed-by': 1},
                                        {'1-of': [{'signed-by': 0}, {'signed-by': 1}]}
                                    ]
                                }
                            },
                            requiredPeerCount: 1,
                            maxPeerCount: 2,
                            blockToLive: 0
                        }
                    ]
                },
                {
                    id: 'drm',
                    version: 'v0'
                }
            ]

            // additional properties added by the tests
        };
        const configString = JSON.stringify(config);

        beforeEach(() => {
            config = JSON.parse(configString);
        });

        /**
         * Wraps the actual call, so "should" can call this function without parameters
         */
        function call() {
            ConfigValidator.validateChannel(config,
                ['orderer.example.com'],
                ['peer0.org1.example.com', 'peer0.org2.example.com'],
                ['Org1MSP', 'Org2MSP'],
                ['Contract1'],
                flowOptions,
                discovery);
        }

        it('should not throw for a valid value', () => {
            call.should.not.throw();
        });

        it('should throw for unknown child property', () => {
            const err = '"unknown" is not allowed';
            config.unknown = '';
            call.should.throw(err);
        });

        it('should throw when both "configBinary" and "definition" is set for created channel', () => {
            const err = '"value" contains a conflict between optional exclusive peers [configBinary, definition]';
            config.created = true;
            config.definition = {
                capabilities : [],
                consortium : 'SampleConsortium',
                msps : [ 'Org1MSP', 'Org2MSP' ],
                version : 0
            };
            call.should.throw(err);
        });

        describe(prop('created'), () => {
            it('should not throw for missing optional property', () => {
                delete config.created;
                call.should.not.throw();
            });

            it('should throw for a non-boolean value', () => {
                const err = 'child "created" fails because ["created" must be a boolean]';
                config.created = 'yes';
                call.should.throw(err);
            });
        });

        describe(prop('configBinary'), () => {
            it('should throw for an empty string value', () => {
                const err = 'child "configBinary" fails because ["configBinary" is not allowed to be empty, "configBinary" length must be at least 1 characters long]';
                config.configBinary = '';
                call.should.throw(err);
            });

            it('should throw for a non-string value', () => {
                const err = 'child "configBinary" fails because ["configBinary" must be a string]';
                config.configBinary = true;
                call.should.throw(err);
            });

            it('should not throw for missing property when channel is created', () => {
                config.created = true;
                delete config.configBinary;
                call.should.not.throw();
            });

            it('should not throw for missing property when definition is set', () => {
                delete config.configBinary;
                config.definition = {
                    capabilities : [],
                    consortium : 'SampleConsortium',
                    msps : [ 'Org1MSP', 'Org2MSP' ],
                    version : 0
                };
                call.should.not.throw();
            });

            it('should throw for property when definition is set', () => {
                const err = 'child "configBinary" fails because ["configBinary" is not allowed]';
                config.definition = {
                    capabilities : [],
                    consortium : 'SampleConsortium',
                    msps : [ 'Org1MSP', 'Org2MSP' ],
                    version : 0
                };
                call.should.throw(err);
            });
        });

        describe(prop('definition'), () => {
            beforeEach(() => {
                delete config.configBinary;
                config.definition = {
                    capabilities : [],
                    consortium : 'SampleConsortium',
                    msps : [ 'Org1MSP', 'Org2MSP' ],
                    version : 0
                };
            });

            it('should not throw for setting it instead of "configBinary"', () => {
                call.should.not.throw();
            });

            it('should not throw for missing property when channel is created', () => {
                config.created = true;
                delete config.definition;
                call.should.not.throw();
            });

            it('should throw for non-object value', () => {
                const err = 'child "definition" fails because ["definition" must be an object]';
                config.definition = true;
                call.should.throw(err);
            });

            it('should throw for empty object', () => {
                const err = 'child "definition" fails because [child "capabilities" fails because ["capabilities" is required], child "consortium" fails because ["consortium" is required], child "msps" fails because ["msps" is required], child "version" fails because ["version" is required]]';
                config.definition = {};
                call.should.throw(err);
            });

            describe(prop('capabilities'), () => {
                it('should throw for missing required property', () => {
                    const err = 'child "definition" fails because [child "capabilities" fails because ["capabilities" is required]]';
                    delete config.definition.capabilities;
                    call.should.throw(err);
                });

                it('should throw for non-array value', () => {
                    const err = 'child "definition" fails because [child "capabilities" fails because ["capabilities" must be an array]]';
                    config.definition.capabilities = true;
                    call.should.throw(err);
                });

                it('should throw for undefined elements', () => {
                    const err = 'child "definition" fails because [child "capabilities" fails because ["capabilities" must not be a sparse array]]';
                    config.definition.capabilities = [ undefined ];
                    call.should.throw(err);
                });
            });

            describe(prop('consortium'), () => {
                it('should throw for missing required property', () => {
                    const err = 'child "definition" fails because [child "consortium" fails because ["consortium" is required]]';
                    delete config.definition.consortium;
                    call.should.throw(err);
                });

                it('should throw for non-string value', () => {
                    const err = 'child "definition" fails because [child "consortium" fails because ["consortium" must be a string]]';
                    config.definition.consortium = true;
                    call.should.throw(err);
                });

                it('should throw for an empty string value', () => {
                    const err = 'child "definition" fails because [child "consortium" fails because ["consortium" is not allowed to be empty, "consortium" length must be at least 1 characters long]]';
                    config.definition.consortium = '';
                    call.should.throw(err);
                });
            });

            describe(prop('msps'), () => {
                it('should throw for missing required property', () => {
                    const err = 'child "definition" fails because [child "msps" fails because ["msps" is required]]';
                    delete config.definition.msps;
                    call.should.throw(err);
                });

                it('should throw for non-array value', () => {
                    const err = 'child "definition" fails because [child "msps" fails because ["msps" must be an array]]';
                    config.definition.msps = true;
                    call.should.throw(err);
                });

                it('should throw for an undefined item', () => {
                    const err = 'child "definition" fails because [child "msps" fails because ["msps" must not be a sparse array]]';
                    config.definition.msps.push(undefined);
                    call.should.throw(err);
                });

                it('should throw for an invalid item', () => {
                    const err = 'child "definition" fails because [child "msps" fails because ["msps" at position 2 fails because ["2" must be one of [Org1MSP, Org2MSP]]]]';
                    config.definition.msps.push('Org5MSP');
                    call.should.throw(err);
                });

                it('should throw for duplicated items', () => {
                    const err = 'child "definition" fails because [child "msps" fails because ["msps" position 2 contains a duplicate value]]';
                    config.definition.msps.push('Org1MSP');
                    call.should.throw(err);
                });
            });

            describe(prop('version'), () => {
                it('should throw for missing required property', () => {
                    const err = 'child "definition" fails because [child "version" fails because ["version" is required]]';
                    delete config.definition.version;
                    call.should.throw(err);
                });

                it('should throw for non-integer value', () => {
                    const err = 'child "definition" fails because [child "version" fails because ["version" must be an integer]]';
                    config.definition.version = 3.14;
                    call.should.throw(err);
                });

                it('should throw for a negative value', () => {
                    const err = 'child "definition" fails because [child "version" fails because ["version" must be larger than or equal to 0]]';
                    config.definition.version = -10;
                    call.should.throw(err);
                });
            });
        });

        describe(prop('orderers'), () => {
            it('should throw for missing required property', () => {
                const err = 'child "orderers" fails because ["orderers" is required]';
                delete config.orderers;
                call.should.throw(err);
            });

            it('should not throw for missing optional property in discovery mode', () => {
                discovery = true;
                delete config.orderers;
                call.should.not.throw();
            });

            it('should throw for non-array value', () => {
                const err = 'child "orderers" fails because ["orderers" must be an array]';
                config.orderers = true;
                call.should.throw(err);
            });

            it('should throw for an undefined item', () => {
                const err = 'child "orderers" fails because ["orderers" must not be a sparse array]';
                config.orderers.push(undefined);
                call.should.throw(err);
            });

            it('should throw for an invalid item', () => {
                const err = 'child "orderers" fails because ["orderers" at position 1 fails because ["1" must be one of [orderer.example.com]]]';
                config.orderers.push('orderer2.example.com');
                call.should.throw(err);
            });

            it('should throw for duplicated items', () => {
                const err = 'child "orderers" fails because ["orderers" position 1 contains a duplicate value]';
                config.orderers.push('orderer.example.com');
                call.should.throw(err);
            });
        });

        describe(prop('peers'), () => {
            it('should throw for missing required property', () => {
                const err = 'child "peers" fails because ["peers" is required]';
                delete config.peers;
                call.should.throw(err);
            });

            it('should throw for non-object value', () => {
                const err = 'child "peers" fails because ["peers" must be an object]';
                config.peers = true;
                call.should.throw(err);
            });

            it('should throw for invalid child property, even if its structure would be valid', () => {
                const err = 'child "peers" fails because ["unknown" is not allowed]';
                config.peers.unknown = {};
                call.should.throw(err);
            });

            describe(prop('[child].endorsingPeer'), () => {
                it('should not throw for missing optional property', () => {
                    delete config.peers['peer0.org1.example.com'].endorsingPeer;
                    call.should.not.throw();
                });

                it('should throw for non-bool value', () => {
                    const err = 'child "peers" fails because [child "peer0.org1.example.com" fails because [child "endorsingPeer" fails because ["endorsingPeer" must be a boolean]]]';
                    config.peers['peer0.org1.example.com'].endorsingPeer = '';
                    call.should.throw(err);
                });
            });

            describe(prop('[child].chaincodeQuery'), () => {
                it('should not throw for missing optional property', () => {
                    delete config.peers['peer0.org1.example.com'].chaincodeQuery;
                    call.should.not.throw();
                });

                it('should throw for non-bool value', () => {
                    const err = 'child "peers" fails because [child "peer0.org1.example.com" fails because [child "chaincodeQuery" fails because ["chaincodeQuery" must be a boolean]]]';
                    config.peers['peer0.org1.example.com'].chaincodeQuery = '';
                    call.should.throw(err);
                });
            });

            describe(prop('[child].ledgerQuery'), () => {
                it('should not throw for missing optional property', () => {
                    delete config.peers['peer0.org1.example.com'].ledgerQuery;
                    call.should.not.throw();
                });

                it('should throw for non-bool value', () => {
                    const err = 'child "peers" fails because [child "peer0.org1.example.com" fails because [child "ledgerQuery" fails because ["ledgerQuery" must be a boolean]]]';
                    config.peers['peer0.org1.example.com'].ledgerQuery = '';
                    call.should.throw(err);
                });
            });

            describe(prop('[child].eventSource'), () => {
                it('should not throw for missing optional property', () => {
                    delete config.peers['peer0.org1.example.com'].eventSource;
                    call.should.not.throw();
                });

                it('should throw for non-bool value', () => {
                    const err = 'child "peers" fails because [child "peer0.org1.example.com" fails because [child "eventSource" fails because ["eventSource" must be a boolean]]]';
                    config.peers['peer0.org1.example.com'].eventSource = '';
                    call.should.throw(err);
                });
            });
        });

        describe(prop('contracts'), () => {
            it('should throw for missing required property', () => {
                const err = 'child "contracts" fails because ["contracts" is required]';
                delete config.contracts;
                call.should.throw(err);
            });

            it('should throw for non-array value', () => {
                const err = 'child "contracts" fails because ["contracts" must be an array]';
                config.contracts = true;
                call.should.throw(err);
            });

            it('should throw for an undefined item', () => {
                const err = 'child "contracts" fails because ["contracts" must not be a sparse array]';
                config.contracts.push(undefined);
                call.should.throw(err);
            });

            it('should throw "metadataPath" is set without "path"', () => {
                const err = 'child "contracts" fails because ["contracts" at position 0 fails because ["metadataPath" missing required peer "path"]]';
                delete config.contracts[0].path;
                call.should.throw(err);
            });

            it('should throw "path" is set without "language"', () => {
                const err = 'child "contracts" fails because ["contracts" at position 1 fails because ["path" missing required peer "language"]]';
                // on second contract
                config.contracts[1].path = 'path';
                call.should.throw(err);
            });

            it('should throw "init" is set without "language"', () => {
                const err = 'child "contracts" fails because ["contracts" at position 1 fails because ["init" missing required peer "language"]]';
                // on second contract
                config.contracts[1].init = [];
                call.should.throw(err);
            });

            it('should throw "function" is set without "language"', () => {
                const err = 'child "contracts" fails because ["contracts" at position 1 fails because ["function" missing required peer "language"]]';
                // on second contract
                config.contracts[1].function = 'init';
                call.should.throw(err);
            });

            it('should throw "initTransientMap" is set without "language"', () => {
                const err = 'child "contracts" fails because ["contracts" at position 1 fails because ["initTransientMap" missing required peer "language"]]';
                // on second contract
                config.contracts[1].initTransientMap = {};
                call.should.throw(err);
            });

            it('should throw "collections-config" is set without "language"', () => {
                const err = 'child "contracts" fails because ["contracts" at position 1 fails because ["collections-config" missing required peer "language"]]';
                // on second contract
                config.contracts[1]['collections-config'] = [{
                    name: 'name',
                    policy: {
                        identities: [
                            {role: {name: 'member', mspId: 'Org1MSP'}},
                            {role: {name: 'member', mspId: 'Org2MSP'}}
                        ],
                        policy: {
                            '2-of': [
                                {'signed-by': 1},
                                {'1-of': [{'signed-by': 0}, {'signed-by': 1}]}
                            ]
                        }
                    },
                    requiredPeerCount: 1,
                    maxPeerCount: 2,
                    blockToLive: 0
                }];
                call.should.throw(err);
            });

            it('should throw "endorsement-policy" is set without "language"', () => {
                const err = 'child "contracts" fails because ["contracts" at position 1 fails because ["endorsement-policy" missing required peer "language"]]';
                // on second contract
                config.contracts[1]['endorsement-policy'] = {
                    identities: [
                        { role: { name: 'member', mspId: 'Org1MSP' }},
                        { role: { name: 'member', mspId: 'Org2MSP' }}
                    ],
                    policy: {
                        '2-of': [
                            { 'signed-by': 1},
                            { '1-of': [{ 'signed-by': 0 }, { 'signed-by': 1 }]}
                        ]
                    }
                };
                call.should.throw(err);
            });

            describe(prop('[item].id'), () => {
                it('should throw for missing required property', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "id" fails because ["id" is required]]]';
                    delete config.contracts[0].id;
                    call.should.throw(err);
                });

                it('should throw for non-string value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "id" fails because ["id" must be a string]]]';
                    config.contracts[0].id = true;
                    call.should.throw(err);
                });

                it('should throw for empty string value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "id" fails because ["id" is not allowed to be empty, "id" length must be at least 1 characters long]]]';
                    config.contracts[0].id = '';
                    call.should.throw(err);
                });
            });

            describe(prop('[item].version'), () => {
                it('should throw for missing required property', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "version" fails because ["version" is required]]]';
                    delete config.contracts[0].version;
                    call.should.throw(err);
                });

                it('should throw for non-string value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "version" fails because ["version" must be a string]]]';
                    config.contracts[0].version = true;
                    call.should.throw(err);
                });

                it('should throw for empty string value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "version" fails because ["version" is not allowed to be empty, "version" length must be at least 1 characters long]]]';
                    config.contracts[0].version = '';
                    call.should.throw(err);
                });
            });

            describe(prop('[item].contractID'), () => {
                it('should not throw for missing optional property', () => {
                    delete config.contracts[0].contractID;
                    call.should.not.throw();
                });

                it('should throw for non-string value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "contractID" fails because ["contractID" must be a string]]]';
                    config.contracts[0].contractID = true;
                    call.should.throw(err);
                });

                it('should throw for empty string value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "contractID" fails because ["contractID" is not allowed to be empty, "contractID" length must be at least 1 characters long]]]';
                    config.contracts[0].contractID = '';
                    call.should.throw(err);
                });

                it('should throw for duplicate items based on "contractID" vs "contractID"', () => {
                    const err = 'child "contracts" fails because ["contracts" position 1 contains a duplicate value]';
                    config.contracts[1].contractID = 'ContractMarbles';
                    call.should.throw(err);
                });

                it('should throw for duplicate items based on "contractID" vs "id"', () => {
                    const err = 'child "contracts" fails because ["contracts" position 1 contains a duplicate value]';
                    config.contracts[1].id = 'ContractMarbles';
                    call.should.throw(err);
                });

                it('should throw for duplicate items based on "id" vs "contractID"', () => {
                    const err = 'child "contracts" fails because ["contracts" position 1 contains a duplicate value]';
                    delete config.contracts[0].contractID;
                    config.contracts[1].contractID = 'marbles';
                    call.should.throw(err);
                });

                it('should throw for duplicate items based on "id" vs "id"', () => {
                    const err = 'child "contracts" fails because ["contracts" position 1 contains a duplicate value]';
                    delete config.contracts[0].contractID;
                    config.contracts[1].id = 'marbles';
                    call.should.throw(err);
                });
            });

            // using the second contract
            describe(prop('[item].language'), () => {
                it('should not throw for missing optional property', () => {
                    delete config.contracts[1].language;
                    call.should.not.throw();
                });

                it('should throw for non-string value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 1 fails because [child "language" fails because ["language" must be a string]]]';
                    config.contracts[1].language = true;
                    call.should.throw(err);
                });

                it('should throw for empty string value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 1 fails because [child "language" fails because ["language" is not allowed to be empty, "language" must be one of [golang, node, java]]]]';
                    config.contracts[1].language = '';
                    call.should.throw(err);
                });

                it('should throw for invalid string value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 1 fails because [child "language" fails because ["language" must be one of [golang, node, java]]]]';
                    config.contracts[1].language = 'noooode';
                    call.should.throw(err);
                });
            });

            describe(prop('[item].path'), () => {
                it('should not throw for missing optional property', () => {
                    delete config.contracts[0].metadataPath;
                    delete config.contracts[0].path;
                    call.should.not.throw();
                });

                it('should throw for non-string value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "path" fails because ["path" must be a string]]]';
                    config.contracts[0].path = true;
                    call.should.throw(err);
                });

                it('should throw for empty string value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "path" fails because ["path" is not allowed to be empty, "path" length must be at least 1 characters long]]]';
                    config.contracts[0].path = '';
                    call.should.throw(err);
                });
            });

            describe(prop('[item].metadataPath'), () => {
                it('should not throw for missing optional property', () => {
                    delete config.contracts[0].metadataPath;
                    call.should.not.throw();
                });

                it('should throw for non-string value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "metadataPath" fails because ["metadataPath" must be a string]]]';
                    config.contracts[0].metadataPath = true;
                    call.should.throw(err);
                });

                it('should throw for empty string value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "metadataPath" fails because ["metadataPath" is not allowed to be empty, "metadataPath" length must be at least 1 characters long]]]';
                    config.contracts[0].metadataPath = '';
                    call.should.throw(err);
                });
            });

            describe(prop('[item].init'), () => {
                it('should not throw for missing optional property', () => {
                    delete config.contracts[0].init;
                    call.should.not.throw();
                });

                it('should throw for non-array value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "init" fails because ["init" must be an array]]]';
                    config.contracts[0].init = true;
                    call.should.throw(err);
                });

                it('should throw for undefined item', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "init" fails because ["init" must not be a sparse array]]]';
                    config.contracts[0].init.push(undefined);
                    call.should.throw(err);
                });

                it('should throw for non-string item', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "init" fails because ["init" at position 0 fails because ["0" must be a string]]]]';
                    config.contracts[0].init.push(true);
                    call.should.throw(err);
                });
            });

            describe(prop('[item].function'), () => {
                it('should not throw for missing optional property', () => {
                    delete config.contracts[0].function;
                    call.should.not.throw();
                });

                it('should throw for non-string value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "function" fails because ["function" must be a string]]]';
                    config.contracts[0].function = true;
                    call.should.throw(err);
                });
            });

            describe(prop('[item].initTransientMap'), () => {
                it('should not throw for missing optional property', () => {
                    delete config.contracts[0].initTransientMap;
                    call.should.not.throw();
                });

                it('should throw for non-object value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "initTransientMap" fails because ["initTransientMap" must be an object]]]';
                    config.contracts[0].initTransientMap = true;
                    call.should.throw(err);
                });

                it('should throw for non-string child property key', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "initTransientMap" fails because [child "false" fails because ["false" must be a string]]]]';
                    config.contracts[0].initTransientMap.false = true;
                    call.should.throw(err);
                });

                it('should throw for non-string child property value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "initTransientMap" fails because [child "key" fails because ["key" must be a string]]]]';
                    config.contracts[0].initTransientMap.key = true;
                    call.should.throw(err);
                });
            });

            describe(prop('[item].collections-config'), () => {
                it('should not throw for missing optional property', () => {
                    delete config.contracts[0]['collections-config'];
                    call.should.not.throw();
                });

                it('should not throw for string form instead of object form', () => {
                    config.contracts[0]['collections-config'] = 'path';
                    call.should.not.throw();
                });

                it('should throw for non-array value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" must be an array]]]';
                    config.contracts[0]['collections-config'] = true;
                    call.should.throw(err);
                });

                it('should throw for empty array value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" must contain at least 1 items]]]';
                    config.contracts[0]['collections-config'] = [];
                    call.should.throw(err);
                });

                it('should throw for undefined item', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" must not be a sparse array]]]';
                    config.contracts[0]['collections-config'].push(undefined);
                    call.should.throw(err);
                });

                it('should throw for unknown child property of item', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because ["unknown" is not allowed]]]]';
                    config.contracts[0]['collections-config'][0].unknown = '';
                    call.should.throw(err);
                });

                describe(prop('[item].name'), () => {
                    it('should throw for missing required property', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "name" fails because ["name" is required]]]]]';
                        delete config.contracts[0]['collections-config'][0].name;
                        call.should.throw(err);
                    });

                    it('should throw for non-string value', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "name" fails because ["name" must be a string]]]]]';
                        config.contracts[0]['collections-config'][0].name = true;
                        call.should.throw(err);
                    });

                    it('should throw for empty string value', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "name" fails because ["name" is not allowed to be empty, "name" length must be at least 1 characters long]]]]]';
                        config.contracts[0]['collections-config'][0].name = '';
                        call.should.throw(err);
                    });

                    it('should throw for duplicate value', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" position 1 contains a duplicate value]]]';
                        config.contracts[0]['collections-config'][0].name = 'name2';
                        call.should.throw(err);
                    });
                });

                describe(prop('[item].requiredPeerCount'), () => {
                    it('should throw for missing required property', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "requiredPeerCount" fails because ["requiredPeerCount" is required], child "maxPeerCount" fails because ["maxPeerCount" references "requiredPeerCount" which is not a number]]]]]';
                        delete config.contracts[0]['collections-config'][0].requiredPeerCount;
                        call.should.throw(err);
                    });

                    it('should throw for non-integer value', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "requiredPeerCount" fails because ["requiredPeerCount" must be an integer]]]]]';
                        config.contracts[0]['collections-config'][0].requiredPeerCount = 0.14;
                        call.should.throw(err);
                    });

                    it('should throw for negative value', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "requiredPeerCount" fails because ["requiredPeerCount" must be larger than or equal to 0]]]]]';
                        config.contracts[0]['collections-config'][0].requiredPeerCount = -1;
                        call.should.throw(err);
                    });

                    it('should throw for value greater than "maxPeerCount"', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "requiredPeerCount" fails because ["requiredPeerCount" must be less than or equal to 2], child "maxPeerCount" fails because ["maxPeerCount" must be larger than or equal to 3]]]]]';
                        config.contracts[0]['collections-config'][0].requiredPeerCount = 3;
                        call.should.throw(err);
                    });
                });

                describe(prop('[item].maxPeerCount'), () => {
                    it('should throw for missing required property', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "requiredPeerCount" fails because ["requiredPeerCount" references "maxPeerCount" which is not a number], child "maxPeerCount" fails because ["maxPeerCount" is required]]]]]';
                        delete config.contracts[0]['collections-config'][0].maxPeerCount;
                        call.should.throw(err);
                    });

                    it('should throw for non-integer value', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "maxPeerCount" fails because ["maxPeerCount" must be an integer]]]]]';
                        config.contracts[0]['collections-config'][0].maxPeerCount = 3.14;
                        call.should.throw(err);
                    });

                    it('should throw for negative value', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "requiredPeerCount" fails because ["requiredPeerCount" must be less than or equal to -1], child "maxPeerCount" fails because ["maxPeerCount" must be larger than or equal to 1]]]]]';
                        config.contracts[0]['collections-config'][0].maxPeerCount = -1;
                        call.should.throw(err);
                    });

                    it('should throw for value less than "requiredPeerCount"', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "requiredPeerCount" fails because ["requiredPeerCount" must be less than or equal to 0], child "maxPeerCount" fails because ["maxPeerCount" must be larger than or equal to 1]]]]]';
                        config.contracts[0]['collections-config'][0].maxPeerCount = 0;
                        call.should.throw(err);
                    });
                });

                describe(prop('[item].blockToLive'), () => {
                    it('should throw for missing required property', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "blockToLive" fails because ["blockToLive" is required]]]]]';
                        delete config.contracts[0]['collections-config'][0].blockToLive;
                        call.should.throw(err);
                    });

                    it('should throw for non-integer value', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "blockToLive" fails because ["blockToLive" must be an integer]]]]]';
                        config.contracts[0]['collections-config'][0].blockToLive = 3.14;
                        call.should.throw(err);
                    });

                    it('should throw for negative value', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "blockToLive" fails because ["blockToLive" must be larger than or equal to 0]]]]]';
                        config.contracts[0]['collections-config'][0].blockToLive = -1;
                        call.should.throw(err);
                    });
                });

                describe(prop('[item].policy'), () => {
                    it('should throw for missing required property', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because ["policy" is required]]]]]';
                        delete config.contracts[0]['collections-config'][0].policy;
                        call.should.throw(err);
                    });

                    it('should throw for non-object value', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because ["policy" must be an object]]]]]';
                        config.contracts[0]['collections-config'][0].policy = true;
                        call.should.throw(err);
                    });

                    it('should throw for unknown child property', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because ["unknown" is not allowed]]]]]';
                        config.contracts[0]['collections-config'][0].policy.unknown = '';
                        call.should.throw(err);
                    });

                    describe(prop('identities'), () => {
                        it('should throw for missing required property', () => {
                            const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "identities" fails because ["identities" is required]]]]]]';
                            delete config.contracts[0]['collections-config'][0].policy.identities;
                            call.should.throw(err);
                        });

                        it('should throw for non-array value', () => {
                            const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "identities" fails because ["identities" must be an array]]]]]]';
                            config.contracts[0]['collections-config'][0].policy.identities = true;
                            call.should.throw(err);
                        });

                        it('should throw for undefined item', () => {
                            const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "identities" fails because ["identities" must not be a sparse array]]]]]]';
                            config.contracts[0]['collections-config'][0].policy.identities.push(undefined);
                            call.should.throw(err);
                        });

                        it('should throw for duplicate items', () => {
                            const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "identities" fails because ["identities" position 2 contains a duplicate value]]]]]]';
                            config.contracts[0]['collections-config'][0].policy.identities.push({role: {name: 'member', mspId: 'Org1MSP'}});
                            call.should.throw(err);
                        });

                        it('should throw for unknown child property of items', () => {
                            const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "identities" fails because ["identities" at position 0 fails because ["unknown" is not allowed]]]]]]]';
                            config.contracts[0]['collections-config'][0].policy.identities[0].unknown = '';
                            call.should.throw(err);
                        });

                        describe(prop('[item].role'), () => {
                            it('should throw for missing required property', () => {
                                const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "identities" fails because ["identities" at position 0 fails because [child "role" fails because ["role" is required]]]]]]]]';
                                delete config.contracts[0]['collections-config'][0].policy.identities[0].role;
                                call.should.throw(err);
                            });

                            it('should throw for unknown child property', () => {
                                const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "identities" fails because ["identities" at position 0 fails because [child "role" fails because ["unknown" is not allowed]]]]]]]]';
                                config.contracts[0]['collections-config'][0].policy.identities[0].role.unknown = '';
                                call.should.throw(err);
                            });

                            describe(prop('name'), () => {
                                it('should throw for missing required property', () => {
                                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "identities" fails because ["identities" at position 0 fails because [child "role" fails because [child "name" fails because ["name" is required]]]]]]]]]';
                                    delete config.contracts[0]['collections-config'][0].policy.identities[0].role.name;
                                    call.should.throw(err);
                                });

                                it('should throw for non-string value', () => {
                                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "identities" fails because ["identities" at position 0 fails because [child "role" fails because [child "name" fails because ["name" must be a string]]]]]]]]]';
                                    config.contracts[0]['collections-config'][0].policy.identities[0].role.name = true;
                                    call.should.throw(err);
                                });

                                it('should throw for invalid value', () => {
                                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "identities" fails because ["identities" at position 0 fails because [child "role" fails because [child "name" fails because ["name" must be one of [member, admin]]]]]]]]]]';
                                    config.contracts[0]['collections-config'][0].policy.identities[0].role.name = 'not-member';
                                    call.should.throw(err);
                                });
                            });

                            describe(prop('mspId'), () => {
                                it('should throw for missing required property', () => {
                                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "identities" fails because ["identities" at position 0 fails because [child "role" fails because [child "mspId" fails because ["mspId" is required]]]]]]]]]';
                                    delete config.contracts[0]['collections-config'][0].policy.identities[0].role.mspId;
                                    call.should.throw(err);
                                });

                                it('should throw for non-string value', () => {
                                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "identities" fails because ["identities" at position 0 fails because [child "role" fails because [child "mspId" fails because ["mspId" must be a string]]]]]]]]]';
                                    config.contracts[0]['collections-config'][0].policy.identities[0].role.mspId = true;
                                    call.should.throw(err);
                                });

                                it('should throw for invalid value', () => {
                                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "identities" fails because ["identities" at position 0 fails because [child "role" fails because [child "mspId" fails because ["mspId" must be one of [Org1MSP, Org2MSP]]]]]]]]]]';
                                    config.contracts[0]['collections-config'][0].policy.identities[0].role.mspId = 'Org5MSP';
                                    call.should.throw(err);
                                });
                            });
                        });
                    });

                    describe(prop('policy'), () => {
                        it('should throw for missing required property', () => {
                            const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "policy" fails because ["policy" is required]]]]]]';
                            delete config.contracts[0]['collections-config'][0].policy.policy;
                            call.should.throw(err);
                        });

                        it('should throw for non-object value', () => {
                            const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "policy" fails because ["policy" must be an object]]]]]]';
                            config.contracts[0]['collections-config'][0].policy.policy = true;
                            call.should.throw(err);
                        });

                        it('should throw for an empty value', () => {
                            const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "policy" fails because ["policy" must have 1 children]]]]]]';
                            config.contracts[0]['collections-config'][0].policy.policy = {};
                            call.should.throw(err);
                        });

                        it('should throw for an invalid child property', () => {
                            const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "policy" fails because ["of2" is not allowed]]]]]]';
                            config.contracts[0]['collections-config'][0].policy.policy.of2 = {};
                            call.should.throw(err);
                        });

                        describe(prop('X-of'), () => {
                            it('should throw for non-array value', () => {
                                const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "policy" fails because [child "2-of" fails because ["2-of" must be an array]]]]]]]';
                                config.contracts[0]['collections-config'][0].policy.policy['2-of'] = true;
                                call.should.throw(err);
                            });

                            it('should throw for empty value', () => {
                                const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "policy" fails because [child "2-of" fails because ["2-of" must contain at least 1 items]]]]]]]';
                                config.contracts[0]['collections-config'][0].policy.policy['2-of'] = [];
                                call.should.throw(err);
                            });

                            it('should throw for undefined item', () => {
                                const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "policy" fails because [child "2-of" fails because ["2-of" must not be a sparse array]]]]]]]';
                                config.contracts[0]['collections-config'][0].policy.policy['2-of'].push(undefined);
                                call.should.throw(err);
                            });

                            it('should throw for item with invalid key', () => {
                                const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "policy" fails because [child "2-of" fails because ["2-of" at position 2 fails because ["of2" is not allowed]]]]]]]]';
                                config.contracts[0]['collections-config'][0].policy.policy['2-of'].push({ of2: true });
                                call.should.throw(err);
                            });

                            it('should throw for empty item', () => {
                                const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "policy" fails because [child "2-of" fails because ["2-of" at position 2 fails because ["2" must have at least 1 children]]]]]]]]';
                                config.contracts[0]['collections-config'][0].policy.policy['2-of'].push({});
                                call.should.throw(err);
                            });

                            // the recursive X-of items are covered by the above tests
                            describe(prop('[item].signed-by'), () => {
                                it('should throw for non-integer value', () => {
                                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "policy" fails because [child "2-of" fails because ["2-of" at position 0 fails because [child "signed-by" fails because ["signed-by" must be an integer]]]]]]]]]';
                                    config.contracts[0]['collections-config'][0].policy.policy['2-of'][0]['signed-by'] = 3.14;
                                    call.should.throw(err);
                                });

                                it('should throw for negative value', () => {
                                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "collections-config" fails because ["collections-config" must be a string, "collections-config" at position 0 fails because [child "policy" fails because [child "policy" fails because [child "2-of" fails because ["2-of" at position 0 fails because [child "signed-by" fails because ["signed-by" must be larger than or equal to 0]]]]]]]]]';
                                    config.contracts[0]['collections-config'][0].policy.policy['2-of'][0]['signed-by'] = -10;
                                    call.should.throw(err);
                                });
                            });
                        });

                    });
                });
            });

            describe(prop('[item].endorsement-policy'), () => {
                it('should not throw for missing optional property', () => {
                    delete config.contracts[0]['endorsement-policy'];
                    call.should.not.throw();
                });

                it('should throw for non-object value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because ["endorsement-policy" must be an object]]]';
                    config.contracts[0]['endorsement-policy'] = true;
                    call.should.throw(err);
                });

                it('should throw for unknown child property', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because ["unknown" is not allowed]]]';
                    config.contracts[0]['endorsement-policy'].unknown = '';
                    call.should.throw(err);
                });

                describe(prop('identities'), () => {
                    it('should throw for missing required property', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "identities" fails because ["identities" is required]]]]';
                        delete config.contracts[0]['endorsement-policy'].identities;
                        call.should.throw(err);
                    });

                    it('should throw for non-array value', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "identities" fails because ["identities" must be an array]]]]';
                        config.contracts[0]['endorsement-policy'].identities = true;
                        call.should.throw(err);
                    });

                    it('should throw for undefined item', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "identities" fails because ["identities" must not be a sparse array]]]]';
                        config.contracts[0]['endorsement-policy'].identities.push(undefined);
                        call.should.throw(err);
                    });

                    it('should throw for duplicate items', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "identities" fails because ["identities" position 2 contains a duplicate value]]]]';
                        config.contracts[0]['endorsement-policy'].identities.push({
                            role: {
                                name: 'member',
                                mspId: 'Org1MSP'
                            }
                        });
                        call.should.throw(err);
                    });

                    it('should throw for unknown child property of items', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "identities" fails because ["identities" at position 0 fails because ["unknown" is not allowed]]]]]';
                        config.contracts[0]['endorsement-policy'].identities[0].unknown = '';
                        call.should.throw(err);
                    });

                    describe(prop('[item].role'), () => {
                        it('should throw for missing required property', () => {
                            const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "identities" fails because ["identities" at position 0 fails because [child "role" fails because ["role" is required]]]]]]';
                            delete config.contracts[0]['endorsement-policy'].identities[0].role;
                            call.should.throw(err);
                        });

                        it('should throw for unknown child property', () => {
                            const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "identities" fails because ["identities" at position 0 fails because [child "role" fails because ["unknown" is not allowed]]]]]]';
                            config.contracts[0]['endorsement-policy'].identities[0].role.unknown = '';
                            call.should.throw(err);
                        });

                        describe(prop('name'), () => {
                            it('should throw for missing required property', () => {
                                const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "identities" fails because ["identities" at position 0 fails because [child "role" fails because [child "name" fails because ["name" is required]]]]]]]';
                                delete config.contracts[0]['endorsement-policy'].identities[0].role.name;
                                call.should.throw(err);
                            });

                            it('should throw for non-string value', () => {
                                const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "identities" fails because ["identities" at position 0 fails because [child "role" fails because [child "name" fails because ["name" must be a string]]]]]]]';
                                config.contracts[0]['endorsement-policy'].identities[0].role.name = true;
                                call.should.throw(err);
                            });

                            it('should throw for invalid value', () => {
                                const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "identities" fails because ["identities" at position 0 fails because [child "role" fails because [child "name" fails because ["name" must be one of [member, admin]]]]]]]]';
                                config.contracts[0]['endorsement-policy'].identities[0].role.name = 'not-member';
                                call.should.throw(err);
                            });
                        });

                        describe(prop('mspId'), () => {
                            it('should throw for missing required property', () => {
                                const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "identities" fails because ["identities" at position 0 fails because [child "role" fails because [child "mspId" fails because ["mspId" is required]]]]]]]';
                                delete config.contracts[0]['endorsement-policy'].identities[0].role.mspId;
                                call.should.throw(err);
                            });

                            it('should throw for non-string value', () => {
                                const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "identities" fails because ["identities" at position 0 fails because [child "role" fails because [child "mspId" fails because ["mspId" must be a string]]]]]]]';
                                config.contracts[0]['endorsement-policy'].identities[0].role.mspId = true;
                                call.should.throw(err);
                            });

                            it('should throw for invalid value', () => {
                                const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "identities" fails because ["identities" at position 0 fails because [child "role" fails because [child "mspId" fails because ["mspId" must be one of [Org1MSP, Org2MSP]]]]]]]]';
                                config.contracts[0]['endorsement-policy'].identities[0].role.mspId = 'Org5MSP';
                                call.should.throw(err);
                            });
                        });
                    });
                });

                describe(prop('policy'), () => {
                    it('should throw for missing required property', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "policy" fails because ["policy" is required]]]]';
                        delete config.contracts[0]['endorsement-policy'].policy;
                        call.should.throw(err);
                    });

                    it('should throw for non-object value', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "policy" fails because ["policy" must be an object]]]]';
                        config.contracts[0]['endorsement-policy'].policy = true;
                        call.should.throw(err);
                    });

                    it('should throw for an empty value', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "policy" fails because ["policy" must have 1 children]]]]';
                        config.contracts[0]['endorsement-policy'].policy = {};
                        call.should.throw(err);
                    });

                    it('should throw for an invalid child property', () => {
                        const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "policy" fails because ["of2" is not allowed]]]]';
                        config.contracts[0]['endorsement-policy'].policy.of2 = {};
                        call.should.throw(err);
                    });

                    describe(prop('X-of'), () => {
                        it('should throw for non-array value', () => {
                            const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "policy" fails because [child "2-of" fails because ["2-of" must be an array]]]]]';
                            config.contracts[0]['endorsement-policy'].policy['2-of'] = true;
                            call.should.throw(err);
                        });

                        it('should throw for empty value', () => {
                            const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "policy" fails because [child "2-of" fails because ["2-of" must contain at least 1 items]]]]]';
                            config.contracts[0]['endorsement-policy'].policy['2-of'] = [];
                            call.should.throw(err);
                        });

                        it('should throw for undefined item', () => {
                            const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "policy" fails because [child "2-of" fails because ["2-of" must not be a sparse array]]]]]';
                            config.contracts[0]['endorsement-policy'].policy['2-of'].push(undefined);
                            call.should.throw(err);
                        });

                        it('should throw for item with invalid key', () => {
                            const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "policy" fails because [child "2-of" fails because ["2-of" at position 2 fails because ["of2" is not allowed]]]]]]';
                            config.contracts[0]['endorsement-policy'].policy['2-of'].push({of2: true});
                            call.should.throw(err);
                        });

                        it('should throw for empty item', () => {
                            const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "policy" fails because [child "2-of" fails because ["2-of" at position 2 fails because ["2" must have at least 1 children]]]]]]';
                            config.contracts[0]['endorsement-policy'].policy['2-of'].push({});
                            call.should.throw(err);
                        });

                        // the recursive X-of items are covered by the above tests
                        describe(prop('[item].signed-by'), () => {
                            it('should throw for non-integer value', () => {
                                const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "policy" fails because [child "2-of" fails because ["2-of" at position 0 fails because [child "signed-by" fails because ["signed-by" must be an integer]]]]]]]';
                                config.contracts[0]['endorsement-policy'].policy['2-of'][0]['signed-by'] = 3.14;
                                call.should.throw(err);
                            });

                            it('should throw for negative value', () => {
                                const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "endorsement-policy" fails because [child "policy" fails because [child "2-of" fails because ["2-of" at position 0 fails because [child "signed-by" fails because ["signed-by" must be larger than or equal to 0]]]]]]]';
                                config.contracts[0]['endorsement-policy'].policy['2-of'][0]['signed-by'] = -10;
                                call.should.throw(err);
                            });
                        });
                    });
                });
            });

            describe(prop('[item].targetPeers'), () => {
                it('should not throw for missing optional property', () => {
                    delete config.contracts[0].targetPeers;
                    call.should.not.throw();
                });

                it('should throw for non-array value', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "targetPeers" fails because ["targetPeers" must be an array]]]';
                    config.contracts[0].targetPeers = true;
                    call.should.throw(err);
                });

                it('should throw for empty array', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "targetPeers" fails because ["targetPeers" must contain at least 1 items]]]';
                    config.contracts[0].targetPeers = [];
                    call.should.throw(err);
                });

                it('should throw for undefined item', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "targetPeers" fails because ["targetPeers" must not be a sparse array]]]';
                    config.contracts[0].targetPeers.push(undefined);
                    call.should.throw(err);
                });

                it('should throw for invalid peer reference', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "targetPeers" fails because ["targetPeers" at position 2 fails because ["2" must be one of [peer0.org1.example.com, peer0.org2.example.com]]]]]';
                    config.contracts[0].targetPeers.push('peer0.org5.example.com');
                    call.should.throw(err);
                });

                it('should throw for duplicate peer reference', () => {
                    const err = 'child "contracts" fails because ["contracts" at position 0 fails because [child "targetPeers" fails because ["targetPeers" position 2 contains a duplicate value]]]';
                    config.contracts[0].targetPeers.push('peer0.org1.example.com');
                    call.should.throw(err);
                });
            });
        });
    });
});
