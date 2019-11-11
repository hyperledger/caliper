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

const util = require('../../common/utils/caliper-utils');

const logger = util.getLogger('client.js');

/**
 * Class for Client Orchestration
 */
class ClientOrchestrator {
    /**
     * Constructor
     * @param {object} benchmarkConfig The benchmark configuration object.
     * @param {object} workerFactory The factory for the worker processes.
     * @param {object[]} workerArguments Array of arbitrary arguments to pass to the worker processes.
     */
    constructor(benchmarkConfig, workerFactory, workerArguments) {
        this.config = benchmarkConfig.test.clients;
        this.workerFactory = workerFactory;
        this.workerArguments = workerArguments;

        if(this.config.hasOwnProperty('number')) {
            this.number = this.config.number;
        } else {
            this.number = 1;
        }

        logger.info(`Configured number of worker processes: ${this.number}`);

        this.updates = {id:0, data:[]};           // contains txUpdated messages
        this.processes  = {};
    }

    /**
    * Start the test
    * message = {
    *              type: 'test',
    *              label : label name,
    *              numb:   total number of simulated txs,
    *              rateControl: rate controller to use
    *              trim:   trim options
    *              args:   user defined arguments,
    *              cb  :   path of the callback js file,
    *              config: path of the blockchain config file   // TODO: how to deal with the local config file when transfer it to a remote client (via zookeeper), as well as any local materials like crypto keys??
    *            };
    * @param {JSON} test test specification
    * @returns {Object[]} the test results array
    * @async
    */
    async startTest(test) {
        this.updates.data = [];
        this.updates.id++;

        const results = [];
        await this._startTest(this.number, test, this.updates.data, results);
        const testOutput = this.formatResults(results);
        return testOutput;
    }

    /**
     * Start a test
     * @param {Number} number test clients' count
     * @param {JSON} test test specification
     * @param {Array} updates array to save txUpdate results
     * @param {Array} results array to save the test results
     * @async
     */
    async _startTest(number, test, updates, results) {

        // Conditionally launch clients on the test round. Subsequent tests should re-use existing clients.
        if (Object.keys(this.processes).length === 0) {
            // launch clients
            const readyPromises = [];
            this.processes = {};
            for (let i = 0 ; i < number ; i++) {
                this.launchClient(updates, results, readyPromises);
            }
            // wait for all clients to have initialized
            logger.info(`Waiting for ${readyPromises.length} clients to be ready... `);

            await Promise.all(readyPromises);

            logger.info(`${readyPromises.length} clients ready, starting test phase`);
        } else {
            logger.info(`Existing ${Object.keys(this.processes).length} clients will be reused in next test round... `);
        }

        let txPerClient;
        let totalTx = test.numb;
        if (test.numb) {
            // Run specified number of transactions
            txPerClient  = Math.floor(test.numb / number);

            // trim should be based on client number if specified with txNumber
            if (test.trim) {
                test.trim = Math.floor(test.trim / number);
            }

            if(txPerClient < 1) {
                txPerClient = 1;
            }
            test.numb = txPerClient;
        } else if (test.txDuration) {
            // Run for time specified txDuration based on clients
            // Do nothing, we run for the time specified within test.txDuration
        } else {
            throw new Error('Unconditioned transaction rate driving mode');
        }

        let promises = [];
        let idx = 0;
        for (let id in this.processes) {
            let client = this.processes[id];
            let p = new Promise((resolve, reject) => {
                client.obj.promise = {
                    resolve: resolve,
                    reject:  reject
                };
            });
            promises.push(p);
            client.results = results;
            client.updates = updates;
            test.clientArgs = this.workerArguments[idx];
            test.clientIdx = idx;
            test.totalClients = number;

            if(totalTx % number !== 0 && idx === number-1){
                test.numb = totalTx - txPerClient*(number - 1);
            }

            // send test specification to client and update idx
            client.obj.send(test);
            idx++;
        }

        await Promise.all(promises);
        // clear promises
        for (let client in this.processes) {
            if (client.obj && client.ob.promise) {
                delete client.obj.promise;
            }
        }
    }

    /**
     * Stop all test clients(child processes)
     */
    stop() {
        for (let pid in this.processes) {
            this.processes[pid].obj.kill();
        }
        this.processes = {};
    }

    /**
     * Get the update array
     * @return {Array} update array
     */
    getUpdates() {
        return this.updates;
    }

    /**
     * Call the Promise function for a process
     * @param {String} pid pid of the client process
     * @param {Boolean} isResolve indicates resolve(true) or reject(false)
     * @param {Object} msg input for the Promise function
     * @param {Boolean} isReady indicates promise type ready(true) promise(false)
     */
    setPromise(pid, isResolve, msg, isReady) {
        const client = this.processes[pid];
        if (client) {
            const type = isReady ? 'ready' : 'promise';
            const clientObj = client.obj;
            if(clientObj && clientObj[type] && typeof clientObj[type] !== 'undefined') {
                if(isResolve) {
                    clientObj[type].resolve(msg);
                }
                else {
                    clientObj[type].reject(msg);
                }
            } else {
                throw new Error('Unconditioned case within setPromise()');
            }
        }
    }

    /**
     * Push test result from a child process into the global array
     * @param {String} pid pid of the child process
     * @param {Object} data test result
     */
    pushResult(pid, data) {
        let p = this.processes[pid];
        if (p && p.results && typeof p.results !== 'undefined') {
            p.results.push(data);
        }
    }

    /**
     * Push update value from a child process into the global array
     * @param {String} pid pid of the child process
     * @param {Object} data update value
     */
    pushUpdate(pid, data) {
        let p = this.processes[pid];
        if (p && p.updates && typeof p.updates !== 'undefined') {
            p.updates.push(data);
        }
    }

    /**
     * Launch a client process to do the test
     * @param {Array} updates array to save txUpdate results
     * @param {Array} results array to save the test results
     * @param {Array} readyPromises array to hold ready promises
     */
    launchClient(updates, results, readyPromises) {
        let client = this.workerFactory.spawnWorker();
        let pid   = client.pid.toString();

        logger.info('Launching client with PID ', pid);
        this.processes[pid] = {obj: client, results: results, updates: updates};

        let p = new Promise((resolve, reject) => {
            client.ready = {
                resolve: resolve,
                reject:  reject
            };
        });

        readyPromises.push(p);

        const self = this;
        client.on('message', function(msg) {
            if (msg.type === 'ready') {
                logger.info('Client ready message received');
                self.setPromise(pid, true, null, true);
            } else if (msg.type === 'txUpdated') {
                self.pushUpdate(pid, msg.data);
            } else if (msg.type === 'txReset') {
                self.pushUpdate(pid, msg.data);
            } else if (msg.type === 'testResult') {
                self.pushResult(pid, msg.data);
                self.setPromise(pid, true, null);
            } else if (msg.type === 'error') {
                self.setPromise(pid, false, new Error('Client encountered error:' + msg.data));
            } else {
                self.setPromise(pid, false, new Error('Client returned unexpected message type:' + msg.type));
            }
        });

        client.on('error', function() {
            self.setPromise(pid, false, new Error('Client encountered unexpected error'));
        });

        client.on('exit', function(code, signal) {
            logger.info(`Client exited with code ${code}`);
            self.setPromise(pid, false, new Error('Client already exited'));
        });
    }

    /**
     * Send message to all child processes
     * @param {JSON} message message
     * @return {Number} number of child processes
     */
    sendMessage(message) {
        for (let pid in this.processes) {
            this.processes[pid].obj.send(message);
        }
        return this.processes.length;
    }

    /**
     * Format the final test results for subsequent consumption from [ {result: [], start: val, end: val}, {result: [], start: val, end: val}, {result: [], start: val, end: val}]
     * to {results: [val, val], start: val, end: val}
     * @param {JSON[]} results an Array of JSON objects
     * @return {JSON} an appropriately formatted result
     */
    formatResults(results) {

        let resultArray = [];
        let allStartedTime = null;
        let allFinishedTime = null;
        for (const clientResult of results){
            // Start building the array of all client results
            resultArray = resultArray.concat(clientResult.results);

            // Track all started/complete times
            if (!allStartedTime || clientResult.start > allStartedTime) {
                allStartedTime = clientResult.start;
            }

            if (!allFinishedTime || clientResult.end < allFinishedTime) {
                allFinishedTime = clientResult.end;
            }
        }

        return {
            results: resultArray,
            start: allStartedTime,
            end: allFinishedTime
        };
    }

}

module.exports = ClientOrchestrator;
