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

const MessengerInterface = require('./messenger-interface');
const Logger = require('../utils/caliper-utils').getLogger('mqtt-worker-messenger');
const ConfigUtil = require('../config/config-util');
const MessageHandler = require('../../worker/client/message-handler');

const mqtt = require('mqtt');

/**
 * Messenger that is based on an mqtt implementation
 */
class MqttWorkerMessenger extends MessengerInterface {

    /**
     * Constructor for MQTT Worker
     * @param {object} configuration configuration details
     */
    constructor(configuration) {
        super(configuration);
        this.configuration.address = ConfigUtil.get(ConfigUtil.keys.Worker.Communication.Address);
    }

    /**
     * Initialize the Messenger
     * @async
     */
    async initialize() {
        Logger.info('Initializing MQTT messenger ... ');

        const messengerConnectedPromise = new Promise((resolve, reject) => {
            this.messengerConnectedPromise = {
                resolve: resolve,
                reject:  reject
            };
        });

        this.mqttClient = mqtt.connect(this.configuration.address);

        this.mqttClient.on('connect', () => {
            const clientId = this.mqttClient.options.clientId;
            Logger.info(`${this.configuration.sut} worker connected with mqtt clientId ${clientId}`);

            // Subscribe to the update topic
            Logger.info(`${this.configuration.sut} worker with mqtt clientId ${clientId} subscribing to topic "master/update"`);
            this.mqttClient.subscribe('master/update');

            // resolve promise so that connection can complete
            this.connected = true;
            this.messengerConnectedPromise.resolve();
        });

        this.mqttClient.on('error', (error) => {
            if (this.connected) {
                Logger.error('MQTT Message error: ', error);
            } else {
                this.messengerConnectedPromise.reject(error);
            }
        });

        await messengerConnectedPromise;
    }

    /**
     * Get the client UUID
     * @returns {string} the UUID of the MQTT client connection instance
     */
    getUUID() {
        if (this.mqttClient) {
            return this.mqttClient.options.clientId;
        } else {
            Logger.error('No client constructed');
            return undefined;
        }
    }

    /**
     * Send a message using the messenger
     * @param {object} message the message to send
     */
    send(message) {
        // Convert to string and send
        const msg = JSON.stringify(message);
        this.mqttClient.publish('worker/update', msg);
        Logger.debug(`${this.configuration.sut} worker published message: ${msg}`);
    }

    /**
     * Configure the Messenger for use
     * @param {MessageHandler} handlerContext a configured message handler
     */
    configure(handlerContext) {
        this.mqttClient.on('message', async (topic, message) => {
            switch (topic) {
            case 'master/update':{
                const msg = JSON.parse(message);
                // Only action if intended for this client
                if (msg.to.includes(this.getUUID()) || msg.to.includes('all')) {
                    await MessageHandler.handle(handlerContext, msg.data);
                }
                break;
            }
            default:
                Logger.info(`No conditional for topic: ${topic}`);
            }
        });
    }

    /**
     * Clean up any resources associated with the messenger.
     */
    async dispose() {
        Logger.info('Disconnecting from MQTT service');
        const messengerDisconnectedPromise = new Promise((resolve, reject) => {
            this.messengerDisconnectedPromise = {
                resolve: resolve,
                reject:  reject
            };
        });

        this.mqttClient.end(false, {}, () => {
            Logger.info('MQTT connection closed');
            this.messengerDisconnectedPromise.resolve();
        });

        await messengerDisconnectedPromise;
    }

}

/**
 * Creates a new MqttWorkerMessenger instance.
 * @param {object} messengerConfig the messenger configuration
 * @return {MqttMessenger} The MqttWorkerMessenger instance.
 */
function createMessenger(messengerConfig) {
    return new MqttWorkerMessenger(messengerConfig);
}

module.exports.createMessenger = createMessenger;
