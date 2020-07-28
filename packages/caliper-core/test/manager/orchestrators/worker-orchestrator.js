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

const rewire = require('rewire');
const WorkerOrchestratorRewire = rewire('../../../lib/manager/orchestrators/worker-orchestrator');
const TransactionStatisticsCollector = require('../../../lib/common/core/transaction-statistics-collector');

const chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('worker orchestrator implementation', () => {
    const benchmarkConfig = {
        test: {
            workers: {
                number: 7
            }
        }
    };

    const workerFactory = {};

    describe('#constructor', () => {

        it('should read the number of test workers if present in the config file', () => {
            const myOrchestrator = new WorkerOrchestratorRewire(benchmarkConfig, workerFactory);

            myOrchestrator.number.should.equal(7);
        });

        it('should default to one worker in the test if not specified in the config file ', () => {
            const myOrchestrator = new WorkerOrchestratorRewire({ test: { workers: {notNumber: 2}}}, workerFactory);

            myOrchestrator.number.should.equal(1);
        });
    });

    describe('#startTest', () => {
        const myOrchestrator = new WorkerOrchestratorRewire(benchmarkConfig, workerFactory);
        let _startTestStub;
        let formatResultsStub;

        beforeEach(() => {
            _startTestStub = sinon.stub();
            formatResultsStub = sinon.stub().returns('formatted');
            myOrchestrator._startTest = _startTestStub;
            myOrchestrator.formatResults = formatResultsStub;
        });

        it('should increment the updates.id variable', async () => {
            myOrchestrator.updates.id = 41;
            const testMsg = {msg: 'test msg'};
            await myOrchestrator.startTest(testMsg);

            myOrchestrator.updates.id.should.equal(42);
        });

        it('should call _startTest with known arguments', async () => {
            myOrchestrator.updates.id = 0;
            const testMsg = {msg: 'test msg'};
            await  myOrchestrator.startTest(testMsg);

            sinon.assert.calledOnce(_startTestStub);
            sinon.assert.calledWith(_startTestStub, testMsg);
        });

        it('should call formatResults', async() => {
            myOrchestrator.updates.id = 0;
            const testMsg = {msg: 'test msg'};
            await  myOrchestrator.startTest(testMsg);

            sinon.assert.calledOnce(formatResultsStub);
        });

        it('should return the response from formatResults', async () => {
            myOrchestrator.updates.id = 0;
            const testMsg = {msg: 'test msg'};
            const response = await  myOrchestrator.startTest(testMsg);

            response.should.equal('formatted');
        });

    });


    describe('#getUpdates', () => {
        const myOrchestrator = new WorkerOrchestratorRewire(benchmarkConfig, workerFactory);

        it('should return the updates', () => {
            const checkVal = 'this is my update';
            // overwrite with known value
            myOrchestrator.updates = checkVal;
            // assert response
            myOrchestrator.getUpdates().should.equal(checkVal);
        });

    });

    describe('#formatResults', () => {
        const myOrchestrator = new WorkerOrchestratorRewire(benchmarkConfig, workerFactory);

        let workerStats0;
        let workerStats1;
        beforeEach( () => {
            workerStats0 = new TransactionStatisticsCollector(0, 0, 'testLabel');
            workerStats1 = new TransactionStatisticsCollector(1, 0, 'testLabel');
            workerStats0.activate();
            workerStats1.activate();
        });

        it('should merge all worker results into a single txStats object', () => {
            workerStats0.txSubmitted(3);
            workerStats1.txSubmitted(2);
            const testData = [workerStats0, workerStats1];

            const output = myOrchestrator.formatResults(testData);
            output.results.getTotalSubmittedTx().should.equal(5);
        });

        it('should determine and persist the time when all workers have started', () => {
            const compareStart = Date.UTC(2018, 11, 24);
            workerStats0.stats.metadata.roundStartTime = Date.UTC(2018, 11, 24);
            workerStats1.stats.metadata.roundStartTime = Date.UTC(2018, 11, 24);
            const testData = [workerStats0, workerStats1];

            const output = myOrchestrator.formatResults(testData);
            output.start.should.equal(compareStart);
        });

        it('should determine and persist the last time when all workers were running', () => {
            const compareEnd = Date.UTC(2018, 11, 24);
            workerStats0.stats.metadata.roundFinishTime = Date.UTC(2018, 11, 24);
            workerStats1.stats.metadata.roundFinishTime = Date.UTC(2018, 11, 24);
            const testData = [workerStats0, workerStats1];

            const output = myOrchestrator.formatResults(testData);
            output.end.should.equal(compareEnd);
        });
    });

});
