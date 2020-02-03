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

const PrometheusQueryHelper = require('../../../lib/common/prometheus/prometheus-query-helper');

const chai = require('chai');
chai.should();

describe('PrometheusQueryHelper implementation', () => {


    describe('#buildStringRangeQuery', () => {

        const startTime = 100;
        const endTime = 200;
        const step = 45;

        it('should add start, end and step information', () => {
            const demoString = 'test_the_helper';

            const output = PrometheusQueryHelper.buildStringRangeQuery(demoString, startTime, endTime, step);
            output.endsWith('&start=100&end=200&step=45').should.be.true;
        });

        it('should replace an instance of `{values}` with URI encoded version of that occurrence', () => {
            const demoString = 'sum(rate(container_cpu_usage_seconds_total{name=~".+"}[5m])) by (name) * 100';

            const output = PrometheusQueryHelper.buildStringRangeQuery(demoString, startTime, endTime, step);

            output.should.not.contain('{');
            output.should.not.contain('}');
            output.should.contain(encodeURIComponent('{name=~".+"}'));
        });

    });

    describe('#extractFirstValueFromQueryResponse', () => {


        it('should deal with a vector response that is numerical', () => {
            const response = {
                status: 'success',
                data: {
                    resultType: 'vector',
                    result: [
                        { metric: { name: 'Name0' }, value: [1565608080.458, '10'] }
                    ]
                }
            };
            const output = PrometheusQueryHelper.extractFirstValueFromQueryResponse(response, true);
            output.should.equal(10);
        });

        it('should deal with a vector response that is numerical string', () => {
            const response = {
                status: 'success',
                data: {
                    resultType: 'vector',
                    result: [
                        { metric: { name: 'Name0' }, value: [1565608080.458, '10'] }
                    ]
                }
            };
            const output = PrometheusQueryHelper.extractFirstValueFromQueryResponse(response);
            output.should.equal(10);
        });

        it('should deal with a vector response that is a string', () => {
            const response = {
                status: 'success',
                data: {
                    resultType: 'vector',
                    result: [
                        { metric: { name: 'Name0' }, value: [1565608080.458, 'bob'] }
                    ]
                }
            };
            const output = PrometheusQueryHelper.extractFirstValueFromQueryResponse(response, false);
            output.should.equal('bob');
        });

        it('should deal with a matrix response that is numerical', () => {
            const response = {
                status: 'success',
                data: {
                    resultType: 'matrix',
                    result: [
                        { metric: { name: 'Name0' }, values: [[1565608080.458, 3.1]] },
                        { metric: { name: 'Name1' }, values: [[1565608080.458, 0.2]] },
                        { metric: { name: 'Name2' }, values: [[1565608080.458, 0.1]] }
                    ]
                }
            };
            const output = PrometheusQueryHelper.extractFirstValueFromQueryResponse(response, true);
            output.should.be.an('map');
            output.size.should.equal(3);
            output.get('Name0').should.equal(3.1);
            output.get('Name1').should.equal(0.2);
            output.get('Name2').should.equal(0.1);
        });

        it('should deal with a matrix response that contains numerical string values', () => {
            const response = {
                status: 'success',
                data: {
                    resultType: 'matrix',
                    result: [
                        { metric: { name: 'Name0' }, values: [[1565608080.458, '3.1']] },
                        { metric: { name: 'Name1' }, values: [[1565608080.458, '0.2']] },
                        { metric: { name: 'Name2' }, values: [[1565608080.458, '0.1']] }
                    ]
                }
            };
            const output = PrometheusQueryHelper.extractFirstValueFromQueryResponse(response, true);
            output.should.be.an('map');
            output.size.should.equal(3);
            output.get('Name0').should.equal(3.1);
            output.get('Name1').should.equal(0.2);
            output.get('Name2').should.equal(0.1);
        });

        it('should deal with a matrix response that contains string values', () => {
            const response = {
                status: 'success',
                data: {
                    resultType: 'matrix',
                    result: [
                        { metric: { name: 'Name0' }, values: [[1565608080.458, 'a']] },
                        { metric: { name: 'Name1' }, values: [[1565608080.458, 'b']] },
                        { metric: { name: 'Name2' }, values: [[1565608080.458, 'c']] }
                    ]
                }
            };
            const output = PrometheusQueryHelper.extractFirstValueFromQueryResponse(response, false);
            output.should.be.an('map');
            output.size.should.equal(3);
            output.get('Name0').should.equal('a');
            output.get('Name1').should.equal('b');
            output.get('Name2').should.equal('c');
        });

        it('should return `-` if passed too many results', () => {
            const response = {
                data: {
                    resultType: 'vector',
                    result: [1, 2, 3, 4]
                }
            };
            const value = PrometheusQueryHelper.extractFirstValueFromQueryResponse(response);
            value.should.equal('-');
        });

        it('should return `-` if no value field', () => {
            const response = {
                data: {
                    resultType: 'vector',
                    result: [{ missing: 'yes' }]
                }
            };
            const value = PrometheusQueryHelper.extractFirstValueFromQueryResponse(response);
            value.should.equal('-');
        });

        it('should return contained value ', () => {
            const response = {
                data: {
                    resultType: 'vector',
                    result: [{ value: [111, 1] }]
                }
            };
            const value = PrometheusQueryHelper.extractFirstValueFromQueryResponse(response);
            value.should.equal(1);
        });

        it('should return parse contained value to float by default', () => {
            const response = {
                data: {
                    resultType: 'vector',
                    result: [{ value: [111, '1'] }]
                }
            };
            const value = PrometheusQueryHelper.extractFirstValueFromQueryResponse(response);
            value.should.equal(1);
        });

        it('should return contained value as string if specified', () => {
            const response = {
                data: {
                    resultType: 'vector',
                    result: [{ value: [111, '1'] }]
                }
            };
            const value = PrometheusQueryHelper.extractFirstValueFromQueryResponse(response, false);
            value.should.equal('1');
        });

        it('should throw an error if unknown result type', () => {
            (() => {
                const response = {
                    data: {
                        resultType: 'penguin',
                        result: [{ value: [111, '1'] }]
                    }
                };
                PrometheusQueryHelper.extractFirstValueFromQueryResponse(response, false);
            }).should.throw(Error, /Unknown or missing result type: penguin/);
        });

    });


    describe('#extractStatisticFromRange', () => {

        it('should retrieve the minimum values from a matrix response', () => {
            const response = {
                status: 'success',
                data: {
                    resultType: 'matrix',
                    result: [{
                        metric: {
                            name: 'ca.org1.example.com'
                        },
                        values: [[100, 90], [200, 60], [300, 432]]
                    },
                    {
                        metric: {
                            name: 'ca.org2.example.com'
                        },
                        values: [[100, 40], [200, 50], [0.699, 60]]
                    },
                    {
                        metric: {
                            name: 'cadvisor'
                        },
                        values: [[100, 500], [200, 250], [0.699, 10]]
                    }
                    ]
                }
            };
            const output = PrometheusQueryHelper.extractStatisticFromRange(response, 'min', 'name');
            output.should.be.an('map');
            output.size.should.equal(3);
            output.get('ca.org1.example.com').should.equal(60);
            output.get('ca.org2.example.com').should.equal(40);
            output.get('cadvisor').should.equal(10);
        });

        it('should retrieve the minimum value from a matrix response that is numerical but contains no names', () => {
            const response = {
                status: 'success',
                data: {
                    resultType: 'matrix',
                    result: [
                        { values: [[1565608080.458, 3], [1565608080.458, 4.8], [1565608080.458, 0.2]] }
                    ]
                }
            };
            const output = PrometheusQueryHelper.extractStatisticFromRange(response, 'min', 'name');
            output.should.be.an('map');
            output.size.should.equal(1);
            output.get('unknown').should.equal(0.2);
        });

        it('should retrieve the minimum value from a matrix response that contains a string', () => {
            const response = {
                status: 'success',
                data: {
                    resultType: 'matrix',
                    result: [
                        { metric: { name: 'Name0' }, values: [[1565608080.458, 'banana'], [1565608080.458, 'penguin'], [1565608080.458, '0.2']] },
                        { metric: { name: 'Name1' }, values: [[1565608080.458, '1'], [1565608080.458, 'bob'], [1565608080.458, '6']] },
                        { metric: { name: 'Name2' }, values: [[1565608080.458, 'sally'], [1565608080.458, '-2'], [1565608080.458, '0.001']] }
                    ]
                }
            };
            const output = PrometheusQueryHelper.extractStatisticFromRange(response, 'min', 'name');
            output.should.be.an('map');
            output.size.should.equal(3);
            output.get('Name0').should.equal('-');
            output.get('Name1').should.equal('-');
            output.get('Name2').should.equal('-');
        });

        it('should retrieve the maximum value from a matrix response with a single value', () => {
            const response = {
                status: 'success',
                data: {
                    resultType: 'matrix',
                    result: [
                        {
                            metric: { name: 'Name0' },
                            values: [
                                [1565608080.458, 3]
                            ]
                        }
                    ]
                }
            };
            const output = PrometheusQueryHelper.extractStatisticFromRange(response, 'max', 'name');
            output.should.be.an('map');
            output.size.should.equal(1);
            output.get('Name0').should.equal(3);
        });

        it('should retrieve the maximum value from a matrix response with multiple values', () => {
            const response = {
                status: 'success',
                data: {
                    resultType: 'matrix',
                    result: [
                        { metric: { name: 'Name0' }, values: [[1565608080.458, 3], [1565608080.458, 4.8], [1565608080.458, 0.2]] },
                        { metric: { name: 'Name1' }, values: [[1565608080.458, 1], [1565608080.458, 8], [1565608080.458, 6]] },
                        { metric: { name: 'Name2' }, values: [[1565608080.458, 0.1], [1565608080.458, -2], [1565608080.458, 0.001]] }
                    ]
                }
            };
            const output = PrometheusQueryHelper.extractStatisticFromRange(response, 'max', 'name');
            output.should.be.an('map');
            output.size.should.equal(3);
            output.get('Name0').should.equal(4.8);
            output.get('Name1').should.equal(8);
            output.get('Name2').should.equal(0.1);
        });

        it('should retrieve the maximum value from a matrix response with a single value and no name', () => {
            const response = {
                status: 'success',
                data: {
                    resultType: 'matrix',
                    result: [
                        {
                            values: [
                                [1565608080.458, 3]
                            ]
                        }
                    ]
                }
            };
            const output = PrometheusQueryHelper.extractStatisticFromRange(response, 'max');
            output.should.be.an('map');
            output.size.should.equal(1);
            output.get('unknown').should.equal(3);
        });

        it('should retrieve the maximum value from a matrix response that is numerical but contains no names', () => {
            const response = {
                'status': 'success',
                'data': {
                    'resultType': 'matrix',
                    'result': [
                        {
                            'metric': {},
                            'values': [
                                [1565625618.564, '0.7'],
                                [1565625619.564, '0.324'],
                                [1565625620.564, '0.35']]
                        }
                    ]
                }
            };
            const output = PrometheusQueryHelper.extractStatisticFromRange(response, 'max');
            output.should.be.an('map');
            output.size.should.equal(1);
            output.get('unknown').should.equal(0.7);
        });

        it('should retrieve the maximum value from a matrix response that is string', () => {
            const response = {
                status: 'success',
                data: {
                    resultType: 'matrix',
                    result: [
                        { metric: { name: 'Name0' }, values: [[1565608080.458, 'banana'], [1565608080.458, 'penguin'], [1565608080.458, '0.2']] },
                        { metric: { name: 'Name1' }, values: [[1565608080.458, '1'], [1565608080.458, 'bob'], [1565608080.458, '6']] },
                        { metric: { name: 'Name2' }, values: [[1565608080.458, 'sally'], [1565608080.458, '-2'], [1565608080.458, '0.001']] }
                    ]
                }
            };
            const output = PrometheusQueryHelper.extractStatisticFromRange(response, 'max', 'name');
            output.should.be.an('map');
            output.size.should.equal(3);
            output.get('Name0').should.equal('-');
            output.get('Name1').should.equal('-');
            output.get('Name2').should.equal('-');
        });

        it('should retrieve the average value from a matrix response', () => {
            const response = {
                data: {
                    resultType: 'matrix',
                    result: [{ values: [[111, 1], [111, 1], [111, 2], [111, 2], [111, 8]] }]
                }
            };
            const output = PrometheusQueryHelper.extractStatisticFromRange(response, 'avg');
            output.should.be.an('map');
            output.size.should.equal(1);
            output.get('unknown').should.equal(2.8);
        });

        it('should retrieve the sum value from a matrix response', () => {
            const response = {
                data: {
                    resultType: 'matrix',
                    result: [{ values: [[111, 1], [111, 1], [111, 2], [111, 2], [111, 8]] }]
                }
            };
            const output = PrometheusQueryHelper.extractStatisticFromRange(response, 'sum');
            output.should.be.an('map');
            output.size.should.equal(1);
            output.get('unknown').should.equal(14);
        });

        it('should return `-` if passed too few results', () => {
            const response = {
                data: {
                    resultType: 'matrix',
                    result: [1]
                }
            };
            const output = PrometheusQueryHelper.extractStatisticFromRange(response, 'min');
            output.should.be.an('map');
            output.size.should.equal(1);
            output.get('unknown').should.equal('-');
        });

        it('should return `-` if no values field', () => {
            const response = {
                data: {
                    resultType: 'matrix',
                    result: [{ missing: 'yes' }]
                }
            };
            const output = PrometheusQueryHelper.extractStatisticFromRange(response, 'min');
            output.should.be.an('map');
            output.size.should.equal(1);
            output.get('unknown').should.equal('-');
        });

    });


    describe('#extractValuesFromTimeSeries', () => {

        const numberSeries = [
            [111, 1],
            [111, 2],
            [111, 3],
            [111, 4]
        ];

        const stringSeries = [
            [111, '1'],
            [111, '2'],
            [111, '3'],
            [111, '4']
        ];

        it('should return numeric values by default', () => {
            const values = PrometheusQueryHelper.extractValuesFromTimeSeries(numberSeries);
            values.should.be.an('array').of.length(4).that.deep.equals([1, 2, 3, 4]);
        });

        it('should cast to numeric values if specified', () => {
            const values = PrometheusQueryHelper.extractValuesFromTimeSeries(stringSeries, true);
            values.should.be.an('array').of.length(4).that.deep.equals([1, 2, 3, 4]);
        });

        it('should return string values if specified', () => {
            const values = PrometheusQueryHelper.extractValuesFromTimeSeries(stringSeries, false);
            values.should.be.an('array').of.length(4).that.deep.equals(['1', '2', '3', '4']);
        });
    });

});

