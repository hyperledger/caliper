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

const { spawn }= require('child_process');

/**
 * Internal Utility Class
 * <p><a href="diagrams/util.svg"><img src="diagrams/util.svg" style="width:100%;"/></a></p>
 * @private
 */
class CmdUtil {


    /** Simple log method to output to the console
     * Used to put a single console.log() here, so eslinting is easier.
     * And if this needs to written to a file at some point it is also eaiser
     */
    static log(){
        Array.from(arguments).forEach((s)=>{
            // eslint-disable-next-line no-console
            console.log(s);
        });
    }

    /**
     * Perform a sleep
     * @param {*} ms the time to sleep, in ms
     * @returns {Promise} a completed promise
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Invokes a given command in a spawned child process and attaches all standard IO.
     * @param {string} cmd The command to be run.
     * @param {string[]} args The array of arguments to pass to the command.
     * @param {object} env The key-value pairs of environment variables to set.
     * @param {string} cwd The current working directory to set.
     * @returns {Promise} A Promise that is resolved or rejected.
     */
    static invokeCommand(cmd, args, env, cwd) {
        return new Promise((resolve, reject) => {
            let proc = spawn(cmd, args, {
                stdio: 'inherit',
                cwd: cwd || './',
                env: { ...process.env, ...env }
            });

            proc.on('exit', (code, signal) => {
                if(code !== 0) {
                    return reject(new Error(`Failed to execute "${cmd}" with return code ${code}.${signal ? ` Signal: ${signal}` : ''}`));
                }
                resolve();
            });
        });
    }

    /**
     * Invokes a given command in a spawned child process and returns its output.
     * @param {string} cmd The command to be run.
     * @param {string[]} args The array of arguments to pass to the command.
     * @param {object} env The key-value pairs of environment variables to set.
     * @param {string} cwd The current working directory to set.
     * @returns {Promise} A Promise that is resolved with the command output or rejected with an Error.
     */
    static getCommandOutput(cmd, args, env, cwd) {
        return new Promise((resolve, reject) => {
            let output = '';
            let proc = spawn(cmd, args, {
                cwd: cwd || './',
                env: {
                    ...process.env,
                    ...env
                }
            });

            proc.stdout.on('data', (data) => {
                output += data.toString();
            });

            proc.on('exit', (code, signal) => {
                if(code !== 0) {
                    return reject(new Error(`Failed to execute "${cmd}" with return code ${code}.${signal ? ` Signal: ${signal}` : ''}`));
                }
                resolve(output.trim());
            });
        });
    }
}

module.exports = CmdUtil;
