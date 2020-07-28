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
const fs = require('fs');
const yaml = require('js-yaml');
const chai = require('chai');
chai.should();

const path = require('path');

describe ('benchmark configuration generator', () => {
    let dir, tmpConfigPath;
    let options = {
        subgenerator: 'benchmark',
        contractFunction: 'workload',
        contractArguments: '["args1", "args2", "args3"]',
        benchmarkName: 'x contract benchmark',
        benchmarkDescription: 'benchmark for contract x',
        workers: 10,
        label: 'function test',
        contractId: 'xContract',
        contractVersion: '1.0.0',
        txType: 'txDuration',
        rateController: 'fixed-rate',
        workspace: 'workspace'
    };
    let configJSON = {
        test: {
            name: 'x contract benchmark',
            description: 'benchmark for contract x',
            workers: {
                type: 'local',
                number: 10
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
        }
    };

    const configPath = `${options.workspace}/benchmarks/config.yaml`;

    const runGenerator = async () => {
        await helpers.run(path.join(__dirname, '../../generators/app'))
            .inTmpDir((dir_) => {
                dir = dir_;
            })
            .withPrompts(options);
        tmpConfigPath = path.join(dir, configPath);
    };

    it('should create a workspace directory with a name defined by the user', async () => {
        options.txDuration = 30;
        await runGenerator();
        assert.file(`${options.workspace}/`);
    });

    it('should create a folder called benchmarks inside the workspace', async () => {
        options.txDuration = 30;
        await runGenerator();
        assert.file([`${options.workspace}/benchmarks/`]);
    });

    it('should create configuration file called config.yaml',async () => {
        options.txDuration = 30;
        await runGenerator();
        assert.file([`${options.workspace}/benchmarks/config.yaml`]);
    });

    it('should use the configuration template and user prompts to populate the created config.yaml', async () => {
        options.txDuration = 30;
        await runGenerator();
        const config = yaml.safeLoad(fs.readFileSync(tmpConfigPath),'utf8');
        config.should.deep.equal(configJSON);
    });

    it('should use the fixed-rate controller in config.yaml if user answered "Fixed Rate" for rate controller prompt', async () => {
        options.txDuration = 30;
        options.rateController = 'fixed-rate';
        await runGenerator();

        const config = yaml.safeLoad(fs.readFileSync(tmpConfigPath),'utf8');
        const configStr = JSON.stringify(config);
        const fileContains = configStr.includes('"type":"fixed-rate"');

        fileContains.should.equal(true);
    });

    it ('should use the fixed-backlog controller in config.yaml if user answered "Fixed Backlog" for rate controller prompt', async () => {
        options.txDuration = 30;
        options.rateController = 'fixed-backlog';
        await runGenerator();

        const config = yaml.safeLoad(fs.readFileSync(tmpConfigPath),'utf8');
        const configStr = JSON.stringify(config);
        const fileContains = configStr.includes('"type":"fixed-backlog"');

        fileContains.should.equal(true);
    });

    it ('should use the fixed-feedback-rate controller in config.yaml if user answered "Fixed Feedback Rate" for rate controller prompt', async () => {
        options.txDuration = 30;
        options.rateController = 'fixed-feedback-rate';
        await runGenerator();

        const config = yaml.safeLoad(fs.readFileSync(tmpConfigPath),'utf8');
        const configStr = JSON.stringify(config);
        const fileContains = configStr.includes('"type":"fixed-feedback-rate"');

        fileContains.should.equal(true);
    });

    it ('should use the linear-rate controller in config.yaml if user answered "Linear Rate" for rate controller prompt', async () => {
        options.txDuration = 30;
        options.rateController = 'linear-rate';
        await runGenerator();

        const config = yaml.safeLoad(fs.readFileSync(tmpConfigPath),'utf8');
        const configStr = JSON.stringify(config);
        const fileContains = configStr.includes('"type":"linear-rate"');

        fileContains.should.equal(true);
    });

    it ('should ask for the txDuration if user answered "txDuration" for tyType prompt', async () => {
        options.txType = 'txDuration';
        options.txDuration = 30;
        await runGenerator();

        const config = yaml.safeLoad(fs.readFileSync(tmpConfigPath),'utf8');
        const configStr = JSON.stringify(config);
        const fileContains = configStr.includes('"txDuration"');

        fileContains.should.equal(true);
    });

    it('should ask for the txNumber if user answered "txNumber" for txType prompt', async () => {
        options.txType = 'txNumber';
        options.txNumber = 30;
        await runGenerator();

        const config = yaml.safeLoad(fs.readFileSync(tmpConfigPath),'utf8');
        const configStr = JSON.stringify(config);
        const fileContains = configStr.includes('"txNumber"');

        fileContains.should.equal(true);
    });

    it('should provide a default client value if user answered prompt with a string for workers', async () => {
        options.workers = 'penguin';
        await runGenerator();

        const config = yaml.safeLoad(fs.readFileSync(tmpConfigPath),'utf8');
        const configStr = JSON.stringify(config);
        const fileContains = configStr.includes('"workers":{"type":"local","number":1');

        fileContains.should.equal(true);
    });

    it('should provide an absolute value for client if user answered prompt with a negative number for workers', async () => {
        options.workers = -10;
        await runGenerator();

        const config = yaml.safeLoad(fs.readFileSync(tmpConfigPath),'utf8');
        const configStr = JSON.stringify(config);
        const fileContains = configStr.includes('"workers":{"type":"local","number":10');

        fileContains.should.equal(true);
    });

    it('should provide an absolute value for txDuration if user answered prompt with a negative number for txDuration', async () => {
        options.txType = 'txDuration';
        options.txDuration = -30;
        await runGenerator();

        const config = yaml.safeLoad(fs.readFileSync(tmpConfigPath),'utf8');
        const configStr = JSON.stringify(config);
        const fileContains = configStr.includes('"txDuration":30');

        fileContains.should.equal(true);
    });

    it('should provide an absolute value for txNumber if user answered prompt with a negative number for txNumber', async () => {
        options.txType = 'txNumber';
        options.txNumber = -30;
        await runGenerator();

        const config = yaml.safeLoad(fs.readFileSync(tmpConfigPath),'utf8');
        const configStr = JSON.stringify(config);
        const fileContains = configStr.includes('"txNumber":30');

        fileContains.should.equal(true);
    });

    it('should provide a default txDuration if user answered prompt with a string for txDuration', async () => {
        options.txType = 'txDuration';
        options.txDuration = 'penguin';
        await runGenerator();

        const config = yaml.safeLoad(fs.readFileSync(tmpConfigPath),'utf8');
        const configStr = JSON.stringify(config);
        const fileContains = configStr.includes('"txDuration":20');

        fileContains.should.equal(true);
    });

    it('should provide a default txNumber if user answered prompt with a string for txNumber', async () => {
        options.txType = 'txNumber';
        options.txNumber = 'penguin';
        await runGenerator();

        const config = yaml.safeLoad(fs.readFileSync(tmpConfigPath),'utf8');
        const configStr = JSON.stringify(config);
        const fileContains = configStr.includes('"txNumber":50');

        fileContains.should.equal(true);
    });
});
