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

const RateInterface = require('./rateInterface.js');
const RateControl = require('./rateControl');
const fs = require('fs');
const util = require('../util');

const TEXT_FORMAT = 'TEXT';
const BINARY_BE_FORMAT = 'BIN_BE';
const BINARY_LE_FORMAT = 'BIN_LE';
const supportedFormats = [TEXT_FORMAT, BINARY_BE_FORMAT, BINARY_LE_FORMAT];

/**
 * Decorator rate controller for recording the rate of an other controller.
 *
 * @property {Blockchain} blockchain The initialized blockchain object.
 * @property {object} options The user-supplied options for the controller.
 * @property {object[]} records The record of times for submitted transactions.
 * @property {RateControl} rateController The rate controller to record.
 * @property {string} pathTemplate The template path for the file to record to.
 * @property {number} roundIdx The index of the current round.
 * @property {number} clientIdx The index of the current client.
 * @property {string} outputFormat Specifies the output format for the recordings.
 * @property {boolean} logEnd Indicates whether log when the records are written to file.
 */
class RecordRateController extends RateInterface{
    /**
     * Creates a new instance of the {RecordRateController} class.
     * @constructor
     * @param {Blockchain} blockchain The initialized blockchain object.
     * @param {object} opts Options for the rate controller.
     */
    constructor(blockchain, opts) {
        super(blockchain, opts);
        this.records = [];

        if (typeof opts.pathTemplate === 'undefined') {
            throw new Error('The path to save the recording to is undefined');
        }

        if (typeof opts.rateController === 'undefined') {
            throw new Error('The rate controller to record is undefined');
        }

        this.logEnd = Boolean(opts.logEnd || false);

        // check for supported output formats
        if (typeof opts.outputFormat === 'undefined') {
            util.log(`[RecordRateController] Output format is undefined. Defaulting to ${TEXT_FORMAT} format`);
            this.outputFormat = TEXT_FORMAT;
        } else if (supportedFormats.includes(opts.outputFormat.toUpperCase())) {
            this.outputFormat = opts.outputFormat.toUpperCase();
        } else {
            util.log(`[RecordRateController] Output format ${opts.outputFormat} is not supported. Defaulting to CSV format`);
            this.outputFormat = TEXT_FORMAT;
        }

        this.pathTemplate = opts.pathTemplate;
        this.rateController = new RateControl(opts.rateController, blockchain);
    }

    /**
     * Initializes the rate controller.
     *
     * @param {object} msg Client options with adjusted per-client load settings.
     * @param {string} msg.type The type of the message. Currently always 'test'
     * @param {string} msg.label The label of the round.
     * @param {object} msg.rateControl The rate control to use for the round.
     * @param {number} msg.trim The number/seconds of transactions to trim from the results.
     * @param {object} msg.args The user supplied arguments for the round.
     * @param {string} msg.cb The path of the user's callback module.
     * @param {string} msg.config The path of the network's configuration file.
     * @param {number} msg.numb The number of transactions to generate during the round.
     * @param {number} msg.txDuration The length of the round in SECONDS.
     * @param {number} msg.totalClients The number of clients executing the round.
     * @param {number} msg.clients The number of clients executing the round.
     * @param {object} msg.clientargs Arguments for the client.
     * @param {number} msg.clientIdx The 0-based index of the current client.
     * @param {number} msg.roundIdx The 1-based index of the current round.
     */
    async init(msg) {
        this.roundIdx = msg.roundIdx;
        this.clientIdx = msg.clientIdx + 1;

        // if we know the number of transactions beforehand, pre-allocate the array
        if (msg.numb) {
            this.records = new Array(msg.numb);
            this.records.fill(0);
        }

        // resolve template path placeholders
        this.pathTemplate = this.pathTemplate.replace(/<R>/gi, this.roundIdx.toString());
        this.pathTemplate = this.pathTemplate.replace(/<C>/gi, this.clientIdx.toString());
        this.pathTemplate = util.resolvePath(this.pathTemplate);

        await this.rateController.init(msg);
    }

    /**
     * Perform the rate control by sleeping through the round.
     * @param {number} start The epoch time at the start of the round (ms precision).
     * @param {number} idx Sequence number of the current transaction.
     * @param {object[]} currentResults The list of results of finished transactions.
     */
    async applyRateControl(start, idx, currentResults) {
        await this.rateController.applyRateControl(start, idx, currentResults);
        this.records[idx] = Date.now() - start;
    }

    /**
     * Notify the rate controller about the end of the round.
     */
    async end() {
        await this.rateController.end();

        try {
            switch (this.outputFormat) {
            case TEXT_FORMAT:
                this.exportToText();
                break;
            case BINARY_LE_FORMAT:
                this.exportToBinaryLittleEndian();
                break;
            case BINARY_BE_FORMAT:
                this.exportToBinaryBigEndian();
                break;
            default:
                util.log(`[RecordRateController] Output format ${this.outputFormat} is not supported.`);
                break;
            }

            if (this.logEnd) {
                util.log(`[RecordRateController] Recorded Tx submission times for Client#${this.clientIdx} in Round#${this.roundIdx} to ${this.pathTemplate}`);
            }
        } catch (err) {
            util.log(`[RecordRateController] An error occured while writing records to ${this.pathTemplate}: ${err.stack ? err.stack : err}`);
        }
    }

    /**
     * Exports the recorded results in text format.
     */
    exportToText() {
        fs.writeFileSync(this.pathTemplate, '', 'utf-8');
        this.records.forEach(submitTime => fs.appendFileSync(this.pathTemplate, `${submitTime}\n`));
    }

    /**
     * Exports the recorded results in little endian binary format.
     */
    exportToBinaryLittleEndian() {
        // 4 bytes for array length, and 4 bytes for every array element
        let buffer = Buffer.alloc((this.records.length + 1) * 4);
        let offset = 0; // offset will be maintained by the buffer return value

        offset = buffer.writeUInt32LE(this.records.length, offset);

        for (let i = 0; i < this.records.length; i++) {
            offset = buffer.writeUInt32LE(this.records[i], offset);
        }

        fs.writeFileSync(this.pathTemplate, buffer, 'binary');
    }

    /**
     * Exports the recorded results in big endian binary format.
     */
    exportToBinaryBigEndian() {
        // 4 bytes for array length, and 4 bytes for every array element
        let buffer = Buffer.alloc((this.records.length + 1) * 4);
        let offset = 0; // offset will be maintained by the buffer return value

        offset = buffer.writeUInt32BE(this.records.length, offset);

        for (let i = 0; i < this.records.length; i++) {
            offset = buffer.writeUInt32BE(this.records[i], offset);
        }

        fs.writeFileSync(this.pathTemplate, buffer, 'binary');
    }
}

module.exports = RecordRateController;