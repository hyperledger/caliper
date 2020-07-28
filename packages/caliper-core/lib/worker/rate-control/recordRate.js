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
const util = require('../../common/utils/caliper-utils');
const logger = util.getLogger('record-rate-controller');

const TEXT_FORMAT = 'TEXT';
const BINARY_BE_FORMAT = 'BIN_BE';
const BINARY_LE_FORMAT = 'BIN_LE';
const supportedFormats = [TEXT_FORMAT, BINARY_BE_FORMAT, BINARY_LE_FORMAT];

/**
 * Decorator rate controller for recording the rate of an other controller.
 *
 * @property {number[]} records The record of relative times for submitted transactions.
 * @property {RateControl} rateController The rate controller to record.
 * @property {string} pathTemplate The template path for the file to record to.
 * @property {string} outputFormat Specifies the output format for the recordings.
 *
 * @extends RateInterface
 */
class RecordRateController extends RateInterface {
    /**
     * Initializes the rate controller instance.
     * @param {TestMessage} testMessage start test message
     * @param {TransactionStatisticsCollector} stats The TX stats collector instance.
     * @param {number} workerIndex The 0-based index of the worker node.
     */
    constructor(testMessage, stats, workerIndex) {
        super(testMessage, stats, workerIndex);

        this.records = [];
        // if we know the number of transactions beforehand, pre-allocate the array
        if (testMessage.getNumberOfTxs()) {
            this.records = new Array(testMessage.getNumberOfTxs());
            this.records.fill(0);
        }

        if (typeof this.options.pathTemplate === 'undefined') {
            throw new Error('The path to save the recording to is undefined');
        }

        if (typeof this.options.rateController === 'undefined') {
            throw new Error('The rate controller to record is undefined');
        }

        // check for supported output formats
        if (typeof this.options.outputFormat === 'undefined') {
            logger.warn(`Output format is undefined. Defaulting to "${TEXT_FORMAT}" format`);
            this.outputFormat = TEXT_FORMAT;
        } else if (supportedFormats.includes(this.options.outputFormat.toUpperCase())) {
            this.outputFormat = this.options.outputFormat.toUpperCase();
            logger.debug(`Output format is set to "${this.outputFormat}" format in worker #${this.workerIndex} in round #${this.roundIndex}`);
        } else {
            logger.warn(`Output format "${this.options.outputFormat}" is not supported. Defaulting to "${TEXT_FORMAT}" format`);
            this.outputFormat = TEXT_FORMAT;
        }

        this.pathTemplate = this.options.pathTemplate;
        // resolve template path placeholders
        this.pathTemplate = this.pathTemplate.replace(/<R>/gi, this.roundIndex.toString());
        this.pathTemplate = this.pathTemplate.replace(/<C>/gi, this.workerIndex.toString());
        this.pathTemplate = util.resolvePath(this.pathTemplate);

        this.rateController = new RateControl(testMessage, stats, workerIndex,);
    }

    /**
     * Exports the recorded results in text format.
     */
    _exportToText() {
        fs.writeFileSync(this.pathTemplate, '', 'utf-8');
        this.records.forEach(submitTime => fs.appendFileSync(this.pathTemplate, `${submitTime}\n`));
    }

    /**
     * Exports the recorded results in little endian binary format.
     */
    _exportToBinaryLittleEndian() {
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
    _exportToBinaryBigEndian() {
        // 4 bytes for array length, and 4 bytes for every array element
        let buffer = Buffer.alloc((this.records.length + 1) * 4);
        let offset = 0; // offset will be maintained by the buffer return value

        offset = buffer.writeUInt32BE(this.records.length, offset);

        for (let i = 0; i < this.records.length; i++) {
            offset = buffer.writeUInt32BE(this.records[i], offset);
        }

        fs.writeFileSync(this.pathTemplate, buffer, 'binary');
    }

    /**
     * Perform the rate control action by blocking the execution for a certain amount of time.
     * @async
     */
    async applyRateControl() {
        await this.rateController.applyRateControl();
        this.records[this.stats.getTotalSubmittedTx()] = Date.now() - this.stats.getRoundStartTime();
    }

    /**
     * Notify the rate controller about the end of the round.
     * @async
     */
    async end() {
        await this.rateController.end();

        try {
            switch (this.outputFormat) {
            case TEXT_FORMAT:
                this._exportToText();
                break;
            case BINARY_LE_FORMAT:
                this._exportToBinaryLittleEndian();
                break;
            case BINARY_BE_FORMAT:
                this._exportToBinaryBigEndian();
                break;
            default:
                logger.error(`Output format ${this.outputFormat} is not supported.`);
                break;
            }

            logger.debug(`Recorded Tx submission times for worker #${this.workerIndex} in round #${this.roundIndex} to ${this.pathTemplate}`);
        } catch (err) {
            logger.error(`An error occurred for worker #${this.workerIndex} in round #${this.roundIndex} while writing records to ${this.pathTemplate}: ${err.stack || err}`);
        }
    }
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
    return new RecordRateController(testMessage, stats, workerIndex);
}

module.exports.createRateController = createRateController;
