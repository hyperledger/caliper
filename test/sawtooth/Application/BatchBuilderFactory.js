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
const BatchBuilderFactory = rewire('../../../src/sawtooth/Application/BatchBuilderFactory');
const Util = require('../../../src/comm/util.js');

const chai = require('chai');
chai.should();
const assert = chai.assert;

describe('BatchBuilderFactory implementation', () => {
    describe('#getBatchBuilder', () => {
        it('should error with no batch builders defined', () => {
            try {
                BatchBuilderFactory.getBatchBuilder('test', '1.0', {
                    sawtooth: {}
                });
                assert.fail(null, null, 'Exception expected');
            } catch (err) {
                if (err.constructor.name === 'AssertionError') {
                    throw err;
                }
                err.message.should.equal('There are no batch builders defined in the configuration');
            }
        });

        it('should error if there is no matching family', () => {
            try {
                BatchBuilderFactory.getBatchBuilder('test', '1.0', {
                    sawtooth: {
                        batchBuilders: {
                            other: { '2.0': 'some/other/path' }
                        }
                    }
                });
                assert.fail(null, null, 'Exception expected');
            } catch (err) {
                if (err.constructor.name === 'AssertionError') {
                    throw err;
                }
                err.message.should.equal('There is no batch builder for test');
            }
        });

        it('should error if there is no matching family+version', () => {
            try {
                BatchBuilderFactory.getBatchBuilder('test', '1.0', {
                    sawtooth: {
                        batchBuilders: {
                            test: { '0.1': 'some/path' },
                            other: { '2.0': 'some/other/path' }
                        }
                    }
                });
                assert.fail(null, null, 'Exception expected');
            } catch (err) {
                if (err.constructor.name === 'AssertionError') {
                    throw err;
                }
                err.message.should.equal('There is no batch builder for test[1.0]');
            }
        });

        it('should alter version v0 to 1.0', () => {
            try {
                BatchBuilderFactory.getBatchBuilder('test', 'v0', {
                    sawtooth: {
                        batchBuilders: {
                            test: { '0.1': 'some/path' },
                            other: { '2.0': 'some/other/path' }
                        }
                    }
                });
                assert.fail(null, null, 'Exception expected');
            } catch (err) {
                if (err.constructor.name === 'AssertionError') {
                    throw err;
                }
                err.message.should.equal('There is no batch builder for test[1.0]');
            }
        });

        it('should error if unable to import the file', () => {
            try {
                BatchBuilderFactory.getBatchBuilder('test', '1.0', {
                    sawtooth: {
                        batchBuilders: {
                            test: { '1.0': 'some/path' },
                            other: { '2.0': 'some/other/path' }
                        }
                    }
                });
                assert.fail(null, null, 'Exception expected');
            } catch (err) {
                if (err.constructor.name === 'AssertionError') {
                    throw err;
                }
                err.message.should.equal('Unable to load batch builder for test[1.0] at some/path::'+
                    'Cannot find module \''+Util.resolvePath('some/path')+'\'');
            }
        });

        it('should be able to return a batch builder', () => {
            const batchBuilder = BatchBuilderFactory.getBatchBuilder('test', '1.0', {
                sawtooth: {
                    batchBuilders: {
                        test: { '1.0': 'src/sawtooth/Application/SimpleBatchBuilder' },
                        other: { '2.0': 'some/other/path' }
                    }
                }
            });
            batchBuilder.constructor.name.should.equal('SimpleBatchBuilder');
        });
    });

});