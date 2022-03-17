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
const ConnectionProfileDefinition = {
    getTlsCertForPeer: (peer) => {
        return '-----BEGIN CERTIFICATE-----\nMIICKzCCAdGgAwIBAgIRAL0i4WmltsbdL5xDc0xJQYQwCgYIKoZIzj0EAwIwczEL\nMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNhbiBG\ncmFuY2lzY28xGTAXBgNVBAoTEG9yZzEuZXhhbXBsZS5jb20xHDAaBgNVBAMTE2Nh\nLm9yZzEuZXhhbXBsZS5jb20wHhcNMjAwOTA3MTE0MjAwWhcNMzAwOTA1MTE0MjAw\nWjBsMQswCQYDVQQGEwJVUzETMBEGA1UECBMKQ2FsaWZvcm5pYTEWMBQGA1UEBxMN\nU2FuIEZyYW5jaXNjbzEPMA0GA1UECxMGY2xpZW50MR8wHQYDVQQDDBZVc2VyMUBv\ncmcxLmV4YW1wbGUuY29tMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEZ6BjhMNZ\nPjLYxx+Mtq08UY7Tmill5xRqbACy13wZCmb8SIW6/pjzhWVWfM7YoSLGQWgrgiB4\n8NU8eubMyQA3DqNNMEswDgYDVR0PAQH/BAQDAgeAMAwGA1UdEwEB/wQCMAAwKwYD\nVR0jBCQwIoAgnvPwKjaMDSoQBDUfZMgJPmr5nlvrV/AdzLomWFMuLbkwCgYIKoZI\nzj0EAwIDSAAwRQIhAJwCKxXrCGZMgBlxbaMJzN7wcUM2qjX8jS4ZnBDl7HpaAiBH\nNhHITMTKPcPKgrQT/h1bTXqmxZXnwgh1n7D7VC/Fuw==\n-----END CERTIFICATE-----\n';
    }
};

class GrpcClient {
    constructor(endpoint, tlsCred, grpcOptions) {
    }

    close(){}
}

const grpc = {
    credentials: {
        createSsl: (bufferCert) => {
            return '';
        }
    },

    Client : GrpcClient,

    makeGenericClientConstructor: (obj, str) => {
        return GrpcClient;
    }
};

const crypto = {
    createPrivateKey: (pk) => {
        return '';
    },
    getHashes: () => {
        return [];
    },
    getCiphers: () =>{
        return '';
    }
};

const signers = {
    newPrivateKeySigner: () => {
        return '';
    }
};

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
    constructor(name, args) {
        Transaction.constructorArgs = name;
        this.args = args;
        this.setTransient(this.args.transientData);
    }

    submit() {
        Transaction.submitArgs = this.args.arguments;
        Transaction.submit = true;
        if (Transaction.err) {
            throw Transaction.err;
        }
        return 'submitResponse';
    }

    async evaluate() {
        Transaction.evaluateArgs = this.args.arguments;
        Transaction.evaluate = true;
        if (Transaction.err) {
            throw Transaction.err;
        }
        return 'evaluateResponse';
    }

    setTransient(contents) {
        Transaction.transient = contents;
    }

    getTransactionId() {
        return '1';
    }

    getStatus(){
        return 'success';
    }

    getResult(){
        return 'submitResponse';
    }

    static reset() {
        Transaction.submit = false;
        Transaction.submitArgs = null;
        Transaction.evaluate = false;
        Transaction.evaluateArgs = null;
        Transaction.transient = undefined;
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
    async submitAsync(name, args) {
        const transaction = new Transaction(name, args);
        await transaction.submit();
        return transaction;
    }
    async newProposal(name, args) {return new Transaction(name, args);}
}

class Network {
    getContract(args) {
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
    constructor(args) {
        Gateway.constructed++;
        Gateway.connected++;
        Gateway.connectArgs.push(args);
    }

    static reset() {
        Gateway.constructed = 0;
        Gateway.closed = 0;
        Gateway.channel = undefined;
        Gateway.err = undefined;
        Gateway.connectArgs = [];
    }

    getNetwork(channel) {
        Gateway.channel = channel;
        return new Network();
    }

    close(){
        Gateway.closed++;
    }
}

function connect(args){
    return new Gateway(args);
}

module.exports.Wallets = Wallets;
module.exports.StubWallet = StubWallet;
module.exports.Gateway = Gateway;
module.exports.Network = Network;
module.exports.Transaction = Transaction;
module.exports.crypto = crypto;
module.exports.signers = signers;
module.exports.connect = connect;
module.exports.grpc = grpc;
module.exports.ConnectionProfileDefinition = ConnectionProfileDefinition;
