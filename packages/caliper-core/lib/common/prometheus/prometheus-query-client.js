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

const url = require('url');
const http = require('http');
const https = require('https');

const Logger = require('../utils/caliper-utils').getLogger('prometheus-query-client');

const NULL = '/api/v1/';
const RANGE = '/api/v1/query_range';
const SINGLE = '/api/v1/query';

/**
 * PrometheusQueryClient for use with querying the Prometheus server to retrieve metrics
 */
class PrometheusQueryClient {

    /**
     * Constructor for client
     * @param {String} prometheusUrl the url of the Prometheus gateway
     */
    constructor(prometheusUrl) {
        this.prometheusUrl = prometheusUrl;
    }

    /**
     * Retrieve target parameters for the query
     * @param {String} type query type
     * @param {String} query the unique query append
     * @returns {Object} request parameters and the http module required for the http request
     */
    retrieveTargetParameters(type, query) {
        const target = url.resolve(this.prometheusUrl, type + query);
        const requestParams = url.parse(target);
        const httpModule = this.isHttps(requestParams.href) ? https : http;
        return {
            requestParams,
            httpModule
        };
    }

    /**
     * Issue a range query to the Prometheus server
     * @param {String} queryString string query to make
     * @param {number} startTime start time index for the query, in seconds since epoch (ie Date.now()/1000)
     * @param {number} endTime end time index for the query, in seconds since epoch (ie Date.now()/1000)
     * @param {number} step step size for query, defaults if not provided
     * @returns {JSON} the result of the query
     * @async
     */
    async rangeQuery(queryString, startTime, endTime, step = 1) {
        const query = '?query=' + queryString + '&start=' + startTime + '&end=' + endTime + '&step=' + step;
        Logger.debug('Issuing range query: ', query);

        const targetParams = this.retrieveTargetParameters(RANGE, query);
        return await this.retrieveResponse(targetParams);
    }

    /**
     * Issue a query to the Prometheus server
     * @param {String} queryString string query to make
     * @param {number} timePoint time index for the query, in seconds since epoch (ie Date.now()/1000)
     * @returns {JSON} the result of the query
     * @async
     */
    async query(queryString, timePoint) {
        const query = '?query=' + queryString + '&time=' + timePoint;
        Logger.debug('Issuing query: ', query);
        const targetParams = this.retrieveTargetParameters(SINGLE, query);
        return await this.retrieveResponse(targetParams);
    }

    /**
     * URL encode a passed string and issue a `get` request against the v1 api
     * @param {String} getString the string to URL encode and use as a get request
     * @returns {JSON} the result of the get query
     * @async
     */
    async getByEncodedUrl(getString) {
        Logger.debug('Performing get with url encoded string: ', getString);
        const targetParams =  this.retrieveTargetParameters(NULL, getString);
        return await this.retrieveResponse(targetParams);
    }

    /**
     * Retrieve a response object by making the query
     * @param {Object} targetParams parameters and the http module required for the http request
     * @returns {JSON} the result of the query
     * @async
     */
    async retrieveResponse(targetParams){
        try {
            const resp = await this.doRequest(targetParams);
            const response = JSON.parse(resp);
            if (response.status.localeCompare('success') === 0 ) {
                return response;
            } else {
                Logger.error(`Prometheus query to ${targetParams.requestParams.href} failed with: ${JSON.stringify(response)}`);
                return null;
            }
        } catch (error) {
            Logger.error('Query error: ', error);
            throw error;
        }
    }


    /**
     * Perform the request and return it in a promise
     * @param {Object} targetParams parameters and the http module required for the http request
     * @returns {Promise} Promise
     */
    doRequest(targetParams) {
        return new Promise ((resolve, reject) => {

            // Assign request options
            const options = Object.assign(targetParams.requestParams, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Make the request
            const req = targetParams.httpModule.request(options, res => {
                let body = '';
                res.setEncoding('utf8');
                res.on('data', chunk => {
                    body += chunk;
                });
                res.on('end', () => {
                    if(body) {
                        resolve(body);
                    } else {
                        resolve();
                    }
                });
                res.on('error', err => {
                    Logger.error(err);
                    reject(err);
                });
            });

            req.end();
        });
    }

    /**
     * Check if we are using http or https
     * @param {*} href the passed Href
     * @returns {Boolean} true if https
     */
    isHttps(href) {
        return href.search(/^https/) !== -1;
    }
}

module.exports = PrometheusQueryClient;
