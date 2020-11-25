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
const sinon = require('sinon');
const path = require('path');

const IdentityManagerFactory = require('../../lib/identity-management/IdentityManagerFactory');
const IdentityManager = require('../../lib/identity-management/IdentityManager');
const IWalletFacadeFactory = require('../../lib/identity-management/IWalletFacadeFactory');
const IWalletFacade = require('../../lib/identity-management/IWalletFacade');

const org1MSPWithCertificates = {
    mspid: 'Org1MSP',
    identities: {
        certificates: [
            {
                name: 'User1',
                clientPrivateKey: {
                    path: path.resolve(__dirname, '../sample-configs/User1.key.pem')
                },
                clientSignedCert: {
                    path: path.resolve(__dirname, '../sample-configs/User1.cert.pem')
                }
            }
        ]
    }
};

const org1MSPWithCertificatesAndWallet = {
    mspid: 'Org1MSP',
    identities: {
        certificates: [
            {
                name: 'User1',
                clientPrivateKey: {
                    path: path.resolve(__dirname, '../sample-configs/User1.key.pem')
                },
                clientSignedCert: {
                    path: path.resolve(__dirname, '../sample-configs/User1.cert.pem')
                }
            }
        ],
        wallet: {
            path: path.resolve(__dirname, '../sample-configs')
        }
    }
};

const org1MSPWithAdminandUserCertificates = {
    mspid: 'Org1MSP',
    identities: {
        certificates: [
            {
                name: 'User1',
                clientPrivateKey: {
                    path: path.resolve(__dirname, '../sample-configs/User1.key.pem')
                },
                clientSignedCert: {
                    path: path.resolve(__dirname, '../sample-configs/User1.cert.pem')
                }
            },
            {
                name: 'Org1Admin',
                admin: true,
                clientPrivateKey: {
                    path: path.resolve(__dirname, '../sample-configs/User1.key.pem')
                },
                clientSignedCert: {
                    path: path.resolve(__dirname, '../sample-configs/User1.cert.pem')
                }
            }

        ]
    }
};

const org1MSPWithWallet = {
    mspid: 'Org1MSP',
    identities: {
        wallet: {
            path: path.resolve(__dirname, '../sample-configs')
        }
    }
};

const org2MSPWithWalletAndAdminNames = {
    mspid: 'Org2MSP',
    identities: {
        wallet: {
            path: path.resolve(__dirname, '../sample-configs'),
            adminNames: ['admin']
        }
    }
};

const org2MSPWithWallet = {
    mspid: 'Org2MSP',
    identities: {
        wallet: {
            path: path.resolve(__dirname, '../sample-configs')
        },
    }
};

const org2MSPWithCertificates = {
    mspid: 'Org2MSP',
    identities: {
        certificates: [
            {
                name: 'User1',
                clientPrivateKey: {
                    path: path.resolve(__dirname, '../sample-configs/User1.key.pem')
                },
                clientSignedCert: {
                    path: path.resolve(__dirname, '../sample-configs/User1.cert.pem')
                }
            }
        ]
    }
};

const org3MSPWithCertificates = {
    mspid: 'org3MSP',
    identities: {
        certificates: [
            {
                name: 'User1',
                clientPrivateKey: {
                    path: path.resolve(__dirname, '../sample-configs/User1.key.pem')
                },
                clientSignedCert: {
                    path: path.resolve(__dirname, '../sample-configs/User1.cert.pem')
                }
            },
            {
                name: 'User2',
                clientPrivateKey: {
                    pem: '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----'
                },
                clientSignedCert: {
                    pem: '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----'
                }
            }
        ]
    }
};

describe('An Identity Manager', () => {
    const identityManagerFactory = new IdentityManagerFactory();
    let stubWalletFacadeFactory;
    let stubInMemoryAndFileSystemWalletFacade;

    beforeEach(() => {
        stubWalletFacadeFactory = sinon.createStubInstance(IWalletFacadeFactory);
        stubInMemoryAndFileSystemWalletFacade = sinon.createStubInstance(IWalletFacade);
        stubWalletFacadeFactory.create.resolves(stubInMemoryAndFileSystemWalletFacade);
    });

    describe('When being created by it\'s factory', () => {
        it('should return an Identity Manager instance if an array of valid organizations are supplied', async () => {
            stubInMemoryAndFileSystemWalletFacade.getAllIdentityNames.resolves([]);
            const identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates]);
            identityManager.should.be.instanceOf(IdentityManager);
        });

        it('should throw an error if no organizations are provided', async () => {
            await identityManagerFactory.create(stubWalletFacadeFactory,[]).should.be.rejectedWith(/No organizations have been defined/);
            await identityManagerFactory.create(stubWalletFacadeFactory).should.be.rejectedWith(/No organizations have been defined/);
            await identityManagerFactory.create(stubWalletFacadeFactory, null).should.be.rejectedWith(/No organizations have been defined/);
        });

        it('should throw an error if first organization does not define an mspid', async () => {
            const badOrg = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            delete badOrg.mspid;
            await identityManagerFactory.create(stubWalletFacadeFactory,[badOrg]).should.be.rejectedWith(/No mspid has been defined for the first organization/);
        });

        it('should throw an error if a non default organization does not define an mspid', async () => {
            const badOrg = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            delete badOrg.mspid;
            await identityManagerFactory.create(stubWalletFacadeFactory,[org1MSPWithCertificates, badOrg]).should.be.rejectedWith(/At least 1 organization has not specified the mspid property/);
        });

        it('should throw an error if a non default organization has same mspid as default organization', async () => {
            const badOrg = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            await identityManagerFactory.create(stubWalletFacadeFactory,[org1MSPWithCertificates, badOrg]).should.be.rejectedWith(/More than 1 organization with the same mspid is not allowed/);
        });
    });

    describe('when generating an alias name', () => {
        it('should not prefix for the default organisation', async () => {
            stubInMemoryAndFileSystemWalletFacade.getAllIdentityNames.resolves([]);
            const identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates]);
            identityManager.generateAliasNameFromOrganizationAndIdentityName('Org1MSP', 'admin').should.equal('admin');
        });

        it('should not prefix for when organisation is not provided', async () => {
            const identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates]);
            identityManager.generateAliasNameFromOrganizationAndIdentityName(undefined, 'admin').should.equal('admin');
            identityManager.generateAliasNameFromOrganizationAndIdentityName(null, 'admin').should.equal('admin');
            identityManager.generateAliasNameFromOrganizationAndIdentityName('', 'admin').should.equal('admin');
        });

        it('should prefix for the non default organisation', async () => {
            const anotherorg1MSPWithCertificates = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            anotherorg1MSPWithCertificates.mspid = 'Org2MSP';
            const identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates, anotherorg1MSPWithCertificates]);
            identityManager.generateAliasNameFromOrganizationAndIdentityName('Org2MSP', 'admin').should.equal('_Org2MSP_admin');
        });
    });

    describe('when getting a list of alias names from an organisation', () => {
        beforeEach(() => {
            stubInMemoryAndFileSystemWalletFacade.getAllIdentityNames.resolves(['admin', 'user', '_Org2MSP_admin', '_Org2MSP_issuer']);
        });

        it('should return the correct aliases for the default organisation when explicitly specified', async () => {
            const identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates]);
            await identityManager.getAliasNamesForOrganization('Org1MSP').should.eventually.deep.equal(['admin', 'user']);
        });

        it('should return the correct aliases for the default organisation when not explicitly specified', async () => {
            const identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates]);
            await identityManager.getAliasNamesForOrganization('').should.eventually.deep.equal(['admin', 'user']);
            await identityManager.getAliasNamesForOrganization().should.eventually.deep.equal(['admin', 'user']);
            await identityManager.getAliasNamesForOrganization(null).should.eventually.deep.equal(['admin', 'user']);
            await identityManager.getAliasNamesForOrganization(undefined).should.eventually.deep.equal(['admin', 'user']);
        });

        it('should return the correct aliases for a non default organisation', async () => {
            const identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates]);
            await identityManager.getAliasNamesForOrganization('Org2MSP').should.eventually.deep.equal(['_Org2MSP_admin', '_Org2MSP_issuer']);
        });

        it('should return the an empty array if there are no aliases for the organization', async () => {
            const identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates]);
            await identityManager.getAliasNamesForOrganization('org3MSP').should.eventually.deep.equal([]);
        });
    });

    describe('when processing the explicit certificates in a configuration', () => {
        it('should throw an error if certificates section isn\'t structured correctly', async () => {
            const badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            badOrg1MSP.identities.certificates = {};
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/No valid entries in certificates property for organization Org1MSP/);
        });

        it('should throw an error if name, clientSignCert or clientPrivateKey not specified', async () => {
            let badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            delete badOrg1MSP.identities.certificates[0].name;
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/A valid entry in certificates for organization Org1MSP must have a name, clientSignedCert and clientPrivateKey entry/);

            badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            delete badOrg1MSP.identities.certificates[0].clientSignedCert;
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/A valid entry in certificates for organization Org1MSP must have a name, clientSignedCert and clientPrivateKey entry/);

            badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            delete badOrg1MSP.identities.certificates[0].clientPrivateKey;
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/A valid entry in certificates for organization Org1MSP must have a name, clientSignedCert and clientPrivateKey entry/);
        });

        it('should throw an error if path or pem not specified', async () => {
            let badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            delete badOrg1MSP.identities.certificates[0].clientSignedCert.path;
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/No path or pem property specified for clientSignedCert for name User1 in organization Org1MSP/);

            badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            delete badOrg1MSP.identities.certificates[0].clientPrivateKey.path;
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/No path or pem property specified for clientPrivateKey for name User1 in organization Org1MSP/);
        });

        it('should throw an error if path specified for clientSignCert or clientPrivateKey does not exist', async () => {
            let badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            badOrg1MSP.identities.certificates[0].clientSignedCert.path = '/to/some/known/path/file';
            delete badOrg1MSP.identities.certificates[0].clientPrivateKey.path;
            badOrg1MSP.identities.certificates[0].clientPrivateKey.pem = '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----';
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/path property does not point to a file that exists for clientSignedCert for name User1 in organization Org1MSP/);

            badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            badOrg1MSP.identities.certificates[0].clientPrivateKey.path = '/to/some/known/path/file';
            delete badOrg1MSP.identities.certificates[0].clientSignedCert.path;
            badOrg1MSP.identities.certificates[0].clientSignedCert.pem = '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----';
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/path property does not point to a file that exists for clientPrivateKey for name User1 in organization Org1MSP/);
        });

        it('should throw an error if path specified for clientSignCert or clientPrivateKey does not appear to have valid PEM contents', async () => {
            let badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            delete badOrg1MSP.identities.certificates[0].clientPrivateKey.path;
            badOrg1MSP.identities.certificates[0].clientPrivateKey.pem = '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----';
            badOrg1MSP.identities.certificates[0].clientSignedCert.path = path.resolve(__dirname, '../sample-configs/invalid.yaml');
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/path property does not point to a valid pem file for clientSignedCert for name User1 in organization Org1MSP/);

            badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            delete badOrg1MSP.identities.certificates[0].clientSignedCert.path;
            badOrg1MSP.identities.certificates[0].clientSignedCert.pem = '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----';
            badOrg1MSP.identities.certificates[0].clientPrivateKey.path = path.resolve(__dirname, '../sample-configs/invalid.yaml');
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/path property does not point to a valid pem file for clientPrivateKey for name User1 in organization Org1MSP/);
        });

        it('should throw an error if pem specified for clientSignCert or clientPrivateKey does not appear to have valid PEM contents', async () => {
            const badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            delete badOrg1MSP.identities.certificates[0].clientPrivateKey.path;
            delete badOrg1MSP.identities.certificates[0].clientSignedCert.path;
            badOrg1MSP.identities.certificates[0].clientPrivateKey.pem = '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----';
            badOrg1MSP.identities.certificates[0].clientSignedCert.pem = 'I am not valid';
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/pem property not valid for clientSignedCert for name User1 in organization Org1MSP/);
            badOrg1MSP.identities.certificates[0].clientSignedCert.pem = '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----';
            badOrg1MSP.identities.certificates[0].clientPrivateKey.pem = 'I am not valid';
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/pem property not valid for clientPrivateKey for name User1 in organization Org1MSP/);
        });

        it('should import an identity from a pem which is not base64 encoded', async () => {
            const newOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            const newOrg2MSP = JSON.parse(JSON.stringify(org2MSPWithCertificates));
            delete newOrg1MSP.identities.certificates[0].clientPrivateKey.path;
            delete newOrg1MSP.identities.certificates[0].clientSignedCert.path;
            delete newOrg2MSP.identities.certificates[0].clientPrivateKey.path;
            delete newOrg2MSP.identities.certificates[0].clientSignedCert.path;

            newOrg1MSP.identities.certificates[0].clientPrivateKey.pem = '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----';
            newOrg1MSP.identities.certificates[0].clientSignedCert.pem = '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----';
            newOrg2MSP.identities.certificates[0].clientPrivateKey.pem = '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----';
            newOrg2MSP.identities.certificates[0].clientSignedCert.pem = '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----';

            await identityManagerFactory.create(stubWalletFacadeFactory, [newOrg1MSP, newOrg2MSP]);
            sinon.assert.calledTwice(stubInMemoryAndFileSystemWalletFacade.import);
            sinon.assert.calledWith(stubInMemoryAndFileSystemWalletFacade.import, 'Org1MSP', 'User1', '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----', '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----');
            sinon.assert.calledWith(stubInMemoryAndFileSystemWalletFacade.import, 'Org2MSP', '_Org2MSP_User1', '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----', '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----');
        });

        it('should import an identity from a pem which are base64 encoded', async () => {
            const newOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            const newOrg2MSP = JSON.parse(JSON.stringify(org2MSPWithCertificates));
            delete newOrg1MSP.identities.certificates[0].clientPrivateKey.path;
            delete newOrg1MSP.identities.certificates[0].clientSignedCert.path;
            delete newOrg2MSP.identities.certificates[0].clientPrivateKey.path;
            delete newOrg2MSP.identities.certificates[0].clientSignedCert.path;

            newOrg1MSP.identities.certificates[0].clientPrivateKey.pem = 'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS0=';
            newOrg1MSP.identities.certificates[0].clientSignedCert.pem = 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCi0tLS0tRU5EIENFUlRJRklDQVRFLS0tLS0=';
            newOrg2MSP.identities.certificates[0].clientPrivateKey.pem = 'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS0=';
            newOrg2MSP.identities.certificates[0].clientSignedCert.pem = 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCi0tLS0tRU5EIENFUlRJRklDQVRFLS0tLS0=';

            await identityManagerFactory.create(stubWalletFacadeFactory, [newOrg1MSP, newOrg2MSP]);
            sinon.assert.calledTwice(stubInMemoryAndFileSystemWalletFacade.import);
            sinon.assert.calledWith(stubInMemoryAndFileSystemWalletFacade.import, 'Org1MSP', 'User1', '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----', '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----');
            sinon.assert.calledWith(stubInMemoryAndFileSystemWalletFacade.import, 'Org2MSP', '_Org2MSP_User1', '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----', '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----');
        });

        it('should import an identity from a path', async () => {
            await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates, org2MSPWithCertificates]);
            sinon.assert.calledTwice(stubInMemoryAndFileSystemWalletFacade.import);
            sinon.assert.calledWith(stubInMemoryAndFileSystemWalletFacade.import, 'Org1MSP', 'User1', sinon.match(/^-----BEGIN CERTIFICATE-----.*/),
                sinon.match(/^-----BEGIN PRIVATE KEY-----.*/));
            sinon.assert.calledWith(stubInMemoryAndFileSystemWalletFacade.import, 'Org2MSP', '_Org2MSP_User1', sinon.match(/^-----BEGIN CERTIFICATE-----.*/),
                sinon.match(/^-----BEGIN PRIVATE KEY-----.*/));
        });

        it('should import multiple identities', async () => {
            await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates, org3MSPWithCertificates]);
            sinon.assert.calledThrice(stubInMemoryAndFileSystemWalletFacade.import);
            sinon.assert.calledWith(stubInMemoryAndFileSystemWalletFacade.import, 'Org1MSP', 'User1', sinon.match(/^-----BEGIN CERTIFICATE-----.*/),
                sinon.match(/^-----BEGIN PRIVATE KEY-----.*/));
            sinon.assert.calledWith(stubInMemoryAndFileSystemWalletFacade.import, 'org3MSP', '_org3MSP_User1', sinon.match(/^-----BEGIN CERTIFICATE-----.*/),
                sinon.match(/^-----BEGIN PRIVATE KEY-----.*/));
            sinon.assert.calledWith(stubInMemoryAndFileSystemWalletFacade.import, 'org3MSP', '_org3MSP_User2', sinon.match(/^-----BEGIN CERTIFICATE-----.*/),
                sinon.match(/^-----BEGIN PRIVATE KEY-----.*/));
        });
    });

    describe('when extracting identities from a wallet', () => {
        it('should throw an error when the wallet path does not exist', async () => {
            const badPathToWallet = {
                mspid: 'Org2MSP',
                identities: {
                    wallet: {
                        path: '/some/path/that/does/not/exist'
                    },
                }
            };
            await identityManagerFactory.create(stubWalletFacadeFactory, [badPathToWallet]).should.be.rejectedWith(/path property .* does not point to an existing directory for Org2MSP/);
        });

        it('should throw an error when no path is provided', async () => {
            const noPathToWallet = {
                mspid: 'Org2MSP',
                identities: {
                    wallet: {
                    },
                }
            };
            await identityManagerFactory.create(stubWalletFacadeFactory, [noPathToWallet]).should.be.rejectedWith(/No path to the wallet for Org2MSP was supplied/);
        });

        it('should throw an error when path is not a directory', async () => {
            const badPathToWallet = {
                mspid: 'Org2MSP',
                identities: {
                    wallet: {
                        path: __filename
                    },
                }
            };
            await identityManagerFactory.create(stubWalletFacadeFactory, [badPathToWallet]).should.be.rejectedWith(/path property .* does not point to a directory for Org2MSP/);
        });

        it('when no identities available should not add anything to wallet', async () => {
            stubInMemoryAndFileSystemWalletFacade.getAllIdentityNames.resolves([]);

            const identityManagerFactory = new IdentityManagerFactory();
            await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithWallet]);

            sinon.assert.notCalled(stubInMemoryAndFileSystemWalletFacade.import);
        });

        it('should import a single identity to the memory wallet', async() => {
            stubInMemoryAndFileSystemWalletFacade.getAllIdentityNames.resolves(['User1']);
            const identityManagerFactory = new IdentityManagerFactory();

            const testIdentity = {
                mspid : 'Org1MSP',
                certificate : '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----',
                privateKey : '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----',
            };
            stubInMemoryAndFileSystemWalletFacade.export.resolves(testIdentity);

            await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithWallet]);

            sinon.assert.calledOnce(stubInMemoryAndFileSystemWalletFacade.import);
            sinon.assert.calledWith(stubInMemoryAndFileSystemWalletFacade.import, 'Org1MSP', 'User1', '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----', '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----');
        });

        it('should import all identities in the wallet for the same organization', async() => {
            stubInMemoryAndFileSystemWalletFacade.getAllIdentityNames.resolves(['User1', 'User2']);
            const identityManagerFactory = new IdentityManagerFactory();

            const testIdentityUser1 = {
                mspid : 'Org1MSP',
                certificate : '-----BEGIN CERTIFICATE-----User1\n-----END CERTIFICATE-----',
                privateKey : '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----',
            };
            const testIdentityUser2 = {
                mspid : 'Org1MSP',
                certificate : '-----BEGIN CERTIFICATE-----User2\n-----END CERTIFICATE-----',
                privateKey : '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----',
            };
            stubInMemoryAndFileSystemWalletFacade.export.withArgs('User1').resolves(testIdentityUser1);
            stubInMemoryAndFileSystemWalletFacade.export.withArgs('User2').resolves(testIdentityUser2);

            await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithWallet]);

            sinon.assert.calledTwice(stubInMemoryAndFileSystemWalletFacade.import);
            sinon.assert.calledWith(stubInMemoryAndFileSystemWalletFacade.import, 'Org1MSP', 'User1', '-----BEGIN CERTIFICATE-----User1\n-----END CERTIFICATE-----', '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----');
            sinon.assert.calledWith(stubInMemoryAndFileSystemWalletFacade.import, 'Org1MSP', 'User2', '-----BEGIN CERTIFICATE-----User2\n-----END CERTIFICATE-----', '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----');
        });

        it('should add a multiple identities to the memory wallet for multiple organizations from different wallets', async() => {
            const stubMultiWalletFacadeFactory = sinon.createStubInstance(IWalletFacadeFactory);
            const stubInMemoryWalletFacade = sinon.createStubInstance(IWalletFacade);
            const stubFileWalletFacadeOrg1 = sinon.createStubInstance(IWalletFacade);
            const stubFileWalletFacadeOrg2 = sinon.createStubInstance(IWalletFacade);
            stubMultiWalletFacadeFactory.create.withArgs().resolves(stubInMemoryWalletFacade);
            stubMultiWalletFacadeFactory.create.withArgs(sinon.match.string).onCall(0).resolves(stubFileWalletFacadeOrg1);
            stubMultiWalletFacadeFactory.create.withArgs(sinon.match.string).onCall(1).resolves(stubFileWalletFacadeOrg2);
            stubFileWalletFacadeOrg1.getAllIdentityNames.resolves(['User1']);
            stubFileWalletFacadeOrg2.getAllIdentityNames.resolves(['User2']);

            const identityManagerFactory = new IdentityManagerFactory();

            const testIdentityUser1 = {
                mspid : 'Org1MSP',
                certificate : '-----BEGIN CERTIFICATE-----User1\n-----END CERTIFICATE-----',
                privateKey : '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----',
            };
            const testIdentityUser2 = {
                mspid : 'Org2MSP',
                certificate : '-----BEGIN CERTIFICATE-----User2\n-----END CERTIFICATE-----',
                privateKey : '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----',
            };
            stubFileWalletFacadeOrg1.export.withArgs('User1').resolves(testIdentityUser1);
            stubFileWalletFacadeOrg2.export.withArgs('User2').resolves(testIdentityUser2);

            await identityManagerFactory.create(stubMultiWalletFacadeFactory, [org1MSPWithWallet, org2MSPWithWallet]);

            sinon.assert.calledTwice(stubInMemoryWalletFacade.import);
            sinon.assert.calledWith(stubInMemoryWalletFacade.import, 'Org1MSP', 'User1', '-----BEGIN CERTIFICATE-----User1\n-----END CERTIFICATE-----', '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----');
            sinon.assert.calledWith(stubInMemoryWalletFacade.import, 'Org2MSP', '_Org2MSP_User2', '-----BEGIN CERTIFICATE-----User2\n-----END CERTIFICATE-----', '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----');
        });

        it('should add a multiple identities to the memory wallet for multiple organizations from the same wallet', async() => {
            const stubMultiWalletFacadeFactory = sinon.createStubInstance(IWalletFacadeFactory);
            const stubInMemoryWalletFacade = sinon.createStubInstance(IWalletFacade);
            const stubFileWalletFacade = sinon.createStubInstance(IWalletFacade);
            stubMultiWalletFacadeFactory.create.withArgs().resolves(stubInMemoryWalletFacade);
            stubMultiWalletFacadeFactory.create.withArgs(sinon.match.string).resolves(stubFileWalletFacade);
            stubFileWalletFacade.getAllIdentityNames.resolves(['User1', 'User2']);

            const identityManagerFactory = new IdentityManagerFactory();

            const testIdentityUser1 = {
                mspid : 'Org1MSP',
                certificate : '-----BEGIN CERTIFICATE-----User1\n-----END CERTIFICATE-----',
                privateKey : '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----',
            };
            const testIdentityUser2 = {
                mspid : 'Org2MSP',
                certificate : '-----BEGIN CERTIFICATE-----User2\n-----END CERTIFICATE-----',
                privateKey : '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----',
            };
            stubFileWalletFacade.export.withArgs('User1').resolves(testIdentityUser1);
            stubFileWalletFacade.export.withArgs('User2').resolves(testIdentityUser2);

            await identityManagerFactory.create(stubMultiWalletFacadeFactory, [org1MSPWithWallet, org2MSPWithWallet]);

            sinon.assert.calledTwice(stubInMemoryWalletFacade.import);
            sinon.assert.calledWith(stubInMemoryWalletFacade.import, 'Org1MSP', 'User1', '-----BEGIN CERTIFICATE-----User1\n-----END CERTIFICATE-----', '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----');
            sinon.assert.calledWith(stubInMemoryWalletFacade.import, 'Org2MSP', '_Org2MSP_User2', '-----BEGIN CERTIFICATE-----User2\n-----END CERTIFICATE-----', '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----');
        });
    });

    describe('when working with identities from different sources', () => {
        it('should create a wallet from all different sources', async () => {
            stubInMemoryAndFileSystemWalletFacade.getAllIdentityNames.resolves(['User2']);
            stubInMemoryAndFileSystemWalletFacade.import.withArgs('Org1MSP', 'User1', sinon.match.string, sinon.match.string).onCall(1).throws(new Error('User1 already exists'));

            const identityManagerFactory = new IdentityManagerFactory();

            const testIdentity = {
                mspid : 'Org1MSP',
                certificate : '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----',
                privateKey : '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----',
            };
            stubInMemoryAndFileSystemWalletFacade.export.resolves(testIdentity);

            await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificatesAndWallet]);
            sinon.assert.calledTwice(stubInMemoryAndFileSystemWalletFacade.import);
            sinon.assert.calledWith(stubInMemoryAndFileSystemWalletFacade.import, 'Org1MSP', 'User1', sinon.match.string, sinon.match.string);
            sinon.assert.calledWith(stubInMemoryAndFileSystemWalletFacade.import, 'Org1MSP', 'User2', sinon.match.string, sinon.match.string);
        });

        it('should throw an error if 2 identities from 2 different sources have the same name in the same organization', async () => {
            stubInMemoryAndFileSystemWalletFacade.getAllIdentityNames.resolves(['User1']);
            stubInMemoryAndFileSystemWalletFacade.import.withArgs('Org1MSP', 'User1', sinon.match.string, sinon.match.string).onCall(1).throws(new Error('User1 already exists'));

            const identityManagerFactory = new IdentityManagerFactory();

            const testIdentity = {
                mspid : 'Org1MSP',
                certificate : '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----',
                privateKey : '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----',
            };
            stubInMemoryAndFileSystemWalletFacade.export.resolves(testIdentity);

            await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificatesAndWallet])
                .should.be.rejectedWith(/User1 has been declared in more than 1 place within organization Org1MSP/);
        });
    });

    describe('when getting a list of admin alias names from an organisation', () => {
        it('should return an empty list if no admins are defined', async () => {
            stubInMemoryAndFileSystemWalletFacade.getAllIdentityNames.resolves(['User1']);
            const identityManagerFactory = new IdentityManagerFactory();

            const testIdentity = {
                mspid : 'Org1MSP',
                certificate : '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----',
                privateKey : '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----',
            };
            stubInMemoryAndFileSystemWalletFacade.export.resolves(testIdentity);

            let identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithWallet]);
            identityManager.getAdminAliasNamesForOrganization().should.deep.equal([]);
            identityManager.getAdminAliasNamesForOrganization('Org1MSP').should.deep.equal([]);

            identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org2MSPWithCertificates]);
            identityManager.getAdminAliasNamesForOrganization('Org2MSP').should.deep.equal([]);

            identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithWallet, org2MSPWithCertificates]);
            identityManager.getAdminAliasNamesForOrganization('Org1MSP').should.deep.equal([]);
            identityManager.getAdminAliasNamesForOrganization('Org2MSP').should.deep.equal([]);
        });

        it('should return the correct aliases for defined admins', async () => {
            stubInMemoryAndFileSystemWalletFacade.getAllIdentityNames.resolves(['User1', 'admin']);
            const identityManagerFactory = new IdentityManagerFactory();

            const testIdentity = {
                mspid : 'Org2MSP',
                certificate : '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----',
                privateKey : '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----',
            };
            stubInMemoryAndFileSystemWalletFacade.export.resolves(testIdentity);

            let identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithAdminandUserCertificates]);
            identityManager.getAdminAliasNamesForOrganization('Org1MSP').should.deep.equal(['Org1Admin']);
            identityManager.getAdminAliasNamesForOrganization('').should.deep.equal(['Org1Admin']);
            identityManager.getAdminAliasNamesForOrganization().should.deep.equal(['Org1Admin']);

            identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org2MSPWithWalletAndAdminNames]);
            identityManager.getAdminAliasNamesForOrganization('Org2MSP').should.deep.equal(['admin']);

            identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithAdminandUserCertificates, org2MSPWithWalletAndAdminNames]);
            identityManager.getAdminAliasNamesForOrganization('Org1MSP').should.deep.equal(['Org1Admin']);
            identityManager.getAdminAliasNamesForOrganization('Org2MSP').should.deep.equal(['_Org2MSP_admin']);
        });
    });

    describe('when getting the in memory wallet that contains all identities', () => {
        it('should return the in memory node-sdk version specific wallet when requested', async () => {
            stubInMemoryAndFileSystemWalletFacade.getWallet.returns('IamAwallet');
            const identityManagerFactory = new IdentityManagerFactory();
            const identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates, org2MSPWithCertificates]);
            await identityManager.getWallet().should.equal('IamAwallet');
        });

        it('should return the in memory wallet facade when requested', async () => {
            const identityManagerFactory = new IdentityManagerFactory();
            const identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates, org2MSPWithCertificates]);
            await identityManager.getWalletFacade().should.equal(stubInMemoryAndFileSystemWalletFacade);
        });
    });
});
