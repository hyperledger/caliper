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

const MessageTypes = require('./../utils/constants').Messages.Types;

const RegisterMessage = require('./registerMessage');
const ConnectedMessage = require('./connectedMessage');
const AssignIdMessage = require('./assignIdMessage');
const AssignedMessage = require('./assignedMessage');
const InitializeMessage = require('./initializeMessage');
const ReadyMessage = require('./readyMessage');
const PrepareMessage = require('./prepareMessage');
const PreparedMessage = require('./preparedMessage');
const TestMessage = require('./testMessage');
const TxResetMessage = require('./txResetMessage');
const TxUpdateMessage = require('./txUpdateMessage');
const TestResultMessage = require('./testResultMessage');
const ExitMessage = require('./exitMessage');

/**
 * Parses the given JSON string message.
 * @param {string} rawMessage The raw JSON string message.
 * @return {Message} The message object.
 */
function parse(rawMessage) {
    let msg = JSON.parse(rawMessage);

    if (!msg.type) {
        throw new Error(`Missing message type: "${rawMessage}"`);
    }

    const from = msg.sender;
    const to = msg.recipients;
    const date = msg.date;
    const err = msg.error;

    switch (msg.type) {
    case MessageTypes.Register:
        return new RegisterMessage(from, date, err);
    case MessageTypes.Connected:
        return new ConnectedMessage(from, to, date, err);
    case MessageTypes.AssignId:
        return new AssignIdMessage(from, to, msg.content, date, err);
    case MessageTypes.Assigned:
        return new AssignedMessage(from, to, date, err);
    case MessageTypes.Initialize:
        return new InitializeMessage(from, date, err);
    case MessageTypes.Ready:
        return new ReadyMessage(from, to, date, err);
    case MessageTypes.Prepare:
        return new PrepareMessage(from, to, msg.content, date, err);
    case MessageTypes.Prepared:
        return new PreparedMessage(from, to, date, err);
    case MessageTypes.Test:
        return new TestMessage(from, to, msg.content, date, err);
    case MessageTypes.TxReset:
        return new TxResetMessage(from, to, date, err);
    case MessageTypes.TxUpdate:
        return new TxUpdateMessage(from, to, msg.content, date, err);
    case MessageTypes.TestResult:
        return new TestResultMessage(from, to, msg.content, date, err);
    case MessageTypes.Exit:
        return new ExitMessage(from, date, err);
    default:
        throw new Error(`Unknown message type "${msg.type}"`);
    }
}

module.exports = parse;
