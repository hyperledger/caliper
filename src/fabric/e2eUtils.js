/**
 * Modifications Copyright 2017 HUAWEI
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */


'use strict';

const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('E2E testing');
const commUtils = require('../comm/util');
const TxStatus  = require('../comm/transaction');

const path = require('path');
const fs = require('fs');
const util = require('util');

const Client = require('fabric-client');
const testUtil = require('./util.js');

let ORGS;

let tx_id = null;
let the_user = null;

/**
 * Initialize the Fabric client configuration.
 * @param {string} config_path The path of the Fabric network configuration file.
 */
function init(config_path) {
    Client.addConfigFile(config_path);
    ORGS = Client.getConfigSetting('fabric').network;
}
module.exports.init = init;

/**
 * Deploy the given chaincode to the given organization's peers.
 * @param {string} org The name of the organization.
 * @param {object} chaincode The chaincode object from the configuration file.
 * @return {Promise} The return promise.
 */
function installChaincode(org, chaincode) {
    Client.setConfigSetting('request-timeout', 60000);
    const channel_name = chaincode.channel;

    const client = new Client();
    const channel = client.newChannel(channel_name);

    const orgName = ORGS[org].name;
    const cryptoSuite = Client.newCryptoSuite();
    cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
    client.setCryptoSuite(cryptoSuite);

    const caRootsPath = ORGS.orderer.tls_cacerts;
    let data = fs.readFileSync(commUtils.resolvePath(caRootsPath));
    let caroots = Buffer.from(data).toString();

    channel.addOrderer(
        client.newOrderer(
            ORGS.orderer.url,
            {
                'pem': caroots,
                'ssl-target-name-override': ORGS.orderer['server-hostname']
            }
        )
    );

    const targets = [];
    for (let key in ORGS[org]) {
        if (ORGS[org].hasOwnProperty(key)) {
            if (key.indexOf('peer') === 0) {
                let data = fs.readFileSync(commUtils.resolvePath(ORGS[org][key].tls_cacerts));
                let peer = client.newPeer(
                    ORGS[org][key].requests,
                    {
                        pem: Buffer.from(data).toString(),
                        'ssl-target-name-override': ORGS[org][key]['server-hostname']
                    }
                );

                targets.push(peer);
                channel.addPeer(peer);
            }
        }
    }

    return Client.newDefaultKeyValueStore({
        path: testUtil.storePathForOrg(orgName)
    }).then((store) => {
        client.setStateStore(store);

        // get the peer org's admin required to send install chaincode requests
        return testUtil.getSubmitter(client, true /* get peer org admin */, org);
    }).then((admin) => {
        the_user = admin;

        let resolvedPath = chaincode.path;
        let metadataPath = chaincode.metadataPath ? commUtils.resolvePath(chaincode.metadataPath) : chaincode.metadataPath;
        if (chaincode.language === 'node') {
            resolvedPath = commUtils.resolvePath(chaincode.path);
        }

        // send proposal to endorser
        const request = {
            targets: targets,
            chaincodePath: resolvedPath,
            metadataPath: metadataPath,
            chaincodeId: chaincode.id,
            chaincodeType: chaincode.language,
            chaincodeVersion: chaincode.version
        };
        return client.installChaincode(request);
    },
    (err) => {
        throw new Error('Failed to enroll user \'admin\'. ' + err);
    }).then((results) => {
        const proposalResponses = results[0];

        let all_good = true;
        const errors = [];
        for(let i in proposalResponses) {
            let one_good = false;
            if (proposalResponses && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
                one_good = true;
            } else {
                logger.error('install proposal was bad');
                errors.push(proposalResponses[i]);
            }
            all_good = all_good && one_good;
        }
        if (!all_good) {
            throw new Error(util.format('Failed to send install Proposal or receive valid response: %s', errors));
        }
    },
    (err) => {
        throw new Error('Failed to send install proposal due to error: ' + (err.stack ? err.stack : err));
    })
        .catch((err) => {
            return Promise.reject(err);
        });
}
module.exports.installChaincode = installChaincode;

/**
 * Disconnect from the given event hubs.
 * @param {object[]} ehs The collection of event hubs.
 */
function disconnect(ehs) {
    for(let key in ehs) {
        const eventhub = ehs[key];
        if (eventhub && eventhub.isconnected()) {
            eventhub.disconnect();
        }
    }
}

/**
 * Assemble a chaincode proposal request.
 * @param {Client} client The Fabric client object.
 * @param {User} the_user Unused.
 * @param {object} chaincode The chaincode object from the configuration file.
 * @param {boolean} upgrade Indicates whether the request is an upgrade or not.
 * @param {object} transientMap The transient map the request.
 * @param {object} endorsement_policy The endorsement policy object from the configuration file.
 * @return {object} The assembled chaincode proposal request.
 */
function buildChaincodeProposal(client, the_user, chaincode, upgrade, transientMap, endorsement_policy) {
    const tx_id = client.newTransactionID();

    // send proposal to endorser
    const request = {
        chaincodePath: chaincode.path,
        chaincodeId: chaincode.id,
        chaincodeType: chaincode.language,
        chaincodeVersion: chaincode.version,
        fcn: 'init',
        args: chaincode.init || [],
        txId: tx_id,
        'endorsement-policy': endorsement_policy
    };


    if(upgrade) {
        // use this call to test the transient map support during chaincode instantiation
        request.transientMap = transientMap;
    }

    return request;
}

/**
 * Instantiate or upgrade the given chaincode with the given endorsement policy.
 * @param {object} chaincode The chaincode object from the configuration file.
 * @param {object} endorsement_policy The endorsement policy object from the configuration file.
 * @param {boolean} upgrade Indicates whether the call is an upgrade or a new instantiation.
 * @return {Promise} The return promise.
 */
function instantiateChaincode(chaincode, endorsement_policy, upgrade){
    Client.setConfigSetting('request-timeout', 120000);

    let channel = testUtil.getChannel(chaincode.channel);
    if(channel === null) {
        return Promise.reject(new Error('could not find channel in config'));
    }
    const channel_name = channel.name;
    const userOrg = channel.organizations[0];

    let targets = [],
        eventhubs = [];
    let type = 'instantiate';
    if(upgrade) {type = 'upgrade';}
    const client = new Client();
    channel = client.newChannel(channel_name);

    const orgName = ORGS[userOrg].name;
    const cryptoSuite = Client.newCryptoSuite();
    cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
    client.setCryptoSuite(cryptoSuite);

    const caRootsPath = ORGS.orderer.tls_cacerts;
    let data = fs.readFileSync(commUtils.resolvePath(caRootsPath));
    let caroots = Buffer.from(data).toString();

    channel.addOrderer(
        client.newOrderer(
            ORGS.orderer.url,
            {
                'pem': caroots,
                'ssl-target-name-override': ORGS.orderer['server-hostname']
            }
        )
    );

    targets = [];
    const transientMap = {'test': 'transientValue'};

    return Client.newDefaultKeyValueStore({
        path: testUtil.storePathForOrg(orgName)
    }).then((store) => {

        client.setStateStore(store);
        return testUtil.getSubmitter(client, true /* use peer org admin*/, userOrg);

    }).then((admin) => {
        the_user = admin;

        let eventPeer = null;
        for(let org in ORGS) {
            if(ORGS.hasOwnProperty(org) && org.indexOf('org') === 0) {
                for (let key in ORGS[org]) {
                    if(ORGS[org].hasOwnProperty(key) && key.indexOf('peer') === 0) {
                        let data = fs.readFileSync(commUtils.resolvePath(ORGS[org][key].tls_cacerts));
                        let peer = client.newPeer(
                            ORGS[org][key].requests,
                            {
                                pem: Buffer.from(data).toString(),
                                'ssl-target-name-override': ORGS[org][key]['server-hostname']
                            });
                        targets.push(peer);
                        channel.addPeer(peer);
                        if(org === userOrg && !eventPeer) {
                            eventPeer = key;
                        }
                    }
                }
            }
        }

        // an event listener can only register with a peer in its own org
        let data = fs.readFileSync(commUtils.resolvePath(ORGS[userOrg][eventPeer].tls_cacerts));
        let eh = client.newEventHub();
        eh.setPeerAddr(
            ORGS[userOrg][eventPeer].events,
            {
                pem: Buffer.from(data).toString(),
                'ssl-target-name-override': ORGS[userOrg][eventPeer]['server-hostname']
            }
        );
        eh.connect();
        eventhubs.push(eh);

        // read the config block from the orderer for the channel
        // and initialize the verify MSPs based on the participating
        // organizations
        return channel.initialize();
    }, (err) => {
        throw new Error('Failed to enroll user \'admin\'. ' + err);

    }).then(() => {

        // the v1 chaincode has Init() method that expects a transient map
        if (upgrade) {
            let request = buildChaincodeProposal(client, the_user, chaincode, upgrade, transientMap, endorsement_policy);
            tx_id = request.txId;

            return channel.sendUpgradeProposal(request);
        } else {
            let request = buildChaincodeProposal(client, the_user, chaincode, upgrade, transientMap, endorsement_policy);
            tx_id = request.txId;
            return channel.sendInstantiateProposal(request);
        }

    }, (err) => {
        throw new Error('Failed to initialize the channel'+ (err.stack ? err.stack : err));
    }).then((results) => {

        const proposalResponses = results[0];

        const proposal = results[1];
        let all_good = true;
        for(let i in proposalResponses) {
            let one_good = false;
            if (proposalResponses[i].response && proposalResponses[i].response.status === 200) {
                one_good = true;
            }
            all_good = all_good && one_good;
        }
        if (all_good) {
            const request = {
                proposalResponses: proposalResponses,
                proposal: proposal,
            };

            // set the transaction listener and set a timeout of 5 mins
            // if the transaction did not get committed within the timeout period,
            // fail the test
            const deployId = tx_id.getTransactionID();

            const eventPromises = [];
            eventhubs.forEach((eh) => {
                let txPromise = new Promise((resolve, reject) => {
                    let handle = setTimeout(reject, 300000);

                    eh.registerTxEvent(deployId.toString(), (tx, code) => {
                        clearTimeout(handle);
                        eh.unregisterTxEvent(deployId);

                        if (code !== 'VALID') {
                            commUtils.log('The chaincode ' + type + ' transaction was invalid, code = ' + code);
                            reject();
                        } else {
                            commUtils.log('The chaincode ' + type + ' transaction was valid.');
                            resolve();
                        }
                    });
                });
                eventPromises.push(txPromise);
            });

            const sendPromise = channel.sendTransaction(request);
            return Promise.all([sendPromise].concat(eventPromises))
                .then((results) => {
                    return results[0]; // just first results are from orderer, the rest are from the peer events

                }).catch((err) => {
                    throw new Error('Failed to send ' + type + ' transaction and get notifications within the timeout period.');
                });

        } else {
            throw new Error('Failed to send ' + type + ' Proposal or receive valid response. Response null or status is not 200. exiting...');
        }
    }, (err) => {
        throw new Error('Failed to send ' + type + ' proposal due to error: ' + (err.stack ? err.stack : err));

    }).then((response) => {
        //TODO should look into the event responses
        if (!(response instanceof Error) && response.status === 'SUCCESS') {
            return Promise.resolve();
        } else {
            throw new Error('Failed to order the ' + type + 'transaction. Error code: ' + response.status);
        }
    }, (err) => {
        throw new Error('Failed to send instantiate due to error: ' + (err.stack ? err.stack : err));
    })
        .then(()=>{
            disconnect(eventhubs);
            return Promise.resolve();
        })
        .catch((err) => {
            disconnect(eventhubs);
            return Promise.reject(err);
        });
}

module.exports.instantiateChaincode = instantiateChaincode;

/**
 * Get the peers of a given organization.
 * @param {string} orgName The name of the organization.
 * @return {string[]} The collection of peer names.
 */
function getOrgPeers(orgName) {
    const peers = [];
    const org = ORGS[orgName];
    for (let key in org) {
        if ( org.hasOwnProperty(key)) {
            if (key.indexOf('peer') === 0) {
                peers.push(org[key]);
            }
        }
    }

    return peers;
}

/**
 * Create a Fabric context based on the channel configuration.
 * @param {object} channelConfig The channel object from the configuration file.
 * @return {Promise<object>} The created Fabric context.
 */
function getcontext(channelConfig) {
    Client.setConfigSetting('request-timeout', 120000);
    const channel_name = channelConfig.name;
    // var userOrg = channelConfig.organizations[0];
    // choose a random org to use, for load balancing
    const idx = Math.floor(Math.random() * channelConfig.organizations.length);
    const userOrg = channelConfig.organizations[idx];

    const client = new Client();
    const channel = client.newChannel(channel_name);
    let orgName = ORGS[userOrg].name;
    const cryptoSuite = Client.newCryptoSuite();
    const eventhubs = [];
    cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(orgName)}));
    client.setCryptoSuite(cryptoSuite);

    const caRootsPath = ORGS.orderer.tls_cacerts;
    let data = fs.readFileSync(commUtils.resolvePath(caRootsPath));
    let caroots = Buffer.from(data).toString();

    channel.addOrderer(
        client.newOrderer(
            ORGS.orderer.url,
            {
                'pem': caroots,
                'ssl-target-name-override': ORGS.orderer['server-hostname']
            }
        )
    );

    orgName = ORGS[userOrg].name;
    return Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg(orgName)})
        .then((store) => {
            if (store) {
                client.setStateStore(store);
            }
            return testUtil.getSubmitter(client, true, userOrg);
        }).then((admin) => {
            the_user = admin;

            // set up the channel to use each org's random peer for
            // both requests and events
            for(let i in channelConfig.organizations) {
                let org   = channelConfig.organizations[i];
                let peers = getOrgPeers(org);

                if(peers.length === 0) {
                    throw new Error('could not find peer of ' + org);
                }

                let peerInfo = peers[Math.floor(Math.random() * peers.length)];
                let data = fs.readFileSync(commUtils.resolvePath(peerInfo.tls_cacerts));
                let peer = client.newPeer(
                    peerInfo.requests,
                    {
                        pem: Buffer.from(data).toString(),
                        'ssl-target-name-override': peerInfo['server-hostname']
                    }
                );
                channel.addPeer(peer);

                // an event listener can only register with the peer in its own org
                if(org === userOrg) {
                    let eh = client.newEventHub();
                    eh.setPeerAddr(
                        peerInfo.events,
                        {
                            pem: Buffer.from(data).toString(),
                            'ssl-target-name-override': peerInfo['server-hostname'],
                            //'request-timeout': 120000
                            'grpc.keepalive_timeout_ms' : 3000, // time to respond to the ping, 3 seconds
                            'grpc.keepalive_time_ms' : 360000   // time to wait for ping response, 6 minutes
                            // 'grpc.http2.keepalive_time' : 15
                        }
                    );
                    eventhubs.push(eh);
                }
            }

            // register event listener
            eventhubs.forEach((eh) => {
                eh.connect();
            });

            return channel.initialize();
        })
        .then((nothing) => {
            return Promise.resolve({
                org: userOrg,
                client: client,
                channel: channel,
                submitter: the_user,
                eventhubs: eventhubs});
        })
        .catch((err) => {
            return Promise.reject(err);
        });
}
module.exports.getcontext = getcontext;

/**
 * Disconnect the event hubs.
 * @param {object} context The Fabric context.
 * @return {Promise} The return promise.
 */
function releasecontext(context) {
    if(context.hasOwnProperty('eventhubs')){
        for(let key in context.eventhubs) {
            const eventhub = context.eventhubs[key];
            if (eventhub && eventhub.isconnected()) {
                eventhub.disconnect();
            }
        }
        context.eventhubs = [];
    }
    return Promise.resolve();
}
module.exports.releasecontext = releasecontext;

/**
 * Submit a transaction to the given chaincode with the specified options.
 * @param {object} context The Fabric context.
 * @param {string} id The name of the chaincode.
 * @param {string} version The version of the chaincode.
 * @param {string[]} args The arguments to pass to the chaincode.
 * @param {number} timeout The timeout for the transaction invocation.
 * @return {Promise<TxStatus>} The result and stats of the transaction invocation.
 */
async function invokebycontext(context, id, version, args, timeout){
    const TxErrorEnum = require('./constant.js').TxErrorEnum;
    const TxErrorIndex = require('./constant.js').TxErrorIndex;

    const channel = context.channel;
    const eventHubs = context.eventhubs;
    const startTime = Date.now();
    const txIdObject = context.client.newTransactionID();
    const txId = txIdObject.getTransactionID().toString();

    // timestamps are recorded for every phase regardless of success/failure
    let invokeStatus = new TxStatus(txId);
    let errFlag = TxErrorEnum.NoError;
    invokeStatus.SetFlag(errFlag);

    // TODO: should resolve endorsement policy to decides the target of endorsers
    // now random peers ( one peer per organization ) are used as endorsers as default, see the implementation of getContext
    // send proposal to endorser
    const f = args[0];
    args.shift();
    const proposalRequest = {
        chaincodeId: id,
        fcn: f,
        args: args,
        txId: txIdObject,
    };

    let proposalResponseObject = null;
    try {
        if(context.engine) {
            context.engine.submitCallback(1);
        }
        try {
            proposalResponseObject = await channel.sendTransactionProposal(proposalRequest, timeout * 1000);
            invokeStatus.Set('time_endorse', Date.now());
        } catch (err) {
            invokeStatus.Set('time_endorse', Date.now());
            errFlag |= TxErrorEnum.ProposalResponseError;
            invokeStatus.SetFlag (errFlag);
            invokeStatus.SetErrMsg(TxErrorIndex.ProposalResponseError, err.toString());
            // error occurred, early life-cycle termination, definitely failed
            invokeStatus.SetVerification(true);
            throw err; // handle logging in one place
        }

        const proposalResponses = proposalResponseObject[0];
        const proposal = proposalResponseObject[1];

        let allGood = true;
        for(let i in proposalResponses) {
            let one_good = false;
            let proposal_response = proposalResponses[i];
            if( proposal_response.response && proposal_response.response.status === 200) {
                // TODO: the CPU cost of verifying response is too high.
                // Now we ignore this step to improve concurrent capacity for the client
                // so a client can initialize multiple concurrent transactions
                // Is it a reasonable way?
                // one_good = channel.verifyProposalResponse(proposal_response);
                one_good = true;
            } else {
                let err = new Error('Endorsement denied: ' + proposal_response.toString());
                errFlag |= TxErrorEnum.BadProposalResponseError;
                invokeStatus.SetFlag(errFlag);
                invokeStatus.SetErrMsg(TxErrorIndex.BadProposalResponseError, err.toString());
                // explicit rejection, early life-cycle termination, definitely failed
                invokeStatus.SetVerification(true);
                throw err;
            }
            allGood = allGood && one_good;
        }

        if (allGood) {
            // check all the read/write sets to see if the same, verify that each peer
            // got the same results on the proposal
            allGood = channel.compareProposalResponseResults(proposalResponses);
            if (!allGood) {
                let err = new Error('Read/Write set mismatch between endorsements');
                errFlag |= TxErrorEnum.BadProposalResponseError;
                invokeStatus.SetFlag(errFlag);
                invokeStatus.SetErrMsg(TxErrorIndex.BadProposalResponseError, err.toString());
                // r/w set mismatch, early life-cycle termination, definitely failed
                invokeStatus.SetVerification(true);
                throw err;
            }
        }

        invokeStatus.SetResult(proposalResponses[0].response.payload);

        const transactionRequest = {
            proposalResponses: proposalResponses,
            proposal: proposal,
        };

        let newTimeout = timeout * 1000 - (Date.now() - startTime);
        if(newTimeout < 10000) {
            commUtils.log('WARNING: timeout is too small, default value is used instead');
            newTimeout = 10000;
        }

        const eventPromises = [];
        eventHubs.forEach((eh) => {
            eventPromises.push(new Promise((resolve, reject) => {
                let handle = setTimeout(() => reject(new Error('Timeout')), newTimeout);

                eh.registerTxEvent(txId,
                    (tx, code) => {
                        clearTimeout(handle);
                        eh.unregisterTxEvent(txId);

                        // either explicit invalid event or valid event, verified in both cases by at least one peer
                        invokeStatus.SetVerification(true);
                        if (code !== 'VALID') {
                            let err = new Error('Invalid transaction: ' + code);
                            errFlag |= TxErrorEnum.BadEventNotificationError;
                            invokeStatus.SetFlag(errFlag);
                            invokeStatus.SetErrMsg(TxErrorIndex.BadEventNotificationError, err.toString());
                            reject(err); // handle error in final catch
                        } else {
                            resolve();
                        }
                    },
                    (err) => {
                        clearTimeout(handle);
                        // we don't know what happened, but give the other eventhub connections a chance
                        // to verify the Tx status, so resolve this call
                        errFlag |= TxErrorEnum.EventNotificationError;
                        invokeStatus.SetFlag(errFlag);
                        invokeStatus.SetErrMsg(TxErrorIndex.EventNotificationError, err.toString());
                        resolve();
                    }
                );
            }));
        });

        let broadcastResponse;
        try {
            broadcastResponse = await channel.sendTransaction(transactionRequest);
        } catch (err) {
            // missing the ACK does not mean anything, the Tx could be already under ordering
            // so let the events decide the final status, but log this error
            errFlag |= TxErrorEnum.OrdererResponseError;
            invokeStatus.SetFlag(errFlag);
            invokeStatus.SetErrMsg(TxErrorIndex.OrdererResponseError,err.toString());
        }

        invokeStatus.Set('time_order', Date.now());

        if (broadcastResponse && broadcastResponse.status === 'SUCCESS') {
            invokeStatus.Set('status', 'submitted');
        } else if (broadcastResponse && broadcastResponse.status !== 'SUCCESS') {
            let err = new Error('Received rejection from orderer service: ' + broadcastResponse.status);
            errFlag |= TxErrorEnum.BadOrdererResponseError;
            invokeStatus.SetFlag(errFlag);
            invokeStatus.SetErrMsg(TxErrorIndex.BadOrdererResponseError, err.toString());
            // the submission was explicitly rejected, so the Tx will definitely not be ordered
            invokeStatus.SetVerification(true);
            throw err;
        }

        await Promise.all(eventPromises);
        // if the Tx is not verified at this point, then every eventhub connection failed (with resolve)
        // so mark it failed but leave it not verified
        if (!invokeStatus.IsVerified()) {
            invokeStatus.SetStatusFail();
            commUtils.log('Failed to complete transaction [' + txId.substring(0, 5) + '...]: every eventhub connection closed');
        } else {
            invokeStatus.SetStatusSuccess();
        }
    } catch (err)
    {
        // at this point the Tx should be verified
        invokeStatus.SetStatusFail();
        commUtils.log('Failed to complete transaction [' + txId.substring(0, 5) + '...]:' + (err instanceof Error ? err.stack : err));
    }

    return invokeStatus;
}

module.exports.invokebycontext = invokebycontext;

/**
 * Submit a query to the given chaincode with the specified options.
 * @param {object} context The Fabric context.
 * @param {string} id The name of the chaincode.
 * @param {string} version The version of the chaincode.
 * @param {string} name The single argument to pass to the chaincode.
 * @param {string} fcn The chaincode query function name.
 * @return {Promise<object>} The result and stats of the transaction invocation.
 */
function querybycontext(context, id, version, name, fcn) {
    //const userOrg = context.org;
    const client = context.client;
    const channel = context.channel;
    //const eventhubs = context.eventhubs;
    const tx_id = client.newTransactionID();
    const txStatus = new TxStatus(tx_id.getTransactionID());

    // send query
    const request = {
        chaincodeId: id,
        chaincodeVersion: version,
        txId: tx_id,
        fcn: fcn,
        args: [name]
    };

    if(context.engine) {
        context.engine.submitCallback(1);
    }

    return channel.queryByChaincode(request)
        .then((responses) => {
            if(responses.length > 0) {
                const value = responses[0];
                if(value instanceof Error) {
                    throw value;
                }

                for(let i = 1 ; i < responses.length ; i++) {
                    if(responses[i].length !== value.length || !responses[i].every(function(v,idx){
                        return v === value[idx]; })) {
                        throw new Error('conflicting query responses');
                    }
                }

                txStatus.SetStatusSuccess();
                txStatus.SetResult(responses[0]);
                return Promise.resolve(txStatus);
            }
            else {
                throw new Error('no query responses');
            }
        })
        .catch((err) => {
            commUtils.log('Query failed, ' + (err.stack?err.stack:err));
            txStatus.SetStatusFail();
            return Promise.resolve(txStatus);
        });
}

module.exports.querybycontext = querybycontext;

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
module.exports.readAllFiles = readAllFiles;
