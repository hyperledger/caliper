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

const tls = require('tls');
const fs = require('fs');
const net = require('net');
const uuidv4 = require('uuid/v4');
const events = require('events');

/**
 * NetworkError exception class thrown in socket connection
 */
class NetworkError extends Error {
    /**
     *
     * @param {String} msg exception message
     */
    constructor(msg) {
        super(msg);
        this.name = 'NetworkError';
    }
}

let emitters = new Map();
let buffers = new Map();
let sockets = new Map();
let lastBytesRead = new Map();

/**
 * Parse response returned by node
 * @param {Buffer} response Node's response
 */
function parseResponse(response) {
    let seq = response.slice(6, 38).toString();
    let result = JSON.parse(response.slice(42).toString());
    let emitter = emitters.get(seq);
    if(!emitter) {
        //Stale message receieved
        return;
    }
    emitter = emitter.emitter;

    if (emitter) {
        let readOnly = Object.getOwnPropertyDescriptor(emitter, 'readOnly').value;
        if (readOnly) {
            if (result.error || result.result !== undefined ) {
                emitter.emit('gotresult', result);
            }
        } else {
            if (result.error || result.status || (result.result && result.result.status)) {
                emitter.emit('gotresult', result);
            } else {
                if (!result.result) {
                    throw new NetworkError(`unknown message receieved, seq=${seq}, data=${response.toString()}`);
                }
            }
        }
    } else {
        throw new NetworkError(`unknown owner message receieved, seq=${seq}, data=${response.toString()}`);
    }
}

/**
 * Create a new TLS socket
 * @param {String} ip IP of channel server
 * @param {Number} port Port of channel server
 * @param {Object} authentication A JSON object contains certificate file path, private key file path and CA file path
 * @return {TLSSocket} A new TLS socket
 */
function createNewSocket(ip, port, authentication) {
    let secureContextOptions = {
        key: fs.readFileSync(authentication.key),
        cert: fs.readFileSync(authentication.cert),
        ca: fs.readFileSync(authentication.ca),
        ecdhCurve: 'secp256k1',
    };

    let secureContext = tls.createSecureContext(secureContextOptions);

    let socket = new net.Socket();
    socket.connect(port, ip);

    let clientOptions = {
        rejectUnauthorized: false,
        secureContext: secureContext,
        socket: socket
    };

    let tlsSocket = tls.connect(clientOptions);

    tlsSocket.on('error', function (error) {
        throw new Error(error);
    });

    let socketID = `${ip}:${port}`;

    lastBytesRead.set(socketID, 0);

    tlsSocket.on('data', function (data) {
        let response = null;
        if (data instanceof Buffer) {
            response = data;
        }
        else {
            response = Buffer.from(data, 'ascii');
        }

        if (!buffers.has(socketID)) {
            // First time to read data from this socket
            let expectedLength = null;
            if (tlsSocket.bytesRead - lastBytesRead.get(socketID) >= 4) {
                expectedLength = response.readUIntBE(0, 4);
            }

            if (!expectedLength || tlsSocket.bytesRead < lastBytesRead.get(socketID) + expectedLength) {
                buffers.set(socketID, {
                    expectedLength: expectedLength,
                    buffer: response
                });
            } else {
                lastBytesRead.set(socketID, lastBytesRead.get(socketID) + expectedLength);
                parseResponse(response);
                buffers.delete(socketID);
            }
        } else {
            // Multiple reading
            let cache = buffers.get(socketID);
            cache.buffer = Buffer.concat([cache.buffer, response]);
            if (!cache.expectedLength && tlsSocket.bytesRead - lastBytesRead.get(socketID) >= 4) {
                cache.expectedLength = cache.buffer.readUIntBE(0, 4);
            }

            if (cache.expectedLength && tlsSocket.bytesRead - lastBytesRead.get(socketID) >= cache.expectedLength) {
                lastBytesRead.set(socketID, lastBytesRead.get(socketID) + cache.expectedLength);
                parseResponse(buffers.get(socketID).buffer);
                buffers.delete(socketID);
            }
        }
    });

    return tlsSocket;
}

/**
 * Prepare the data which will be sent to channel server
 * @param {String} data JSON string of load
 * @return {Object} UUID and packaged data
 */
function packageData(data) {
    const headerLength = 4 + 2 + 32 + 4;

    let length = Buffer.alloc(4);
    length.writeUInt32BE(headerLength + data.length);
    let type = Buffer.alloc(2);
    type.writeUInt16BE(0x12);
    let uuid = uuidv4();
    uuid = uuid.replace(/-/g, '');
    let seq = Buffer.from(uuid, 'ascii');
    let result = Buffer.alloc(4);
    result.writeInt32BE(0);
    let msg = Buffer.from(data, 'ascii');

    return {
        'uuid': uuid,
        'packagedData': Buffer.concat([length, type, seq, result, msg])
    };
}

/**
 * Clear context when a message got response or timeout
 * @param {String} uuid The ID of an `channelPromise`request
 */
function clearContext(uuid) {
    clearTimeout(emitters.get(uuid).timer);
    emitters.delete(uuid);
    buffers.delete(uuid);
}

/**
 * Return channel promise for a request
 * @param {Object} node A JSON object which contains IP and port configuration of channel server
 * @param {Object} authentication A JSON object contains certificate file path, private key file path and CA file path
 * @param {String} data JSON string of load
 * @param {Number} timeout Timeout to wait response
 * @param {Boolean} readOnly Is this request read-only?
 * @return {Promise} a promise which will be resolved when the request is satisfied
 */
function channelPromise(node, authentication, data, timeout, readOnly = false) {
    let ip = node.ip;
    let port = node.channelPort;

    let connectionID = `${ip}${port}`;
    if (!sockets.has(connectionID)) {
        let newSocket = createNewSocket(ip, port, authentication);
        newSocket.unref();
        sockets.set(connectionID, newSocket);
    }
    let tlsSocket = sockets.get(connectionID);

    let dataPackage = packageData(JSON.stringify(data));
    let uuid = dataPackage.uuid;

    tlsSocket.socketID = uuid;
    let packagedData = dataPackage.packagedData;
    let channelPromise = new Promise(async (resolve, reject) => {
        let eventEmitter = new events.EventEmitter();
        Object.defineProperty(eventEmitter, 'readOnly', {
            value: readOnly,
            writable: false,
            configurable: false,
            enumerable: false
        });

        eventEmitter.on('gotresult', (result) => {
            clearContext(uuid);
            if (result.error) {
                reject(result);
            } else {
                resolve(result);
            }
            return; // This `return` is not necessary, but it may can avoid future trap
        });

        eventEmitter.on('timeout', () => {
            clearContext(uuid);
            reject({ 'error': 'timeout' });
            return; // This `return` is not necessary, but it may can avoid future trap
        });

        emitters.set(uuid, {
            emitter: eventEmitter,
            timer: setTimeout(() => {
                eventEmitter.emit('timeout');
            }, timeout)
        });

        tlsSocket.write(packagedData);
    });
    return channelPromise;
}

module.exports = channelPromise;
