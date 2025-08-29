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
const mockery = require('mockery');
const ConnectorBase = require('../../lib/common/core/connector-base');
const ConfigUtils = require('../../lib/common/config/config-util');

//
// Simple RoundOrchestrator Stub
//
const sandbox = sinon.createSandbox();
const roundOrchestratorSpies = {
  run: sandbox.stub(),
  stop: sandbox.stub(),
};
class StubRoundOrchestrator {
  run() {
    roundOrchestratorSpies.run();
  }
  stop() {
    roundOrchestratorSpies.stop();
  }
}
const stubbedCaliperUtils = {
  getLogger: sandbox.stub().returns({
    info: () => {},
    error: () => {},
  }),
  getFlowOptions: sandbox.stub(),
  execAsync: sandbox.stub(),
};
const stubbedBenchValidator = {
  validateObject: sandbox.stub(),
};
const stubbedConfigUtils = {
  get: sandbox.stub(),
  set: sandbox.stub(),
  keys: { Workspace: 'caliper-workspace' },
};

mockery.enable({
  warnOnReplace: false,
  warnOnUnregistered: false,
  useCleanCache: true,
});

mockery.registerMock('./orchestrators/round-orchestrator', StubRoundOrchestrator);
mockery.registerMock('../common/config/config-util', stubbedConfigUtils);
mockery.registerMock('../common/utils/caliper-utils', stubbedCaliperUtils);
mockery.registerMock('../common/utils/benchmark-validator', stubbedBenchValidator);

const CaliperEngine = require('../../lib/manager/caliper-engine');
const expect = chai.expect;

after(() => {
  mockery.deregisterAll();
  mockery.disable();
  sandbox.restore();
});

describe('CaliperEngine', function () {
  beforeEach(() => {
    roundOrchestratorSpies.run.reset();
    roundOrchestratorSpies.stop.reset();
    stubbedCaliperUtils.getFlowOptions.returns({
      performStart: false,
      performEnd: false,
      performInit: false,
      performInstall: false,
      performTest: false,
    });
  });

  describe('Initialization', function () {
    it('should initialize with given configurations and adapter factory', function () {
      const mockBenchConfig = { name: 'test-benchmark' };
      const mockNetworkConfig = { type: 'fabric' };
      const mockAdapterFactory = sandbox.stub();
      const engine = new CaliperEngine(mockBenchConfig, mockNetworkConfig, mockAdapterFactory);

      expect(engine.benchmarkConfig).to.equal(mockBenchConfig);
      expect(engine.networkConfig).to.equal(mockNetworkConfig);
      expect(engine.adapterFactory).to.equal(mockAdapterFactory);
    });

    it('should set the workspace and initial return code', function () {
      const mockWorkspace = '/tmp/path/to/test-workspace';
      stubbedConfigUtils.get.withArgs(ConfigUtils.keys.Workspace).returns(mockWorkspace);
      const engine = new CaliperEngine({}, {}, sandbox.stub());

      expect(engine.workspace).to.equal(mockWorkspace);
      expect(engine.returnCode).to.equal(-1);
      expect(stubbedConfigUtils.get.calledWith('caliper-workspace')).to.be.true;
    });
  });

  describe('Benchmark Execution Flow', function () {
    let benchSandbox;
    let mockAdapter;

    beforeEach(() => {
      benchSandbox = sinon.createSandbox();

      mockAdapter = sinon.createStubInstance(ConnectorBase);
      mockAdapter.init.resolves();
      mockAdapter.installSmartContract.resolves();
      mockAdapter.prepareWorkerArguments.resolves({});
    });

    afterEach(() => {
      benchSandbox.restore();
      stubbedCaliperUtils.getFlowOptions.reset();
      stubbedCaliperUtils.execAsync.reset();
    });

    context('When start commands are to be executed', function () {
      it('should execute the start command successfully', async function () {
        const testCMD = 'echo "Starting network"';
        stubbedCaliperUtils.getFlowOptions.returns({
          performStart: true,
          performEnd: true,
        });
        stubbedConfigUtils.get.withArgs('caliper-workspace').returns('./');
        const networkConfig = {
          caliper: {
            command: {
              start: testCMD,
            },
          },
        };
        const engine = new CaliperEngine({}, networkConfig, () => mockAdapter);
        stubbedCaliperUtils.execAsync.resolves();
        const returnCode = await engine.run();

        expect(stubbedCaliperUtils.execAsync.calledOnce).to.be.true;
        expect(stubbedCaliperUtils.execAsync.calledWith(testCMD));
        expect(returnCode).to.equal(0);
      });

      it('should handle errors during start command execution', async function () {
        const networkConfig = {
          caliper: { command: { start: 'bad-command' } },
        };
        stubbedCaliperUtils.getFlowOptions.returns({
          performStart: true,
        });
        const engine = new CaliperEngine({}, networkConfig, sinon.stub());
        const commandError = new Error('Command failed');
        stubbedCaliperUtils.execAsync.rejects(commandError);
        const returnCode = await engine.run();

        expect(stubbedCaliperUtils.execAsync.callCount).to.equal(1);
        expect(returnCode).to.equal(3);
      });

      it('should handle a non-string start command', async function () {
        const networkConfig = { caliper: { command: { start: 1234 } } };
        stubbedCaliperUtils.getFlowOptions.returns({
          performStart: true,
        });
        const engine = new CaliperEngine({}, networkConfig, () => mockAdapter);
        const returnCode = await engine.run();

        expect(stubbedCaliperUtils.execAsync.callCount).to.equal(0);
        expect(returnCode).to.equal(1);
      });

      it('should handle an empty start command', async function () {
        const networkConfig = { caliper: { command: { start: '       ' } } };
        stubbedCaliperUtils.getFlowOptions.returns({
          performStart: true,
        });
        const engine = new CaliperEngine({}, networkConfig, () => mockAdapter);
        const returnCode = await engine.run();

        expect(stubbedCaliperUtils.execAsync.callCount).to.equal(0);
        expect(returnCode).to.equal(2);
      });
    });

    context('When start commands are skipped', function () {
      it('should not execute the start command', async function () {
        stubbedCaliperUtils.getFlowOptions.returns({
          performStart: false,
          performEnd: false,
          performInit: false,
          performInstall: false,
          performTest: false,
        });
        const engine = new CaliperEngine({}, {}, () => mockAdapter);
        const returnCode = await engine.run();

        expect(stubbedCaliperUtils.execAsync.callCount).to.equal(0);
        expect(returnCode).to.equal(0);
      });
    });

    context('During benchmark initialization', function () {
      it('should initialize the network successfully', async function () {
        stubbedCaliperUtils.getFlowOptions.returns({
          performInit: true,
        });
        const adapterFactory = sinon.stub().resolves(mockAdapter);
        const engine = new CaliperEngine({}, {}, adapterFactory);
        await engine.run();

        expect(adapterFactory.calledOnce).to.be.true;
        expect(mockAdapter.init.calledOnce).to.be.true;
      });

      it('should handle errors during network initialization', async function () {
        stubbedCaliperUtils.getFlowOptions.returns({
          performInit: true,
        });
        mockAdapter.init.rejects(new Error('Init failed'));
        const engine = new CaliperEngine({}, {}, () => mockAdapter);
        const returnCode = await engine.run();

        expect(mockAdapter.init.calledOnce).to.be.true;
        expect(returnCode).to.equal(4);
      });
    });

    context('When initialization is skipped', function () {
      it('should not perform network initialization', async function () {
        const engine = new CaliperEngine({}, {}, () => mockAdapter);
        const returnCode = await engine.run();

        expect(stubbedCaliperUtils.execAsync.callCount).to.equal(0);
        expect(returnCode).to.equal(0);
      });
    });

    context('During smart contract installation', function () {
      it('should install the smart contract successfully', async function () {
        stubbedCaliperUtils.getFlowOptions.returns({
          performInstall: true,
        });
        const adapterFactory = sinon.stub().resolves(mockAdapter);
        const engine = new CaliperEngine({}, {}, adapterFactory);

        const returnCode = await engine.run();

        expect(adapterFactory.calledOnce).to.be.true;
        expect(mockAdapter.installSmartContract.calledOnce).to.be.true;
        expect(returnCode).to.equal(0);
      });

      it('should handle errors during smart contract installation', async function () {
        stubbedCaliperUtils.getFlowOptions.returns({
          performInstall: true,
        });
        mockAdapter.installSmartContract.rejects(new Error('Install failed'));
        const engine = new CaliperEngine({}, {}, () => mockAdapter);
        const returnCode = await engine.run();

        expect(mockAdapter.installSmartContract.calledOnce).to.be.true;
        expect(returnCode).to.equal(5);
      });
    });

    context('When smart contract installation is skipped', function () {
      it('should not perform smart contract installation', async function () {
        const engine = new CaliperEngine({}, {}, () => mockAdapter);
        await engine.run();

        expect(mockAdapter.installSmartContract.callCount).to.equal(0);
      });
    });

    context('During test execution', function () {
      it('should execute test rounds when performTest is true', async function () {
        stubbedCaliperUtils.getFlowOptions.returns({
          performTest: true,
        });
        const benchmarkConfig = { test: { workers: { number: 1 } } };
        const engine = new CaliperEngine(benchmarkConfig, {}, () => mockAdapter);
        const returnCode = await engine.run();

        expect(roundOrchestratorSpies.run.calledOnce).to.be.true;
        expect(returnCode).to.equal(0);
      });

      it('should handle errors during test execution', async function () {
        stubbedCaliperUtils.getFlowOptions.returns({
          performTest: true,
        });

        const testError = new Error('Orchestrator failed');
        roundOrchestratorSpies.run.throws(testError);

        const benchmarkConfig = { test: { workers: { number: 1 } } };
        const adapterFactory = sinon.stub().resolves(mockAdapter);
        const engine = new CaliperEngine(benchmarkConfig, {}, adapterFactory);
        const returnCode = await engine.run();

        expect(roundOrchestratorSpies.run.calledOnce).to.be.true;
        expect(returnCode).to.equal(6);
      });
    });

    context('When test phase is skipped', function () {
      it('should not execute the test phase', async function () {
        const engine = new CaliperEngine({}, {}, () => mockAdapter);

        await engine.run();

        expect(roundOrchestratorSpies.run.called).to.be.false;
      });
    });

    context('When an error occurs during benchmark run', function () {
      it('should catch and log the error, setting an appropriate return code', async function () {
        stubbedCaliperUtils.getFlowOptions.returns({
          performInit: true,
        });
        const engine = new CaliperEngine({}, {}, () => {
          throw new Error('Failed to create adapter');
        });

        const returnCode = await engine.run();

        expect(returnCode).to.equal(6);
      });
    });

    context('When end commands are executed', function () {
      it('should execute the end command successfully', async function () {
        const testCMD = 'docker-compose down';
        stubbedCaliperUtils.getFlowOptions.returns({
          performEnd: true,
        });
        const networkConfig = { caliper: { command: { end: testCMD } } };
        stubbedConfigUtils.get.withArgs('caliper-workspace').returns('./');
        stubbedCaliperUtils.execAsync.resolves();
        const engine = new CaliperEngine({}, networkConfig, () => mockAdapter);

        await engine.run();

        expect(stubbedCaliperUtils.execAsync.calledOnce).to.be.true;
        expect(stubbedCaliperUtils.execAsync.calledWith(`cd ./; ${testCMD}`)).to.be.true;
      });

      it('should handle errors during end command execution', async function () {
        stubbedCaliperUtils.getFlowOptions.returns({
          performEnd: true,
        });
        const networkConfig = { caliper: { command: { end: 'bad-end-command' } } };
        stubbedCaliperUtils.execAsync.rejects(new Error('End command failed'));
        const engine = new CaliperEngine({}, networkConfig, () => mockAdapter);

        const returnCode = await engine.run();

        expect(returnCode).to.equal(9);
      });

      it('should execute end commands even if errors occurred during other stages', async function () {
        stubbedCaliperUtils.getFlowOptions.returns({
          performInit: true,
          performEnd: true,
        });
        mockAdapter.init.rejects(new Error('Init failed'));
        stubbedCaliperUtils.execAsync.resolves();
        const networkConfig = { caliper: { command: { end: 'cleanup.sh' } } };
        const adapterFactory = sinon.stub().resolves(mockAdapter);
        const engine = new CaliperEngine({}, networkConfig, adapterFactory);

        const returnCode = await engine.run();

        expect(returnCode).to.equal(4);
        expect(stubbedCaliperUtils.execAsync.calledOnce).to.be.true;
      });
    });

    context('When end commands are skipped', function () {
      it('should not execute the end command', async function () {
        const networkConfig = { caliper: { command: { end: 'cleanup.sh' } } };
        const engine = new CaliperEngine({}, networkConfig, () => mockAdapter);

        await engine.run();

        expect(stubbedCaliperUtils.execAsync.callCount).to.equal(0);
      });
    });

    it('should set the return code to 0 if no errors occurred during the run', async function () {
      stubbedCaliperUtils.getFlowOptions.returns({
        performStart: true,
        performInit: true,
        performInstall: true,
        performTest: true,
        performEnd: true,
      });
      stubbedCaliperUtils.execAsync.resolves();
      const networkConfig = { caliper: { command: { start: 'start.sh', end: 'end.sh' } } };
      const benchmarkConfig = { test: { workers: { number: 1 } } };
      const adapterFactory = sinon.stub().resolves(mockAdapter);
      const engine = new CaliperEngine(benchmarkConfig, networkConfig, adapterFactory);

      const returnCode = await engine.run();

      expect(returnCode).to.equal(0);
    });

    it('should return the appropriate return code after execution', async function () {
      stubbedCaliperUtils.getFlowOptions.returns({
        performInit: true,
      });
      mockAdapter.init.rejects(new Error('Init failed'));
      const adapterFactory = sinon.stub().resolves(mockAdapter);
      const engine = new CaliperEngine({}, {}, adapterFactory);

      const returnedValue = await engine.run();

      expect(returnedValue).to.equal(4);
    });
  });

  describe('When a Benchmark Stop is requested', function () {
    let benchmarkConfig, networkConfig, engine;
    let adaptorFactory = sinon.stub().returns(sinon.createStubInstance(ConnectorBase));
    beforeEach(() => {
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
                  tps: 10,
                },
              },
              workload: {
                module: 'benchmarks/workloads/workload.js',
                arguments: {
                  contractId: 'xContract',
                  contractVersion: '1.0.0',
                },
              },
            },
          ],
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

    it('should stop the benchmark if the benchmark has been started', async function () {
      stubbedCaliperUtils.getFlowOptions.returns({
        performStart: true,
        performTest: true,
        performEnd: true,
      });
      await engine.run();
      expect(roundOrchestratorSpies.run.calledOnce).to.be.true;
      await engine.stop();
      expect(roundOrchestratorSpies.stop.calledOnce).to.be.true;
    });

    it('should do nothing if no benchmark run has been started', async function () {
      expect(roundOrchestratorSpies.run.calledOnce).to.be.false;
      await engine.stop();
      expect(roundOrchestratorSpies.stop.calledOnce).to.be.false;
    });
  });
});
