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

const AdminConnection = require('composer-admin').AdminConnection;
const BusinessNetworkDefinition = require('composer-admin').BusinessNetworkDefinition;
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const IdCard = require('composer-common').IdCard;

const Util = require('../comm/util');
const logger = Util.getLogger('composer_utils.js');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const ora = require('ora');

/**
 * Run a command within a child process and return upon Promise completion. Promise will be rejected on error, or
 * non-zero return code.
 * @param {String} command The command to run
 * @return {Promise} The promise for the child process executing the passed command
 */
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

/**
 * Create the Fabric channels as defined by the configuration data
 * @param {Object} config Configuration data in Json format
 * @return {Promise} a completed Promise
  */
async function createChannels(config) {

    let channels = config.composer.network.channels;
    if(!channels || Object.keys(channels).length === 0) {
        return Promise.reject('No channels defined within config: unable to create.');
    }

    let keys = Object.keys(channels);
    let spinner = ora(`Creating channels ${keys}`).start();
    for (let keysInc=0; keysInc<keys.length; keysInc++){
        let key = keys[keysInc];
        let channel = channels[key];
        let orderer = config.composer.network.orderers[channel.orderers].hosturl;

        try {
            let mspconfig = '"CORE_PEER_MSPCONFIGPATH=' + channel.mspconfig + '"';
            if(config.composer.network.tls) {
                let cmdString = ' docker exec -e ' + mspconfig + ' ' + channel.peers[0] + ' peer channel create -o ' + orderer + ' -c ' + key + ' -f ' + channel.config + ' --tls true --cafile ' + channel.cafile;
                await runCommand(cmdString);
            } else {
                let cmdString = ' docker exec -e ' + mspconfig + ' ' + channel.peers[0] + ' peer channel create -o ' + orderer + ' -c ' + key + ' -f ' + channel.config;
                await runCommand(cmdString);
            }
            spinner.succeed();
        } catch (error) {
            spinner.fail();
            throw error;
        }
    }
}

/**
 * Join the peers to Fabric channels
 * @param {Object} config Configuration data in Json format
 * @returns {Promise} a completed Promise
 */
async function joinChannels(config) {
    let orgs = config.composer.network.organizations;

    if(!orgs || orgs.length === 0) {
        return Promise.reject('No organisations defined within config: unable to join channels.');
    }

    // for each organisation
    for (let orgInc=0; orgInc<orgs.length; orgInc++){
        let org = orgs[orgInc];

        // Collect Organisation peers
        let peerNames = org.peers;
        let peers = new Array();
        peerNames.forEach((peer) => {
            peers.push(config.composer.network.peers[peer]);
        });

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
                let channelName = channelNames[channelInc];
                let channel = config.composer.network.channels[channelName];

                let fetchCmd, joinCmd;
                let orderer = config.composer.network.orderers[channel.orderers[0]];

                if (config.composer.network.tls) {
                    fetchCmd = 'docker exec -e "CORE_PEER_MSPCONFIGPATH=' + org.mspconfig + '" ' +  peer.hostname + ' peer channel fetch config -o ' + orderer.hosturl + ' -c ' + channelName + ' ' + channelName + '.block' + ' --tls --cafile ' + orderer.mspconfig;
                    joinCmd = 'docker exec -e "CORE_PEER_MSPCONFIGPATH=' + org.mspconfig + '" ' +  peer.hostname + ' peer channel join -b ' + channelName + '.block --tls true --cafile ' + orderer.mspconfig;
                } else {
                    fetchCmd = 'docker exec -e "CORE_PEER_MSPCONFIGPATH=' + org.mspconfig + '" ' +  peer.hostname + ' peer channel fetch config -o ' + orderer.hosturl + ' -c ' + channelName + ' ' + channelName + '.block';
                    joinCmd = 'docker exec -e "CORE_PEER_MSPCONFIGPATH=' + org.mspconfig + '" ' +  peer.hostname + ' peer channel join -b ' + channelName + '.block';
                }

                let spinner = ora('Joining peers to channels').start();
                try {
                    await runCommand(fetchCmd);
                    const attempts = 5; // The join process can fail if couchDB is being used, so condition for that here
                    for (let i = 0; i<attempts; i++) {
                        spinner.text =`Attempting to join peer ${peer.hostname} to channel ${channelName} (attempt ${i+1}/${attempts})`;
                        try {
                            await runCommand(joinCmd);
                            break;
                        } catch (error) {
                            spinner.text = `Failed to join peer ${peer.hostname} to channel ${channelName} (attempt ${i+1}/${attempts})`;
                            if (i+1 === attempts) {
                                throw new Error(error);
                            } else {
                                await Util.sleep(3000);
                            }
                        }
                    }
                    spinner.succeed();
                } catch (error) {
                    spinner.fail();
                    throw error;
                }

            }
        }
    }
}

/**
 * Create the commmon-conection-profile for a named organization
 * @param {String} orgName The organisatino name to consider
 * @param {Object} config Configuration data in Json format
 * @returns {Object} the common connection profile
 */
function createCommonConnectionProfile(orgName, config) {
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
        });
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
            let certPath = Util.resolvePath(configOrderer.cert);
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
            let certPath =  Util.resolvePath(configPeer.cert);
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

/**
 * Create Administration Business Network cards for each organisation defined within the configuration
 * @param {Object} config Configuration data in Json format
 */
async function createAdminBusNetCards(config) {
    let orgs = config.composer.network.organizations;
    let adminConnection = await new AdminConnection();

    // Loop over each Organisation
    for (let i=0; i<orgs.length; i++){
        let org = orgs[i];
        let profile = createCommonConnectionProfile(org.name, config);

        // set metadata options
        let metadata = {
            version: 1,
            userName : `${org.name}@${config.composer.network['x-type']}`,
            roles : 'PeerAdmin',
        };

        // base card
        let idCard = new IdCard(metadata, profile);

        // certificates & privateKey
        let certpath = Util.resolvePath(org.adminCert);
        let keyPath = Util.resolvePath(org.adminKey);
        let cert = fs.readFileSync(certpath).toString();
        let key = fs.readFileSync(keyPath).toString();

        const newCredentials = {};
        newCredentials.certificate = cert;
        newCredentials.privateKey =  key;

        idCard.setCredentials(newCredentials);
        let cardName = `PerfPeerAdmin@${org.name}`;

        let exists = await adminConnection.hasCard(cardName);
        if (exists) {
            await adminConnection.deleteCard(cardName);
            await adminConnection.importCard(cardName, idCard);
        } else {
            await adminConnection.importCard(cardName, idCard);
        }
    }
}

/**
 * Perform a runtime install on the peers
 * @param {Object} businessNetwork The business network to install the runtime for
 * @param {*} installOptions Optional install options
 * @param {String} cardName The name of the business network card to use for the operation
 */
async function runtimeInstall(businessNetwork, installOptions, cardName) {
    let adminConnection = new AdminConnection();
    let businessNetworkDefinition;

    //check the file is there
    let filePath = path.join(Util.resolvePath(businessNetwork.path), businessNetwork.id);
    if (fs.existsSync(filePath)) {
        businessNetworkDefinition = await BusinessNetworkDefinition.fromDirectory(filePath);
    } else {
        throw new Error(`Business Network named ${businessNetwork.name} does not exist on path ${filePath}`);
    }

    const spinner = ora(`Performing Composer runtime install for network ${businessNetwork.id} with card ${cardName}`).start();
    await adminConnection.connect(cardName);
    try {
        await adminConnection.install(businessNetworkDefinition, installOptions);
        spinner.succeed();
    } catch (error){
        logger.error('Composer runtime install failed, ' + (error.stack ? error.stack : error));
        spinner.fail();
        throw new Error(error);
    }
}

/**
 * Retrieve a business network connection using a named card
 * @param {String} cardName Name of the business network card to use
 * @return {Object} The business network connection obtained through the passed card
 */
async function getBusNetConnection(cardName) {
    let busNetConnection = new BusinessNetworkConnection();
    try {
        await busNetConnection.connect(cardName);
        return busNetConnection;
    } catch (error){
        logger.error('composer.getBusNetConnection() failed for cardName [' + cardName + '] with error: ' + (error.stack ? error.stack : error));
        throw new Error(error);
    }
}

/**
 * Start a business network
 * @param {*} businessNetwork The business network to be started
 * @param {*} cardName The name of the card to use when performing the start
 * @param {*} logLevel The starting log level for the business network
 */
async function networkStart(businessNetwork, cardName, logLevel) {

    let adminConnection = new AdminConnection();
    await adminConnection.connect(cardName);

    let card = await adminConnection.exportCard(cardName);

    // create the NetworkAdmin card for the new network and import it
    let metadata= {
        version : 1,
        userName : 'admin',
        enrollmentSecret : 'adminpw',
        businessNetwork : businessNetwork.id
    };

    let idCard = new IdCard(metadata, card.getConnectionProfile());
    let idCardName = `PerfNetworkAdmin@${businessNetwork.id}`;

    let exists = await adminConnection.hasCard(idCardName);
    if (exists) {
        await adminConnection.deleteCard(idCardName);
        await adminConnection.importCard(idCardName, idCard);
    } else {
        await adminConnection.importCard(idCardName, idCard);
    }

    let startOptions = {};

    // Create the Network Admin that matches the above card
    let networkAdmins = new Array();
    let networkAdmin = {};
    networkAdmin.userName = 'admin';
    networkAdmin.enrollmentSecret = 'adminpw';
    networkAdmins.push(networkAdmin);
    startOptions.networkAdmins = networkAdmins;

    if (logLevel) {
        startOptions.logLevel = logLevel;
    }

    let spinner = ora(`Starting business network ${businessNetwork.id}. This involves building chaincode containers and may take several minutes to complete...`).start();
    try {
        await adminConnection.start(businessNetwork.id, businessNetwork.version, startOptions);
        spinner.succeed();
    } catch (error) {
        spinner.fail();
        throw error;
    }

    spinner = ora(`Network start complete, activating user network card ${idCardName}`).start();
    try {
        let connection = await getBusNetConnection(idCardName);
        await connection.ping();
        spinner.succeed();
    } catch (error) {
        spinner.fail();
        throw error;
    }
}

/**
 * Retrieve all business network cards that are used to access a named business network
 * @param {String} busNet Name of the business network
 * @return {Strinrg[]} Array of all valid business network card names
 */
async function getCardNamesForBusNet(busNet) {
    logger.info('getCardsForBusNet()', busNet);
    const adminConnection = new AdminConnection();

    let busNetCards = [];
    const cardMap = await adminConnection.getAllCards();
    const cardNames = Array.from(cardMap.keys());

    // Loop over each card
    for (let i=0; i<cardNames.length; i++){
        let name = cardNames[i];
        let idCard = cardMap.get(name);
        if (idCard.getBusinessNetworkName().localeCompare(busNet) === 0) {
            busNetCards.push(name);
        }
    }
    return busNetCards;
}

/**
 * Retrieve a business network connection for a participant within a Business Network. Will issue and identity
 * to the passed userID using an admin business network connection, create and import a business network card
 * that is valid for the business network, use the business network card to obtain a connection and pass the connection back.
 * @param {*} adminBusNetConnection An admin connection to the business network
 * @param {*} businessNetworkName  The business network name to create the card for
 * @param {*} particpant The existing Participant in the business network to create a connection for
 * @param {*} userID The userID to issue an identity to
 * @returns {BusinessNetworkConnection} the businessNetworkConnection to a deployed Composer business network
 */
async function obtainConnectionForParticipant(adminBusNetConnection, businessNetworkName, particpant, userID) {
    const adminConnection = new AdminConnection();

    // Issue the identity
    let identity = await adminBusNetConnection.issueIdentity(particpant.getFullyQualifiedIdentifier(), userID);

    // Retrieve default admin card
    let adminCardName = `PerfNetworkAdmin@${businessNetworkName}`;
    let adminCard = await adminConnection.exportCard(adminCardName);

    // Create & import a busnet card
    const metadata = {
        userName: identity.userID,
        version: 1,
        enrollmentSecret: identity.userSecret,
        businessNetwork: businessNetworkName
    };

    const card = new IdCard(metadata, adminCard.getConnectionProfile());
    const cardName = `PerfUser${userID}@${businessNetworkName}`;

    let exists = await adminConnection.hasCard(cardName);
    if (exists) {
        logger.info('Replacing existing business network user card: ', cardName);
        await adminConnection.deleteCard(cardName);
        await adminConnection.importCard(cardName, card);
    } else {
        logger.info('Importing card business network user card: ', cardName);
        await adminConnection.importCard(cardName, card);
    }

    // Retrieve a connection with the card and enrol user via a ping action
    let newConnection = await getBusNetConnection(cardName);
    await newConnection.ping();

    return newConnection;
}

// Exports
module.exports.createChannels = createChannels;
module.exports.joinChannels = joinChannels;
module.exports.runtimeInstall = runtimeInstall;
module.exports.networkStart = networkStart;
module.exports.getBusNetConnection = getBusNetConnection;
module.exports.createAdminBusNetCards = createAdminBusNetCards;
module.exports.getCardNamesForBusNet = getCardNamesForBusNet;
module.exports.obtainConnectionForParticipant = obtainConnectionForParticipant;