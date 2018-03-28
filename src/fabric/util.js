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

var path = require('path');
var fs = require('fs-extra');
var os = require('os');
var util = require('util');

var jsrsa = require('jsrsasign');
var KEYUTIL = jsrsa.KEYUTIL;

var Client = require('fabric-client');
var copService = require('fabric-ca-client/lib/FabricCAClientImpl.js');
var User = require('fabric-client/lib/User.js');
var CryptoSuite = require('fabric-client/lib/impl/CryptoSuite_ECDSA_AES.js');
var KeyStore = require('fabric-client/lib/impl/CryptoKeyStore.js');
var ecdsaKey = require('fabric-client/lib/impl/ecdsa/key.js');
var Constants = require('./constant.js');

var logger = require('fabric-client/lib/utils.js').getLogger('TestUtil');

var channels = [];
var cryptodir;
var rootpath = '../..'
var ORGS;

module.exports.getChannel = function(name) {
    for(let i in channels) {
        if(channels[i].name === name) {
            return channels[i];
        }
    }
    return null;
}

module.exports.getDefaultChannel = function() {
    return channels[0];
}

// all temporary files and directories are created under here
var tempdir = Constants.tempdir;

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
    if (typeof process.env.OVERWRITE_GOPATH === 'undefined'
        || process.env.OVERWRITE_GOPATH.toString().toUpperCase() === 'TRUE') {
        process.env.GOPATH = path.join(__dirname, rootpath);
    }
};

// specifically set the values to defaults because they may have been overridden when
// running in the overall test bucket ('gulp test')
module.exports.resetDefaults = function() {
	global.hfc.config = undefined;
	require('nconf').reset();
};

module.exports.cleanupDir = function(keyValStorePath) {
	var absPath = path.join(process.cwd(), keyValStorePath);
	var exists = module.exports.existsSync(absPath);
	if (exists) {
		fs.removeSync(absPath);
	}
};

module.exports.getUniqueVersion = function(prefix) {
	if (!prefix) prefix = 'v';
	return prefix + Date.now();
};

// utility function to check if directory or file exists
// uses entire / absolute path from root
module.exports.existsSync = function(absolutePath /*string*/) {
	try  {
		var stat = fs.statSync(absolutePath);
		if (stat.isDirectory() || stat.isFile()) {
			return true;
		} else
			return false;
	}
	catch (e) {
		return false;
	}
};

module.exports.readFile = readFile;

module.exports.init = function(config_path) {
    Client.addConfigFile(config_path);
    var fa = Client.getConfigSetting('fabric');
    ORGS = fa.network;
    channels = fa.channel;
    cryptodir = fa.cryptodir;
}

var	tlsOptions = {
	trustedRoots: [],
	verify: false
};

function getMember(username, password, client, userOrg) {
	var caUrl = ORGS[userOrg].ca.url;

	return client.getUserContext(username, true)
	.then((user) => {
		return new Promise((resolve, reject) => {
			if (user && user.isEnrolled()) {
				return resolve(user);
			}

			var member = new User(username);
			var cryptoSuite = client.getCryptoSuite();
			if (!cryptoSuite) {
				cryptoSuite = Client.newCryptoSuite();
				if (userOrg) {
					cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: module.exports.storePathForOrg(ORGS[userOrg].name)}));
					client.setCryptoSuite(cryptoSuite);
				}
			}
			member.setCryptoSuite(cryptoSuite);

			// need to enroll it with CA server
			var cop = new copService(caUrl, tlsOptions, ORGS[userOrg].ca.name, cryptoSuite);

			return cop.enroll({
				enrollmentID: username,
				enrollmentSecret: password
			}).then((enrollment) => {
				return member.setEnrollment(enrollment.key, enrollment.certificate, ORGS[userOrg].mspid);
			}).then(() => {
				var skipPersistence = false;
				if (!client.getStateStore()) {
					skipPersistence = true;
				}
				return client.setUserContext(member, skipPersistence);
			}).then(() => {
				return resolve(member);
			}).catch((err) => {
                // TODO: will remove t argument later
                console.log('Failed to enroll and persist user. Error: ' + (err.stack ? err.stack : err));
			});
		});
	});
}

function getAdmin(client, userOrg) {
    try {
        if(!ORGS.hasOwnProperty(userOrg)) {
            throw new Error('Could not found ' + userOrg + ' in configuration');
        }
        var org = ORGS[userOrg];
        var keyPEM, certPEM;
        if(org.user) {
            keyPEM = fs.readFileSync(path.join(__dirname, '../..', org.user.key));
            certPEM = fs.readFileSync(path.join(__dirname, '../..', org.user.cert));
        }
        else {
            var keyPath = path.join(__dirname, util.format('../../%s/peerOrganizations/%s.example.com/users/Admin@%s.example.com/keystore', cryptodir, userOrg, userOrg));
            if(!fs.existsSync(keyPath)) {
                keyPath = path.join(__dirname, util.format('../../%s/peerOrganizations/%s.example.com/users/Admin@%s.example.com/msp/keystore', cryptodir, userOrg, userOrg));
            }
            keyPEM = readAllFiles(keyPath)[0];
            var certPath = path.join(__dirname, util.format('../../%s/peerOrganizations/%s.example.com/users/Admin@%s.example.com/signcerts', cryptodir, userOrg, userOrg));
            if(!fs.existsSync(certPath)) {
                certPath = path.join(__dirname, util.format('../../%s/peerOrganizations/%s.example.com/users/Admin@%s.example.com/msp/signcerts', cryptodir, userOrg, userOrg));
            }
            certPEM = readAllFiles(certPath)[0];
        }

        var cryptoSuite = Client.newCryptoSuite();
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

function getOrdererAdmin(client) {
    try {
        if(!ORGS.orderer) {
            throw new Error('Could not found orderer in configuration');
        }

        var orderer = ORGS.orderer;
        var keyPEM, certPEM;
        if(orderer.user) {
            keyPEM = fs.readFileSync(path.join(__dirname, '../..', orderer.user.key));
            certPEM = fs.readFileSync(path.join(__dirname, '../..', orderer.user.cert));
        }
        else {
            var keyPath = path.join(__dirname, util.format('../../%s/ordererOrganizations/example.com/users/Admin@example.com/keystore', cryptodir));
            if(!fs.existsSync(keyPath)) {
                keyPath = path.join(__dirname, util.format('../../%s/ordererOrganizations/example.com/users/Admin@example.com/msp/keystore', cryptodir));
            }
            keyPEM = readAllFiles(keyPath)[0];
            var certPath = path.join(   __dirname, util.format('../../%s/ordererOrganizations/example.com/users/Admin@example.com/signcerts', cryptodir));
            if(!fs.existsSync(certPath)) {
                certPath = path.join(__dirname, util.format('../../%s/ordererOrganizations/example.com/users/Admin@example.com/msp/signcerts', cryptodir));
            }
            certPEM = readAllFiles(certPath)[0];
        }

        return Promise.resolve(client.createUser({
            username: 'ordererAdmin',
            mspid: 'OrdererMSP',
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

function readFile(path) {
	return new Promise((resolve, reject) => {
		fs.readFile(path, (err, data) => {
			if (!!err)
				reject(new Error('Failed to read file ' + path + ' due to error: ' + err));
			else
				resolve(data);
		});
	});
}

function readAllFiles(dir) {
	var files = fs.readdirSync(dir);
	var certs = [];
	files.forEach((file_name) => {
		let file_path = path.join(dir,file_name);
		let data = fs.readFileSync(file_path);
		certs.push(data);
	});
	return certs;
}

module.exports.getOrderAdminSubmitter = function(client) {
	return getOrdererAdmin(client);
};

module.exports.getSubmitter = function(client, peerOrgAdmin, org) {
	if (arguments.length < 2) throw new Error('"client" and "test" are both required parameters');

	var peerAdmin, userOrg;
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
