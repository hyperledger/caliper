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

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const should = chai.should();
const mockery = require('mockery');
const sinon = require('sinon');

/**
 * simulate Util
 */
class Utils {
    /**
     *
     * @param {*} path path
     * @return {string} the fake path
     */
    static resolvePath(path) {
        return 'fake/path';
    }

    /**
     *
     * @return {boolean} the fake path
     */
    static isForkedProcess() {
        return false;
    }

    /**
     *
     * @param {*} yaml res
     * @return {string} the fake yaml
     */
    static parseYaml(yaml) {
        return 'yaml';
    }

    /**
     * @returns {*} logger stub
     */
    static getLogger() {
        return {
            debug: sinon.stub(),
            error: sinon.stub()
        };
    }

    /**
     * @param {*} url url
     * @returns {*} url
     */
    static augmentUrlWithBasicAuth(url) {
        return url;
    }
}

mockery.enable({
    warnOnReplace: false,
    warnOnUnregistered: false
});
mockery.registerMock('../../common/utils/caliper-utils', Utils);


describe('When using a PrometheusPushTxObserver', () => {

    // Require here to enable mocks to be established
    const PrometheusPushTxObserver = require('../../../lib/worker/tx-observers/prometheus-push-tx-observer');

    after(()=> {
        mockery.deregisterAll();
        mockery.disable();
    });

    it('should throw an error if no pushURL is specified within the options', async () => {
        (() => {
            PrometheusPushTxObserver.createTxObserver(undefined, undefined, 0);
        }).should.throw('PushGateway transaction observer must be provided with a pushUrl within the passed options');
    });

    it('should build from default values if no options are passed', async () => {
        const options = {
            pushUrl: 'http://my.url.com'
        };
        const prometheusPushTxObserver = PrometheusPushTxObserver.createTxObserver(options, undefined, 0);

        // Assert expected default options
        prometheusPushTxObserver.pushInterval.should.equal(10000);
        prometheusPushTxObserver.defaultLabels.should.deep.equal({
            roundIndex: 0,
            roundLabel: undefined,
            workerIndex: 0
        });
        should.not.exist(prometheusPushTxObserver.processMetricCollectInterval);
        prometheusPushTxObserver.defaultLabels.should.deep.equal({
            roundIndex: 0,
            roundLabel: undefined,
            workerIndex: 0
        });
    });

    it('should build from the passed options if they exist', async () => {
        const options = {
            pushUrl: 'http://my.url.com',
            pushInterval: 1234,
            processMetricCollectInterval: 100,
            defaultLabels: {
                anotherLabel: 'anotherLabel'
            }
        };
        const prometheusPushTxObserver = PrometheusPushTxObserver.createTxObserver(options, undefined, 0);

        // Assert expected options
        prometheusPushTxObserver.pushInterval.should.equal(1234);
        prometheusPushTxObserver.processMetricCollectInterval.should.equal(100);
        prometheusPushTxObserver.defaultLabels.should.deep.equal({
            roundIndex: 0,
            roundLabel: undefined,
            workerIndex: 0,
            anotherLabel: 'anotherLabel'
        });
    });

    it('should update labels on activate to ensure statistics are scraped correctly', async () => {
        const options = {
            pushUrl: 'http://my.url.com'
        };
        const prometheusPushTxObserver = PrometheusPushTxObserver.createTxObserver(options, undefined, 0);
        prometheusPushTxObserver._sendUpdate = sinon.stub();
        await prometheusPushTxObserver.activate(2, 'myTestRound');

        prometheusPushTxObserver.defaultLabels.should.deep.equal({
            roundIndex: 2,
            roundLabel: 'myTestRound',
            workerIndex: 0
        });
    });

    it('should update transaction statistics during use', async () => {
        const options = {
            pushUrl: 'http://my.url.com'
        };
        const prometheusPushTxObserver = PrometheusPushTxObserver.createTxObserver(options, undefined, 0);
        prometheusPushTxObserver._sendUpdate = sinon.stub();
        await prometheusPushTxObserver.activate(2, 'myTestRound');
        prometheusPushTxObserver.txSubmitted(100);
        prometheusPushTxObserver.txFinished({
            GetStatus: sinon.stub().returns('success'),
            GetTimeFinal: sinon.stub().returns(101),
            GetTimeCreate: sinon.stub().returns(10)
        });

        prometheusPushTxObserver.counterTxSubmitted.hashMap.should.deep.equal({
            '': { value: 100, labels: {} }
        });
        prometheusPushTxObserver.counterTxFinished.hashMap.should.deep.equal({
            'final_status:success': {
                labels: {
                    'final_status': 'success'
                },
                value: 1
            }
        });
    });

    it('should reset all counters on deactivate so that statistics do not bleed into other rounds', async () => {
        const options = {
            pushUrl: 'http://my.url.com'
        };
        const prometheusPushTxObserver = PrometheusPushTxObserver.createTxObserver(options, undefined, 0);
        prometheusPushTxObserver._sendUpdate = sinon.stub();
        await prometheusPushTxObserver.activate(2, 'myTestRound');
        prometheusPushTxObserver.txSubmitted(100);
        prometheusPushTxObserver.txFinished(
            [{
                GetStatus: sinon.stub().returns('success'),
                GetTimeFinal: sinon.stub().returns(101),
                GetTimeCreate: sinon.stub().returns(10)
            },
            {
                GetStatus: sinon.stub().returns('success'),
                GetTimeFinal: sinon.stub().returns(101),
                GetTimeCreate: sinon.stub().returns(10)
            }]
        );

        prometheusPushTxObserver.counterTxSubmitted.hashMap.should.deep.equal({
            '': {
                labels: {},
                value: 100
            }
        });
        prometheusPushTxObserver.counterTxFinished.hashMap.should.deep.equal({
            'final_status:success': {
                labels: {
                    'final_status': 'success'
                },
                value: 2
            }
        });

        await prometheusPushTxObserver.deactivate();

        // Values should be zero, or empty (https://github.com/siimon/prom-client/blob/master/test/counterTest.js)
        const txSubmitted = await prometheusPushTxObserver.counterTxSubmitted.get();
        txSubmitted.values[0].value.should.equal(0);

        const txFinished = await prometheusPushTxObserver.counterTxFinished.get();
        txFinished.values.should.deep.equal([]);
    });

});
