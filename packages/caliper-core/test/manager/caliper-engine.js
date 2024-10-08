/* eslint-disable require-jsdoc */
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

const BenchValidator = require('../../lib/common/utils/benchmark-validator');

const chai = require('chai');
const mockery = require('mockery');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const sinon = require('sinon');
const expect = chai.expect;

chai.should();

const roundOrchestratorRunMock = sinon.stub();
const roundOrchestratorStopMock = sinon.stub();

const workspaceKey = 'caliper-workspace';

describe('CaliperEngine', function() {
    let flowOptions = {};
    let loggerStub, sandbox, benchmarkConfig,
        networkConfig, adapterFactory, engine,
        connectorMock, execAsyncStub, CaliperEngine,
        getFlowOptionsStub, getLoggerStub,
        configUtilsGetStub;

    before(function() {
        sandbox = sinon.createSandbox();
        loggerStub = {
            info: sandbox.stub(),
            warn: sandbox.stub(),
            error: sandbox.stub(),
            debug: sandbox.stub(),
        };

        function MockRoundOrchestrator() {
            this.run = roundOrchestratorRunMock;
            this.stop = roundOrchestratorStopMock;
        }

        mockery.registerMock('./orchestrators/round-orchestrator', MockRoundOrchestrator);

        execAsyncStub = sandbox.stub();
        getFlowOptionsStub = sandbox.stub().returns(flowOptions);
        getLoggerStub = sandbox.stub().returns(loggerStub);

        mockery.registerMock('../common/utils/caliper-utils', {
            getLogger: getLoggerStub,
            getFlowOptions: getFlowOptionsStub,
            execAsync: execAsyncStub,
        });

        configUtilsGetStub = sandbox.stub();
        mockery.registerMock('../common/config/config-util', {
            get: configUtilsGetStub,
            keys: {
                Workspace: workspaceKey,
            }
        });

        mockery.enable({
            useCleanCache: true,
            warnOnReplace: false,
            warnOnUnregistered: false,
        });

        CaliperEngine = require('../../lib/manager/caliper-engine');
    });

    beforeEach(function() {
        flowOptions = {
            performStart: true,
            performInit: true,
            performInstall: true,
            performTest: true,
            performEnd: true,
        };
        benchmarkConfig = {
            test: {
                workers: {
                    number: 1,
                },
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
        adapterFactory = sandbox.stub();
        engine = new CaliperEngine(benchmarkConfig, networkConfig, adapterFactory);

        getFlowOptionsStub.returns(flowOptions);

        // Common connector mock
        connectorMock = {
            init: sandbox.stub().resolves(),
            installSmartContract: sandbox.stub().resolves(),
            prepareWorkerArguments: sandbox.stub().resolves({}),
        };
        adapterFactory.resolves(connectorMock);

        sandbox.stub(BenchValidator, 'validateObject').returns(true);
    });

    afterEach(() => {
        execAsyncStub.reset();
        Object.keys(loggerStub).forEach(propName => loggerStub[propName].reset());
        roundOrchestratorRunMock.reset();
        sandbox.restore();
    });

    describe('Initialization', function() {
        it('should initialize with given configurations and adapter factory', function() {
            const benchmarkConfig = { test: 'benchmarkConfig' };
            const networkConfig = { caliper: {} };
            const adapterFactory = sinon.stub();

            const engine = new CaliperEngine(benchmarkConfig, networkConfig, adapterFactory);

            expect(engine.benchmarkConfig).to.equal(benchmarkConfig);
            expect(engine.networkConfig).to.equal(networkConfig);
            expect(engine.adapterFactory).to.equal(adapterFactory);
        });

        it('should set the workspace from configuration and initialize the return code to -1', function() {
            const testWorkspace = '/tmp/workspace';
            const benchmarkConfig = {};
            const networkConfig = { caliper: {} };
            const adapterFactory = sinon.stub();
            configUtilsGetStub.withArgs(workspaceKey).returns(testWorkspace);

            const engine = new CaliperEngine(benchmarkConfig, networkConfig, adapterFactory);

            expect(engine.workspace).to.equal(testWorkspace);
            expect(engine.returnCode).to.equal(-1);
        });
    });

    describe('Benchmark Execution Flow', function() {
        context('When start commands are to be executed', function() {
            it('should execute the start command successfully', async function() {
                const returnCode = await engine.run();

                sinon.assert.calledTwice(execAsyncStub);
                sinon.assert.calledWith(execAsyncStub, sinon.match(/echo "Starting network"/));
                expect(returnCode).to.equal(0);
            });

            it('should log an error, set the return code (1-3), and throw an error if the start command execution fails', async function() {
                flowOptions.performEnd = false;
                execAsyncStub.rejects(new Error('Start command failed'));

                const returnCode = await engine.run();

                expect(returnCode).to.equal(3);
                sinon.assert.calledOnce(loggerStub.error);
                sinon.assert.calledWith(loggerStub.error, sinon.match('Start command failed'));
            });
        });

        context('When start commands are skipped', function() {
            it('should not execute the start command', async function() {
                flowOptions.performStart = false;

                const returnCode = await engine.run();

                sinon.assert.calledOnce(execAsyncStub);
                sinon.assert.calledWith(loggerStub.info, 'Skipping start commands due to benchmark flow conditioning');
                expect(returnCode).to.equal(0);
            });
        });

        context('During benchmark initialization', function() {
            it('should initialize the network successfully', async function() {
                const connectorMock = {
                    init: sandbox.stub().resolves(),
                    installSmartContract: sandbox.stub().resolves(),
                    prepareWorkerArguments: sandbox.stub().resolves(),
                };
                adapterFactory.resolves(connectorMock);

                const returnCode = await engine.run();

                sinon.assert.calledOnce(connectorMock.init);
                expect(returnCode).to.equal(0);
            });

            it('should log an error, set returnCode to 4, and throw an error if network initialization fails', async function() {
                const failureReason = 'Initialization failed';
                const connectorMock = {
                    init: sandbox.stub().rejects(new Error(failureReason)),
                };
                adapterFactory.resolves(connectorMock);

                const returnCode = await engine.run();

                expect(returnCode).to.equal(4);
                sinon.assert.calledOnce(loggerStub.error);
                sinon.assert.calledWith(loggerStub.error, sinon.match(failureReason));
            });
        });

        context('When initialization is skipped', function() {
            it('should not perform network initialization', function() {
                it('should not perform network initialization', async function() {
                    flowOptions.performInit = false;
                    const connectorMock = {
                        init: sandbox.stub(),
                    };
                    adapterFactory.resolves(connectorMock);
                    execAsyncStub.resolves();

                    const returnCode = await engine.run();

                    sinon.assert.notCalled(connectorMock.init);
                    sinon.assert.calledWith(loggerStub.info, 'Skipping initialization phase due to benchmark flow conditioning');
                    expect(returnCode).to.equal(0);
                });
            });
        });

        context('During smart contract installation', function() {
            it('should install the smart contract successfully', async function() {
                const returnCode = await engine.run();

                sinon.assert.calledOnce(connectorMock.installSmartContract);
                expect(returnCode).to.equal(0);
            });

            it('should log an error, set returnCode to 5, and throw an error if smart contract installation fails', async function() {
                const failureReason = 'Installation failed';
                connectorMock.installSmartContract.rejects(new Error(failureReason));

                const returnCode = await engine.run();

                expect(returnCode).to.equal(5);
                sinon.assert.calledOnce(loggerStub.error);
                sinon.assert.calledWith(loggerStub.error, sinon.match(failureReason));
            });
        });

        context('When smart contract installation is skipped', function() {
            it('should not perform smart contract installation', async function() {
                flowOptions.performInstall = false;

                const returnCode = await engine.run();

                sinon.assert.notCalled(connectorMock.installSmartContract);
                sinon.assert.calledWith(loggerStub.info, 'Skipping install smart contract phase due to benchmark flow conditioning');
                expect(returnCode).to.equal(0);
            });
        });

        context('During test execution', function() {
            it('should execute test rounds when performTest is true', async function() {
                const returnCode = await engine.run();

                sinon.assert.calledOnce(roundOrchestratorRunMock);
                expect(returnCode).to.equal(0);
            });

            it('should log an error, set returnCode to 6, and proceed to execute end commands if an error occurs during test execution', async function() {
                const failureReason = 'Test execution failed';
                roundOrchestratorRunMock.rejects(new Error(failureReason));

                await engine.run();

                expect(engine.returnCode).to.equal(6);
                sinon.assert.calledOnce(loggerStub.error);
                sinon.assert.calledWith(loggerStub.error, sinon.match(failureReason));

                sinon.assert.calledTwice(execAsyncStub);
            });
        });

        context('When test phase is skipped', function() {
            it('should not execute the test phase', async function() {
                flowOptions.performTest = false;

                const returnCode = await engine.run();

                sinon.assert.notCalled(roundOrchestratorRunMock);
                sinon.assert.calledWith(loggerStub.info, 'Skipping benchmark test phase due to benchmark flow conditioning');
                expect(returnCode).to.equal(0);
            });
        });

        context('When an error occurs during benchmark run', function() {
            it('should catch and log the error, set an appropriate return code, and proceed to execute end commands', async function() {
                const failureReason = 'Simulated installation error';
                connectorMock.installSmartContract.rejects(new Error(failureReason));

                await engine.run();

                expect(engine.returnCode).to.equal(5);
                sinon.assert.calledOnce(loggerStub.error);
                sinon.assert.calledWith(loggerStub.error, sinon.match(failureReason));

                sinon.assert.calledTwice(execAsyncStub);
            });
        });

        context('When end commands are executed', function() {
            it('should execute the end command successfully', async function() {
                const returnCode = await engine.run();

                sinon.assert.calledWith(execAsyncStub, sinon.match(/echo "Stopping network"/));
                expect(returnCode).to.equal(0);
            });

            it('should log an error, set the return code (7-9), and throw an error if executing the end command fails', async function() {
                networkConfig.caliper.command.end = 'invalid_command';
                const failureReason = 'End command failed';
                execAsyncStub.withArgs(sinon.match(/invalid_command/)).rejects(new Error(failureReason));

                await engine.run();

                expect(engine.returnCode).to.equal(9); // Error status codes start at 6 for end command
                sinon.assert.calledWith(loggerStub.error, sinon.match(failureReason));
            });

            it('should execute end commands even if errors occurred during other stages', async function() {
                roundOrchestratorRunMock.rejects(new Error('Test execution failed'));

                await engine.run();

                expect(engine.returnCode).to.equal(6);
                sinon.assert.calledWith(execAsyncStub, sinon.match(/echo "Stopping network"/));
            });
        });

        context('When end commands are skipped', function() {
            it('should not execute the end command', async function() {
                flowOptions.performEnd = false;

                const returnCode = await engine.run();

                sinon.assert.calledWith(loggerStub.info, 'Skipping end command due to benchmark flow conditioning');
                sinon.assert.calledOnce(execAsyncStub);
                expect(returnCode).to.equal(0);
            });
        });

        it('should set the return code to 0 if no errors occurred during the run', async function() {
            const returnCode = await engine.run();

            expect(returnCode).to.equal(0);
            expect(returnCode).to.equal(0);
        });

        it('should return the appropriate return code after execution', async function() {
            connectorMock.installSmartContract.rejects(new Error('Installation failed'));

            let returnCode;
            try {
                await engine.run();
            } catch (err) {
                // Ignore error for this test
            } finally {
                returnCode = engine.returnCode;
            }

            expect(returnCode).to.equal(5);
        });
    });

    describe('Benchmark Stop Functionality', function() {
        it('should stop the benchmark if the benchmark has been started', async function() {
            const runPromise = engine.run();

            await new Promise(resolve => setTimeout(resolve, 10));
            await engine.stop();

            sinon.assert.calledOnce(roundOrchestratorRunMock);

            await runPromise;

        });

        it('should not throw an error if stop is called when no benchmark run has been started', async function() {

            await engine.stop();
            sinon.assert.notCalled(loggerStub.error);
        });
    });
});
