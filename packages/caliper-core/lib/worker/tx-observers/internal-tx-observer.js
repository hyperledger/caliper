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

const TxObserverInterface = require('./tx-observer-interface');
const TxUpdateMessage = require('../../common/messages/txUpdateMessage');
const TxResetMessage = require('../../common/messages/txResetMessage');
const CaliperUtils = require('../../common/utils/caliper-utils');
const ConfigUtil = require('../../common/config/config-util');

/**
 * Internal TX observer used by the worker process to driver TX scheduling and report round statistics
 * It is always instantiated.
 */
class InternalTxObserver extends TxObserverInterface {
    /**
     * Initializes the observer instance.
     * @param {MessengerInterface} messenger The worker messenger instance.
     * @param {string} managerUuid The UUID of the messenger for message sending.
     * @param {number} workerIndex The 0-based index of the worker node.
     */
    constructor(messenger, managerUuid, workerIndex) {
        super(messenger, workerIndex);
        this.updateInterval = ConfigUtil.get(ConfigUtil.keys.Observer.Internal.Interval);
        this.intervalObject = undefined;
        this.messengerUUID = messenger.getUUID();
        this.managerUuid = managerUuid;
    }

    /**
     * Sends the current aggregated statistics to the master node when triggered by "setInterval".
     * @private
     */
    async _sendUpdate() {
        let txUpdateMessage = new TxUpdateMessage(this.messengerUUID, [this.managerUuid], super.getCurrentStatistics());
        await this.messenger.send(txUpdateMessage);
    }

    /**
     * Activates the TX observer instance and starts the regular update scheduling.
     * @param {number} roundIndex The 0-based index of the current round.
     * @param {string} roundLabel The roundLabel name.
     */
    async activate(roundIndex, roundLabel) {
        await super.activate(roundIndex, roundLabel);
        this.intervalObject = setInterval(async () => { await this._sendUpdate(); }, this.updateInterval);
    }

    /**
     * Deactivates the TX observer interface, and stops the regular update scheduling.
     */
    async deactivate() {
        await super.deactivate();

        if (this.intervalObject) {
            clearInterval(this.intervalObject);

            await this._sendUpdate();
            await CaliperUtils.sleep(this.updateInterval);

            // TODO: the txResult message should be enough
            // or the round-end message should include the final stats
            let txResetMessage = new TxResetMessage(this.messengerUUID, [this.managerUuid]);
            await this.messenger.send(txResetMessage);
        }
    }
}

module.exports = InternalTxObserver;
