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

var Generator = require('yeoman-generator');

const defaultTxValue = 50;
const defaultClientValue = 5;
const answersObject = {};

let promptAnswers, workspaceAnswers, callbackAnswers, inititalAnswers, clientAnswer, roundAnswers, txValueAnswer
module.exports = class extends Generator {
    async prompting () {
        this.log("Welcome to the Hyperledger Caliper benchmark generator!\nLet's start off by creating a workspace folder!");

        const workspaceQuestions = [{
            type: 'input',
            name: 'workspace',
            message: 'What would you like to call your workspace?',
            when: () => !this.options.workspace
        }];
        workspaceAnswers = await this.prompt(workspaceQuestions);

        this.log("Now for the callback file...");
        const callbackQuestions = [{
            type: 'input',
            name: 'chaincodeId',
            message: 'What is the name of your smart contract?',
            when: () => !this.options.chaincodeId
        }, {
            type: 'input',
            name: 'version',
            message: 'What is the version of your smart contract?',
            when: () => !this.options.version
        }, {
            type: 'input',
            name: 'chaincodeFunction',
            message: 'Which smart contract function would you like to perform the benchmark on?',
            when: () => !this.options.chaincodeFunction
        }];
        callbackAnswers = await this.prompt(callbackQuestions);

        this.log("Now for the benchmark configuration file...");
        const configQuestions = {
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
                type: 'input',
                name: 'clients',
                message: 'How many clients would you like to have?',
                default: defaultClientValue,
                when: () => !this.options.clients
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
                type: 'input',
                name: 'txDuration',
                message: 'How long would you like the round to last?',
                default: defaultTxValue,
                when: () => !this.options.txDuration
            }],
            txNumberQuestion : [{
                type: 'input',
                name: 'txNumber',
                message: 'How many transactions would you like to have in this round?',
                default: defaultTxValue,
                when: () => !this.options.txNumber
            }]
        }

        inititalAnswers = await this.prompt(configQuestions.initialQuestions);

        clientAnswer = await this.prompt(configQuestions.clientQuestions);
        if (isNaN(parseFloat(this.options.clients)) || this.options.clients < 0) {
            this.log(`Error: Not a valid input. Using default client value of ${defaultClientValue}.`)
        }

        roundAnswers = await this.prompt(configQuestions.roundQuestions);

        if (roundAnswers.txType === "txDuration") {
            txValueAnswer = await this.prompt(configQuestions.txDurationQuestion);
            if (isNaN(parseFloat(txValueAnswer.txDuration)) || txValueAnswer.txDuration < 0) {
              this.log(`Error: Not a valid input. Using default txDuration value of ${defaultTxValue}.`)
            }
        }
        if (roundAnswers.txType === "txNumber") {
            txValueAnswer = await this.prompt(configQuestions.txNumberQuestion);
            if (isNaN(parseFloat(txValueAnswer.txNumber)) || txValueAnswer.txNumber < 0) {
              this.log(`Error: Not a valid input. Using default txNumber value of ${defaultTxValue}.`)
            }
        }

        Object.assign(this.options, workspaceAnswers, callbackAnswers, inititalAnswers, clientAnswer, roundAnswers, txValueAnswer);
        promptAnswers = this.options;
    }

    _callbackWrite() {
        answersObject.chaincodeId = promptAnswers.chaincodeId;
        answersObject.version = promptAnswers.version;
        answersObject.chaincodeFunction = promptAnswers.chaincodeFunction;
        answersObject.callbackPath = `callbacks/${ promptAnswers.chaincodeFunction }.js`;

        this.fs.copyTpl(
            this.templatePath('callback.js'),
            this.destinationPath(`${ promptAnswers.workspace }/benchmarks/${ answersObject.callbackPath }`), answersObject
            )
    }

    _configWrite() {
        answersObject.benchmarkName = promptAnswers.benchmarkName;
        answersObject.benchmarkDescription = promptAnswers.benchmarkDescription;
        answersObject.clients = promptAnswers.clients
        answersObject.label = promptAnswers.label;
        answersObject.txType = promptAnswers.txType;
        answersObject.chaincodeId = promptAnswers.chaincodeId;

        if (typeof promptAnswers.clients === 'string' || promptAnswers.clients < 0) {
            answersObject.clients = defaultClientValue;
        }
        else answersObject.clients = promptAnswers.clients;

        if (promptAnswers.txType === 'txDuration') {
            if (typeof promptAnswers.txDuration === 'string' || promptAnswers.txDuration < 0) {
              answersObject.txValue = defaultTxValue;
            }
            else answersObject.txValue = promptAnswers.txDuration;
        };
        
        if (promptAnswers.txType === 'txNumber') {
            if (typeof promptAnswers.txNumber === 'string' || promptAnswers.txNumber < 0) {
              answersObject.txValue = defaultTxValue;
            }
            else answersObject.txValue = promptAnswers.txNumber;
        };

        this.fs.copyTpl(
            this.templatePath('config.yaml'),
            this.destinationPath(`${ promptAnswers.workspace }/benchmarks/config.yaml`), answersObject
          );
    }

    async writing () {
        console.log('Generating benchmark files...');
        this._callbackWrite();
        answersObject.rateController = promptAnswers.rateController;
        switch(promptAnswers.rateController) {
            case 'fixed-rate':
            answersObject.opts = `tps: 10`;
            this._configWrite();
            break;
        case 'fixed-backlog':
            answersObject.opts = `unfinished_per_client: 5`;
            this._configWrite();
            break;
        case 'linear-rate':
            answersObject.opts = `startingTps: 25
        finishingTps: 75`;
            this._configWrite();
            break;
        case 'fixed-feedback-rate':
            answersObject.opts = `tps: 100
        unfinished_per_client: 100`;
            this._configWrite();
            break;
        }
    }

    end(){
        console.log('Finished generating benchmark files');
    };
}
