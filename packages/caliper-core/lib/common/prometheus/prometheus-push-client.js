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

const Logger = require('../utils/caliper-utils').getLogger('prometheus-push-client');

const BASE = 'metrics/job/caliper/';
const POST = 'POST';
const DELETE = 'DELETE';

/**
 * PrometheusClient - client communication with Prometheus metrics through the Push Gateway
 */
class PrometheusPushClient {

    /**
     * Constructor for client
     * @param {String} gatewayURL the push gateway URL
     */
    constructor(gatewayURL) {
        this.gatewayURL = gatewayURL;
    }

    /**
     * Check if gateway has been set
     * @returns {Boolean} true if gateway set, otherwise false
     */
    gatewaySet(){
        const isSet = this.gatewayURL ? true : false;
        return isSet;
    }

    /**
     * Set the gateway
     * @param {String} gatewayURL the push gateway URL
     */
    setGateway(gatewayURL) {
        this.gatewayURL = gatewayURL;
    }

    /**
     * Configure the target for the push
     * @param {String} testLabel the benchmark test name to store under
     * @param {String} testRound the test round to store under
     * @param {String} clientId the clientId to store under
     */
    configureTarget(testLabel, testRound, clientId) {
        const testPath = `instance/${testLabel}/round/${testRound.toString()}/client/${clientId.toString()}`;
        const target = url.resolve(this.gatewayURL, BASE + testPath);
        this.requestParams = url.parse(target);
        this.httpModule = this.isHttps(this.requestParams.href) ? https : http;
        Logger.debug(`Prometheus push client configured to target ${this.requestParams.href}`);
    }

    /**
     * Push a message to the Prometheus gateway
     * @param {String} key the key to store the information
     * @param {String} value the value to persist
     * @param {String[]} tags the tags to use when persisting
     */
    push(key, value, tags) {
        let body;
        if (tags) {
            body = `${key}{${tags.join(',')}} ${value}`;
        } else {
            body = `${key} ${value}`;
        }
        this.useGateway(POST, body);
    }

    /**
     * Delete everything under the path within the PushGateway for the current configuration
     */
    delete(){
        this.useGateway(DELETE, null);
    }

    /**
     * Send message on gateway
     * @param {String} method the method type [POST | DELETE]
     * @param {String} body the body to send
     */
    useGateway(method, body) {
        Logger.debug(`Prometheus client sending body ${body} to target ${this.requestParams.href}`);
        // Convert body to binary, the newline is important
        body = Buffer.from(body + '\n', 'binary');

        // Assign request options
        const options = Object.assign(this.requestParams, {
            method,
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Length': body.length
            }
        });

        // Make the request
        const req = this.httpModule.request(options, res => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => {
                body += chunk;
            });
            res.on('end', () => {
                if(body) {
                    Logger.info('PushGateway Response: ' + body);
                }
            });
        });
        req.on('error', err => {
            Logger.error(err);
        });

        // send and end
        req.write(body);
        req.end();
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

module.exports = PrometheusPushClient;
