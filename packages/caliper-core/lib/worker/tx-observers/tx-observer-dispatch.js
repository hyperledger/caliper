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

const path = require('path');
const TxObserverInterface = require('./tx-observer-interface');
const CaliperUtils = require('../../common/utils/caliper-utils');

const builtInTxObservers = new Map([
    ['logging', path.join(__dirname, 'logging-tx-observer.js')],
    ['prometheus', path.join(__dirname, 'prometheus-tx-observer.js')],
    ['prometheus-push', path.join(__dirname, 'prometheus-push-tx-observer.js')]
]);

/**
 * TX observer dispatch to manage the broadcast of TX events to other TX observers.
 *
 * @property {TxObserverInterface[]} txObservers Collection of configured TX observers.
 */
class TxObserverDispatch extends TxObserverInterface {
    /**
     * Initializes the TX observer dispatch instance.
     * @param {MessengerInterface} messenger The worker messenger instance.
     * @param {TxObserverInterface} internalTxObserver The executor's internal TX observer instance.
     * @param {string} managerUuid The UUID of the messenger for message sending.
     * @param {number} workerIndex The 0-based index of the worker node.
     */
    constructor(messenger, internalTxObserver, managerUuid, workerIndex) {
        super(messenger, workerIndex);
        // contains the loaded TX observers
        this.txObservers = [];

        // load the configured TX observers
        let observerConfigs = super.getDeclaredTxObservers();
        for (let observer of observerConfigs) {
            const factoryFunction = CaliperUtils.loadModuleFunction(builtInTxObservers, observer.module, 'createTxObserver');
            this.txObservers.push(factoryFunction(observer.options, messenger, workerIndex));
        }

        // always load the internal TX observer
        this.txObservers.push(internalTxObserver);
    }

    /**
     * Activates the dispatch, and in turn, every configured TX observer instance.
     * @param {number} roundIndex The 0-based index of the current round.
     * @param {string} roundLabel The roundLabel name.
     * @async
     */
    async activate(roundIndex, roundLabel) {
        await super.activate(roundIndex, roundLabel);

        for (let observer of this.txObservers) {
            await observer.activate(roundIndex, roundLabel);
        }
    }

    /**
     * Deactivates the dispatch, and in turn, every configured TX observer instance.
     * @async
     */
    async deactivate() {
        await super.deactivate();

        for (let observer of this.txObservers) {
            await observer.deactivate();
        }
    }

    /**
     * Called when TXs are submitted. The dispatch forwards the event to every configured TX observer instance.
     * @param {number} count The number of submitted TXs. Can be greater than one for a batch of TXs.
     */
    txSubmitted(count) {
        if (!this.active) {
            return;
        }

        for (let observer of this.txObservers) {
            observer.txSubmitted(count);
        }
    }

    /**
     * Called when TXs are finished. The dispatch forwards the event to every configured TX observer instance.
     * @param {TxStatus | TxStatus[]} results The result information of the finished TXs. Can be a collection of results for a batch of TXs.
     */
    txFinished(results) {
        if (!this.active) {
            return;
        }

        for (let observer of this.txObservers) {
            observer.txFinished(results);
        }
    }
}

module.exports = TxObserverDispatch;























