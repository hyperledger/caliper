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

const MessageTargets = require('./../utils/constants').Messages.Targets;

/**
 * Base class for messages.
 */
class Message {
    /**
     * Constructor for the base message class.
     * @param {string} sender The sender of the message.
     * @param {string[]} recipients The list of recipients of the message.
     * @param {string} type The type of the message.
     * @param {object} content The content of the message.
     * @param {string} date The date string of the message.
     * @param {string} error The error relating to the message.
     */
    constructor(sender, recipients, type, content, date, error) {
        /**
         * The sender of the message.
         * @type {string}
         */
        this.sender = sender;

        /**
         * The recipients of the message.
         * @type {string[]}
         */
        this.recipients = recipients;

        /**
         * The type of the message.
         * @type {string}
         */
        this.type = type;

        /**
         * The content of the message.
         * @type {Object}
         */
        this.content = content;

        /**
         * The date of the message.
         * @type {Date}
         */
        this.date = date ? new Date(date) : undefined;

        /**
         * The error relating to the message.
         * @type {string}
         */
        this.error = error;
    }

    /**
     * Gets the type of the message.
     * @return {string} The type of the message.
     */
    getType() {
        return this.type;
    }

    /**
     * Gets the sender UUID of the message.
     * @return {string} The sender UUID of the message.
     */
    getSender() {
        return this.sender;
    }

    /**
     * Gets the recipient UUIDs of the message.
     * @return {string[]} The recipient UUIDs of the message.
     */
    getRecipients() {
        return this.recipients;
    }

    /**
     * Indicates whether the message has an associated error.
     * @return {boolean} True, if the message contains an error. Otherwise false.
     */
    hasError() {
        return this.error !== undefined;
    }

    /**
     * Gets the error message associated with the message.
     * @return {string} The error message.
     */
    getError() {
        return this.error;
    }

    /**
     * Gets the content of the message.
     * @return {object} The content of the message.
     */
    getContent() {
        return this.content;
    }

    /**
     * Indicates whether the message is intended for the given recipient.
     * @param {string} recipientId The recipient UUID.
     * @return {boolean} True, if the message is for the recipient. Otherwise false.
     */
    forRecipient(recipientId) {
        return this.recipients.includes(MessageTargets.All) || this.recipients.includes(recipientId);
    }

    /**
     * Serializes the message metadata and content.
     * @return {string} The JSON string representation of the message.
     */
    stringify() {
        let message = {
            sender: this.sender,
            recipients: this.recipients,
            type: this.type,
            content: this.content,
            date: this.date ? this.date.toISOString() : (new Date()).toISOString()
        };

        if (this.error) {
            message.error = this.error;
        }

        return JSON.stringify(message);
    }
}

module.exports = Message;
