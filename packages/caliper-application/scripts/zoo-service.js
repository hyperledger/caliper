/**
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict';

const {CaliperUtils} = require('caliper-core');
const childProcess = require('child_process');
const exec = childProcess.exec;

let logger = CaliperUtils.getLogger('scripts/zoo-service.js');

/**
 * main for starting or stoping a zoo service
 */
async function main() {

    let program = require('commander');
    program
        .version('0.1.0')
        .option('-t, --type <string>', 'start or stop')
        .parse(process.argv);
   if (program.type === 'start') {
       start();
   }else if(program.type === 'stop') {
       stop();
   }else {
       logger.error('Only support -t start or -t stop');
   }
}

/**
 * Start a zoo service
 */
async function start() {
    const up = 'docker-compose -f zookeeper-service.yaml up -d';
    logger.info('Starting zookeeper service ......');
    await execAsync(up);
    logger.info('Start zookeeper service successful');
}

/**
 * Stop a zoo service
 */
async function stop() {
    const down = 'docker-compose -f zookeeper-service.yaml down';
    logger.info('Stoping zookeeper service ......');
    await execAsync(down);
    logger.info('Stop zookeeper service successful');
}

/**
 * Executes the given command asynchronously.
 * @param {string} command The command to execute through a newly spawn shell.
 * @return {Promise} The return promise is resolved upon the successful execution of the command, or rejected with an Error instance.
 * @async
 */
function execAsync(command) {
    return new Promise((resolve, reject) => {
        logger.info(`Executing command: ${command}`);
        let child = exec(command, (err, stdout, stderr) => {
            if (err) {
                logger.error(`Unsuccessful command execution. Error code: ${err.code}. Terminating signal: ${err.signal}`);
                return reject(err);
            }
            return resolve();
        });
        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);
    });
}

main();
