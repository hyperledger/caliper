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

let Generator = require('yeoman-generator');

module.exports = class extends Generator {
    /**
     * Prompts the user the question about the generator to use.
     * @async
     */
    async prompting() {
        this.log('Welcome to the Hyperledger Caliper generator!');
        const question = [{
            type: 'list',
            name: 'subgenerator',
            message: 'Which generator would you like to run?',
            choices: [
                {name: 'Benchmark', value: 'benchmark'}
            ],
            store: true,
            when: () => !this.options.subgenerator
        }];
        const answers = await this.prompt(question);
        Object.assign(this.options, answers);
    }

    /**
     * Sets/configures the selected sub-generator.
     */
    async configuring() {
        const { subgenerator } = this.options;
        this.log(`You can also run the ${subgenerator} generator using: yo @hyperledger/caliper:${subgenerator}\n`);
        this.composeWith(require.resolve(`../${subgenerator}`));
    }
};
