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

/* eslint-disable require-jsdoc */

class StubPeer {
    constructor(name, belongsToOrg) {
        this.name = name;
        this.belongsToOrg = belongsToOrg;
    }

    isInRole() {
        return true;
    }

    isInOrg(org) {
        return (org === this.belongsToOrg);
    }

    getName() {
        return this.name;
    }
}


class StubChannelEventHub {
    async connect() {}

    isconnected() {
        return true;
    }

    disconnect() {
        StubChannelEventHub.disconnectCalls++;
    }

    registerTxEvent(txId, callback) {
        callback(txId, 'VALID');
    }

    unregisterTxEvent() {}

    getName() {
        return 'peer1';
    }

    static reset() {
        StubChannelEventHub.disconnectCalls = 0;
    }
}

class StubChannel {
    constructor(channelName) {
        this.channelName = channelName;
    }

    initialize() {
        StubChannel.initializeCalls++;

        if (StubChannel.throwOnInitializeError) {
            throw StubChannel.throwOnInitializeError;
        }
    }

    close() {
        StubChannel.closeCalls++;
    }

    getPeers() {
        return [new StubPeer('peer1')];
    }

    newChannelEventHub() {
        return new StubChannelEventHub();
    }

    async queryByChaincode(args) {
        StubChannel.queryByChaincodeCalls++;
        StubChannel.queryByChaincodeArgs = args;

        if (StubChannel.throwOnQueryByChaincodeError) {
            throw StubChannel.throwOnQueryByChaincodeError;
        }

        return ['evaluateResponse'];
    }

    async sendTransactionProposal(args) {
        StubChannel.sendTransactionProposalCalls++;
        StubChannel.sendTransactionProposalArgs = args;

        if (StubChannel.throwOnSendTransactionProposalError) {
            throw StubChannel.throwOnSendTransactionProposalError;
        }

        return [[{
            response: {
                status: 200,
                payload: 'proposalResponse'
            }
        }], 'proposal'];
    }

    async sendTransaction() {
        StubChannel.sendTransactionCalls++;

        if (StubChannel.throwOnSendTransactionError) {
            throw StubChannel.throwOnSendTransactionError;
        }

        if (StubChannel.failOnSendTransactionCall) {
            return {status: 'FAILED'};
        }

        return {status: 'SUCCESS'};
    }

    getChannelPeers() {
        return [new StubPeer('peer1', 'Org1MSP'), new StubPeer('peer2', 'Org2MSP'), new StubPeer('peer3', 'Org3MSP'), new StubPeer('peer4', 'Org2MSP')];
    }

    getOrderer() {
        return 'orderer.example.com';
    }

    compareProposalResponseResults() {
        return true;
    }

    static throwOnInitialize(error) {
        StubChannel.throwOnInitializeError = error;
    }

    static throwOnQueryByChaincode(error) {
        StubChannel.throwOnQueryByChaincodeError = error;
    }

    static throwOnSendTransactionProposal(error) {
        StubChannel.throwOnSendTransactionProposalError = error;
    }

    static throwOnSendTransaction(error) {
        StubChannel.throwOnSendTransactionError = error;
    }

    static failOnSendTransaction() {
        StubChannel.failOnSendTransactionCall = true;
    }

    static reset() {
        StubChannel.initializeCalls = 0;
        StubChannel.closeCalls = 0;
        StubChannel.throwOnInitializeError = undefined;
        StubChannel.throwOnQueryByChaincodeError = undefined;
        StubChannel.throwOnSendTransactionProposalError = undefined;
        StubChannel.throwOnSendTransactionError = undefined;
        StubChannel.failOnSendTransactionCall = false;
        StubChannel.sendTransactionProposalCalls = 0;
        StubChannel.sendTransactionCalls = 0;
        StubChannel.queryByChaincodeCalls = 0;
    }
}

class StubClient {
    static loadFromConfig() {
        StubClient.loadFromConfigCalls++;
        return new StubClient();
    }

    createUser(...args) {
        StubClient.createUserCalls++;
        StubClient.createUserArgs = args;
    }

    setTlsClientCertAndKey(...args) {
        StubClient.setTlsClientCertAndKeyCalls++;
        StubClient.setTlsClientCertAndKeyArgs = args;
    }

    getChannel(channelName) {
        StubClient.getChannelArgs = channelName;
        return new StubChannel(channelName);
    }

    newTransactionID() {
        return {getTransactionID: () => '1'};
    }


    static reset() {
        StubClient.loadFromConfigCalls = 0;
        StubClient.createUser = 0;
        StubClient.setTlsClientCertAndKeyCalls = 0;
        StubClient.sendTransactionCalls++;
    }
}

module.exports.Client = StubClient;
module.exports.Channel = StubChannel;
module.exports.ChannelEventHub = StubChannelEventHub;
module.exports.Constants = {
    NetworkConfig: {
        ENDORSING_PEER_ROLE: 'epr',
        EVENT_SOURCE_ROLE: 'esr'
    }
};
