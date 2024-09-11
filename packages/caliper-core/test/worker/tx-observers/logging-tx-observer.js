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
const sinon = require('sinon');
const expect = chai.expect;
const mockery = require('mockery');

chai.use(require('sinon-chai'));

describe('When monitoring transaction activity', () => {
    let createLoggingTxObserver, CaliperUtils, observer, logStub;

    before(() => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false
        });

        CaliperUtils = {
            getLogger: sinon.stub().returns({
                info: sinon.stub(),
                error: sinon.stub(),
                warn: sinon.stub()
            })
        };

        mockery.registerMock('../../common/utils/caliper-utils', CaliperUtils);
        createLoggingTxObserver = require('../../../lib/worker/tx-observers/logging-tx-observer').createTxObserver;
    });

    beforeEach(() => {
        logStub = CaliperUtils.getLogger().info;
        observer = createLoggingTxObserver({ messageLevel: 'info' }, null, 0);
    });

    afterEach(() => {
        sinon.restore();
        logStub.resetHistory();
    });

    after(() => {
        mockery.deregisterAll();
        mockery.disable();
    });

    describe('On initialization', () => {
        it('should set up the logger with default settings if no options are provided', () => {
            observer = createLoggingTxObserver({}, null, 0);
            expect(logStub).to.exist;
        });

        it('should use a specific log level if provided in options', () => {
            observer = createLoggingTxObserver({ messageLevel: 'warn' }, null, 0);
            const warnLogger = CaliperUtils.getLogger().warn;
            expect(warnLogger).to.exist;
        });
    });

    describe('When processing submitted transactions', () => {
        it('should ignore submissions and not log any data', () => {
            observer.txSubmitted(5);
            expect(logStub).to.not.have.been.called;
        });
    });

    describe('When processing finished transactions', () => {
        it('should log multiple transaction results', () => {
            const results = [{ status: 'success' }, { status: 'failed' }];
            observer.txFinished(results);
            expect(logStub).to.have.been.calledTwice;
            expect(logStub.firstCall).to.have.been.calledWithMatch(JSON.stringify({
                status: 'success',
            }));
            expect(logStub.secondCall).to.have.been.calledWithMatch(JSON.stringify({
                status: 'failed',
            }));
        });

        it('should handle empty results without logging', () => {
            observer.txFinished([]);
            expect(logStub).to.not.have.been.called;
        });

        it('should not modify the original result object properties', () => {
            const result = { status: 'success' };
            observer.txFinished(result);

            expect(result).to.not.have.property('workerIndex');
            expect(result).to.not.have.property('roundIndex');
        });
    });
});
