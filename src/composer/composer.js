/**
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
*
* @file, definition of the Composer class, which implements the caliper's NBI for Hyperledger Fabric
*/

'use strict';

// Caliper requires
const BlockchainInterface = require('../comm/blockchain-interface.js');
const Util = require('../comm/util');
const logger = Util.getLogger('composer.js');
const TxStatus = require('../comm/transaction');

// Composer helpers
const composer_utils = require('./composer_utils.js');

/**
 * Concrete implementation of the BlockchainInterface for Composer
 */
class Composer extends BlockchainInterface {

    /**
     * sets this.configPath
     * @param {String} path path to configuration file
     */
    constructor(path) {
        super(path);
    }

    /**
     * Initialise the target platform configuration
     * @returns {Promise} a completed Promise
     */
    init() {
        logger.info('Initializing target platform configuration');
        // initialise the target blockchain, create cards
        let config  = require(this.configPath);
        return this.initialiseFabric(config)
            .then(() => {
            // Create id cards
                return composer_utils.createAdminBusNetCards(config);
            })
            .catch((err) => {
                logger.error('composer.init() failed, ', err);
                return Promise.reject(err);
            });
    }

    /**
     * Inner function to initialise the fabbric configuration
     * @param {Object} config the configuration object for the platform
     * @returns {Promise} a completed Promise
     */
    initialiseFabric(config) {
        return composer_utils.createChannels(config)
            .then(() => {
                return composer_utils.joinChannels(config);
            })
            .then(() => {
                return new Promise(resolve => setTimeout(resolve, 2000));
            })
            .catch((err) => {
                logger.error('composer.init() failed at initialiseFabric(), ', err);
                return Promise.reject(err);
            });
    }

    /**
     * Deploys business networks
     * @returns {Promise} a completed Promise
     */
    installSmartContract() {
        logger.info('Deploying Composer');
        // Here, this relates to deploying a Composer BusinessNetwork to the Blockchain platform
        // - runtime install on each participating org
        // - start from any participating org
        // - conditionally set log level
        let config = require(this.configPath);
        let chaincodes = config.composer.chaincodes;

        // Expand required deployments
        let busnets =[];
        chaincodes.forEach((busnet) => {
            let orgs = busnet.orgs;
            orgs.forEach((org) => {
                busnets.push({'id': busnet.id, 'version': busnet.version, 'path': busnet.path, 'org': org});
            });
        });

        // install runtime on orgs using respective organization cards
        return busnets.reduce((promiseChain, busnet) => {
            return promiseChain.then(() => {
                return composer_utils.runtimeInstall(busnet, null, 'PerfPeerAdmin@' + busnet.org);
            });
        }, Promise.resolve())
            .then((result) => {
            // network start on single peer using organization card
                return chaincodes.reduce((promiseChain, busnet) => {
                    return promiseChain.then(() => {
                        return composer_utils.networkStart(busnet, 'PerfPeerAdmin@' + busnet.orgs[0], busnet.loglevel);
                    });
                }, Promise.resolve());
            })
            .then(() => {
                logger.info('Composer deployment complete');
            })
            .catch((err) => {
                logger.error('composer.installSmartContract() failed, ', err);
                return Promise.reject(err);
            });
    }

    /**
     * Retrieves a business network conneection
     * @param {String} name the name of the business network
     * @returns {BusinessNetworkConnection} an admin connection to the named business network
     */
    getContext(name) {
        logger.info('getting  context for: ', name);
        // Return business network connection
        return composer_utils.getBusNetConnection('PerfNetworkAdmin@' + name);
    }

    /**
     * Release context implementation
     * @param {*} context the context to release
     * @returns {Promise} a completed Promise
     */
    releaseContext(context) {
        return Promise.resolve();
    }

    /**
     * Submit a transaction to the deployed business network using the passed connection
     * @param {*} connection the business network connection to use when submitting the transaction
     * @param {*} transaction the transactino to submit
     * @returns {Promise} a completed Promise containing a result
     */
    submitTransaction(connection, transaction) {
        let invoke_status = new TxStatus(transaction.getIdentifier());
        if(connection.engine) {
            connection.engine.submitCallback(1);
        }
        return connection.submitTransaction(transaction)
            .then((complete) => {
                invoke_status.SetStatusSuccess();
                return Promise.resolve(invoke_status);
            })
            .catch((err) => {
                invoke_status.SetStatusFail();
                invoke_status.result = [];

                return Promise.resolve(invoke_status);
            });
    }
}

module.exports = Composer;