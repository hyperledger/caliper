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

const Report = require('../../../lib/master/report/report');

const chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('report implementation', () => {

    describe('#getLocalResultValues', () => {

        it('should retrieve a result column map', () => {
            const report = new Report();

            const getResultColumnMapSpy = new sinon.stub().returns(new Map());
            report.getResultColumnMap = getResultColumnMapSpy;

            report.getLocalResultValues('label', {});

            sinon.assert.calledOnce(getResultColumnMapSpy);
        });

        it('should set Name to `unknown` if missing', () => {
            const report = new Report();
            const output = report.getLocalResultValues(null,  {});
            output.get('Name').should.equal('unknown');
        });

        it('should set Name if available', () => {
            const report = new Report();
            const output = report.getLocalResultValues('myTestLabel', {});
            output.get('Name').should.equal('myTestLabel');
        });

        it('should set Succ to `-` if missing', () => {
            const report = new Report();
            const output = report.getLocalResultValues('myTestLabel', {});
            output.get('Succ').should.equal('-');
        });

        it('should set Succ if available', () => {
            const report = new Report();
            const output = report.getLocalResultValues('myTestLabel', {succ: '42'});
            output.get('Succ').should.equal('42');
        });

        it('should set Succ to zero if passed', () => {
            const report = new Report();
            const output = report.getLocalResultValues('myTestLabel', {succ: '0'});
            output.get('Succ').should.equal('0');
        });

        it('should set Fail to `-` if missing', () => {
            const report = new Report();
            const output = report.getLocalResultValues('myTestLabel', {});
            output.get('Fail').should.equal('-');
        });

        it('should set Fail if available', () => {
            const report = new Report();
            const output = report.getLocalResultValues('myTestLabel', {fail: '38'});
            output.get('Fail').should.equal('38');
        });

        it('should set Max Latency to `-` if missing', () => {
            const report = new Report();
            const output = report.getLocalResultValues('myTestLabel', {});
            output.get('Max Latency (s)').should.equal('-');
        });

        it('should set Max Latency to 2DP if available', () => {
            const report = new Report();
            const output = report.getLocalResultValues('myTestLabel', {delay: { max: 1.2322}} );
            output.get('Max Latency (s)').should.equal('1.23');
        });
        it('should set Min Latency to `-` if missing', () => {
            const report = new Report();
            const output = report.getLocalResultValues('myTestLabel', {});
            output.get('Min Latency (s)').should.equal('-');
        });

        it('should set Min Latency to 2DP if available', () => {
            const report = new Report();
            const output = report.getLocalResultValues('myTestLabel', {delay: { min: 0.2322}});
            output.get('Min Latency (s)').should.equal('0.23');
        });

        it('should set Avg Latency to `-` if missing', () => {
            const report = new Report();
            const output = report.getLocalResultValues('myTestLabel', {});
            output.get('Avg Latency (s)').should.equal('-');
        });

        it('should set Avg Latency to 2DP if available', () => {
            const report = new Report();
            const output = report.getLocalResultValues('myTestLabel', { succ: 3, delay: { sum: 10}});
            output.get('Avg Latency (s)').should.equal('3.33');
        });

        it('should set Send Rate `-` if missing', () => {
            const report = new Report();
            const output = report.getLocalResultValues('myTestLabel', {});
            output.get('Send Rate (TPS)').should.equal('-');
        });

        it('should set Send Rate to 1DP if available', () => {
            const report = new Report();
            const output = report.getLocalResultValues('myTestLabel', { succ:500, fail:0, create:{min:1565001755.094, max:1565001774.893} });
            output.get('Send Rate (TPS)').should.equal('25.3');
        });

        it('should set Throughput to `-` if missing', () => {
            const report = new Report();
            const output = report.getLocalResultValues('myTestLabel', {});
            output.get('Throughput (TPS)').should.equal('-');
        });

        it('should set Throughput to 1DP if available', () => {
            const report = new Report();
            const output = report.getLocalResultValues('myTestLabel', {succ:500,fail:0,create:{min:1565001755.094,max:1565001774.893},final:{min:1565001755.407,max:1565001774.988,last:1565001774.988},delay:{min:0.072,max:0.342,sum:98.64099999999999,detail:[]},out:[],sTPTotal:0,sTTotal:0,invokeTotal:0,length:500});
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
