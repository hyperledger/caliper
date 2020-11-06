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
    const staticConnectionProfile = fs.readFileSync(path.resolve(__dirname, '../sample-configs/StaticOrg1ConnectionProfile.json'));
    const mspId = 'Org1MSP';

    it('should return whether it is dynamic or not (true or false) based on the discover property', () => {
        const providedConnectionPofile = JSON.parse(connectionProfile.toString());
        let  connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
            loadedConnectionProfile: providedConnectionPofile,
            discover: true
        });
        connectionProfileDefinition.getConnectionProfile().should.equal(providedConnectionPofile);
        connectionProfileDefinition.isDynamicConnectionProfile().should.equal(true);

        connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
            loadedConnectionProfile: providedConnectionPofile,
            discover: false
        });
        connectionProfileDefinition.isDynamicConnectionProfile().should.equal(false);

        connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
            loadedConnectionProfile: providedConnectionPofile
        });
        connectionProfileDefinition.isDynamicConnectionProfile().should.equal(false);
    });


    it('should return true if a connection profile is using tls', () => {
        const connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
            loadedConnectionProfile: JSON.parse(connectionProfile.toString()),
            discover: true
        });
        connectionProfileDefinition.isTLSEnabled().should.equal(true);
    });

    it('should return false if a connection profile is not using tls', () => {
        const alteredConnectionProfile = JSON.parse(connectionProfile.toString());
        alteredConnectionProfile.peers['peer0.org1.example.com'].url = 'grpc://localhost:7051';
        alteredConnectionProfile.certificateAuthorities['ca.org1.example.com'].url = 'http://localhost:7054';
        const connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
            loadedConnectionProfile: alteredConnectionProfile,
            discover: true
        });
        connectionProfileDefinition.isTLSEnabled().should.equal(false);
    });

    describe('when getting the organization owned endorsing peers for a channel', () => {
        it('should get the owned peers for a channel when defined in the connection profile', () => {
            const connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
                loadedConnectionProfile: JSON.parse(staticConnectionProfile.toString()),
                discover: false
            });

            let peersInChannelForOrg = connectionProfileDefinition.getOwnedEndorsingPeersInChannel('mychannel');
            peersInChannelForOrg.should.deep.equal(['peer0.org1.example.com', 'peer1.org1.example.com']);

            peersInChannelForOrg = connectionProfileDefinition.getOwnedEndorsingPeersInChannel('yourchannel');
            peersInChannelForOrg.should.deep.equal(['peer0.org1.example.com']);
        });

        it('should throw an error when no channels are defined in the connection profile', () => {
            const blankConnectionProfile = {
            };
            const connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
                loadedConnectionProfile: blankConnectionProfile,
                discover: false
            });
            (() => {
                connectionProfileDefinition.getOwnedEndorsingPeersInChannel('mychannel');
            }).should.throw(/No channel mychannel defined in the connection profile for organization Org1MSP/);
        });

        it('should throw an error when the specific channel is not defined in the connection profile', () => {
            const limitedConnectionProfile = {
                channels: {
                    yourchannel: {
                        orderers: [
                            'orderer0.example.com',
                            'orderer1.example.com'
                        ],
                        peers: {
                            'peer0.org1.example.com': {},
                            'peer0.org2.example.com': {}
                        }
                    }
                }
            };
            const connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
                loadedConnectionProfile: limitedConnectionProfile,
                discover: false
            });
            (() => {
                connectionProfileDefinition.getOwnedEndorsingPeersInChannel('mychannel');
            }).should.throw(/No channel mychannel defined in the connection profile for organization Org1MSP/);
        });

        it('should throw an error when the specific channel has no peers in the connection profile', () => {
            const limitedConnectionProfile = {
                channels: {
                    mychannel: {
                        orderers: [
                            'orderer0.example.com',
                            'orderer1.example.com'
                        ]
                    }
                }
            };
            const connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
                loadedConnectionProfile: limitedConnectionProfile,
                discover: false
            });
            (() => {
                connectionProfileDefinition.getOwnedEndorsingPeersInChannel('mychannel');
            }).should.throw(/No peers defined for mychannel in the connection profile for organization Org1MSP/);
        });

        it('should return an empty list when no peers are specified for the organization', () => {
            const limitedConnectionProfile = {
                client: {
                    organization: 'Org1'
                },
                organizations: {
                    Org1: {
                        mspid: 'Org1MSP'
                    }
                },
                channels: {
                    mychannel: {
                        orderers: [
                            'orderer0.example.com',
                            'orderer1.example.com'
                        ],
                        peers: {
                            'peer0.org1.example.com': {},
                            'peer0.org2.example.com': {}
                        }
                    }
                }
            };
            const connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
                loadedConnectionProfile: limitedConnectionProfile,
                discover: false
            });
            connectionProfileDefinition.getOwnedEndorsingPeersInChannel('mychannel').should.deep.equal([]);
        });

        it('should return only peers that are defined as endorsing or chaincode query peers', () => {
            const limitedConnectionProfile = {
                client: {
                    organization: 'Org1'
                },
                organizations: {
                    Org1: {
                        mspid: 'Org1MSP',
                        peers: [
                            'peer0.org1.example.com',
                            'peer1.org1.example.com',
                            'peer2.org1.example.com',
                            'peer3.org1.example.com',
                            'peer4.org1.example.com',
                            'peer5.org1.example.com'
                        ]
                    }
                },
                channels: {
                    mychannel: {
                        orderers: [
                            'orderer0.example.com',
                            'orderer1.example.com'
                        ],
                        peers: {
                            'peer0.org1.example.com': {endorsingPeer: false, chaincodeQuery:false},
                            'peer1.org1.example.com': {endorsingPeer: true, chaincodeQuery: false},
                            'peer2.org1.example.com': {endorsingPeer: false, chaincodeQuery: true},
                            'peer3.org1.example.com': {endorsingPeer: false},
                            'peer4.org1.example.com': {endorsingPeer: false, chaincodeQuery:false},
                            'peer5.org1.example.com': {chaincodeQuery: false},
                            'peer0.org2.example.com': {}
                        }
                    }
                }
            };
            const connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
                loadedConnectionProfile: limitedConnectionProfile,
                discover: false
            });
            connectionProfileDefinition.getOwnedEndorsingPeersInChannel('mychannel').should.deep.equal([
                'peer1.org1.example.com',
                'peer2.org1.example.com',
                'peer3.org1.example.com',
                'peer5.org1.example.com'
            ]);
        });
    });

    describe('when getting the endorsing peers for a channel', () => {
        it('should get the owned peers for a channel when defined in the connection profile', () => {
            const connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
                loadedConnectionProfile: JSON.parse(staticConnectionProfile.toString()),
                discover: false
            });

            let peersInChannelForOrg = connectionProfileDefinition.getEndorsingPeersInChannel('mychannel');
            peersInChannelForOrg.should.deep.equal(['peer0.org1.example.com', 'peer1.org1.example.com', 'peer0.org2.example.com']);

            peersInChannelForOrg = connectionProfileDefinition.getEndorsingPeersInChannel('yourchannel');
            peersInChannelForOrg.should.deep.equal(['peer0.org1.example.com', 'peer0.org2.example.com']);
        });

        it('should throw an error when no channels are defined in the connection profile', () => {
            const blankConnectionProfile = {
            };
            const connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
                loadedConnectionProfile: blankConnectionProfile,
                discover: false
            });
            (() => {
                connectionProfileDefinition.getEndorsingPeersInChannel('mychannel');
            }).should.throw(/No channel mychannel defined in the connection profile for organization Org1MSP/);
        });

        it('should throw an error when the specific channel is not defined in the connection profile', () => {
            const limitedConnectionProfile = {
                channels: {
                    yourchannel: {
                        orderers: [
                            'orderer0.example.com',
                            'orderer1.example.com'
                        ],
                        peers: {
                            'peer0.org1.example.com': {},
                            'peer0.org2.example.com': {}
                        }
                    }
                }
            };
            const connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
                loadedConnectionProfile: limitedConnectionProfile,
                discover: false
            });
            (() => {
                connectionProfileDefinition.getEndorsingPeersInChannel('mychannel');
            }).should.throw(/No channel mychannel defined in the connection profile for organization Org1MSP/);
        });

        it('should throw an error when the specific channel has no peers in the connection profile', () => {
            const limitedConnectionProfile = {
                channels: {
                    mychannel: {
                        orderers: [
                            'orderer0.example.com',
                            'orderer1.example.com'
                        ]
                    }
                }
            };
            const connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
                loadedConnectionProfile: limitedConnectionProfile,
                discover: false
            });
            (() => {
                connectionProfileDefinition.getEndorsingPeersInChannel('mychannel');
            }).should.throw(/No peers defined for mychannel in the connection profile for organization Org1MSP/);
        });

        it('should return only peers that are defined as endorsing or chaincode query peers', () => {
            const limitedConnectionProfile = {
                client: {
                    organization: 'Org1'
                },
                organizations: {
                    Org1: {
                        mspid: 'Org1MSP',
                        peers: [
                            'peer0.org1.example.com',
                            'peer1.org1.example.com',
                            'peer2.org1.example.com',
                            'peer3.org1.example.com',
                            'peer4.org1.example.com',
                            'peer5.org1.example.com'
                        ]
                    }
                },
                channels: {
                    mychannel: {
                        orderers: [
                            'orderer0.example.com',
                            'orderer1.example.com'
                        ],
                        peers: {
                            'peer0.org1.example.com': {endorsingPeer: false, chaincodeQuery:false},
                            'peer1.org1.example.com': {endorsingPeer: true, chaincodeQuery: false},
                            'peer2.org1.example.com': {endorsingPeer: false, chaincodeQuery: true},
                            'peer3.org1.example.com': {endorsingPeer: false},
                            'peer4.org1.example.com': {endorsingPeer: false, chaincodeQuery:false},
                            'peer5.org1.example.com': {chaincodeQuery: false},
                            'peer0.org2.example.com': {endorsingPeer: false, chaincodeQuery:false},
                            'peer1.org2.example.com': {endorsingPeer: true, chaincodeQuery: false},
                            'peer2.org2.example.com': {endorsingPeer: false, chaincodeQuery: true},
                            'peer3.org2.example.com': {endorsingPeer: false},
                            'peer4.org2.example.com': {endorsingPeer: false, chaincodeQuery:false},
                            'peer5.org2.example.com': {chaincodeQuery: false},
                        }
                    }
                }
            };
            const connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
                loadedConnectionProfile: limitedConnectionProfile,
                discover: false
            });
            connectionProfileDefinition.getEndorsingPeersInChannel('mychannel').should.deep.equal([
                'peer1.org1.example.com',
                'peer2.org1.example.com',
                'peer3.org1.example.com',
                'peer5.org1.example.com',
                'peer1.org2.example.com',
                'peer2.org2.example.com',
                'peer3.org2.example.com',
                'peer5.org2.example.com'
            ]);
        });
    });

    describe('when getting the orderers for a channel', () => {
        it('should get the orderers for a channel when defined in the connection profile', () => {
            const connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
                loadedConnectionProfile: JSON.parse(staticConnectionProfile.toString()),
                discover: false
            });
            const orderers = connectionProfileDefinition.getOrderersForChannel('mychannel');
            orderers.should.deep.equal(['orderer0.example.com', 'orderer1.example.com']);
        });

        it('should throw an error when no channels are defined in the connection profile', () => {
            const blankConnectionProfile = {
            };
            const connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
                loadedConnectionProfile: blankConnectionProfile,
                discover: false
            });
            (() => {
                connectionProfileDefinition.getOrderersForChannel('mychannel');
            }).should.throw(/No channel mychannel defined in the connection profile for organization Org1MSP/);
        });

        it('should throw an error when the specific channel is not defined in the connection profile', () => {
            const limitedConnectionProfile = {
                channels: {
                    yourchannel: {
                        orderers: [
                            'orderer0.example.com',
                            'orderer1.example.com'
                        ],
                        peers: {
                            'peer0.org1.example.com': {},
                            'peer0.org2.example.com': {}
                        }
                    }
                }
            };
            const connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
                loadedConnectionProfile: limitedConnectionProfile,
                discover: false
            });
            (() => {
                connectionProfileDefinition.getOrderersForChannel('mychannel');
            }).should.throw(/No channel mychannel defined in the connection profile for organization Org1MSP/);
        });

        it('should throw an error when the specific channel has no orderers in the connection profile', () => {
            const limitedConnectionProfile = {
                channels: {
                    mychannel: {
                        peers: {
                            'peer0.org1.example.com': {},
                            'peer0.org2.example.com': {}
                        }
                    }
                }
            };
            const connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
                loadedConnectionProfile: limitedConnectionProfile,
                discover: false
            });
            (() => {
                connectionProfileDefinition.getOrderersForChannel('mychannel');
            }).should.throw(/No orderers defined for mychannel in the connection profile for organization Org1MSP/);
        });

        it('should throw an error when the specific channel does not define the orderer list as an array in the connection profile', () => {
            const limitedConnectionProfile = {
                channels: {
                    mychannel: {
                        orderers: {
                            'orderer0.example.com': '',
                            'orderer1.example.com': ''
                        },
                        peers: {
                            'peer0.org1.example.com': {},
                            'peer0.org2.example.com': {}
                        }
                    }
                }
            };
            const connectionProfileDefinition = new ConnectionProfileDefinition(mspId, {
                loadedConnectionProfile: limitedConnectionProfile,
                discover: false
            });
            (() => {
                connectionProfileDefinition.getOrderersForChannel('mychannel');
            }).should.throw(/No orderers defined for mychannel in the connection profile for organization Org1MSP/);
        });
    });
});
