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
        chaincodeFunction: 'callback',
        chaincodeArguments: '["args1", "args2", "args3"]',
        name: 'x contract benchmark',
        description: 'benchmark for contract x',
        workers: 5,
        label: 'function test',
        chaincodeId: 'xContract',
        version: '1.0.0',
        txType: 'txDuration',
        txDuration: 30,
        rateController: 'fixed-rate',
        workspace: 'workspace',
    };

    const callbackFile = `${options.workspace}/benchmarks/callbacks/${options.chaincodeFunction}.js`;

    const runGenerator = async () => {
        await helpers.run(path.join(__dirname, '../../generators/app'))
            .inTmpDir((dir_) => {})
            .withPrompts(options);
    };

    it('should create a callbacks folder', async () => {
        await runGenerator();
        assert.file([`${options.workspace}/benchmarks/callbacks/`]);
    });

    it('should create callback file inside the callback folder named based on user prompt answer', async () => {
        await runGenerator();
        assert.file([callbackFile]);
    });

    it('should populate the file based on answers to user prompts', async () => {
        await runGenerator();
        let callbackFileContent = '/*\n' +
        '* Licensed under the Apache License, Version 2.0 (the "License");\n' +
        '* you may not use this file except in compliance with the License.\n' +
        '* You may obtain a copy of the License at\n' +
        '* \n' +
        '* http://www.apache.org/licenses/LICENSE-2.0\n' +
        '* \n' +
        '* Unless required by applicable law or agreed to in writing, software\n' +
        '* distributed under the License is distributed on an "AS IS" BASIS,\n' +
        '* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n' +
        '* See the License for the specific language governing permissions and\n' +
        '* limitations under the License.\n' +
        '*/\n' +
        '\n' +
        '\'use strict\';\n' +
        '\n' +
        `const contractId = '${options.chaincodeId}';\n` +
        `const version = '${options.version}';\n` +
        '\n' +
        'let bc, ctx, clientArgs, clientIdx;\n' +
        '\n' +
        'module.exports.init = async function(blockchain, context, args) {\n' +
        '    bc = blockchain;\n' +
        '    ctx = context;\n' +
        '    clientArgs = args;\n' +
        '    clientIdx = context.clientIdx.toString();\n' +
        '\n' +
        '    return Promise.resolve();\n' +
        '};\n' +
        '\n' +
        'module.exports.run = function() {\n' +
        '    let myArgs = {\n' +
        `        chaincodeFunction: '${options.chaincodeFunction}',\n` +
        `        chaincodeArguments: ${options.chaincodeArguments}\n` +
        '    };\n' +
        '\n' +
        '    return bc.invokeSmartContract(ctx, contractId, version, myArgs, 60);\n' +
        '};\n' +
        '\n' +
        'module.exports.end = async function() {\n' +
        '    return Promise.resolve();\n' +
        '};\n';

        assert.fileContent(callbackFile, callbackFileContent);
    });

    it('should default to empty array for chaincode arguments if no user input supplied', async () => {
        options.chaincodeArguments = '';
        await runGenerator();

        assert.fileContent(`${options.workspace}/benchmarks/callbacks/${options.chaincodeFunction}.js`, 'chaincodeArguments: []');
    });

    it('should default to an empty array if user input for chaincode argument does not start with [', async () => {
        options.chaincodeArguments = '"args1", "args2", "args3"]';
        await runGenerator();

        assert.fileContent(`${options.workspace}/benchmarks/callbacks/${options.chaincodeFunction}.js`, 'chaincodeArguments: []');
    });

    it('should default to an empty array if user input for chaincode argument does not end with ]', async () => {
        options.chaincodeArguments = '["args1", "args2", "args3"';
        await runGenerator();

        assert.fileContent(`${options.workspace}/benchmarks/callbacks/${options.chaincodeFunction}.js`, 'chaincodeArguments: []');
    });

    it('should default to an empty array if user input is not the correct format', async () => {
        options.chaincodeArguments = '[args1, "args2" "args3"]';
        await runGenerator();

        assert.fileContent(`${options.workspace}/benchmarks/callbacks/${options.chaincodeFunction}.js`, 'chaincodeArguments: []');
    });
});
