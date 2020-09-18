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

const assert = require('yeoman-assert');
const helpers = require('yeoman-test');
const chai = require('chai');
chai.should();

const path = require('path');

describe('', () => {
    let options = {
        subgenerator: 'benchmark',
        contractFunction: 'penguin',
        contractArguments: '["args1", "args2", "args3"]',
        name: 'x contract benchmark',
        description: 'benchmark for contract x',
        workers: 5,
        label: 'function test',
        contractId: 'xContract',
        contractVersion: '1.0.0',
        txType: 'txDuration',
        txDuration: 30,
        rateController: 'fixed-rate',
        workspace: 'workspace',
    };

    const workloadFile = `${options.workspace}/benchmarks/workloads/${options.contractFunction}.js`;

    const runGenerator = async () => {
        await helpers.run(path.join(__dirname, '../../generators/app'))
            .inTmpDir((dir_) => {})
            .withPrompts(options);
    };

    it('should create a workloads folder', async () => {
        await runGenerator();
        assert.file([`${options.workspace}/benchmarks/workloads/`]);
    });

    it('should create workload file inside the workload folder named based on user prompt answer', async () => {
        await runGenerator();
        assert.file([workloadFile]);
    });

    it('should populate the file based on answers to user prompts', async () => {
        await runGenerator();
        let workloadFileContent =
        '/*\n' +
        '* Licensed under the Apache License, Version 2.0 (the "License");\n' +
        '* you may not use this file except in compliance with the License.\n' +
        '* You may obtain a copy of the License at\n' +
        '*\n' +
        '* http://www.apache.org/licenses/LICENSE-2.0\n' +
        '*\n' +
        '* Unless required by applicable law or agreed to in writing, software\n' +
        '* distributed under the License is distributed on an "AS IS" BASIS,\n' +
        '* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n' +
        '* See the License for the specific language governing permissions and\n' +
        '* limitations under the License.\n' +
        '*/\n' +
        '\n' +
        '\'use strict\';\n' +
        '\n' +
        'const { WorkloadModuleBase } = require(\'@hyperledger/caliper-core\');\n' +
        '\n' +
        '/**\n' +
        ' * Workload module for the benchmark round.\n' +
        ' */\n' +
        'class PenguinWorkload extends WorkloadModuleBase {\n' +
        '\n' +
        '    /**\n' +
        '     * Initializes the workload module instance.\n' +
        '     */\n' +
        '    constructor() {\n' +
        '        super();\n' +
        '        this.contractId = \'\';\n' +
        '        this.contractVersion = \'\';\n' +
        '    }\n' +
        '\n' +
        '    /**\n' +
        '     * Initialize the workload module with the given parameters.\n' +
        '     * @param {number} workerIndex The 0-based index of the worker instantiating the workload module.\n' +
        '     * @param {number} totalWorkers The total number of workers participating in the round.\n' +
        '     * @param {number} roundIndex The 0-based index of the currently executing round.\n' +
        '     * @param {Object} roundArguments The user-provided arguments for the round from the benchmark configuration file.\n' +
        '     * @param {ConnectorBase} sutAdapter The adapter of the underlying SUT.\n' +
        '     * @param {Object} sutContext The custom context object provided by the SUT adapter.\n' +
        '     * @async\n' +
        '     */\n' +
        '    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {\n' +
        '        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);\n' +
        '\n' +
        '        const args = this.roundArguments;\n' +
        '        this.contractId = args.contractId;\n' +
        '        this.contractVersion = args.contractVersion;\n' +
        '    }\n' +
        '\n' +
        '    /**\n' +
        '     * Assemble TXs for the round.\n' +
        '     * @return {Promise<TxStatus[]>}\n' +
        '     */\n' +
        '    async submitTransaction() {\n' +
        '        const myArgs = {\n' +
        '            contractId: this.contractId,\n' +
        '            contractFunction: \'penguin\',\n' +
        '            contractArguments: ["args1", "args2", "args3"],\n' +
        '            readOnly: false\n' +
        '        };\n' +
        '        return this.sutAdapter.sendRequests(myArgs);\n' +
        '    }\n' +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Create a new instance of the workload module.\n' +
        ' * @return {WorkloadModuleInterface}\n' +
        ' */\n' +
        'function createWorkloadModule() {\n' +
        '    return new PenguinWorkload();\n' +
        '}\n' +
        '\n' +
        'module.exports.createWorkloadModule = createWorkloadModule;\n';

        assert.fileContent(workloadFile, workloadFileContent);
    });

    it('should default to empty array for contract arguments if no user input supplied', async () => {
        options.contractArguments = '';
        await runGenerator();

        assert.fileContent(`${options.workspace}/benchmarks/workloads/${options.contractFunction}.js`, 'contractArguments: []');
    });

    it('should default to an empty array if user input for contract argument does not start with [', async () => {
        options.contractArguments = '"args1", "args2", "args3"]';
        await runGenerator();

        assert.fileContent(`${options.workspace}/benchmarks/workloads/${options.contractFunction}.js`, 'contractArguments: []');
    });

    it('should default to an empty array if user input for contract argument does not end with ]', async () => {
        options.contractArguments = '["args1", "args2", "args3"';
        await runGenerator();

        assert.fileContent(`${options.workspace}/benchmarks/workloads/${options.contractFunction}.js`, 'contractArguments: []');
    });

    it('should default to an empty array if user input is not the correct format', async () => {
        options.contractArguments = '[args1, "args2" "args3"]';
        await runGenerator();

        assert.fileContent(`${options.workspace}/benchmarks/workloads/${options.contractFunction}.js`, 'contractArguments: []');
    });
});
