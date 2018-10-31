/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict';

const Util = require('../../src/comm/util.js');
let configFile;
let networkFile;
/**
 * sets the config file
 * @param {string} file indicates config file name
 * @returns {void}
 **/
function setConfig(file) {
    configFile = file;
}

/**
 * sets the network file
 * @param {string} file indicates network file name
 * @returns {void}
 **/
function setNetwork(file) {
    networkFile = file;
}

/**
 * iniate and starts the benchmark test with input config params
 * @returns {void}
 **/
function main() {
    let program = require('commander');
    program.version('0.1')
        .option('-c, --config <file>', 'config file of the benchmark, default is config.json', setConfig)
        .option('-n, --network <file>', 'config file of the blockchain system under test, if not provided, blockchain property in benchmark config is used', setNetwork)
        .parse(process.argv);

    let path = require('path');
    let fs = require('fs-extra');
    let logger;
    let absConfigFile;
    if(typeof configFile === 'undefined') {
        absConfigFile = path.join(__dirname, 'config.json');
    }
    else {
        absConfigFile = path.join(__dirname, configFile);
    }
    if(!fs.existsSync(absConfigFile)) {
        logger= Util.getLogger('benchamark/smallbank/main.js');
        logger.error('file ' + absConfigFile + ' does not exist');
        return;
    }
    else{
        logger= Util.getLogger('benchamark/smallbank/main.js');
    }

    let absNetworkFile;
    let absCaliperDir = path.join(__dirname, '../..');
    if(typeof networkFile === 'undefined') {
        try{
            let config = require(absConfigFile);
            absNetworkFile = path.join(absCaliperDir, config.blockchain.config);
        }
        catch(err) {
            logger.error('failed to find blockchain.config in ' + absConfigFile);
            return;
        }
    }
    else {
        absNetworkFile = path.join(__dirname, networkFile);
    }
    if(!fs.existsSync(absNetworkFile)) {
        logger.error('file ' + absNetworkFile + ' does not exist');
        return;
    }


    let framework = require('../../src/comm/bench-flow.js');
    framework.run(absConfigFile, absNetworkFile);
}

main();
