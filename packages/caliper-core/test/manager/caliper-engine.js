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

const sinon = require('sinon');
const chai = require('chai');
//const RoundOrchestrator = require('../../lib/manager/orchestrators/round-orchestrator');
const ConnectorBase = require('../../lib/common/core/connector-base');
const mockery = require('mockery');

//
// Simple RoundOrchestrator Stub
//
let roundOrchestratorStopCalled = false;
let roundOrchestratorRunCalled = false;
class StubRoundOrchestrator {

     run() {roundOrchestratorRunCalled = true}
     stop() {roundOrchestratorStopCalled = true}
}

mockery.enable({
    warnOnReplace: false,
    warnOnUnregistered: false,
    useCleanCache: true
});

mockery.registerMock('./orchestrators/round-orchestrator', StubRoundOrchestrator);

const CaliperEngine = require('../../lib/manager/caliper-engine')
const expect = chai.expect;

after(() => {
    mockery.deregisterAll();
    mockery.disable();
});

describe('CaliperEngine', function() {

    describe('Initialization', function() {
        it('should initialize with given configurations and adapter factory', function() {
            // TODO: Implement test
        });

        it('should set the workspace and initial return code', function() {
            // TODO: Implement test
        });
    });

    describe('Benchmark Execution Flow', function() {

        context('When start commands are to be executed', function() {
            it('should execute the start command successfully', function() {
                // TODO: Implement test
            });

            it('should handle errors during start command execution', function() {
                // TODO: Implement test
            });
        });

        context('When start commands are skipped', function() {
            it('should not execute the start command', function() {
                // TODO: Implement test
            });
        });

        context('During benchmark initialization', function() {
            it('should initialize the network successfully', function() {
                // TODO: Implement test
            });

            it('should handle errors during network initialization', function() {
                // TODO: Implement test
            });
        });

        context('When initialization is skipped', function() {
            it('should not perform network initialization', function() {
                // TODO: Implement test
            });
        });

        context('During smart contract installation', function() {
            it('should install the smart contract successfully', function() {
                // TODO: Implement test
            });

            it('should handle errors during smart contract installation', function() {
                // TODO: Implement test
            });
        });

        context('When smart contract installation is skipped', function() {
            it('should not perform smart contract installation', function() {
                // TODO: Implement test
            });
        });

        context('During test execution', function() {
            it('should execute test rounds when performTest is true', function() {
                // TODO: Implement test
            });

            it('should handle errors during test execution', function() {
                // TODO: Implement test
            });
        });

        context('When test phase is skipped', function() {
            it('should not execute the test phase', function() {
                // TODO: Implement test
            });
        });

        context('When an error occurs during benchmark run', function() {
            it('should catch and log the error, setting an appropriate return code', function() {
                // TODO: Implement test
            });
        });

        context('When end commands are executed', function() {
            it('should execute the end command successfully', function() {
                // TODO: Implement test
            });

            it('should handle errors during end command execution', function() {
                // TODO: Implement test
            });

            it('should execute end commands even if errors occurred during other stages', function() {
                // TODO: Implement test
            });
        });

        context('When end commands are skipped', function() {
            it('should not execute the end command', function() {
                // TODO: Implement test
            });
        });

        it('should set the return code to 0 if no errors occurred during the run', function() {
            // TODO: Implement test
        });

        it('should return the appropriate return code after execution', function() {
            // TODO: Implement test
        });
    });

    describe('When a Benchmark Stop is requested', function() {
        let benchmarkConfig, networkConfig, engine;
        let adaptorFactory = sinon.stub().returns(sinon.createStubInstance(ConnectorBase));
        beforeEach(() =>{
            benchmarkConfig = {
                test: {
                    workers: {
                        number: 1,
                    },
                    rounds: [
                        {
                            label: 'function test',
                            contractId: 'xContract',
                            txDuration: 30,
                            rateControl: {
                                type: 'fixed-rate',
                                opts: {
                                    tps: 10
                                }
                            },
                            workload: {
                                module: 'benchmarks/workloads/workload.js',
                                arguments: {
                                    contractId: 'xContract',
                                    contractVersion: '1.0.0'
                                }
                            }
                        }
                    ]

                },
            };
            networkConfig = {
                caliper: {
                    command: {
                        start: 'echo "Starting network"',
                        end: 'echo "Stopping network"',
                    },
                },
            };

            engine = new CaliperEngine(benchmarkConfig, networkConfig, adaptorFactory);
        });

        it('should stop the benchmark if the benchmark has been started', async function() {
            roundOrchestratorRunCalled = false;
            roundOrchestratorStopCalled = false;
            await engine.run();
            expect(roundOrchestratorRunCalled).to.be.true;
            await engine.stop();
            expect(roundOrchestratorStopCalled).to.be.true;
        });

        it('should do nothing if no benchmark run has been started', async function() {
            roundOrchestratorRunCalled = false;
            roundOrchestratorStopCalled = false;
            expect(roundOrchestratorRunCalled).to.be.false;
            await engine.stop();
            expect(roundOrchestratorStopCalled).to.be.false;
        });
    });
});
