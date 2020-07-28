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

const Report = require('../../../lib/manager/report/report');
const TransactionStatisticsCollector = require('../../../lib/common/core/transaction-statistics-collector');

const chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('report implementation', () => {

    describe('#getResultValues', () => {

        it('should retrieve a result column map', () => {
            const report = new Report();
            const txnStats = new TransactionStatisticsCollector();

            const getResultColumnMapSpy = new sinon.stub().returns(new Map());
            report.getResultColumnMap = getResultColumnMapSpy;

            report.getResultValues('label', txnStats);

            sinon.assert.calledOnce(getResultColumnMapSpy);
        });

        it('should set Name to `unknown` if missing', () => {
            const report = new Report();
            const txnStats = new TransactionStatisticsCollector();

            const output = report.getResultValues(null, txnStats);
            output.get('Name').should.equal('unknown');
        });

        it('should set Name if available', () => {
            const report = new Report();
            const txnStats = new TransactionStatisticsCollector();

            const output = report.getResultValues('myTestLabel', txnStats);
            output.get('Name').should.equal('myTestLabel');
        });

        it('should set Succ if available', () => {
            const report = new Report();
            const txnStats = new TransactionStatisticsCollector();
            txnStats.stats.txCounters.totalSuccessful = 42;

            const output = report.getResultValues('myTestLabel', txnStats);
            output.get('Succ').should.equal(42);
        });

        it('should set Succ to zero if passed', () => {
            const report = new Report();
            const txnStats = new TransactionStatisticsCollector();

            const output = report.getResultValues('myTestLabel', txnStats);
            output.get('Succ').should.equal(0);
        });

        it('should set Fail if available', () => {
            const report = new Report();
            const txnStats = new TransactionStatisticsCollector();
            txnStats.stats.txCounters.totalFailed = 38;

            const output = report.getResultValues('myTestLabel', txnStats);
            output.get('Fail').should.equal(38);
        });

        it('should set Max Latency to 2DP if available', () => {
            const report = new Report();
            const txnStats = new TransactionStatisticsCollector();
            txnStats.stats.latency.successful.max = 1232.2;

            const output = report.getResultValues('myTestLabel', txnStats );
            output.get('Max Latency (s)').should.equal('1.23');
        });

        it('should set Min Latency to 2DP if available', () => {
            const report = new Report();
            const txnStats = new TransactionStatisticsCollector();
            txnStats.stats.latency.successful.min = 232.2;

            const output = report.getResultValues('myTestLabel', txnStats);
            output.get('Min Latency (s)').should.equal('0.23');
        });

        it('should set Avg Latency to `-` if no successful transactions', () => {
            const report = new Report();
            const txnStats = new TransactionStatisticsCollector();

            const output = report.getResultValues('myTestLabel', txnStats);
            output.get('Avg Latency (s)').should.equal('-');
        });

        it('should set Avg Latency to 2DP if available', () => {
            const report = new Report();
            const txnStats = new TransactionStatisticsCollector();
            txnStats.stats.txCounters.totalSuccessful = 3;
            txnStats.stats.latency.successful.total = 10000;

            const output = report.getResultValues('myTestLabel', txnStats);
            output.get('Avg Latency (s)').should.equal('3.33');
        });

        it('should set Send Rate to 1DP if available', () => {
            const report = new Report();
            const txnStats = new TransactionStatisticsCollector();
            txnStats.stats.txCounters.totalSuccessful = 500;
            txnStats.stats.timestamps.firstCreateTime = 1565001755094;
            txnStats.stats.timestamps.lastCreateTime  = 1565001774893;

            const output = report.getResultValues('myTestLabel', txnStats);
            output.get('Send Rate (TPS)').should.equal('25.3');
        });

        it('should set Throughput to 1DP if available', () => {
            const report = new Report();
            const txnStats = new TransactionStatisticsCollector();
            txnStats.stats.txCounters.totalSuccessful = 500;
            txnStats.stats.timestamps.lastFinishTime  = 1565001774988;
            txnStats.stats.timestamps.firstCreateTime = 1565001755094;

            const output = report.getResultValues('myTestLabel', txnStats);
            output.get('Throughput (TPS)').should.equal('25.1');
        });
    });

    describe('#convertToTable', () => {

        it('should handle a single result map', () => {
            const report = new Report();
            const results = new Map();
            results.set('Val1', 1);
            results.set('Val2', 2);

            const table = report.convertToTable(results);
            table.should.be.an('array').with.length(2);
            table[0].should.be.an('array').that.contains('Val1','Val2');
            table[1].should.be.an('array').that.contains(1,2);
        });

        it('should handle an array of result maps', () => {
            const report = new Report();
            const results1 = new Map();
            results1.set('Val1', 1);
            results1.set('Val2', 2);
            const results2 = new Map();
            results2.set('Val1', 3);
            results2.set('Val2', 4);

            const table = report.convertToTable([results1,  results2]);
            table.should.be.an('array').with.length(3);
            table[0].should.be.an('array').that.contains('Val1','Val2');
            table[1].should.be.an('array').that.contains(1,2);
            table[2].should.be.an('array').that.contains(3,4);
        });
    });

});
