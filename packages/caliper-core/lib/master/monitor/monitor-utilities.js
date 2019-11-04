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

/**
 * Static utility methods for monitors
 */
class MonitorUtilities {

    /**
    * Cut down the string in case it's too long
    * @param {String} data input string
    * @return {String} normalized string
    */
    static strNormalize(data) {
        if(!data || typeof data !== 'string') {
            return '-';
        }

        const maxLen = 30;
        if(data.length <= maxLen) {
            return data;
        }

        return data.slice(0,25) + '...' + data.slice(-5);
    }

    /**
    * Normalize the value in byte
    * @param {Number} data value in byte
    * @return {String} value in string
    */
    static byteNormalize(data) {
        if(isNaN(data)) {
            return '-';
        }
        let kb = 1024;
        let mb = kb * 1024;
        let gb = mb * 1024;
        if(data < kb) {
            return data.toString() + 'B';
        }
        else if(data < mb) {
            return (data / kb).toFixed(1) + 'KB';
        }
        else if(data < gb) {
            return (data / mb).toFixed(1) + 'MB';
        }
        else{
            return (data / gb).toFixed(1) + 'GB';
        }
    }

    /**
    * Get statistics(maximum, minimum, summation, average) of a number array
    * @param {Array} arr array of numbers
    * @return {JSON} JSON object as {max, min, total, avg}
    */
    static getStatistics(arr) {
        if(arr.length === 0) {
            return {max : NaN, min : NaN, total : NaN, avg : NaN};
        } else {
            const sum = arr.reduce((x, y) => x + y);
            return {max : Math.max(...arr), min : Math.min(...arr), total : sum, avg : sum/arr.length};
        }
    }
}

module.exports = MonitorUtilities;
