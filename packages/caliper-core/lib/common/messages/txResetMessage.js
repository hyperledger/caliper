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

const Message = require('./message');
const MessageTypes = require('./../utils/constants').Messages.Types;

/**
 * Class for the "txReset" message.
 */
class TxResetMessage extends Message {
    /**
     * Constructor for a "txReset" message instance.
     * @param {string} sender The sender of the message.
     * @param {string[]} recipients The recipients of the message.
     * @param {string} date The date string of the message.
     * @param {string} error The potential error associated with the message.
     */
    constructor(sender, recipients, date = undefined, error = undefined) {
        // the local observers needs this content, deep-deep down
        super(sender, recipients, MessageTypes.TxReset, { type: MessageTypes.TxReset }, date, error);
    }
}

module.exports = TxResetMessage;
