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
}

mockery.enable({
    warnOnReplace: false,
    warnOnUnregistered: false
});
mockery.registerMock('../../common/utils/caliper-utils', Utils);


describe('When using a PrometheusTxObserver', () => {

    // Require here to enable mocks to be established
    const PrometheusTxObserver = require('../../../lib/worker/tx-observers/prometheus-tx-observer');

    after(()=> {
        mockery.deregisterAll();
        mockery.disable();
    });

    it('should build from default values if no options are passed', async () => {
        const prometheusTxObserver = PrometheusTxObserver.createTxObserver(undefined, undefined, 0);

        // Assert expected default options
        prometheusTxObserver.metricPath.should.equal('/metrics');
        prometheusTxObserver.scrapePort.should.equal(3000);
        should.not.exist(prometheusTxObserver.processMetricCollectInterval);
        prometheusTxObserver.defaultLabels.should.deep.equal({
            roundIndex: 0,
            roundLabel: undefined,
            workerIndex: 0
        });
    });

    it('should build from the passed options if they exist', async () => {
        const options = {
            metricPath: '/newPath',
            scrapePort: 1234,
            processMetricCollectInterval: 100,
            defaultLabels: {
                anotherLabel: 'anotherLabel'
            }
        };
        const prometheusTxObserver = PrometheusTxObserver.createTxObserver(options, undefined, 0);

        // Assert expected options
        prometheusTxObserver.metricPath.should.equal('/newPath');
        prometheusTxObserver.scrapePort.should.equal(1234);
        prometheusTxObserver.processMetricCollectInterval.should.equal(100);
        prometheusTxObserver.defaultLabels.should.deep.equal({
            roundIndex: 0,
            roundLabel: undefined,
            workerIndex: 0,
            anotherLabel: 'anotherLabel'
        });
    });

    it('should update labels on activate to ensure statistics are scraped correctly', async () => {
        const prometheusTxObserver = PrometheusTxObserver.createTxObserver(undefined, undefined, 0);
        await prometheusTxObserver.activate(2, 'myTestRound');

        prometheusTxObserver.defaultLabels.should.deep.equal({
            roundIndex: 2,
            roundLabel: 'myTestRound',
            workerIndex: 0
        });
    });

    it('should update transaction statistics during use', async () => {
        const prometheusTxObserver = PrometheusTxObserver.createTxObserver(undefined, undefined, 0);
        await prometheusTxObserver.activate(2, 'myTestRound');
        prometheusTxObserver.txSubmitted(100);
        prometheusTxObserver.txFinished({
            GetStatus: sinon.stub().returns('success'),
            GetTimeFinal: sinon.stub().returns(101),
            GetTimeCreate: sinon.stub().returns(10)
        });

        prometheusTxObserver.counterTxSubmitted.hashMap.should.deep.equal({
            '': { value: 100, labels: {} }
        });
        prometheusTxObserver.counterTxFinished.hashMap.should.deep.equal({
            'final_status:success': {
                labels: {
                    'final_status': 'success'
                },
                value: 1
            }
        });
    });

    it('should reset all counters on deactivate so that statistics do not bleed into other rounds', async () => {
        const prometheusTxObserver = PrometheusTxObserver.createTxObserver(undefined, undefined, 0);
        await prometheusTxObserver.activate(2, 'myTestRound');
        prometheusTxObserver.txSubmitted(100);
        prometheusTxObserver.txFinished(
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

        prometheusTxObserver.counterTxSubmitted.hashMap.should.deep.equal({
            '': { value: 100, labels: {} }
        });
        prometheusTxObserver.counterTxFinished.hashMap.should.deep.equal({
            'final_status:success': {
                labels: {
                    'final_status': 'success'
                },
                value: 2
            }
        });

        await prometheusTxObserver.deactivate();

        // Values should be zero, or empty (https://github.com/siimon/prom-client/blob/master/test/counterTest.js)
        const txSubmitted = await prometheusTxObserver.counterTxSubmitted.get();
        txSubmitted.values[0].value.should.equal(0);

        const txFinished = await prometheusTxObserver.counterTxFinished.get();
        txFinished.values.should.deep.equal([]);
    });

});
