/**
* Copyright Persistent Systems 2018. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*@file Implementation for block listener adapter.
*/

'use strict';
const kafka = require('kafka-node');
const Util = require('../comm/util');
const logger = Util.getLogger('block-listener-adapter.js');
let HighLevelProducer = kafka.HighLevelProducer;

let KafkaAdapter = class {
    /**
     * Constructor
     * @param {String} configPath path of the listener configuration file
     *
     */
    constructor(configPath) {
        this.listener_config = require('./listener-config.json');
        let zk_url = this.listener_config.zk_url;
        this.client_kafka = new kafka.Client(zk_url, this.listener_config.topic, { sessionTimeout: 300000, spinDelay: 100, retries: 2 });
        this.producer = new HighLevelProducer(this.client_kafka, { requireAcks: -1 });
        let args = require(configPath).caliper;
        this.bcObj = null;
        this.bcType = args.blockchain;

        switch (this.bcType) {
        case 'fabric': {
            const FabricListener = require('./listener-fabric.js');
            this.bcObj = new FabricListener(this.listener_config, this.client_kafka, this.producer, configPath);
            break;
        }
        default:
            throw new Error('Unknown blockchain type, ' + this.bcType);
        }
    }

    /**
     * Create Kafka topic. Event listener process will publish the block event and timestamp into this kafka topic
     */
    createTopic() {
        let self = this;
        this.producer.on('ready', function () {
            self.producer.createTopics([self.listener_config.topic], false, function (err, data) {
                if (err) {
                    logger.error('Error creating Topic', err);
                }
            });
        });
    }

    /**
    * get Blocks from the Blockchain node
    * @return {void} nothing
    */
    getBlocks() {
        return this.bcObj.getBlocks();
    }

    /**
    * close the kafka producer
    * @return {void} nothing
    */
    closeKafkaProducer () {
        process.exit(0);
    }
};
module.exports = KafkaAdapter;