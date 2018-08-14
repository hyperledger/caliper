/**
* Copyright Persistent Systems 2018. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*@file Implementation for block listener handler.
*/

'use strict';

let block_listener_adapter = require('./block-listener-adapter.js');

process.on('message', function(message) {
    let adapter = new block_listener_adapter (message.config);
    if(message.hasOwnProperty('type')) {
        try {
            switch(message.type) {
            case 'test': {
                adapter.createTopic();
                adapter.getBlocks();
                break;
            }
            case 'closeKafkaProducer': {
                adapter.closeKafkaProducer();
                break;
            }
            default: {
                process.send({type: 'error', data: 'unknown message type'});
            }
            }
        }
        catch(err) {
            process.send({type: 'error', data: err.toString()});
        }
    }
    else {
        process.send({type: 'error', data: 'unknown message type'});
    }

});

process.on('disconnect', function(){
    process.exit(0);
});