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

const org1MSPWithWallet = {
    mspid: 'Org1MSP',
    identities: {
        wallet: {
            path: 'some/path/to/org-specific-wallet'
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

    describe('When being created by it\'s factory', () => {
        const stubWalletFacadeFactory = sinon.createStubInstance(IWalletFacadeFactory);
        const stubWalletFacade = sinon.createStubInstance(IWalletFacade);
        stubWalletFacadeFactory.create.resolves(stubWalletFacade);

        it('should return an Identity Manager instance if an array of valid organizations are supplied', async () => {
            const identityManagerFactory = new IdentityManagerFactory();
            const stubWalletFacade = sinon.createStubInstance(IWalletFacade);
            stubWalletFacadeFactory.create.resolves(stubWalletFacade);
            stubWalletFacade.getAllIdentityNames.resolves([]);
            const identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates]);
            identityManager.should.be.instanceOf(IdentityManager);
        });

        it('should throw an error if no organizations are provided', async () => {
            const identityManagerFactory = new IdentityManagerFactory();
            await identityManagerFactory.create(stubWalletFacadeFactory,[]).should.be.rejectedWith(/No organizations have been defined/);
            await identityManagerFactory.create(stubWalletFacadeFactory).should.be.rejectedWith(/No organizations have been defined/);
            await identityManagerFactory.create(stubWalletFacadeFactory, null).should.be.rejectedWith(/No organizations have been defined/);
        });

        it('should throw an error if first organization does not define an mspid', async () => {
            const identityManagerFactory = new IdentityManagerFactory();
            const badOrg = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            delete badOrg.mspid;
            await identityManagerFactory.create(stubWalletFacadeFactory,[badOrg]).should.be.rejectedWith(/No mspid has been defined for the first organization/);
        });

        it('should throw an error if a non default organization does not define an mspid', async () => {
            const identityManagerFactory = new IdentityManagerFactory();
            const badOrg = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            delete badOrg.mspid;
            await identityManagerFactory.create(stubWalletFacadeFactory,[org1MSPWithCertificates, badOrg]).should.be.rejectedWith(/At least 1 organization has not specified the mspid property/);
        });

        it('should throw an error if a non default organization has same mspid as default organization', async () => {
            const identityManagerFactory = new IdentityManagerFactory();
            const badOrg = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            await identityManagerFactory.create(stubWalletFacadeFactory,[org1MSPWithCertificates, badOrg]).should.be.rejectedWith(/More than 1 organization with the same mspid is not allowed/);
        });
    });

    describe('when generating an alias name', () => {
        const stubWalletFacadeFactory = sinon.createStubInstance(IWalletFacadeFactory);
        const stubWalletFacade = sinon.createStubInstance(IWalletFacade);
        stubWalletFacadeFactory.create.resolves(stubWalletFacade);

        it('should not prefix for the default organisation', async () => {
            const identityManagerFactory = new IdentityManagerFactory();
            const stubWalletFacade = sinon.createStubInstance(IWalletFacade);
            stubWalletFacadeFactory.create.resolves(stubWalletFacade);
            stubWalletFacade.getAllIdentityNames.resolves([]);
            const identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates]);
            identityManager.getAliasNameFromOrganizationAndIdentityName('Org1MSP', 'admin').should.equal('admin');
        });

        it('should not prefix for when organisation is not provided', async () => {
            const identityManagerFactory = new IdentityManagerFactory();
            const identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates]);
            identityManager.getAliasNameFromOrganizationAndIdentityName(undefined, 'admin').should.equal('admin');
            identityManager.getAliasNameFromOrganizationAndIdentityName(null, 'admin').should.equal('admin');
            identityManager.getAliasNameFromOrganizationAndIdentityName('', 'admin').should.equal('admin');
        });


        it('should prefix for the non default organisation', async () => {
            const identityManagerFactory = new IdentityManagerFactory();
            const anotherorg1MSPWithCertificates = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            anotherorg1MSPWithCertificates.mspid = 'Org2MSP';
            const identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates, anotherorg1MSPWithCertificates]);
            identityManager.getAliasNameFromOrganizationAndIdentityName('Org2MSP', 'admin').should.equal('_Org2MSP_admin');
        });
    });

    describe('when getting a list of alias names from an organisation', () => {
        const stubWalletFacadeFactory = sinon.createStubInstance(IWalletFacadeFactory);
        const stubWalletFacade = sinon.createStubInstance(IWalletFacade);
        stubWalletFacadeFactory.create.resolves(stubWalletFacade);
        stubWalletFacade.getAllIdentityNames.resolves(['admin', 'user', '_Org2MSP_admin', '_Org2MSP_issuer']);

        it('should return the correct aliases for the default organisation', async () => {
            const identityManagerFactory = new IdentityManagerFactory();
            const identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates]);
            await identityManager.getAliasNamesForOrganization('Org1MSP').should.eventually.deep.equal(['admin', 'user']);
        });

        it('should return the correct aliases for a non default organisation', async () => {
            const identityManagerFactory = new IdentityManagerFactory();
            const identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates]);
            await identityManager.getAliasNamesForOrganization('Org2MSP').should.eventually.deep.equal(['_Org2MSP_admin', '_Org2MSP_issuer']);
        });

        it('should return the an empty array if there are no aliases for the organization', async () => {
            const identityManagerFactory = new IdentityManagerFactory();
            const identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates]);
            await identityManager.getAliasNamesForOrganization('org3MSP').should.eventually.deep.equal([]);
        });
    });

    describe('when processing the explicit certificates in a configuration', () => {
        const stubWalletFacadeFactory = sinon.createStubInstance(IWalletFacadeFactory);
        const identityManagerFactory = new IdentityManagerFactory();
        let stubWalletFacade;

        beforeEach(() => {
            stubWalletFacade = sinon.createStubInstance(IWalletFacade);
            stubWalletFacadeFactory.create.resolves(stubWalletFacade);
        });

        it('should throw an error if certificates section isn\'t an array', async () => {
            const badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            badOrg1MSP.identities.certificates = {};
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/certificates property must be an array/);
        });

        it('should throw an error if name, clientSignCert or clientPrivateKey not specified', async () => {
            let badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            delete badOrg1MSP.identities.certificates[0].name;
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/A valid entry in certificates must have an name, clientSignedCert and clientPrivateKey entry/);

            badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            delete badOrg1MSP.identities.certificates[0].clientSignedCert;
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/A valid entry in certificates must have an name, clientSignedCert and clientPrivateKey entry/);

            badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            delete badOrg1MSP.identities.certificates[0].clientPrivateKey;
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/A valid entry in certificates must have an name, clientSignedCert and clientPrivateKey entry/);
        });

        it('should throw an error if path or pem not specified', async () => {
            let badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            delete badOrg1MSP.identities.certificates[0].clientSignedCert.path;
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/No path or pem property specified for clientSignedCert for name User1/);

            badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            delete badOrg1MSP.identities.certificates[0].clientPrivateKey.path;
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/No path or pem property specified for clientPrivateKey for name User1/);
        });

        it('should throw an error if path specified for clientSignCert or clientPrivateKey does not exist', async () => {
            let badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            badOrg1MSP.identities.certificates[0].clientSignedCert.path = '/to/some/known/path/file';
            delete badOrg1MSP.identities.certificates[0].clientPrivateKey.path;
            badOrg1MSP.identities.certificates[0].clientPrivateKey.pem = '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----';
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/path property does not point to a file that exists for clientSignedCert for name User1/);

            badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            badOrg1MSP.identities.certificates[0].clientPrivateKey.path = '/to/some/known/path/file';
            delete badOrg1MSP.identities.certificates[0].clientSignedCert.path;
            badOrg1MSP.identities.certificates[0].clientSignedCert.pem = '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----';
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/path property does not point to a file that exists for clientPrivateKey for name User1/);
        });

        it('should throw an error if path specified for clientSignCert or clientPrivateKey does not appear to have valid PEM contents', async () => {
            let badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            delete badOrg1MSP.identities.certificates[0].clientPrivateKey.path;
            badOrg1MSP.identities.certificates[0].clientPrivateKey.pem = '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----';
            badOrg1MSP.identities.certificates[0].clientSignedCert.path = path.resolve(__dirname, '../sample-configs/invalid.yaml');
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/path property does not point to a valid pem file for clientSignedCert for name User1/);

            badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            delete badOrg1MSP.identities.certificates[0].clientSignedCert.path;
            badOrg1MSP.identities.certificates[0].clientSignedCert.pem = '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----';
            badOrg1MSP.identities.certificates[0].clientPrivateKey.path = path.resolve(__dirname, '../sample-configs/invalid.yaml');
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/path property does not point to a valid pem file for clientPrivateKey for name User1/);
        });

        it('should throw an error if pem specified for clientSignCert or clientPrivateKey does not appear to have valid PEM contents', async () => {
            const badOrg1MSP = JSON.parse(JSON.stringify(org1MSPWithCertificates));
            delete badOrg1MSP.identities.certificates[0].clientPrivateKey.path;
            delete badOrg1MSP.identities.certificates[0].clientSignedCert.path;
            badOrg1MSP.identities.certificates[0].clientPrivateKey.pem = '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----';
            badOrg1MSP.identities.certificates[0].clientSignedCert.pem = 'I am not valid';
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/pem property not valid for clientSignedCert for name User1/);
            badOrg1MSP.identities.certificates[0].clientSignedCert.pem = '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----';
            badOrg1MSP.identities.certificates[0].clientPrivateKey.pem = 'I am not valid';
            await identityManagerFactory.create(stubWalletFacadeFactory, [badOrg1MSP]).should.be.rejectedWith(/pem property not valid for clientPrivateKey for name User1/);
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
            sinon.assert.calledTwice(stubWalletFacade.import);
            sinon.assert.calledWith(stubWalletFacade.import, 'Org1MSP', 'User1', '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----', '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----');
            sinon.assert.calledWith(stubWalletFacade.import, 'Org2MSP', '_Org2MSP_User1', '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----', '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----');
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
            sinon.assert.calledTwice(stubWalletFacade.import);
            sinon.assert.calledWith(stubWalletFacade.import, 'Org1MSP', 'User1', '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----', '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----');
            sinon.assert.calledWith(stubWalletFacade.import, 'Org2MSP', '_Org2MSP_User1', '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----', '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----');
        });

        it('should import an identity from a path', async () => {
            await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates, org2MSPWithCertificates]);
            sinon.assert.calledTwice(stubWalletFacade.import);
            sinon.assert.calledWith(stubWalletFacade.import, 'Org1MSP', 'User1', sinon.match(/^-----BEGIN CERTIFICATE-----.*/),
                sinon.match(/^-----BEGIN PRIVATE KEY-----.*/));
            sinon.assert.calledWith(stubWalletFacade.import, 'Org2MSP', '_Org2MSP_User1', sinon.match(/^-----BEGIN CERTIFICATE-----.*/),
                sinon.match(/^-----BEGIN PRIVATE KEY-----.*/));
        });

        it('should import multiple identities', async () => {
            await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates, org3MSPWithCertificates]);
            sinon.assert.calledThrice(stubWalletFacade.import);
            sinon.assert.calledWith(stubWalletFacade.import, 'Org1MSP', 'User1', sinon.match(/^-----BEGIN CERTIFICATE-----.*/),
                sinon.match(/^-----BEGIN PRIVATE KEY-----.*/));
            sinon.assert.calledWith(stubWalletFacade.import, 'org3MSP', '_org3MSP_User1', sinon.match(/^-----BEGIN CERTIFICATE-----.*/),
                sinon.match(/^-----BEGIN PRIVATE KEY-----.*/));
            sinon.assert.calledWith(stubWalletFacade.import, 'org3MSP', '_org3MSP_User2', sinon.match(/^-----BEGIN CERTIFICATE-----.*/),
                sinon.match(/^-----BEGIN PRIVATE KEY-----.*/));
        });
    });

    it('should return a wallet when requested', async () => {
        const stubWalletFacadeFactory = sinon.createStubInstance(IWalletFacadeFactory);
        const stubWalletFacade = sinon.createStubInstance(IWalletFacade);
        stubWalletFacadeFactory.create.resolves(stubWalletFacade);
        stubWalletFacade.getWallet.returns('IamAwallet');
        const identityManagerFactory = new IdentityManagerFactory();
        const identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithCertificates, org2MSPWithCertificates]);
        await identityManager.getWallet().should.equal('IamAwallet');
    });

    describe('when extracting identities from a specific wallet and store in the in memory wallet', () => {

        it('if no identities available should not add anything to wallet', async () => {
            const stubWalletFacadeFactory = sinon.createStubInstance(IWalletFacadeFactory);
            const stubWalletFacade = sinon.createStubInstance(IWalletFacade);
            stubWalletFacadeFactory.create.resolves(stubWalletFacade);
            stubWalletFacade.getAllIdentityNames.resolves([]);
            const identityManagerFactory = new IdentityManagerFactory();

            const identityManager = await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithWallet]);
            await identityManager._extractIdentitiesFromWallet(org1MSPWithWallet, stubWalletFacade);

            sinon.assert.notCalled(stubWalletFacade.import);
        });

        it('should add a single identity to the memory wallet', async() => {
            const stubWalletFacadeFactory = sinon.createStubInstance(IWalletFacadeFactory);
            const stubWalletFacade = sinon.createStubInstance(IWalletFacade);
            stubWalletFacadeFactory.create.resolves(stubWalletFacade);
            stubWalletFacade.getAllIdentityNames.resolves(['User1']);
            const identityManagerFactory = new IdentityManagerFactory();

            const testIdentity = {
                mspid : 'Org1MSP',
                certificate : '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----',
                privateKey : '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----',
            };
            stubWalletFacade.export.resolves(testIdentity);

            await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithWallet]);

            sinon.assert.calledOnce(stubWalletFacade.import);
            sinon.assert.calledWith(stubWalletFacade.import, 'Org1MSP', 'User1', '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----', '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----');
        });

        it('should add a multiple identities to the memory wallet', async() => {
            const stubWalletFacadeFactory = sinon.createStubInstance(IWalletFacadeFactory);
            const stubWalletFacade = sinon.createStubInstance(IWalletFacade);
            stubWalletFacadeFactory.create.resolves(stubWalletFacade);
            stubWalletFacade.getAllIdentityNames.resolves(['User1', 'User2']);
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
            stubWalletFacade.export.withArgs('User1').resolves(testIdentityUser1);
            stubWalletFacade.export.withArgs('User2').resolves(testIdentityUser2);

            await identityManagerFactory.create(stubWalletFacadeFactory, [org1MSPWithWallet]);

            sinon.assert.calledTwice(stubWalletFacade.import);
            sinon.assert.calledWith(stubWalletFacade.import, 'Org1MSP', 'User1', '-----BEGIN CERTIFICATE-----User1\n-----END CERTIFICATE-----', '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----');
            sinon.assert.calledWith(stubWalletFacade.import, 'Org1MSP', 'User2', '-----BEGIN CERTIFICATE-----User2\n-----END CERTIFICATE-----', '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----');
        });
    });
});
