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
    let createLoggingTxObserver, CaliperUtils, observer, logStubs;

    before(() => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false
        });

        logStubs = {
            info: sinon.stub(),
            error: sinon.stub(),
            warn: sinon.stub()
        };

        CaliperUtils = {
            getLogger: sinon.stub().returns(logStubs)
        };

        mockery.registerMock('../../common/utils/caliper-utils', CaliperUtils);
        createLoggingTxObserver = require('../../../lib/worker/tx-observers/logging-tx-observer').createTxObserver;
    });

    beforeEach(() => {
        logStubs.info.resetHistory();
        logStubs.warn.resetHistory();
        logStubs.error.resetHistory();
        observer = createLoggingTxObserver({ messageLevel: 'info' }, null, 0);
    });

    afterEach(() => {
        sinon.restore();
    });

    after(() => {
        mockery.deregisterAll();
        mockery.disable();
    });

    describe('On initialization', () => {
        const logLevels = ['info', 'warn', 'error'];

        logLevels.forEach(level => {
            it(`should use the '${level}' log level if provided in options`, () => {
                observer = createLoggingTxObserver({ messageLevel: level }, null, 0);

                // Simulate a finished transaction
                const result = { status: 'success' };
                observer.txFinished(result);

                // Ensure the correct logger was called
                expect(logStubs[level]).to.have.been.calledOnce;
                expect(logStubs[level]).to.have.been.calledWith(JSON.stringify({
                    status: 'success',
                }));

                // Ensure other loggers were not called
                Object.keys(logStubs).forEach(otherLevel => {
                    if (otherLevel !== level) {
                        expect(logStubs[otherLevel]).to.not.have.been.called;
                    }
                });
            });
        });

    });

    describe('When processing submitted transactions', () => {
        it('should ignore submissions and not log any data', () => {
            observer.txSubmitted(5);
            expect(logStubs.info).to.not.have.been.called;
        });
    });

    describe('When processing finished transactions', () => {
        it('should log multiple transaction results', () => {
            const results = [{ status: 'success' }, { status: 'failed' }];
            observer.txFinished(results);
            expect(logStubs.info).to.have.been.calledTwice;
            expect(logStubs.info.firstCall).to.have.been.calledWithMatch(JSON.stringify({
                status: 'success',
            }));
            expect(logStubs.info.secondCall).to.have.been.calledWithMatch(JSON.stringify({
                status: 'failed',
            }));
        });

        it('should handle empty results without logging', () => {
            observer.txFinished([]);
            expect(logStubs.info).to.not.have.been.called;
        });
    });
});
