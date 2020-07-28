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
const util = require('../../common/utils/caliper-utils');
const logger = util.getLogger('replay-rate-controller');

const TEXT_FORMAT = 'TEXT';
const BINARY_BE_FORMAT = 'BIN_BE';
const BINARY_LE_FORMAT = 'BIN_LE';
const supportedFormats = [TEXT_FORMAT, BINARY_BE_FORMAT, BINARY_LE_FORMAT];

/**
 * Rate controller for replaying a previously recorded transaction trace.
 *
 * @property {number[]} records The record of relative times for submitted transactions.
 * @property {string} pathTemplate The template path for the file to record to.
 * @property {string} inputFormat Specifies the input format for the recordings.
 * @property {number} defaultSleepTime The default sleep time between extra transactions.
 * @property {string} delimiter The delimiter character for the CSV format.
 * @property {boolean} loggedWarning Indicates whether the warning has been logged for running out of the trace.
 *
 * @extends RateInterface
 */
class ReplayRateController extends RateInterface {
    /**
     * Initializes the rate controller instance.
     * @param {TestMessage} testMessage start test message
     * @param {TransactionStatisticsCollector} stats The TX stats collector instance.
     * @param {number} workerIndex The 0-based index of the worker node.
     */
    constructor(testMessage, stats, workerIndex) {
        super(testMessage, stats, workerIndex);
        this.records = [];

        if (typeof this.options.pathTemplate === 'undefined') {
            throw new Error('The path to load the recording from is undefined');
        }

        this.loggedWarning = false;
        this.defaultSleepTime = Number(this.options.defaultSleepTime || 100);

        // check for supported input formats
        if (typeof this.options.inputFormat === 'undefined') {
            logger.warn(`Input format is undefined. Defaulting to "${TEXT_FORMAT}" format`);
            this.inputFormat = TEXT_FORMAT;
        } else if (supportedFormats.includes(this.options.inputFormat.toUpperCase())) {
            this.inputFormat = this.options.inputFormat.toUpperCase();
            logger.debug(`Input format is set to "${this.inputFormat}" format in worker #${this.workerIndex} in round #${this.roundIndex}`);
        } else {
            logger.warn(`Input format "${this.options.inputFormat}" is not supported. Defaulting to "${TEXT_FORMAT}" format`);
            this.inputFormat = TEXT_FORMAT;
        }

        this.pathTemplate = this.options.pathTemplate;
        // resolve template path placeholders
        this.pathTemplate = this.pathTemplate.replace(/<R>/gi, this.roundIndex.toString());
        this.pathTemplate = this.pathTemplate.replace(/<C>/gi, this.workerIndex.toString());
        this.pathTemplate = util.resolvePath(this.pathTemplate);

        if (!fs.existsSync(this.pathTemplate)) {
            throw new Error(`Trace file does not exist: ${this.pathTemplate}`);
        }

        switch (this.inputFormat) {
        case TEXT_FORMAT:
            this._importFromText();
            break;
        case BINARY_BE_FORMAT:
            this._importFromBinaryBigEndian();
            break;
        case BINARY_LE_FORMAT:
            this._importFromBinaryLittleEndian();
            break;
        }
    }

    /**
     * Imports the timings from a one-column CSV format.
     */
    _importFromText() {
        this.records = fs.readFileSync(this.pathTemplate, 'utf-8').split('\n').map(line => parseInt(line));
    }

    /**
     * Imports the timings from a little endian binary format.
     */
    _importFromBinaryLittleEndian() {
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
    _importFromBinaryBigEndian() {
        let buffer = fs.readFileSync(this.pathTemplate);
        let length = buffer.readUInt32BE(0);
        this.records = new Array(length);

        for (let i = 1; i <= length; i++) {
            // because of the first 4 byte, the i-th record starts after i*4 bytes
            this.records[i - 1] = buffer.readUInt32BE(i * 4);
        }
    }

    /**
     * Perform the rate control action by blocking the execution for a certain amount of time.
     * @async
     */
    async applyRateControl() {
        let currentIndex = this.stats.getTotalSubmittedTx();
        if (currentIndex <= this.records.length - 1) {
            let sleepTime = this.records[currentIndex] - (Date.now() - this.stats.getRoundStartTime());
            if (sleepTime > 5) {
                await util.sleep(sleepTime);
            }
        } else {
            if (!this.loggedWarning) {
                logger.warn(`Using default sleep time of ${this.defaultSleepTime} ms from now on for worker #${this.workerIndex} in round #${this.roundIndex}`);
                this.loggedWarning = true;
            }
            await util.sleep(this.defaultSleepTime);
        }
    }

    /**
     * Notify the rate controller about the end of the round.
     * @async
     */
    async end() { }
}

/**
 * Factory for creating a new rate controller instance.
 * @param {TestMessage} testMessage start test message
 * @param {TransactionStatisticsCollector} stats The TX stats collector instance.
 * @param {number} workerIndex The 0-based index of the worker node.
 *
 * @return {RateInterface} The new rate controller instance.
 */
function createRateController(testMessage, stats, workerIndex) {
    return new ReplayRateController(testMessage, stats, workerIndex);
}

module.exports.createRateController = createRateController;
