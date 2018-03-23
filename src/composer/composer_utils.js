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

const Admin = require('composer-admin');
const BusinessNetworkDefinition = Admin.BusinessNetworkDefinition;
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const IdCard = require('composer-common').IdCard;

const sleep = require('../comm/sleep');

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

// Exports
module.exports.createChannels = createChannels;
module.exports.joinChannels = joinChannels;
module.exports.runtimeInstall = runtimeInstall;
module.exports.networkStart = networkStart;
module.exports.getBusNetConnection = getBusNetConnection;
module.exports.createAdminBusNetCards = createAdminBusNetCards;
module.exports.getCardsForBusNet = getCardsForBusNet;

// Create the channels as passed from the chanel config
async function createChannels(config) {

    let channels = config.composer.network.channels;
    if(!channels || Object.keys(channels).length === 0) {
        return Promise.reject('No channels defined within config: unable to create.');
    }

    let keys = Object.keys(channels);
    for (let keysInc=0; keysInc<keys.length; keysInc++){
        let key = keys[keysInc];
        let channel = channels[key];
        let orderer = config.composer.network.orderers[channel.orderers].hosturl;

        console.log('creating channel ' + key + ' ......');
        let mspconfig = '"CORE_PEER_MSPCONFIGPATH=' + channel.mspconfig + '"';
        if(config.composer.network.tls) {                
            let cmdString = ' docker exec -e ' + mspconfig + ' ' + channel.peers[0] + ' peer channel create -o ' + orderer + ' -c ' + key + ' -f ' + channel.config + ' --tls true --cafile ' + channel.cafile;
            await runCommand(cmdString);
        } else {                
            let cmdString = ' docker exec -e ' + mspconfig + ' ' + channel.peers[0] + ' peer channel create -o ' + orderer + ' -c ' + key + ' -f ' + channel.config;
            await runCommand(cmdString);
        }  
    }
}

// Join the channels assumed created and defined from the channel config
async function joinChannels(config) {
    let orgs = config.composer.network.organizations;    

    if(!orgs || orgs.length === 0) {
        return Promise.reject('No organisations defined within config: unable to join channels.');
    }
    
    // for each organisation
    for (let orgInc=0; orgInc <orgs.length; orgInc++){
        let org = orgs[orgInc];

        // Collect Organisation peers
        let peerNames = org.peers;
        let peers = new Array();
        peerNames.forEach((peer) => {
            peers.push(config.composer.network.peers[peer]);
        })

        if(!peers || peers.length === 0) {
            return Promise.reject('No peers defined within org.config: unable to join peers to channel(s).');
        }

        // For each Peer
        for (let peerInc=0; peerInc<peers.length; peerInc++){
            let peer = peers[peerInc];

            // Channels the peer is to join
            let channelNames = peer.channels;
            if(!channelNames || channelNames.length === 0) {
                return Promise.reject('Error: No channels defined for peer ', peer.hostname);
            }
            
            // For each Channel
            for (let channelInc=0; channelInc<channelNames.length; channelInc++){
                let channelName = channelNames[channelInc]
                let channel = config.composer.network.channels[channelName];

                let fetchCmd, joinCmd;
                let orderer = config.composer.network.orderers[channel.orderers[0]];

                if(config.composer.network.tls) {
                    fetchCmd = 'docker exec -e "CORE_PEER_MSPCONFIGPATH=' + org.mspconfig + '" ' +  peer.hostname + ' peer channel fetch config -o ' + orderer.hosturl + ' -c ' + channelName + ' ' + channelName + '.block' + ' --tls --cafile ' + orderer.mspconfig;
                    joinCmd = 'docker exec -e "CORE_PEER_MSPCONFIGPATH=' + org.mspconfig + '" ' +  peer.hostname + ' peer channel join -b ' + channelName + '.block --tls true --cafile ' + orderer.mspconfig;
                } else {
                    fetchCmd = 'docker exec -e "CORE_PEER_MSPCONFIGPATH=' + org.mspconfig + '" ' +  peer.hostname + ' peer channel fetch config -o ' + orderer.hosturl + ' -c ' + channelName + ' ' + channelName + '.block';
                    joinCmd = 'docker exec -e "CORE_PEER_MSPCONFIGPATH=' + org.mspconfig + '" ' +  peer.hostname + ' peer channel join -b ' + channelName + '.block';
                }
                
                await runCommand(fetchCmd);  
                const attempts = 5; // The join process can fail if couchDB is being used, so condition for that here             
                for (let i = 0; i<5; i++) {                    
                    console.log(`Attempting to join peer ${peer.hostname} to channel ${channelName} (attempt ${i+1}/${attempts})`);
                    try {                        
                        await runCommand(joinCmd);
                        break;
                    } catch (error) {
                        console.log(`Failed to join peer ${peer.hostname} to channel ${channelName} (attempt ${i+1}/${attempts})`);
                        if (i+1 == attempts) {
                            throw new Error(error);
                        } else {
                            await sleep(3000);
                        }
                    }
                }
            }
        }
    }
}

// Run a string command within a promise
function runCommand(command) {

    return new Promise( (resolve, reject) => {
        
        let stderr = '';
        let stdout = '';

        let childCmdProcess = childProcess.exec(command);
        childCmdProcess.stdout.setEncoding('utf8');
        childCmdProcess.stderr.setEncoding('utf8');

        childCmdProcess.stdout.on('data', (data) => {
            stdout += data;
        });

        childCmdProcess.stderr.on('data', (data) => {
            stderr += data;
        });

        childCmdProcess.on('error', (error) => {
            reject({ error: error, stdout: stdout, stderr: stderr });
        });

        childCmdProcess.on('close', (code) => {
            if (code && code !== 0) {
                reject({ code: code, stdout: stdout, stderr: stderr });
            } else {
                resolve(code);
            }
        });
    });
}

// Pass a config file that details the network
function createAdminBusNetCards(config) {    
    let cryptodir = config.composer.cryptodir;
    let orderer = config.composer.network.orderer;
    let orgs = config.composer.network.organizations;
    let adminConnection = new Admin.AdminConnection();

    // Admin Business Network Cards for each Organisation
    return orgs.reduce((orgPromiseChain, org) => {
        let profile = createCommonConnectionProfile(org.name, config);
        return orgPromiseChain.then(() => {
            console.log('Creating Admin Business Network Card for organisation: ' + org.name);
            
            // set metadata options
            let metadata = {
                version: 1,
                userName : `${org.name}@${config.composer.network['x-type']}`,
                roles : 'PeerAdmin',
            };

            // base card
            let idCard = new IdCard(metadata, profile);

            // certificates & privateKey
            let certpath = path.join(__dirname, '/../../', cryptodir, org.adminCert);
            let keyPath = path.join(__dirname, '/../../', cryptodir, org.adminKey);
            let cert = fs.readFileSync(certpath).toString();
            let key = fs.readFileSync(keyPath).toString();

            const newCredentials = {};
            newCredentials.certificate = cert;
            newCredentials.privateKey =  key;

            idCard.setCredentials(newCredentials);
            let cardName = `PerfPeerAdmin@${org.name}`;

            return adminConnection.hasCard(cardName)
            .then((exists) => {
                if(!exists) {
                    console.log('Importing card: ', cardName);                    
                    return adminConnection.importCard(cardName, idCard);
                } else {
                    console.log('Replacing existing card: ', cardName);
                    return adminConnection.deleteCard(cardName)
                    .then(() => {
                        return adminConnection.importCard(cardName, idCard);
                    })
                }
            });
        });
    }, Promise.resolve());
}


// Create the commmon-conection-profile for a target organization
function createCommonConnectionProfile(orgName, config) {
    let cryptodir = config.composer.cryptodir;
    let profile = {};

    // Header information
    profile.name = config.composer.network['x-type'] + orgName;
    profile['x-type'] = config.composer.network['x-type'];
    profile['x-commitTimeout'] = config.composer.network.timeout;
    profile.version = config.composer.network.version;

    // client connection timeouts
    let client = {};
    client.organization = orgName;
    let timeout = {};
    let peer = {};
    peer.endorser = config.composer.network.timeout.toString();
    peer.eventHub = config.composer.network.timeout.toString();
    peer.eventReg = config.composer.network.timeout.toString();
    timeout.peer = peer;
    timeout.orderer = config.composer.network.timeout.toString();
    client.connection = {};    
    client.connection.timeout = timeout;
    profile.client = client;

    // Channels
    let channels = {};
    Object.keys(config.composer.network.channels).forEach((key) => {
        let configChannel = config.composer.network.channels[key];
        let channel = {};
        channel.orderers = configChannel.orderers;
        let channelPeers = {};
        configChannel.peers.forEach((peer) => {
            channelPeers[peer] = {};
        })
        channel.peers = channelPeers;
        channels[key] = channel;
    });
    profile.channels = channels;

    // Organisations
    let organizations = {};
    config.composer.network.organizations.forEach((org) => {
        let organization = {};
        organization.mspid = org.mspid;
        organization.peers = org.peers;
        organization.certificateAuthorities = org.certificateAuthorities;
        organizations[org.name] = organization;
    });
    profile.organizations = organizations;

    // Orderers
    let orderers = {};
    Object.keys(config.composer.network.orderers).forEach((key) => {
        let configOrderer = config.composer.network.orderers[key];
        let orderer = {};
        orderer.url = configOrderer.url;

        if(config.composer.network.tls) {
            let grpcOptions = {};
            let override = configOrderer.hostname;
            grpcOptions['ssl-target-name-override'] = override;
            orderer.grpcOptions = grpcOptions;

            let tlsCACerts = {};
            let certPath = path.join(__dirname, '/../../', cryptodir, configOrderer.cert);
            tlsCACerts.path = certPath;
            orderer.tlsCACerts = tlsCACerts;
        }
        orderers[key] = orderer;
    });
    profile.orderers = orderers;

    // Peers
    let peers = {};
    Object.keys(config.composer.network.peers).forEach((key) => {
        let configPeer = config.composer.network.peers[key];
        let peer = {};
        peer.url = configPeer.url;
        peer.eventUrl = configPeer.eventUrl;

        if(config.composer.network.tls) {
            let grpcOptions = {};
            let override = configPeer.hostname;
            grpcOptions['ssl-target-name-override'] = override;
            peer.grpcOptions = grpcOptions;

            let tlsCACerts = {};
            let certPath =  path.join(__dirname, '/../../', cryptodir, configPeer.cert);
            tlsCACerts.path = certPath;
            peer.tlsCACerts = tlsCACerts;
        }
        peers[key] = peer;
    });
    profile.peers = peers;

    // certificateAuthorities
    let certificateAuthorities = {};
    Object.keys(config.composer.network.certificateAuthorities).forEach((key) => {
        let configCA = config.composer.network.certificateAuthorities[key];
        let ca = {};
        ca.url = configCA.url;
        ca.caName = configCA.name;

        if(config.composer.network.tls) {
            let httpOptions = {};
            httpOptions.verify = false;
            ca.httpOptions = httpOptions;
        }
        certificateAuthorities[key] = ca;
    });
    profile.certificateAuthorities = certificateAuthorities;

    return profile;
}

function runtimeInstall(businessNetworkName, installOptions, cardName) {
    // returns a Promise
    let adminConnection = new Admin.AdminConnection();
    
    return adminConnection.connect(cardName)
    .then((result) => {
        return adminConnection.install(businessNetworkName, installOptions);
    })
    .catch((error) => {
        console.log('composer.runtimeInstall() failed, ' + (error.stack ? error.stack : error));
        return Promise.reject(error);
    })   
};

function networkStart(archiveFile, cardName, logLevel) {
    let archiveFileContents;
    let businessNetworkDefinition;
    let card;
    let idCardName;

    //check the file is there
    let filePath = path.join(__dirname, '..', archiveFile);
    if (fs.existsSync(filePath)) {
        archiveFileContents = fs.readFileSync(filePath);        
    } else {
        throw new Error('Archive file ' + filePath + ' does not exist.');
    }

    // connect and start
    let adminConnection = new Admin.AdminConnection();
    return BusinessNetworkDefinition.fromArchive(archiveFileContents)
    .then((definition) => {
        businessNetworkDefinition = definition;
        console.log('Obtaining admin connection...');
        return adminConnection.connect(cardName);              
    })
    .then(() => {
        return adminConnection.exportCard(cardName);
    })
    .then((card) => {
        console.log('Creating new card for business network user...');
        // create the NetworkAdmin card for the new network and import it
        let metadata= {
            version : 1,
            userName : 'admin',
            enrollmentSecret : 'adminpw',
            businessNetwork : businessNetworkDefinition.getName()
        };

        let idCard = new IdCard(metadata, card.getConnectionProfile());

        idCardName = `PerfNetworkAdmin@${businessNetworkDefinition.getName()}`;
        return adminConnection.hasCard(idCardName)
        .then((exists) => {
            if(!exists) {
                console.log('Importing card business network card: ', idCardName);                    
                return adminConnection.importCard(idCardName, idCard);
            } else {
                console.log('Replacing existing business network card: ', idCardName);
                return adminConnection.deleteCard(idCardName)
                .then(() => {
                    return adminConnection.importCard(idCardName, idCard);
                });
            }
        });
    })
    .then((card) => {
        let startOptions = {};

        // Create the Network Admin that matches the above card
        let networkAdmins = new Array();
        let networkAdmin = {};
        networkAdmin.userName = 'admin';
        networkAdmin.enrollmentSecret = 'adminpw';
        networkAdmins.push(networkAdmin);
        startOptions.networkAdmins = networkAdmins;

        if(logLevel) {
            startOptions.logLevel = logLevel;
        }

        console.log('Performing network start.');
        return adminConnection.start(businessNetworkDefinition, startOptions);
    })
    .then(() => {
        console.log('Network start complete, activating user network card [' + idCardName + ']');
        return getBusNetConnection(idCardName)
        .then((businessNetworkConnection) => {
            return businessNetworkConnection.ping();
        })
    })
    .catch((error) => {
        console.log('composer.networkStart() failed, ' + error);
        return Promise.reject(error);
    }) 
};

function getBusNetConnection(cardName) {
    let busNetConnection = new BusinessNetworkConnection();
    return busNetConnection.connect(cardName)
    .then((definition) => {
        return busNetConnection;
    })
    .catch((error) => {
        console.log('composer.getBusNetConnection() failed for cardName [' + cardName + '] with error: ' + (error.stack ? error.stack : error));
        return Promise.reject(error);
    })
};

function getCardsForBusNet(busNet) {
    console.log('getCardsForBusNet()', busNet);
    const adminConnection = new Admin.AdminConnection();

    let busNetCards = [];
    return adminConnection.getAllCards()
    .then((cardMap) => {
        const cardNames = Array.from(cardMap.keys());
        return cardNames.forEach((name) => {
            let idCard = cardMap.get(name);
            if (idCard.getBusinessNetworkName().localeCompare(busNet) === 0) {
                busNetCards.push(name);
            }
        })
    })
    .then(() => {
        return busNetCards;
    })

};