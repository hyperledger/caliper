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

const Config = require('../../common/config/config-util');
const Utils = require('../../common/utils/caliper-utils');
const Logger = Utils.getLogger('report-builder');
const fs = require('fs');
const Mustache = require('mustache');
const path = require('path');

/**
 * Convert an object to string
 * @param {Object} value object to be converted
 * @return {String} returned string
 */
function stringify(value) {
    if(typeof value === 'object'){
        if(Array.isArray(value)) {
            return value.toString();
        }
        else {
            return JSON.stringify(value, null, 2);
        }
    }
    else {
        return value;
    }
}

/**
 * Report class for generating test report
 */
class ReportBuilder {
    /**
     * Constructor
     */
    constructor() {
        this.template = path.join(__dirname, 'template/report.html');
        this.data = {
            'summary' : {       // summary of benchmark result
                'meta' : [],    // information of the summary, e.g. [{"name": "DLT Type", "value": "Fabric"}, {"name": "Benchmark", "value": "Simple"}...]
                'head' : [],    // table head for the summary table, e.g. ["Test","Name","Succ","Fail","Send Rate","Max Delay","Min Delay", "Avg Delay", "Throughput"],
                'results':[]   // table rows for the summary table, e.g. [{ "result": [0,"publish", 1,0,"1 tps", "10.78 s","10.78 s", "10.78 s", "1 tps"]},...]
            },
            'tests' : [],
            // Each entry in `tests` are the results of each rounds, e.g
            // tests: [
            //    rounds: [
            //     {
            //         "id": "round 0",
            //         "description" : "Test the performance for publishing digital item",
            //         "performance": {
            //             "head": ["Name","Succ","Fail","Send Rate","Max Delay","Min Delay", "Avg Delay", "Throughput"],
            //             "result": ["publish", 1,0,"1 tps", "10.78 s","10.78 s", "10.78 s", "1 tps"]
            //         },
            //         "resources": [
            //            {
            //             "monitor": monitor_type (docker | process | prometheus)
            //             "head": ["TYPE","NAME", "Memory(max)","Memory(avg)","CPU(max)", "CPU(avg)", "Traffic In","Traffic Out"],
            //             "results": [
            //                 {
            //                 "result": ["Docker","peer1.org1.example.com", "94.4MB", "94.4MB", "0.89%", "0.84%", "0B", "0B"]
            //                 },
            //                 {
            //                 "result": ["Docker","peer0.org2.example.com","90.4MB", "90.4MB", "1.2%", "1.2%", "6KB", "0B"]
            //                 }
            //             ]
            //           },
            //           {
            //             "monitor": monitor_type (docker | process | prometheus)
            //             "head": ["TYPE","NAME","Memory(avg)","CPU(max)", "CPU(avg)", "Disc Write","Disc Read"],
            //             "results": [
            //                 {
            //                 "result": ["Docker","peer1.org1.example.com", "94.4MB", "9", "0.89", "0.84%", "0B"]
            //                 },
            //                 {
            //                 "result": ["Docker","peer0.org2.example.com","90.4MB", "9", "1.2", "1.2%", "6KB"]
            //                 }
            //             ],
            //             "charts": [
            //                  {
            //                        "labels": ["peer1.org1.example.com","peer0.org2.example.com"],
            //                        "chart-id": "memory-chart",
            //                        "title": "Memory Avg (MB)",
            //                        "data": [94.4, 90.1]
            //                   },
            //                   {
            //                        "labels": ["peer1.org1.example.com","peer0.org2.example.com"],
            //                        "chart-id": "cpu-chart",
            //                        "title": "CPU Avg (%)",
            //                        "data": [23, 18]
            //                   }
            //              ]
            //           }],
            //     {...}
            // ]
            'benchmarkInfo': 'not provided',   // readable information for the benchmark
            'sut': {
                'meta' : [],                    // metadata of the SUT
                'details' : 'not provided'     // details of the SUT
            }
        };
        this.started = false;
        this.peers = [];
        this.monitors = [];
    }

    /**
    * add a name/value metadata
    * @param {String} name name of the metadata
    * @param {String} value value of the metadata
    */
    addMetadata(name, value) {
        this.data.summary.meta.push({'name': name, 'value': value});
    }

    /**
    * @tableArray, [[head], [row1], [row2], ...]
    *              the first element must be an array represents the header of the table,
    *              and the rest elements represent the rows of the table
    */

    /**
    * set the head of summary table
    * @param {Array} table array containing rows of a table, each row is also an array
    */
    setSummaryTable(table) {
        if(!Array.isArray(table) || table.length < 1) {
            throw new Error('unrecognized report table');
        }

        this.data.summary.head = table[0];
        for(let i = 1 ; i < table.length ; i++) {
            if(!Array.isArray(table)) {
                throw new Error('unrecognized report table');
            }
            this.data.summary.results.push({'result' : table[i]});
        }
    }

    /**
    * add a row to the summary table
    * @param {Array} row elements of the row
    */
    addSummaryTableRow(row) {
        if(!Array.isArray(row) || row.length < 1) {
            throw new Error('unrecognized report row');
        }
        this.data.summary.results.push({'result' : row});
    }

    /**
    * add a new benchmark round
    * @param {Object} roundConfig the test round configuration object
    * @return {Number} id of the round, used to add details to this round
    */
    addBenchmarkRound(roundConfig) {
        let index;
        let exists = false;
        for (let i=0; i<this.data.tests.length; i++) {
            if (this.data.tests[i].label.localeCompare(roundConfig.label) === 0){
                // Label test container exists
                exists = true;
                index = i;
            }
        }


        // Store a reduced subset of the config
        const jsonConfig = {
            txDuration: roundConfig.txDuration,
            rateControl: roundConfig.rateControl,
            callback: roundConfig.callback
        };
        const config = Utils.stringifyYaml(JSON.parse(JSON.stringify(jsonConfig)));

        if (exists) {
            // Add the next round at the index point
            const id = this.data.tests[index].rounds.length;
            this.data.tests[index].rounds.push({
                'id' : 'round ' + id,
                'performance' : {'head':[], 'result': []},
                'resources': [],
                'chart' : []
            });
            return id;
        } else {
            // New item
            this.data.tests.push({
                'description' : this.descriptionMap.get(roundConfig.label),
                'label' : roundConfig.label,
                config,
                'rounds': [{
                    'id' : 'round 0',
                    'performance' : {'head':[], 'result': []},
                    'resources': [],
                    'chart' : []
                }]
            });
            return 0;
        }
    }

    /**
    * set performance table of a specific round
    * @param {String} label the round label
    * @param {Number} id id of the round
    * @param {Array} table table array containing the performance values
    */
    setRoundPerformance(label, id, table) {

        let index;
        let exists = false;
        for (let i=0; i<this.data.tests.length; i++) {
            if (this.data.tests[i].label.localeCompare(label) === 0){
                // Label test container exists
                exists = true;
                index = i;
            }
        }

        if (!exists){
            throw new Error('Non-existing report test label passed');
        }

        if(id < 0 || id >= this.data.tests[index].rounds.length) {
            throw new Error('unrecognized report id');
        }
        if(!Array.isArray(table) || table.length < 1) {
            throw new Error('unrecognized report table');
        }

        this.data.tests[index].rounds[id].performance.head = table[0];
        if(table.length > 1)
        {
            this.data.tests[index].rounds[id].performance.result = table[1];
        }
    }

    /**
    * Add new resource consumption table of a specific round within:
    * {
    *   'description' : this.descriptionMap.get(label),
    *   'label' : label,
    *   'rounds': [{
    *        'id' : 'round 0',
    *        'performance' : {'head':[], 'result': []},
    *        'resources': [ {'head':[], 'results': []} ]
    *       }]
    * }
    * @param {String} label the round label
    * @param {Number} id id of the round
    * @param {Array} table table array containing the resource consumption values
    * @param {Object} charts chart information
    * @param {String} monitor the monitor to which the resource table was created from
    */
    setRoundResourceTable(label, id, table, charts, monitor) {
        let index;
        let exists = false;
        for (let i=0; i<this.data.tests.length; i++) {
            if (this.data.tests[i].label.localeCompare(label) === 0){
                // Label test container exists
                exists = true;
                index = i;
            }
        }

        if (!exists){
            throw new Error('Non-existing report test label passed');
        }

        if(id < 0 || id >= this.data.tests[index].rounds.length) {
            throw new Error('unrecognized report id');
        }
        if(!Array.isArray(table) || table.length < 1) {
            throw new Error('unrecognized report table');
        }

        const results = [];
        for(let i = 1 ; i < table.length ; i++) {
            if(!Array.isArray(table)) {
                throw new Error('unrecognized report table');
            }
            results.push({'result' : table[i]});
        }

        // Build a new object and add into resources array
        const resource = {
            monitor,
            head: table[0],
            results
        };

        if (charts) {
            resource.charts = charts;
        }

        this.data.tests[index].rounds[id].resources.push(resource);

        Logger.debug('resources count:', this.data.tests[index].rounds[id].resources.length);
    }


    /**
    * set the readable information of the benchmark
    * @param {String} info information of the benchmark
    */
    setBenchmarkInfo(info) {
        this.data.benchmarkInfo = Utils.stringifyYaml(JSON.parse(info));
    }

    /**
    * add SUT information
    * @param {String} name name of the metadata
    * @param {Object} value value of the metadata
    */
    addSUTInfo(name, value) {
        if(name === 'details') {
            this.data.sut.details = stringify(value);
        }
        else {
            this.data.sut.meta.push({'name': name, 'value': stringify(value)});
        }
    }

    /**
    * generate a HTML report for the benchmark
    * @async
    */
    async generate() {
        let templateStr = fs.readFileSync(this.template).toString();
        let html = Mustache.render(templateStr, this.data);
        try {
            let filePath = Config.get(Config.keys.Report.Path, 'report.html');
            filePath = Utils.resolvePath(filePath);
            let writeOptions = Config.get(Config.keys.Report.Options, { flag: 'w', mode: 0o666 });

            const dirPath = path.dirname(filePath);
            if (!fs.existsSync(dirPath)) {
                Logger.debug(`Creating parent directory for report: ${dirPath}`);
                fs.mkdirSync(dirPath, { recursive: true, mode: writeOptions.mode });
            }

            fs.writeFileSync(filePath, html, writeOptions);
            Logger.info(`Generated report with path ${filePath}`);
        } catch (err) {
            Logger.error(`Failed to generate report, with error ${err}`);
            throw err;
        }
    }

    /**
     * Generate a label - description map
     * @param {Object} rounds the test rounds from teh yaml config file
     */
    addLabelDescriptionMap(rounds){
        const descriptionMap = new Map();
        for(let i = 0 ; i < rounds.length ; i++) {
            if(rounds[i].hasOwnProperty('description')) {
                descriptionMap.set(rounds[i].label, rounds[i].description);
            }
        }
        this.descriptionMap = descriptionMap;

    }
}

module.exports = ReportBuilder;
