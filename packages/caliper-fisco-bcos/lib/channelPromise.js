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

const CaliperUtils = require('caliper-core').CaliperUtils;
const tls = require('tls');
const fs = require('fs');
const net = require('net');
const uuidv4 = require('uuid/v4');
const events = require('events');
const Color = require('./constant').Color;
const commLogger = CaliperUtils.getLogger('fiscoBcosApi.js');

let sockets = new Map();
let emitters = new Map();

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

    tlsSocket.on('data', function (data) {
        let response = null;
        if (data instanceof Buffer) {
            response = data;
        }
        else {
            response = Buffer.from(data, 'ascii');
        }

        let seq = response.slice(6, 38).toString();
        let result = JSON.parse(response.slice(42).toString());

        if (result.error || result.status || (result.result && result.result.status)) {
            let emitter = emitters.get(seq);
            if (emitter) {
                emitter.emit('gotconsensus', result);
                emitters.delete(seq);
            }
            else {
                commLogger.error(Color.error(`Unknown owner message receieved, seq=${seq}, data=${data}`));
            }
        } else {
            if (!result.result) {
                commLogger.error(Color.error(`Unknown message receieved, seq=${seq}, data=${data}`));
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
 * Return channel promise for a request
 * @param {Object} node A JSON object which contains IP and port configuration of channel server
 * @param {Object} authentication A JSON object contains certificate file path, private key file path and CA file path
 * @param {String} data JSON string of load
 * @param {Number} timeout Timeout to wait response
 * @return {Promise} a promise which will be resovled when the request is satisfied
 */
function channelPromise(node, authentication, data, timeout) {
    let ip = node.ip;
    let port = node.channelPort;
    let nodeKey = `${ip}:${port}`;
    if (!sockets.has(nodeKey)) {
        let tlsSocket = createNewSocket(ip, port, authentication);
        sockets.set(nodeKey, tlsSocket);
    }

    let socket = sockets.get(nodeKey);
    let dataPackage = packageData(JSON.stringify(data));
    let uuid = dataPackage.uuid;
    let packagedData = dataPackage.packagedData;
    let channelPromise = new Promise(async (resolve) => {
        let eventEmitter = new events.EventEmitter();

        eventEmitter.on('gotconsensus', (result) => {
            resolve(result);
        });

        eventEmitter.on('timeout', () => {
            resolve({ 'error': 'timeout' });
        });

        emitters.set(uuid, eventEmitter);

        setTimeout(() => {
            eventEmitter.emit('timeout');
        }, timeout);

        socket.write(packagedData);
    });
    return channelPromise;
}

module.exports = channelPromise;
