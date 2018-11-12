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
const fs = require('fs');
const util = require('../util');
const logger = util.getLogger('replayRate.js');

const TEXT_FORMAT = 'TEXT';
const BINARY_BE_FORMAT = 'BIN_BE';
const BINARY_LE_FORMAT = 'BIN_LE';
const supportedFormats = [TEXT_FORMAT, BINARY_BE_FORMAT, BINARY_LE_FORMAT];

/**
 * Rate controller for replaying a previously recorded transaction trace.
 *
 * @property {Blockchain} blockchain The initialized blockchain object.
 * @property {object} options The user-supplied options for the controller.
 * @property {object[]} records The record of times for submitted transactions.
 * @property {string} pathTemplate The template path for the file to record to.
 * @property {number} roundIdx The index of the current round.
 * @property {number} clientIdx The index of the current client.
 * @property {string} inputFormat Specifies the input format for the recordings.
 * @property {number} defaultSleepTime The default sleep time between extra transactions.
 * @property {string} delimiter The delimiter character for the CSV format.
 * @property {boolean} logWarnings Indicates whether to log extra transaction warnings.
 */
class ReplayRateController extends RateInterface{
    /**
     * Creates a new instance of the {ReplayRateController} class.
     * @constructor
     * @param {Blockchain} blockchain The initialized blockchain object.
     * @param {object} opts Options for the rate controller.
     */
    constructor(blockchain, opts) {
        super(blockchain, opts);
        this.records = [];

        if (typeof opts.pathTemplate === 'undefined') {
            throw new Error('The path to load the recording from is undefined');
        }

        this.pathTemplate = opts.pathTemplate;
        this.logWarnings = Boolean(opts.logWarnings || false);
        this.defaultSleepTime = Number(opts.defaultSleepTime || 20);

        // check for supported input formats
        if (typeof opts.inputFormat === 'undefined') {
            logger.warn(`[ReplayRateController] Input format is undefined. Defaulting to ${TEXT_FORMAT} format`);
            this.inputFormat = TEXT_FORMAT;
        } else if (supportedFormats.includes(opts.inputFormat.toUpperCase())) {
            this.inputFormat = opts.inputFormat.toUpperCase();
        } else {
            logger.warn(`[ReplayRateController] Input format ${opts.inputFormat} is not supported. Defaulting to CSV format`);
            this.inputFormat = TEXT_FORMAT;
        }
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

        // resolve template path placeholders
        this.pathTemplate = this.pathTemplate.replace(/<R>/gi, this.roundIdx.toString());
        this.pathTemplate = this.pathTemplate.replace(/<C>/gi, this.clientIdx.toString());
        this.pathTemplate = util.resolvePath(this.pathTemplate);

        if (!fs.existsSync(this.pathTemplate)) {
            throw new Error(`Trace file does not exist: ${this.pathTemplate}`);
        }

        switch (this.inputFormat) {
        case TEXT_FORMAT:
            this.importFromText();
            break;
        case BINARY_BE_FORMAT:
            this.importFromBinaryBigEndian();
            break;
        case BINARY_LE_FORMAT:
            this.importFromBinaryLittleEndian();
            break;
        default:
            throw new Error(`Unsupported replay rate controller input format: ${this.inputFormat}`);
        }
    }

    /**
     * Perform the rate control by sleeping through the round.
     * @param {number} start The epoch time at the start of the round (ms precision).
     * @param {number} idx Sequence number of the current transaction.
     * @param {object[]} recentResults The list of results of recent transactions.
     * @return {Promise} The return promise.
     */
    async applyRateControl(start, idx, recentResults) {
        if (idx <= this.records.length - 1) {
            let sleepTime = this.records[idx] - (Date.now() - start);
            return sleepTime > 5 ? util.sleep(sleepTime) : Promise.resolve();
        } else {
            if (this.logWarnings) {
                logger.warn(`[ReplayRateController] Using default sleep time of ${this.defaultSleepTime}ms for Tx#${idx}`);
            }
            return util.sleep(this.defaultSleepTime);
        }
    }

    /**
     * Imports the timings from a one-column CSV format.
     */
    importFromText() {
        this.records = fs.readFileSync(this.pathTemplate, 'utf-8').split('\n').map(line => parseInt(line));
    }

    /**
     * Imports the timings from a little endian binary format.
     */
    importFromBinaryLittleEndian() {
        let buffer = fs.readFileSync(this.pathTemplate);
        let length = buffer.readUInt32LE(0);
        this.records = new Array(length);

        for (let i = 1; i <= length; i++) {
            // because of the first 4 byte, the i-th record starts after i*4 bytes
            this.records[i - 1] = buffer.readUInt32LE(i * 4);
        }
    }

    /**
     * Imports the timings from a big endian binary format.
     */
    importFromBinaryBigEndian() {
        let buffer = fs.readFileSync(this.pathTemplate);
        let length = buffer.readUInt32BE(0);
        this.records = new Array(length);

        for (let i = 1; i <= length; i++) {
            // because of the first 4 byte, the i-th record starts after i*4 bytes
            this.records[i - 1] = buffer.readUInt32BE(i * 4);
        }
    }
}

module.exports = ReplayRateController;