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
/*
 * Author:               Jason You
 * Last modified date:   Feb 28 2020
 *
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
/*jshint esversion: 6 */




const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const shell = require('shelljs');

// caliper-core dependencies
const {
    CaliperUtils
} = require('@hyperledger/caliper-core');
const CaliperFlow = require('../gui-caliper-flow');
// development dependencies
const express = require('express');
const api = express.Router();
const multer = require('multer'); // for file reading
const mime = require('mime-types');

// sample config files
const sampleTestConfigPath = 'data/sample-config/sample-test-config.yaml';
const sampleNetworkConfigPath = 'data/sample-config/sample-network-config-fabric-v1.4.yaml';
// user uploaded config files
const configPath = 'data/config/'; // relative to the app.js in ./caliper-api
let networkConfigFile = '';
let testConfigFile = '';

// Run benchmark config parameters
let benchConfigFile = '';
let blockchainConfigFile = '';
let workspace = '';

// const TEST_START = false; // global variable to check test start/end status

/* Remove the comment for MongoDB development */

// // MongoDB dependencies
// const mongo = require('mongodb').MongoClient;
// const mongoUrl = 'mongodb://localhost:27017';

// // test db
// let mongodbOptions = {
//     useUnifiedTopology: true,
//     useNewUrlParser: true,
// };

// mongo.connect(mongoUrl, mongodbOptions, (err, client) => {
//     if (err) {
//         console.log(err);
//         return;
//     } else {
//         console.log("TODO: Add more API POST/GET request in the mongoDB connection");
//         const db = client.db('caliper');
//         const collectionConfig = db.collection('config');
//         const collectionData = db.collection('data');
//         collectionConfig.insertOne({
//             name: 'Caliper-GUI-Server-Test'
//         }, (err, result) => {
//             if (err) {
//                 console.log(err);
//             }
//             console.log('[DB] result:', result);
//         });
//     }
// });

// Check the existence of a path, and create if it doesn't exists
const checkPath = function(path) {
    return fs.existsSync(path);
};

// recursively create directory in path
const createPath = function(path) {
    shell.mkdir('-p', path);
};

// Set up multer to take configuration files uploaeded by user
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!checkPath(configPath)) {
            createPath(configPath);
        } // make sure that path exists
        cb(null, configPath);
    },
    filename: (req, file, cb) => {
        // const filename = file.fieldname + '-' + Date.now();
        const filename = file.fieldname + '.yaml';
        cb(null, filename);
    }
});

// Get the upload multer function to create a publish function
// @param {String} configType: the key or file field name
// @return {String} a publish function
const getPublish = function(configType) {
    let upload = multer({
        storage: storage,
        fileFilter: (req, file, cb) => {
            // Check the mime type of the received file first
            let mimeType = mime.lookup(file.originalname);
            if (!['text/vnd.yaml', 'text/yaml', 'text/x-yaml', 'application/x-yaml'].includes(mimeType)) {
                return cb({
                    statusCode: 400,
                    error: 'Only YAML files are allowed',
                });
            }
            return cb(null, true);
        }
    }).single(configType);

    let publish = (req, res, callback) => {
        upload(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                console.error('[Multer ERR]', err);
            } else if (err) {
                console.error('[SERVER ERR]', err);
                callback({
                    statusCode: 500,
                    error: err
                });
            } else {
                // Successfully uploaded file
                //TODO: modify this part and save the uploaded config file to DB in JSON format
                callback({
                    statusCode: 200,
                    error: null,
                    file: req.file
                });
            }
        });
    };

    return publish;
};

// Set the network config publish functions
const publishNetworkConfig = getPublish('network-config-file');
const publishTestConfig = getPublish('test-config-file');

// POST request to receive network configuration files from user
api.post('/network-config', (req, res, next) => {
    publishNetworkConfig(req, res, ({
        statusCode,
        error,
        file
    }) => {
        if (statusCode !== 200) {
            res.status(statusCode).json({
                error
            });
        } else {
            // TODO: modify this part and store the config file in DB

            // Config file is saved automatically by multer
            networkConfigFile = 'data/config/network-config-file.yaml';
            res.status(statusCode).json({
                file
            });
        }
    });
});

// Handle form input from GUI
api.post('/config-form', (req, res, next) => {
    console.log('[DEBUG] /config-form req.body:', req.body);
    res.json(req.body);
});

api.post('/test-config', (req, res, next) => {
    publishTestConfig(req, res, ({
        statusCode,
        error,
        file
    }) => {
        if (statusCode !== 200) {
            res.status(statusCode).json({
                error
            });
        } else {
            // TODO: store the config file in DB

            // set the config file path so the test can start
            testConfigFile = 'data/config/test-config-file.yaml';
            res.status(statusCode).json({
                file
            });
        }
    });
});

/**
 * Command process for run benchmark command
 * @param {string} argv argument list from caliper GUI startTest API call
 */
const runBenchmark = async function(argv) {
    // Workspace is expected to be the root location of working folders
    workspace = argv.workspace;
    benchConfigFile = path.join(workspace, argv.benchConfig);
    blockchainConfigFile = path.join(workspace, argv.blockchainConfig);

    if (!fs.existsSync(benchConfigFile)) {
        throw (new Error('Configuration file ' + benchConfigFile + ' does not exist'));
    }

    if (!fs.existsSync(blockchainConfigFile)) {
        throw (new Error('Configuration file ' + blockchainConfigFile + ' does not exist'));
    }

    let blockchainType = '';
    let networkObject = CaliperUtils.parseYaml(blockchainConfigFile);

    // if (networkObject.hasOwnProperty('caliper') && networkObject.caliper.hasOwnProperty('blockchain')) {
    if (Object.prototype.hasOwnProperty.call(networkObject, 'caliper') && Object.prototype.hasOwnProperty.call(networkObject.caliper, 'bloackchain')) {
        blockchainType = networkObject.caliper.blockchain;
    } else {
        throw new Error('The configuration file [' + blockchainConfigFile + '] is missing its "caliper.blockchain" attribute');
    }

    console.log(chalk.blue.bold(['Benchmark for target Blockchain type ' + blockchainType + ' about to start']));
    const {
        AdminClient,
        ClientFactory
    } = require('caliper-' + blockchainType);
    const adminClient = new AdminClient(blockchainConfigFile, workspace);
    const clientFactory = new ClientFactory(blockchainConfigFile, workspace);

    // The main caliper test funciton call through dependencies in the caliper-core
    const response = await CaliperFlow.run(benchConfigFile, blockchainConfigFile, adminClient, clientFactory, workspace);

    if (response === 0) {
        console.log(chalk.blue.bold('Benchmark run successful'));
    } else {
        console.log(chalk.red.bold('Benchmark failure'));
        throw new Error('Benchmark failure');
    }
};

// Start the Caliper test by calling dependencies in caliper-core
const startTest = async function(useSample) {
    if (useSample) {
        testConfigFile = sampleTestConfigPath;
        networkConfigFile = sampleNetworkConfigPath;
    } else if (networkConfigFile === '' || testConfigFile === '') {
        console.log('[DEBUG] NetworkConfigFile:------------\n', networkConfigFile);
        console.log('[DEBUG] testConfigFile:------------\n', testConfigFile);
        console.log('[ERROR] The config files are not uploaded, cannot start test!');
        return null;
        // TODO: send status code to the browser so it can response ERROR to user
    }

    let result = {
        success: false,
        data: null,
    }; // the result JSON object return to client and DB

    // Getting all the required inputs for test
    let argv = {
        workspace: '.', // the workspace need to be the folder that contains all the network files used in the network config file, and it must be an absolute path to it (string path) [./ is only the sample workspace]
        benchConfig: testConfigFile,
        blockchainConfig: networkConfigFile,

    };

    // The benchmark tests on caliper core
    let dataOutput = await runBenchmark(argv)
        .then((res) => {
            if (dataOutput) {
                result.data = dataOutput;
                result.success = true;
            } else {
                throw new Error('Empty or null data output!');
            }
        })
        .catch((err) => {
            console.log(err);
        });

    // TODO: Save the result data in MongoDB

    // TODO: Build an api.get to let GUI to query result data from the API -> DB

    // clean();    // clean the config file paths

    return result;
};


// Test function to generate test reaults based on given test and network config files.
api.get('/run-test/:useSample', async (req, res, next) => {
    // TODO: make the startTest() return a JSON output so it can be visualized here

    let useSample = JSON.parse(req.params.useSample);
    let result = await startTest(useSample);
    console.log('[DEBUG] req.params.useSample:', req.params.useSample);

    if (result) {
        res.end('Test finished!');
    } else {
        res.end('Empty result! Something is wrong! Check if you uploaded file or not!');
    }
});

module.exports = api;
