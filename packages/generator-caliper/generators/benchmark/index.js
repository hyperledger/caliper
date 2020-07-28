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

const Generator = require('yeoman-generator');
const camelcase = require('camelcase');

const defaultTxValue = 50;
const defaultTxDuration = 20;
const defaultWorkerCount = 1;
const answersObject = {};

let promptAnswers;

module.exports = class extends Generator {
    /**
     * Prompts questions about the benchmark generator settings.
     * @async
     */
    async prompting () {
        const workspaceQuestions = [{
            type: 'input',
            name: 'workspace',
            message: 'What would you like to name your workspace?',
            when: () => !this.options.workspace
        }];
        const workspaceAnswers = await this.prompt(workspaceQuestions);

        this.log('For the workload file...');
        const workloadQuestions = [{
            type: 'input',
            name: 'contractId',
            message: 'What is the name of your smart contract?',
            when: () => !this.options.contractId
        }, {
            type: 'input',
            name: 'contractVersion',
            message: 'What is the version of your smart contract?',
            when: () => !this.options.contractVersion
        }, {
            type: 'input',
            name: 'contractFunction',
            message: 'Which smart contract function would you like to perform the benchmark on?',
            when: () => !this.options.contractFunction
        }, {
            type: 'input',
            name: 'contractArguments',
            message: 'What are the arguments of your smart contract function? (e.g. ["arg1", "arg2"])',
            when: () => !this.options.contractArguments
        }];
        const workloadAnswers = await this.prompt(workloadQuestions);

        if (workloadAnswers.contractArguments) {
            try {
                JSON.parse(workloadAnswers.contractArguments);
            } catch (error) {
                this.log('Error: Incorrect array format. Using empty array for arguments. Defaulting to \'[]\' for arguments');
            }
        }

        this.log('For the benchmark configuration file...');
        const benchmarkQuestions = {
            initialQuestions: [{
                type: 'input',
                name: 'benchmarkName',
                message: 'What would you like to name your benchmark?',
                when: () => !this.options.benchmarkName
            }, {
                type: 'input',
                name: 'benchmarkDescription',
                message: 'What description would you like to provide for your benchamrk?',
                when: () => !this.options.benchmarkDescription
            }],
            clientQuestions: [{
                type: 'number',
                name: 'workers',
                message: 'How many workers would you like to have?',
                default: defaultWorkerCount,
                when: () => !this.options.workers
            }],
            roundQuestions: [{
                type: 'input',
                name: 'label',
                message: 'What label (hint for test) would you like to provide for your benchmark?',
                when: () => !this.options.label
            }, {
                type: 'list',
                name: 'rateController',
                message: 'Which rate controller would you like to use?',
                choices: [
                    {name: 'Fixed Rate', value: 'fixed-rate'},
                    {name: 'Fixed Backlog', value: 'fixed-backlog'},
                    {name: 'Linear Rate', value: 'linear-rate'},
                    {name: 'Fixed Feedback Rate', value: 'fixed-feedback-rate'}
                ],
                when: () => !this.options.rateController
            }, {
                type: 'list',
                name: 'txType',
                message: 'How would you like to measure the length of the round?',
                choices: [
                    {name: 'Transaction Duration', value:'txDuration'},
                    {name: 'Transaction Number', value: 'txNumber'}
                ],
                when: () => !this.options.txType
            }],
            txDurationQuestion : [{
                type: 'number',
                name: 'txDuration',
                message: 'How long would you like the round to last?',
                default: defaultTxDuration,
                when: () => !this.options.txDuration
            }],
            txNumberQuestion : [{
                type: 'number',
                name: 'txNumber',
                message: 'How many transactions would you like to have in this round?',
                default: defaultTxValue,
                when: () => !this.options.txNumber
            }]
        };

        const inititalAnswers = await this.prompt(benchmarkQuestions.initialQuestions);

        const clientAnswer = await this.prompt(benchmarkQuestions.clientQuestions);
        if (isNaN(parseFloat(this.options.workers)) && isNaN(parseFloat(clientAnswer.workers))) {
            this.log(`Error: Not a valid input. Using default client value of ${defaultWorkerCount}.`);
        }
        if (this.options.workers < 0 || clientAnswer.workers < 0) {
            this.log(`Error: Negative values not accepted. Defaulting to ${Math.abs(clientAnswer.workers)}.`);
        }

        const roundAnswers = await this.prompt(benchmarkQuestions.roundQuestions);

        let txValueAnswer;
        if (roundAnswers.txType === 'txDuration') {
            txValueAnswer = await this.prompt(benchmarkQuestions.txDurationQuestion);
            if (isNaN(parseFloat(txValueAnswer.txDuration))) {
                this.log(`Error: Not a valid input. Using default txDuration value of ${defaultTxDuration}.`);
            }
            if (txValueAnswer.txDuration < 0) {
                this.log(`Error: Negative values not accepted. Defaulting to ${Math.abs(txValueAnswer.txDuration)}.`);
            }
        }
        if (roundAnswers.txType === 'txNumber') {
            txValueAnswer = await this.prompt(benchmarkQuestions.txNumberQuestion);
            if (isNaN(parseFloat(txValueAnswer.txNumber))) {
                this.log(`Error: Not a valid input. Using default txNumber value of ${defaultTxValue}.`);
            }
            if (txValueAnswer.txNumber < 0) {
                this.log(`Error: Negative values not accepted. Defaulting to ${Math.abs(txValueAnswer.txNumber)}.`);
            }
        }

        Object.assign(this.options, workspaceAnswers, workloadAnswers, inititalAnswers, clientAnswer, roundAnswers, txValueAnswer);
        promptAnswers = this.options;
    }

    /**
     * Creates the workload module file/workload.
     * @private
     */
    _workloadWrite() {
        answersObject.contractId = promptAnswers.contractId;
        answersObject.contractVersion = promptAnswers.contractVersion;
        answersObject.contractFunction = promptAnswers.contractFunction;
        answersObject.workload = `${ promptAnswers.contractFunction }.js`;
        answersObject.pascalCase = camelcase(promptAnswers.contractFunction, { pascalCase: true });

        const argsString = promptAnswers.contractArguments;
        if (!argsString) {
            answersObject.contractArguments = '[]';
        } else {
            try {
                // Should be able to parse the user input
                JSON.parse(argsString);
                // Successfully parsed, now set it
                answersObject.contractArguments = argsString;
            } catch (error) {
                answersObject.contractArguments = '[]';
            }
        }

        this.fs.copyTpl(
            this.templatePath('workload.js'),
            this.destinationPath(`${ promptAnswers.workspace }/benchmarks/workloads/${ answersObject.workload }`), answersObject
        );
    }

    /**
     * Creates the benchmark configuration file.
     * @private
     */
    _configWrite() {
        answersObject.benchmarkName = promptAnswers.benchmarkName;
        answersObject.benchmarkDescription = promptAnswers.benchmarkDescription;
        answersObject.workers = promptAnswers.workers;
        answersObject.label = promptAnswers.label;
        answersObject.txType = promptAnswers.txType;
        answersObject.contractId = promptAnswers.contractId;

        if (isNaN(promptAnswers.workers)) {
            answersObject.workers = defaultWorkerCount;
        } else if (promptAnswers.workers < 0) {
            answersObject.workers = Math.abs(promptAnswers.workers);
        }
        else {
            answersObject.workers = promptAnswers.workers;
        }

        if (promptAnswers.txType === 'txDuration') {
            if (isNaN(promptAnswers.txDuration)) {
                answersObject.txValue = defaultTxDuration;
            } else if (promptAnswers.txDuration < 0) {
                answersObject.txValue = Math.abs(promptAnswers.txDuration);
            } else {
                answersObject.txValue = promptAnswers.txDuration;
            }
        }

        if (promptAnswers.txType === 'txNumber') {
            if (isNaN(promptAnswers.txNumber)) {
                answersObject.txValue = defaultTxValue;
            } else if (promptAnswers.txNumber < 0) {
                answersObject.txValue = Math.abs(promptAnswers.txNumber);
            }
            else {
                answersObject.txValue = promptAnswers.txNumber;
            }
        }

        this.fs.copyTpl(
            this.templatePath('config.yaml'),
            this.destinationPath(`${ promptAnswers.workspace }/benchmarks/config.yaml`), answersObject
        );
    }

    /**
     * Creates the benchmark artifacts.
     */
    async writing () {
        console.log('Generating benchmark files...');
        this._workloadWrite();
        answersObject.rateController = promptAnswers.rateController;

        switch(promptAnswers.rateController) {
        case 'fixed-rate':
            answersObject.opts = 'tps: 10';
            this._configWrite();
            break;
        case 'fixed-backlog':
            answersObject.opts = 'unfinished_per_client: 5';
            this._configWrite();
            break;
        case 'linear-rate':
            answersObject.opts = 'startingTps: 25, finishingTps: 75';
            this._configWrite();
            break;
        case 'fixed-feedback-rate':
            answersObject.opts = 'tps: 100, unfinished_per_client: 100';
            this._configWrite();
            break;
        }
    }

    /**
     * Called at the end of the benchmark generation.
     */
    end(){
        console.log('Finished generating benchmark files');
    }
};
