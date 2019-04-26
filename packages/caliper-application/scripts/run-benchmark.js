/**
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict';

const {CaliperFlow, CaliperUtils} = require('caliper-core');

const path = require('path');
const fs = require('fs');

/**
 * main run method for benchmarking
 */
async function main() {
    let program = require('commander');
    program
        .allowUnknownOption()
        .option('-c, --config <file>', 'config file of the benchmark')
        .option('-n, --network <file>', 'config file of the blockchain system under test')
        .parse(process.argv);

    let logger = CaliperUtils.getLogger('scripts/run.js');

    if(typeof program.config === 'undefined') {
        logger.error('config file is required');
        process.exit(1);
    }

    if(typeof program.network === 'undefined') {
        logger.error('network file is required');
        process.exit(1);
    }

    let absConfigFile = path.isAbsolute(program.config) ? program.config : path.join(__dirname, program.config);
    if(!fs.existsSync(absConfigFile)) {
        logger.error('file ' + absConfigFile + ' does not exist');
        process.exit(1);
    }

    let absNetworkFile = path.isAbsolute(program.network) ? program.network : path.join(__dirname, program.network);
    if(!fs.existsSync(absNetworkFile)) {
        logger.error('file ' + absNetworkFile + ' does not exist');
        process.exit(1);
    }

    // Obtain the root path from which all relative paths in the network config files are based from
    const workspace = path.join(__dirname, '../');

    let blockchainType = '';
    let networkObject = CaliperUtils.parseYaml(absNetworkFile);
    if (networkObject.hasOwnProperty('caliper') && networkObject.caliper.hasOwnProperty('blockchain')) {
        blockchainType = networkObject.caliper.blockchain;
    } else {
        throw new Error('The ' + absNetworkFile + ' has no blockchain type') 
    }

    try {
        logger.info('Benchmarr for target Blockchain type ' + blockchainType + ' about to start');
        // Define the blockchain client types based on passed -t option
        const {AdminClient, ClientFactory} = require('caliper-' + blockchainType);
        const adminClient = new AdminClient(absNetworkFile, workspace);
        const clientFactory = new ClientFactory(absNetworkFile, workspace);

        const exitStatus = await CaliperFlow.run(absConfigFile, absNetworkFile, adminClient, clientFactory, workspace);

        logger.info('Benchmark run successfully');
        process.exit(exitStatus);
    } catch (err) {
        logger.error(`Error while executing the benchmark: ${err.stack ? err.stack : err}`);
        process.exit(1);
    }
}

main();
