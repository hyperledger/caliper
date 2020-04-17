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

const _ = require('lodash');
const request = require('request-promise');

/**
 * Sawtooth Helper
 */
class SawtoothHelper {

    /**
    * Get block data from event message
    * @param {Object} events message
    * @param {string} restURL the rest API in use
    * @return {Promise<object>} The promise for the result of event message
    */
    static async getBlock(events, restURL) {
        const block = _.chain(events)
            .find(event => event.eventType === 'sawtooth/block-commit')
            .get('attributes')
            .map(attribute => [attribute.key, attribute.value])
            .fromPairs()
            .value();
        const batchIds = await SawtoothHelper.getBlockBatchIds(block.block_id, restURL);
        return {
            blockNum: parseInt(block.block_num),
            blockId: block.block_id.toString(),
            batchIds: batchIds,
            stateRootHash: block.state_root_hash
        };
    }

    /**
    * Get the last recent block id for the block chain
    * @param {string} restURL the rest API in use
    * @return {Promise<String>} last recent block id
    */
    static async getCurrentBlockId(restURL) {
        const blocks = restURL + '/blocks?limit=1';
        const options = {
            uri: blocks
        };
        return request(options)
            .then((body) => {
                const data = (JSON.parse(body)).data;
                if (data.length > 0) {
                    this.currentBlockNum = parseInt(data[0].header.block_num);
                    return data[0].header_signature.toString();
                }
            });
    }


    /**
     * Get batch ids from block
     * @param {String} blockId the ID of a block
     * @param {string} restURL the rest API in use
     * @return {Promise<object>} The promise for the batch ids
     */
    static async getBlockBatchIds(blockId, restURL) {
        const blocks = restURL + '/blocks/' + blockId;
        const options = {
            uri: blocks
        };
        return request(options)
            .then((body) => {
                const data = (JSON.parse(body)).data;
                if (data !== undefined) {
                    const batchIds = data.header.batch_ids;
                    return batchIds;
                } else {
                    return [];
                }
            });
    }
}

module.exports = SawtoothHelper;
