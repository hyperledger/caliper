/**
* Copyright Persistent Systems 2018. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
@file Implementation for Fabric Event listener to connect to the peer Event Hub and recieve blocks.
*/

'use strict';

const Client = require('fabric-client');
const fs = require('fs');
const path = require('path');
let testUtil = require('../fabric/util.js');
const Util = require('../comm/util');
const logger = Util.getLogger('listener-fabric.js');
const rootPath = '../../';


/**
 * Fabric Listener class, define operations to recieve block events from Fabric Peer and publish into kafka
 */
class FabricListener {
    /**
     * Constructor
     * @param {String} listener_config path of the listener configuration file
     * @param {Client} client_kafka, Kafka client
     * @param {Producer} producer, Kafka HighLevelProducer
     * @param {String} configPath path of the blockchain configuration file
     */
    constructor(listener_config, client_kafka, producer, configPath) {

        this.testUtil = testUtil;
        this.testUtil.init(configPath);
        this.peerEventObject = {};
        this.peerEventObject.eventUrl = listener_config.peerEventUrl;
        let tlsCert = fs.readFileSync(path.join(__dirname, rootPath, listener_config.peerEventTlscaPath));
        this.peerEventObject.eventTlsca = tlsCert;
        this.peerEventObject.eventServerHostName =listener_config.peerEventHostnameOverride;
        this.peerEventObject.org = listener_config.peerOrg;
        this.client = new Client();
        this.client_kafka = client_kafka;
        this.producer = producer;
        this.listener_config = listener_config;

    }

    /**
     * Listen for block event from fabric peer, record the timestamp and publish it into kafka.
     * This timestamp is used by the metric calculator process to calculate the tps and latency.
     *
     */
    getBlocks() {
        let self = this;
        self.client_kafka.on('error', function (error) {
            logger.error('Kafka client ERROR', error);
        });

        self.producer.on('ready', function () {
            Client.newDefaultKeyValueStore({ path: '../hfc/hfc-test-kvs_peerOrg1' }).then((store) => {

                self.client.setStateStore(store);
                return self.testUtil.getSubmitter(self.client, true, self.peerEventObject.org);

            }).then((admin) => {

                self.client._userContext = admin;
                let eh = self.client.newEventHub();
                eh.setPeerAddr(
                    self.peerEventObject.eventUrl,
                    {
                        pem: Buffer.from(self.peerEventObject.eventTlsca).toString(),
                        'ssl-target-name-override': self.peerEventObject.eventServerHostName,
                        'request-timeout': 12000000,
                        'grpc.max_receive_message_length': -1
                    }
                );
                eh.connect();

                eh.registerBlockEvent((block) => {
                    let event_data = {};
                    event_data.validTime = Date.now();
                    event_data.block = block;
                    let payload = [{
                        topic: self.listener_config.topic,
                        messages: JSON.stringify(event_data),
                        partition: 0,
                        attributes: 1
                    }];
                    self.producer.send(payload, function (error, result) {
                        if (error) {
                            logger.error('Error while publishing block in kafka', error);
                        }
                    });

                },
                (err) => {
                    logger.error('Error in chaincode Event listener :', err);
                }
                );
            });

        });
        self.producer.on('error', function (error) {
            logger.error('Producer is not ready', error);
        });

    }

}

module.exports = FabricListener;
