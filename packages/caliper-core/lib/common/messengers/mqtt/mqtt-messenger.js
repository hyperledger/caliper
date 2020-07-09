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

const mqtt = require('mqtt');
const MessengerInterface = require('./../messenger-interface');
const ParseMessage = require('./../../messages/parse');

const Logger = require('./../../utils/caliper-utils').getLogger('mqtt-messenger');
const ConfigUtil = require('./../../config/config-util');

/**
 * MQTT-based messenger implementation for both the manager and the workers.
 *
 * @property {string} address The address of the MQTT broker to communicate with.
 * @property {string} sourceTopic The topic the messenger should subscribe to.
 * @property {string} targetTopic The topic the messenger should publish to.
 * @property {boolean} connected Indicates whether the messenger is connected to the broker or not.
 * @property {MqttClient} mqttClient The underlying MQTT client instance.
 */
class MqttMessenger extends MessengerInterface {

    /**
     * Constructor for the MQTT messenger class.
     * @param {object} configuration User-provided configuration details for the messenger.
     * @param {string} sourceTopic The name of the topic the messenger should subscribe to.
     * @param {string} targetTopic The name of the topic the messenger should publish to.
     */
    constructor(configuration, sourceTopic, targetTopic) {
        super(configuration);
        this.address = ConfigUtil.get(ConfigUtil.keys.Worker.Communication.Address);
        this.sourceTopic = sourceTopic;
        this.targetTopic = targetTopic;
        this.connected = false;
    }

    /**
     * Initialize the messenger instance.
     * @async
     */
    async initialize() {
        Logger.debug('Initializing MQTT messenger ... ');

        let promiseFunctions;
        const promise = new Promise((resolve, reject) => {
            promiseFunctions = {
                resolve: resolve,
                reject:  reject
            };
        });

        this.mqttClient = mqtt.connect(this.address);

        const self = this;
        this.mqttClient.on('connect', () => {
            self.connected = true;
            const clientId = self.mqttClient.options.clientId;

            Logger.debug(`Messenger connected to MQTT with ID "${clientId}"`);
            Logger.debug(`MQTT messenger "${clientId}" subscribing to topic "${self.sourceTopic}"`);

            self.mqttClient.subscribe(self.sourceTopic);
            promiseFunctions.resolve();
        });

        this.mqttClient.on('error', (error) => {
            if (self.connected) {
                Logger.warn(`MQTT messenger "${self.mqttClient.options.clientId}" error: ${error.message}`);
            } else {
                Logger.error(`MQTT messenger error: ${error.stack}`);
                promiseFunctions.reject(error);
            }
        });

        await promise;

        this.mqttClient.on('message', (topic, message) => {
            const uuid = self.getUUID();
            const msgString = message.toString('utf-8');
            Logger.debug(`Messenger "${uuid}" processing message from topic ${topic}: ${msgString}`);
            const msg = ParseMessage(msgString);

            if (topic === self.sourceTopic) {
                // Only action if intended for this messenger
                if (msg.forRecipient(uuid)) {
                    self.onMessage(msg);
                } else {
                    Logger.debug(`Messenger "${uuid}" ignored message from topic "${topic}": ${msgString}`);
                }
            } else {
                Logger.warn(`Received message from unknown MQTT topic: ${topic}`);
            }
        });
    }

    /**
     * Get the UUID for the messenger instance to use as sender or recipient address.
     * @return {string} The UUID of the messenger.
     */
    getUUID() {
        if (this.mqttClient) {
            return this.mqttClient.options.clientId;
        } else {
            Logger.warn('No MQTT client is constructed');
            return undefined;
        }
    }

    /**
     * Configure the messenger instance with the related processes.
     * @param {Process[]} processes The process instances this process can communicate with.
     */
    async configureProcessInstances(processes) {
        // NOOP, doesn't require direct communication between processes
    }

    /**
     * Send a message using the messenger.
     * @param {Message} message The message object.
     */
    send(message) {
        const msg = message.stringify();
        this.mqttClient.publish(this.targetTopic, msg);
        Logger.debug(`Messenger "${this.getUUID()}" published message to topic "${this.targetTopic}": ${msg}`);
    }

    /**
     * Clean up any resources associated with the messenger.
     */
    async dispose() {
        Logger.debug('Disconnecting from MQTT service');
        let promiseFunctions;
        const promise = new Promise((resolve, reject) => {
            promiseFunctions = {
                resolve: resolve,
                reject:  reject
            };
        });

        this.mqttClient.end(false, {}, () => {
            Logger.debug('MQTT connection closed');
            promiseFunctions.resolve();
        });

        await promise;
    }

}

module.exports = MqttMessenger;
