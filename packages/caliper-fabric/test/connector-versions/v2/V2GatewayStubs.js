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

class StubWallet {
    constructor() {
        this.map = new Map();
    }

    async put(key, value) {
        this.map.set(key, value);
    }

    async get(key) {
        return this.map.get(key);
    }

    async list() {
        return Array.from(this.map.keys());
    }
}

const Wallets = {
    newInMemoryWallet: async () => {
        return new StubWallet();
    },
    newFileSystemWallet: async(walletPath) => {
        return new StubWallet();
    }
};

class Transaction {
    constructor(args) {
        Transaction.constructorArgs = args;
    }

    async submit(...args) {
        Transaction.submitArgs = args;
        Transaction.submit = true;
        if (Transaction.err) {
            throw Transaction.err;
        }
        return 'submitResponse';
    }

    async evaluate(...args) {
        Transaction.evaluateArgs = args;
        Transaction.evaluate = true;
        if (Transaction.err) {
            throw Transaction.err;
        }
        return 'evaluateResponse';
    }

    setTransient(contents) {
        Transaction.transient = contents;
    }

    setEndorsingPeers(peers) {
        Transaction.endorsingPeers = peers;
    }

    setEndorsingOrganizations(...mspIds) {
        Transaction.endorsingOrganizations = mspIds;
    }

    getTransactionId() {
        return '1';
    }

    static reset() {
        Transaction.submit = false;
        Transaction.submitArgs = null;
        Transaction.evaluate = false;
        Transaction.evaluateArgs = null;
        Transaction.transient = undefined;
        Transaction.endorsingPeers = undefined;
        Transaction.endorsingOrganizations = undefined;
        Transaction.err = undefined;
    }

    static throwOnCall(err) {
        Transaction.err = err;
    }
}

class StubPeer {
    constructor(name) {
        this.name = name;
    }
}

class Contract {
    createTransaction(args) {return new Transaction(args);}
}

class Network {
    async getContract(args) {
        Network.getContractArgs = args;
        return new Contract();
    }

    getChannel() {
        return {
            client: {getEndorsers: () => [new StubPeer('peer1'), new StubPeer('peer2'), new StubPeer('peer3')]}
        };
    }

    static reset() {
        Network.getContractArgs = undefined;
    }
}

class Gateway {
    constructor() {
        Gateway.constructed++;
    }

    static reset() {
        Gateway.constructed = 0;
        Gateway.connected = 0;
        Gateway.disconnected = 0;
        Gateway.channel = undefined;
        Gateway.err = undefined;
        Gateway.connectArgs = [];
    }

    async getNetwork(channel) {
        Gateway.channel = channel;
        return new Network();
    }

    async connect(...args) {
        if (Gateway.err) {
            throw Gateway.err;
        }
        Gateway.connected++;
        Gateway.connectArgs.push(args);
    }

    disconnect() {
        Gateway.disconnected++;
    }

    static throwOnCall(err) {
        Gateway.err = err;
    }

}

module.exports.Wallets = Wallets;
module.exports.StubWallet = StubWallet;
module.exports.Gateway = Gateway;
module.exports.Network = Network;
module.exports.Transaction = Transaction;
