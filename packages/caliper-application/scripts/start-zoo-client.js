/**
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict';

const {CaliperUtils, CaliperZooClient} = require('caliper-core');

const path = require('path');
const fs = require('fs');

let zooClient;
/**
 * main for creating a zoo client
 */
async function main() {
    let program = require('commander');
    program
        .allowUnknownOption()
        .option('-a, --address <string>', 'zookeeper address')
        .option('-n, --network <file>', 'config file of the blockchain system under test')
        .parse(process.argv);

    let logger = CaliperUtils.getLogger('scripts/zoo.js');

    if(typeof program.address === 'undefined') {
        logger.error('zookeeper address is required');
        process.exit(1);
    }
    if(typeof program.network === 'undefined') {
        logger.error('network file is required');
        process.exit(1);
    }

    let absNetworkFile = path.isAbsolute(program.network) ? program.network : path.join(__dirname, program.network);
    if(!fs.existsSync(absNetworkFile)) {
        logger.error('file ' + absNetworkFile + ' does not exist');
        process.exit(1);
    }

    let blockchainType = '';
    let networkObject = CaliperUtils.parseYaml(absNetworkFile);
    if (networkObject.hasOwnProperty('caliper') && networkObject.caliper.hasOwnProperty('blockchain')) {
        blockchainType = networkObject.caliper.blockchain;
    } else {
        throw new Error('The ' + absNetworkFile + ' has no blockchain type')
    }


    // Obtain the root path from which all relative paths in the network config files are based from
    const workspace = path.join(__dirname, '../');

    try {
        logger.info('Starting zookeeper client of type ' + blockchainType);
        // Define the blockchain client types based on passed -t option
        const {ClientFactory} = require('caliper-' + blockchainType);
        const clientFactory = new ClientFactory(absNetworkFile, workspace);

        zooClient = new CaliperZooClient(program.address, clientFactory, workspace);
        zooClient.start();
    } catch (err) {
        logger.error(`Error while executing the benchmark: ${err.stack ? err.stack : err}`);
        process.exit(1);
    }
}

main();
