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
const Logger = require('../utils/caliper-utils').getLogger('mqtt-master-messenger');
const ConfigUtil = require('../config/config-util');

const mqtt = require('mqtt');

/**
 * Messenger that is based on an mqtt implementation
 */
class MqttMasterMessenger extends MessengerInterface {

    /**
     * Constructor for MQTT Master
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
            Logger.info(`Connected to mqtt broker with clientID: ${this.mqttClient.options.clientId}`);

            // Subscribe to the topic that workers publish to
            this.mqttClient.subscribe('worker/update');

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
     * Configure the Messenger with the worker orchestrator
     * @param {WorkerOrchestrator} orchestrator the worker orchestrator
     */
    configure(orchestrator) {
        this.mqttClient.on('message', (topic, message) => {
            switch (topic) {
            case 'worker/update':
                Logger.debug(`Processing message from 'worker/update' topic and message: ${message}`);
                orchestrator.processWorkerUpdate(JSON.parse(message));
                break;
            default:
                Logger.warn(`No conditional for topic: ${topic}`);
            }
        });
    }

    /**
     * Get the client UUID
     * @returns {string} the UUID of the MQTT client connection instance
     */
    getUUID() {
        if (this.mqttClient) {
            return this.mqttClient.options.clientId;
        } else {
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
        this.mqttClient.publish('master/update', msg);
        Logger.debug(`Published message: ${msg}`);
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
 * Creates a new MqttMasterMessenger instance.
 * @param {object} messengerConfig the messenger configuration
 * @return {MqttMessenger} The MqttMasterMessenger instance.
 */
function createMessenger(messengerConfig) {
    return new MqttMasterMessenger(messengerConfig);
}

module.exports.createMessenger = createMessenger;
