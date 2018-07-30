/**
 * Modifications Copyright 2017 HUAWEI
 * Copyright 2016 IBM,HUAWEI All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

'use strict';

const path = require('path');
const fs = require('fs-extra');
//const os = require('os');
const util = require('util');

//const jsrsa = require('jsrsasign');
//const KEYUTIL = jsrsa.KEYUTIL;

const Client = require('fabric-client');
const copService = require('fabric-ca-client/lib/FabricCAClientImpl.js');
const User = require('fabric-client/lib/User.js');
//const CryptoSuite = require('fabric-client/lib/impl/CryptoSuite_ECDSA_AES.js');
//const KeyStore = require('fabric-client/lib/impl/CryptoKeyStore.js');
//const ecdsaKey = require('fabric-client/lib/impl/ecdsa/key.js');
const Constants = require('./constant.js');
const commUtils = require('../comm/util');

//const logger = require('fabric-client/lib/utils.js').getLogger('TestUtil');

let channels = [];
let cryptodir;
let ORGS;

module.exports.getChannel = function(name) {
    for(let i in channels) {
        if(channels[i].name === name) {
            return channels[i];
        }
    }
    return null;
};

module.exports.getDefaultChannel = function() {
    return channels[0];
};

// all temporary files and directories are created under here
const tempdir = Constants.tempdir;

module.exports.getTempDir = function() {
    fs.ensureDirSync(tempdir);
    return tempdir;
};

// directory for file based KeyValueStore
module.exports.KVS = path.join(tempdir, 'hfc-test-kvs');
module.exports.storePathForOrg = function(org) {
    return module.exports.KVS + '_' + org;
};

// temporarily set $GOPATH to the test fixture folder unless specified otherwise
module.exports.setupChaincodeDeploy = function() {
    if (typeof process.env.OVERWRITE_GOPATH === 'undefined' ||
        process.env.OVERWRITE_GOPATH.toString().toUpperCase() === 'TRUE') {
        process.env.GOPATH = commUtils.resolvePath('.');
    }
};

// specifically set the values to defaults because they may have been overridden when
// running in the overall test bucket ('gulp test')
module.exports.resetDefaults = function() {
    global.hfc.config = undefined;
    require('nconf').reset();
};

module.exports.cleanupDir = function(keyValStorePath) {
    const absPath = path.join(process.cwd(), keyValStorePath);
    const exists = module.exports.existsSync(absPath);
    if (exists) {
        fs.removeSync(absPath);
    }
};

module.exports.getUniqueVersion = function(prefix) {
    if (!prefix) {prefix = 'v';}
    return prefix + Date.now();
};

// utility function to check if directory or file exists
// uses entire / absolute path from root
module.exports.existsSync = function(absolutePath /*string*/) {
    try  {
        const stat = fs.statSync(absolutePath);
        return stat.isDirectory() || stat.isFile();
    }
    catch (e) {
        return false;
    }
};

/**
 * Read the content of the given file.
 * @param {string} path The path of the file.
 * @return {Promise<object>} The raw content of the file.
 */
function readFile(path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, (err, data) => {
            if (err)
            {reject(new Error('Failed to read file ' + path + ' due to error: ' + err));}
            else
            {resolve(data);}
        });
    });
}

/**
 * Read all file contents in the given directory.
 * @param {string} dir The path of the directory.
 * @return {object[]} The collection of raw file contents.
 */
function readAllFiles(dir) {
    const files = fs.readdirSync(dir);
    const certs = [];
    files.forEach((file_name) => {
        let file_path = path.join(dir,file_name);
        let data = fs.readFileSync(file_path);
        certs.push(data);
    });
    return certs;
}

module.exports.readFile = readFile;

module.exports.init = function(config_path) {
    Client.addConfigFile(config_path);
    const fa = Client.getConfigSetting('fabric');
    ORGS = fa.network;
    channels = fa.channel;
    cryptodir = commUtils.resolvePath(fa.cryptodir);
};

const tlsOptions = {
    trustedRoots: [],
    verify: false
};

/**
 * Retrieve an enrolled user, or enroll the user if necessary.
 * @param {string} username The name of the user.
 * @param {string} password The enrollment secret necessary to enroll the user.
 * @param {Client} client The Fabric client object.
 * @param {string} userOrg The name of the user's organization.
 * @return {Promise<User>} The retrieved and enrolled user object.
 */
function getMember(username, password, client, userOrg) {
    const caUrl = ORGS[userOrg].ca.url;

    return client.getUserContext(username, true)
        .then((user) => {
            return new Promise((resolve, reject) => {
                if (user && user.isEnrolled()) {
                    return resolve(user);
                }

                const member = new User(username);
                let cryptoSuite = client.getCryptoSuite();
                if (!cryptoSuite) {
                    cryptoSuite = Client.newCryptoSuite();
                    if (userOrg) {
                        cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: module.exports.storePathForOrg(ORGS[userOrg].name)}));
                        client.setCryptoSuite(cryptoSuite);
                    }
                }
                member.setCryptoSuite(cryptoSuite);

                // need to enroll it with CA server
                const cop = new copService(caUrl, tlsOptions, ORGS[userOrg].ca.name, cryptoSuite);

                return cop.enroll({
                    enrollmentID: username,
                    enrollmentSecret: password
                }).then((enrollment) => {
                    return member.setEnrollment(enrollment.key, enrollment.certificate, ORGS[userOrg].mspid);
                }).then(() => {
                    let skipPersistence = false;
                    if (!client.getStateStore()) {
                        skipPersistence = true;
                    }
                    return client.setUserContext(member, skipPersistence);
                }).then(() => {
                    return resolve(member);
                }).catch((err) => {
                    // TODO: will remove t argument later
                    commUtils.log('Failed to enroll and persist user. Error: ' + (err.stack ? err.stack : err));
                });
            });
        });
}

/**
 * Retrieve the admin identity for the given organization.
 * @param {Client} client The Fabric client object.
 * @param {string} userOrg The name of the user's organization.
 * @return {User} The admin user identity.
 */
function getAdmin(client, userOrg) {
    try {
        if(!ORGS.hasOwnProperty(userOrg)) {
            throw new Error('Could not found ' + userOrg + ' in configuration');
        }
        const org = ORGS[userOrg];
        let keyPEM, certPEM;
        if(org.user) {
            keyPEM = fs.readFileSync(commUtils.resolvePath(org.user.key));
            certPEM = fs.readFileSync(commUtils.resolvePath(org.user.cert));
        }
        else {
            let domain = org.domain ? org.domain : (userOrg + '.example.com');
            // crypto-dir is already an absolute path
            let basePath = path.join(cryptodir, 'peerOrganizations', domain, 'users', util.format('Admin@%s', domain));

            let keyPath = path.join(basePath, 'keystore');
            if(!fs.existsSync(keyPath)) {
                keyPath = path.join(basePath, 'msp', 'keystore');
            }
            keyPEM = readAllFiles(keyPath)[0];

            let certPath = path.join(basePath, 'signcerts');
            if(!fs.existsSync(certPath)) {
                certPath = path.join(basePath, 'msp', 'signcerts');
            }
            certPEM = readAllFiles(certPath)[0];
        }

        const cryptoSuite = Client.newCryptoSuite();
        cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: module.exports.storePathForOrg(ORGS[userOrg].name)}));
        client.setCryptoSuite(cryptoSuite);

        return Promise.resolve(client.createUser({
            username: 'peer'+userOrg+'Admin',
            mspid: org.mspid,
            cryptoContent: {
                privateKeyPEM: keyPEM.toString(),
                signedCertPEM: certPEM.toString()
            }
        }));
    }
    catch(err) {
        return Promise.reject(err);
    }
}

/**
 * Retrieve the admin identity of the orderer service organization.
 * @param {Client} client The Fabric client object.
 * @return {User} The retrieved orderer admin identity.
 */
function getOrdererAdmin(client) {
    try {
        if(!ORGS.orderer) {
            throw new Error('Could not found orderer in configuration');
        }

        const orderer = ORGS.orderer;
        let keyPEM, certPEM;
        if(orderer.user) {
            keyPEM = fs.readFileSync(commUtils.resolvePath(orderer.user.key));
            certPEM = fs.readFileSync(commUtils.resolvePath(orderer.user.cert));
        }
        else {
            let domain = orderer.domain ? orderer.domain : 'example.com';
            // crypto-dir is already an absolute path
            let basePath = path.join(cryptodir, 'ordererOrganizations', domain, 'users', util.format('Admin@%s', domain));

            let keyPath = path.join(basePath, 'keystore');
            if(!fs.existsSync(keyPath)) {
                keyPath = path.join(basePath, 'msp', 'keystore');
            }
            keyPEM = readAllFiles(keyPath)[0];
            let certPath = path.join(basePath, 'signcerts');
            if(!fs.existsSync(certPath)) {
                certPath = path.join(basePath, 'msp', 'signcerts');
            }
            certPEM = readAllFiles(certPath)[0];
        }

        return Promise.resolve(client.createUser({
            username: 'ordererAdmin',
            mspid: orderer.mspid,
            cryptoContent: {
                privateKeyPEM: keyPEM.toString(),
                signedCertPEM: certPEM.toString()
            }
        }));
    }
    catch(err) {
        return Promise.reject(err);
    }
}



module.exports.getOrderAdminSubmitter = function(client) {
    return getOrdererAdmin(client);
};

module.exports.getSubmitter = function(client, peerOrgAdmin, org) {
    if (arguments.length < 2) {throw new Error('"client" and "test" are both required parameters');}

    let peerAdmin, userOrg;
    if (typeof peerOrgAdmin === 'boolean') {
        peerAdmin = peerOrgAdmin;
    } else {
        peerAdmin = false;
    }

    // if the 3rd argument was skipped
    if (typeof peerOrgAdmin === 'string') {
        userOrg = peerOrgAdmin;
    } else {
        if (typeof org === 'string') {
            userOrg = org;
        } else {
            userOrg = 'org1';
        }
    }

    if (peerAdmin) {
        return getAdmin(client, userOrg);
    } else {
        return getMember('admin', 'adminpw', client, userOrg);
    }
};
