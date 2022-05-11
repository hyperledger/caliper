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

const CaliperUtils = require('../common/utils/caliper-utils.js');
const RateControl = require('./rate-control/rateControl.js');

const Events = require('../common/utils/constants').Events.Connector;
const TxObserverDispatch = require('./tx-observers/tx-observer-dispatch');
const InternalTxObserver = require('./tx-observers/internal-tx-observer');

const Logger = CaliperUtils.getLogger('caliper-worker');

/**
 * Class for Worker Interaction
 */
class CaliperWorker {

    /**
     * Create the test worker
     * @param {Object} connector blockchain worker connector
     * @param {number} workerIndex the worker index
     * @param {MessengerInterface} messenger a configured Messenger instance used to communicate with the orchestrator
     * @param {string} managerUuid The UUID of the messenger for message sending.
     */
    constructor(connector, workerIndex, messenger, managerUuid) {
        this.connector = connector;
        this.workerIndex = workerIndex;
        this.messenger = messenger;

        this.internalTxObserver = new InternalTxObserver(messenger, managerUuid, workerIndex);
        this.txObserverDispatch = new TxObserverDispatch(messenger, this.internalTxObserver, managerUuid, workerIndex);

        // forward adapter notifications to the TX dispatch observer
        const self = this;
        this.connector.on(Events.TxsSubmitted, count => self.txObserverDispatch.txSubmitted(count));
        this.connector.on(Events.TxsFinished, results => self.txObserverDispatch.txFinished(results));
    }

    /**
     * Wait until every submitted TX is finished.
     * @param {TransactionStatistics} roundStats The TX statistics of the current round.
     * @private
     * @async
     */
    static async _waitForTxsToFinish(roundStats) {
        // might lose some precision here, but checking the same after every TX result whether it was the last TX
        // (so we could resolve a promise we're waiting for here) might hurt the sending rate
        while (roundStats.getTotalFinishedTx() !== roundStats.getTotalSubmittedTx()) {
            await CaliperUtils.sleep(100);
        }
    }

    /**
     * Put a task to immediate queue of NodeJS event loop
     * @param {function} func The function needed to be executed immediately
     * @return {Promise} Promise of execution
     */
    setImmediatePromise(func) {
        return new Promise((resolve) => {
            setImmediate(() => {
                func();
                resolve();
            });
        });
    }

    /**
     * Perform test with specified number of transactions
     * @param {object} workloadModule The user test module.
     * @param {Object} number number of transactions to submit
     * @param {Object} rateController rate controller object
     * @async
     */
    async runFixedNumber(workloadModule, number, rateController) {
        const stats = this.internalTxObserver.getCurrentStatistics();
        let error = undefined;
        while (stats.getTotalSubmittedTx() < number && !error) {
            await rateController.applyRateControl();

            // If this function calls this.workloadModule.submitTransaction() too quickly, micro task queue will be filled with unexecuted promises,
            // and I/O task(s) will get no chance to be execute and fall into starvation, for more detail info please visit:
            // https://snyk.io/blog/nodejs-how-even-quick-async-functions-can-block-the-event-loop-starve-io/
            await this.setImmediatePromise(() => {
                workloadModule.submitTransaction()
                    .catch(err => { error = err; });
            });
        }

        if (error) {
            // Already logged, no need to log again
            throw error;
        }

        await CaliperWorker._waitForTxsToFinish(stats);
    }

    /**
     * Perform test with specified test duration
     * @param {object} workloadModule The user test module.
     * @param {Object} duration duration to run for
     * @param {Object} rateController rate controller object
     * @async
     */
    async runDuration(workloadModule, duration, rateController) {
        const stats = this.internalTxObserver.getCurrentStatistics();
        let startTime = stats.getRoundStartTime();
        let error = undefined;
        while ((Date.now() - startTime) < (duration * 1000) && !error) {
            await rateController.applyRateControl();

            // If this function calls this.workloadModule.submitTransaction() too quickly, micro task queue will be filled with unexecuted promises,
            // and I/O task(s) will get no chance to be execute and fall into starvation, for more detail info please visit:
            // https://snyk.io/blog/nodejs-how-even-quick-async-functions-can-block-the-event-loop-starve-io/
            await this.setImmediatePromise(() => {
                workloadModule.submitTransaction()
                    .catch(err => { error = err; });
            });
        }

        if (error) {
            // Already logged, no need to log again
            throw error;
        }

        await CaliperWorker._waitForTxsToFinish(stats);
    }

    /**
     * Prepare the round corresponding to the "prepare-round" message.
     * @param {PrepareRoundMessage} prepareTestMessage The "execute-round" message containing schedule information.
     */
    async prepareTest(prepareTestMessage) {
        Logger.debug('Entering prepareTest');

        const roundIndex = prepareTestMessage.getRoundIndex();

        Logger.debug(`Worker #${this.workerIndex} creating workload module`);
        const workloadModuleFactory = CaliperUtils.loadModuleFunction(new Map(), prepareTestMessage.getWorkloadSpec().module, 'createWorkloadModule');
        this.workloadModule = workloadModuleFactory();
        let context;

        try {
            // Retrieve context for this round
            context = await this.connector.getContext(roundIndex, prepareTestMessage.getWorkerArguments());

            // Run init phase of callback
            Logger.info(`Info: worker ${this.workerIndex} prepare test phase for round ${roundIndex} is starting...`);
            await this.workloadModule.initializeWorkloadModule(this.workerIndex, prepareTestMessage.getWorkersNumber(), roundIndex, prepareTestMessage.getWorkloadSpec().arguments, this.connector, context);
            await CaliperUtils.sleep(this.txUpdateTime);
        } catch (err) {
            Logger.info(`Worker [${this.workerIndex}] encountered an error during prepare test phase for round ${roundIndex}: ${(err.stack ? err.stack : err)}`);
            throw err;
        } finally {
            await this.connector.releaseContext(context);
            Logger.info(`Info: worker ${this.workerIndex} prepare test phase for round ${roundIndex} is completed`);
        }
    }

    /**
     * Perform the test
     * @param {TestMessage} testMessage start test message
     * @return {Promise<TransactionStatisticsCollector>} The results of the round execution.
     */
    async executeRound(testMessage) {
        Logger.debug('Entering executeRound');

        const workerArguments = testMessage.getWorkerArguments();
        const roundIndex = testMessage.getRoundIndex();
        const roundLabel = testMessage.getRoundLabel();
        Logger.debug(`Worker #${this.workerIndex} starting round #${roundIndex}`);
        let context, rateController, observerActivated;

        try {
            Logger.debug(`Worker #${this.workerIndex} initializing adapter context`);
            context = await this.connector.getContext(roundIndex, workerArguments);

            // Activate dispatcher
            Logger.debug(`Worker #${this.workerIndex} activating TX observer dispatch`);
            await this.txObserverDispatch.activate(roundIndex, roundLabel);
            observerActivated = true;

            // Configure
            Logger.debug(`Worker #${this.workerIndex} creating rate controller`);
            rateController = new RateControl(testMessage, this.internalTxObserver.getCurrentStatistics(), this.workerIndex);

            // Run the test loop
            Logger.info(`Worker #${this.workerIndex} starting workload loop`);

            if (testMessage.getRoundDuration()) {
                const duration = testMessage.getRoundDuration(); // duration in seconds
                await this.runDuration(this.workloadModule, duration, rateController);
            } else {
                const number = testMessage.getNumberOfTxs();
                await this.runFixedNumber(this.workloadModule, number, rateController);
            }

            Logger.debug(`Worker #${this.workerIndex} finished round #${roundIndex}`, this.internalTxObserver.getCurrentStatistics().getCumulativeTxStatistics());
            return this.internalTxObserver.getCurrentStatistics();
        } catch (err) {
            Logger.error(`Unexpected error in worker #${this.workerIndex} caused worker to finish round #${roundIndex}: ${(err.stack || err)}`);
            throw err;
        } finally {
            if (observerActivated) {
                Logger.debug(`Worker #${this.workerIndex} deactivating TX observer dispatch`);
                try {
                    await this.txObserverDispatch.deactivate();
                } catch(err) {
                    Logger.warn(`Worker #${this.workerIndex} failed to deactivate TX observer dispatch:  ${(err.stack || err)}`);
                }
            }

            if (rateController) {
                Logger.debug(`Worker #${this.workerIndex} cleaning up rate controller`);
                try {
                    await rateController.end();
                } catch(err) {
                    Logger.warn(`Worker #${this.workerIndex} failed to clean up rate controller:  ${(err.stack || err)}`);
                }
            }

            Logger.debug(`Worker #${this.workerIndex} cleaning up workload module`);
            try {
                await this.workloadModule.cleanupWorkloadModule();
            } catch(err) {
                Logger.warn(`Worker #${this.workerIndex} failed to clean up workload module:  ${(err.stack || err)}`);
            }

            if (context) {
                Logger.debug(`Worker #${this.workerIndex} cleaning up connector context`);
                try {
                    await this.connector.releaseContext(context);
                } catch(err) {
                    Logger.warn(`Worker #${this.workerIndex} failed to release connector context:  ${(err.stack || err)}`);
                }
            }
        }
    }
}

module.exports = CaliperWorker;
