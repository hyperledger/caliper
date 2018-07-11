/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict';

const Util = require('../../src/comm/util');

let configFile;
let networkFile;

/**
 * Set benchmark config file
 * @param {*} file config file of the benchmark,  default is config.json
 */
function setConfig(file) {
    configFile = file;
}

/**
 * Set benchmark network file
 * @param {*} file config file of the blockchain system, eg: fabric.json
 */
function setNetwork(file) {
    networkFile = file;
}

/**
 * Entry point of the Benchmarking script.
 */
function main() {
    let program = require('commander');
    program.version('0.1')
        .option('-c, --config <file>', 'config file of the benchmark, default is config.json', setConfig)
        .option('-n, --network <file>', 'config file of the blockchain system under test, if not provided, blockchain property in benchmark config is used', setNetwork)
        .parse(process.argv);

    const path = require('path');
    const fs = require('fs-extra');
    let absConfigFile;
    if(typeof configFile === 'undefined') {
        absConfigFile = path.join(__dirname, 'config.json');
    }
    else {
        absConfigFile = path.join(__dirname, configFile);
    }
    if(!fs.existsSync(absConfigFile)) {
        Util.log('file ' + absConfigFile + ' does not exist');
        return;
    }

    let absNetworkFile;
    let absCaliperDir = path.join(__dirname, '../..');
    if(typeof networkFile === 'undefined') {
        try{
            let config = require(absConfigFile);
            absNetworkFile = path.join(absCaliperDir, config.blockchain.config);
        }
        catch(err) {
            Util.log('failed to find blockchain.config in ' + absConfigFile);
            return;
        }
    }
    else {
        absNetworkFile = path.join(__dirname, networkFile);
    }
    if(!fs.existsSync(absNetworkFile)) {
        Util.log('file ' + absNetworkFile + ' does not exist');
        return;
    }


    const framework = require('../../src/comm/bench-flow.js');
    framework.run(absConfigFile, absNetworkFile);
}

main();






/*
var config_path;
if(process.argv.length < 3) {
    config_path = path.join(__dirname, 'config.json');
}
else {
    config_path = path.join(__dirname, process.argv[2]);
}

// use default framework to run the tests
var framework = require('../../src/comm/bench-flow.js');
framework.run(config_path);
*/
