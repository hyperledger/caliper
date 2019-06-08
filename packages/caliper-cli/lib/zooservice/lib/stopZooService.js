/*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

'use strict';

const childProcess = require('child_process');
const exec = childProcess.exec;

const chalk = require('chalk');
const cmdUtil = require('../../utils/cmdutils');

/**
 * Stop the zoo service
 */
class StopZooService {

    /**
    * Command process for run benchmark command
    * @param {string} argv argument list from caliper command
    */
    static async handler(argv) {
        let cmd = 'docker-compose -f ';
        if (argv.config){
            cmd += argv.config + ' down';
        } else {
            cmdUtil.log(chalk.blue.bold('Using default configuration file'));
            cmd += __dirname + '/zookeeper-service.yaml down';
        }

        cmdUtil.log(chalk.blue.bold('Stoping zookeeper service ......'));
        await StopZooService.execAsync(cmd);
        cmdUtil.log(chalk.blue.bold('Stop zookeeper service successful'));
    }

    /**
     * Executes the given command asynchronously.
     * @param {string} command The command to execute through a newly spawn shell.
     * @return {Promise} The return promise is resolved upon the successful execution of the command, or rejected with an Error instance.
     * @async
     */
    static execAsync(command) {
        return new Promise((resolve, reject) => {
            cmdUtil.log(chalk.blue.bold(`Executing command: ${command}`));
            let child = exec(command, (err, stdout, stderr) => {
                if (err) {
                    cmdUtil.log(chalk.red.bold(`Unsuccessful command execution. Error code: ${err.code}. Terminating signal: ${err.signal}`));
                    return reject(err);
                }
                return resolve();
            });
            child.stdout.pipe(process.stdout);
            child.stderr.pipe(process.stderr);
        });
    }
}

module.exports = StopZooService;
