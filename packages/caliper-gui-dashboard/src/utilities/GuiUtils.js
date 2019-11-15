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
/*!

=========================================================
* Hyperledger Caliper GUI
=========================================================

* Author: Jason You
* GitHub:
* Licensed under the Apache 2.0 - https://www.apache.org/licenses/LICENSE-2.0

Copyright (c) 2019 Jason You

*/



const yaml = require('js-yaml');

// Clean the yaml file string and add the leading dashes if not exists
const addYamlDash = (yamlString) => {
    yamlString = yaml.safeDump(yaml.safeLoad(yamlString));
    if (!yamlString.startsWith('---')) {
        yamlString = '---\n' + yamlString;
    }
    return yamlString;
};

// Border style for tests
const borderStyle = {
    border:'1px dotted gray',
    borderRadius:'5px',
    padding:'10px',
    margin:'10px 0'
};

// Check whether the input x is defined
const hasInput = (x) => {
    return (x !== undefined && x !== null);
};

// Textarea style to make the output more obvious
const textareaStyle = {
    width: '100%',
    border: '2px dotted #34B5B8',
    resize: 'none',
    borderRadius: '5px',
};

// Templete for each test round
const testRoundsTemplete = {
    test_rounds_label: '',
    test_rounds_description: '',
    test_rounds_callback: '',
    test_rounds_transactions: [
        {
            test_rounds_transactions_txNumber: 100,
            test_rounds_transactions_rateControl_type: 'fixed_rate',
            test_rounds_transactions_rateControl_opts_tps: 300
        }
    ],
    test_rounds_arguments: [
        {
            key: '',
            value: ''
        }
    ]
};

module.exports = {
    addYamlDash,
    borderStyle,
    hasInput,
    textareaStyle,
    testRoundsTemplete
};