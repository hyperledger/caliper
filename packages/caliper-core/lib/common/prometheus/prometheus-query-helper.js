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

const Logger = require('../utils/caliper-utils').getLogger('prometheus-query-helper');

/**
 * PrometheusQueryHelper - static helper functions used to help with return responses from Prometheus queries
 */
class PrometheusQueryHelper {

    /**
     * Build a string range query suitable for querying the Prometheus server
     * @param {String} query the query to modify with start and end times
     * @param {number} startTime the start time in seconds for the range query
     * @param {number} endTime the end time in seconds for the range query
     * @param {number} step the step size to use
     * @returns {String} the string query to use
     */
    static buildStringRangeQuery(query, startTime, endTime, step) {
        // Anything that is within `{ }` must be URI encoded (including braces)

        const myRegexp = /({.*})/;
        let match = myRegexp.exec(query);
        while (match !== null) {
            query = query.replace(myRegexp, encodeURIComponent(match[0]));
            match = myRegexp.exec(query);
        }

        const builtQuery = 'query_range?query=' + query + '&start=' + startTime + '&end=' + endTime + '&step=' + step;
        return builtQuery;
    }

    /**
     * Extract a single numeric value from a Prometheus query response. A Prometheus query response may be a
     * vector or a matrix.
     * @param {JSON} response the JSON response from the prometheus server
     * @param {boolean} isNumeric boolean to indicate if value should be cast to float (true) or not (false)
     * @returns {Map<string,value> | value} Either a map of values or single value depending on if the passed response is a matrix or vector
     */
    static extractFirstValueFromQueryResponse(response, isNumeric = true) {

        switch(response.data.resultType){
        case 'vector':
            // should have a result entry containing a 'value' field (not 'values')
            if (response.data.result && response.data.result[0] && response.data.result[0].hasOwnProperty('value')) {
                // value = [timeIndex, value]
                const val = response.data.result[0].value[1];
                if (isNumeric) {
                    return parseFloat(val);
                } else {
                    return val;
                }
            } else {
                if (response.data.result && response.data.result[0]) {
                    Logger.error(`Empty or invalid response ${JSON.stringify(response)} passed for single value extraction`);
                }
                return '-';
            }
        case 'matrix':
        {
            // We need to look at each matrix item and return a Map that details the name:value pairing for each entry
            // result array contains JSON objects that are:
            // {
            //      metric: { name: myName},
            //      values: [[timeIndex, value], [timeIndex, value], ..., [timeIndex, value]]}
            // }
            const valuesMap = new Map();
            for (let result of response.data.result) {
                const name = result.metric.name;
                const value = result.values[0][1];
                if (isNumeric) {
                    valuesMap.set(name, parseFloat(value));
                } else {
                    valuesMap.set(name, value);
                }
            }
            return valuesMap;
        }
        default:
            throw new Error(`Unknown or missing result type: ${response.data.resultType}`);
        }
    }

    /**
     * Extract a statistical value from a Prometheus range query response
     * @param {JSON} response the JSON response from the prometheus server
     * @param {String} statType the type of statistic to retrieve from data range
     * @param {String} label the statistic label of interest
     * @returns {number} the statistical value in the range query results
     */
    static extractStatisticFromRange(response, statType, label){

        switch(response.data.resultType){
        case 'vector':
            // should have a result entry containing a 'value' field (not 'values')
            if (response.data.result && response.data.result[0].hasOwnProperty('value')) {
                Logger.error(`Invalid response ${JSON.stringify(response)} passed for single value extraction`);
            }
            break;
        case 'matrix':
        {
            // We need to look at each matrix item and return a Map that details the name:value pairing for each entry
            // result array contains JSON objects that are:
            // {
            //      metric: { name: myName, otherName: anotherName, label: nameOfInterest },
            //      values: [[timeIndex, value], [timeIndex, value], ..., [timeIndex, value]]}
            // }
            const valuesMap = new Map();
            for (let result of response.data.result) {
                const name = (result.metric && result.metric[label]) ? result.metric[label] : 'unknown';
                const series = result.values ? result.values : [];
                const values = this.extractValuesFromTimeSeries(series, true);
                try {
                    const stat =  this.retrieveStatisticFromArray(values, statType);
                    if (isNaN(stat) || stat === Infinity || stat === -Infinity){
                        valuesMap.set(name, '-');
                    } else {
                        valuesMap.set(name, stat);
                    }
                } catch (error) {
                    Logger.warn(`Unable to perform Math operation, with error ${error}`);
                    valuesMap.set(name, '-');
                }
            }
            return valuesMap;
        }
        default:
            throw new Error(`Unknown or missing result type: ${response.data.resultType}`);
        }
    }

    /**
     * Perform a basic statistical operation over an array
     * @param {Array} values array of values to perform the operation on
     * @param {String} statType type of statistical operation
     * @returns {number} result from statistical operation
     */
    static retrieveStatisticFromArray(values, statType) {
        switch(statType) {
        case 'max':
            return Math.max(...values);
        case 'min':
            return Math.min(...values);
        case 'avg':
        {
            if (values.length>1) {
                const sum = values.reduce((x, y) => x + y);
                return sum / values.length;
            } else {
                return values[0];
            }
        }
        case 'sum':
            return values.reduce((x, y) => x + y);
        default:
            Logger.error(`Unknown stat type passed: ${statType}`);
            throw new Error(`Unknown stat type passed: ${statType}`);
        }
    }

    /**
     * Extract values from time series data
     * @param {Array} series Array of the form [ [timeIndex, value], [], ..., [] ]
     * @param {boolean} isNumeric boolean to indicate if value should be cast to float (true) or not (false)
     * @returns {Array} one dimensional array of values
     */
    static extractValuesFromTimeSeries(series, isNumeric){
        const values = [];
        for (const element of series) {
            if (isNumeric) {
                values.push(parseFloat(element[1]));
            } else {
                values.push(element[1]);
            }
        }
        return values;
    }
}

module.exports = PrometheusQueryHelper;
