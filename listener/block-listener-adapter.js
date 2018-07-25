/**
* Copyright Persistent Systems 2018. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*@file Implementation for block listener adapter.
*/ 

'use strict'

const path = require('path');
const fs = require('fs');
const os = require('os');
const kafka = require('kafka-node');
const Util = require('../src/comm/util');
const log = Util.log;
var HighLevelProducer = kafka.HighLevelProducer;
var KeyedMessage = kafka.KeyedMessage;

var KafkaAdapter = class {
    constructor(configPath) {
        this.listener_config = require("./listener-config.json")
        let zk_url = this.listener_config.zk_url
        this.client_kafka = new kafka.Client(zk_url, this.listener_config.topic, { sessionTimeout: 300000, spinDelay: 100, retries: 2 });
        this.producer = new HighLevelProducer(this.client_kafka, { requireAcks: -1 })
        let args = require(configPath).blockchain;
        this.bcObj = null;
        this.bcType = args.type;

        switch (this.bcType) {
            case 'fabric':
                const FabricListener = require('./listener-fabric.js');
                this.bcObj = new FabricListener(this.listener_config, this.client_kafka, this.producer, configPath);
                break;
            default:
                throw new Error('Unknown blockchain type, ' + this.bcType);
        }
    }

    /**
     * Create Kafka topic
     */
    createTopic() {
        var self = this
        this.producer.on('ready', function () {
            self.producer.createTopics([self.listener_config.topic], false, function (err, data) {
                if (err) {
                    log("Error creating Topic", err)

                } else {

                }
            })
        })
    }

    /**
    * get Blocks from the Blockchain node
    * @return {Promise}
    */
    getBlocks() {
        return this.bcObj.getBlocks();
    }

}
module.exports = KafkaAdapter;