/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict';

var path = require('path');
var fs = require('fs-extra');
var exec = require('child_process').exec;
const Util = require('../src/comm/util');

async function main() {
    let program = require('commander');
    program
        .allowUnknownOption()
        .option('-c, --config <file>', 'config file of the benchmark')
        .option('-n, --network <file>', 'config file of the blockchain system under test')
        .parse(process.argv);

    let logger = Util.getLogger('scripts/main.js');
    let absConfigFile;
    if(typeof program.config === 'undefined') {
      logger.error('config file is required');
      return;
    }
    else {
        absConfigFile = path.isAbsolute(program.config) ? program.config : path.join(__dirname, '/../', program.config);
    }
    if(!fs.existsSync(absConfigFile)) {
        logger.error('file ' + absConfigFile + ' does not exist');
        return;
    }

    let absNetworkFile;
    if(typeof program.network === 'undefined') {
        logger.error('network file is required');
        return;
    }
    else {
        absNetworkFile = path.isAbsolute(program.network) ? program.network : path.join(__dirname, '/../', program.network);
    }
    if(!fs.existsSync(absNetworkFile)) {
        logger.error('file ' + absNetworkFile + ' does not exist');
        return;
    }

    const framework = require('../src/comm/bench-flow.js');
    try { 
        await framework.run(absConfigFile, absNetworkFile); 
        logger.info('Benchmark run successfully');
        process.exit(0); 
    } catch (err) { 
        logger.error(`Error while executing the benchmark: ${err.stack ? err.stack : err}`); 
        process.exit(1); 
    }
}

main();
