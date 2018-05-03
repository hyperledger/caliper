/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict';

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
class Report {
    /**
     * Constructor
     */
    constructor() {
        const path = require('path');
        this.template = path.join(__dirname, 'template/report.html');
        this.data = {
            'summary' : {       // summary of benchmark result
                'meta' : [],    // information of the summary, e.g. [{"name": "DLT Type", "value": "Fabric"}, {"name": "Benchmark", "value": "Simple"}...]
                'head' : [],    // table head for the summary table, e.g. ["Test","Name","Succ","Fail","Send Rate","Max Delay","Min Delay", "Avg Delay", "Throughput"],
                'results':[]   // table rows for the summary table, e.g. [{ "result": [0,"publish", 1,0,"1 tps", "10.78 s","10.78 s", "10.78 s", "1 tps"]},...]
            },
            // results of each rounds, e.g
            // [{
            //     "id": "round 0",
            //     "description" : "Test the performance for publishing digital item",
            //     "performance": {
            //       "head": ["Name","Succ","Fail","Send Rate","Max Delay","Min Delay", "Avg Delay", "Throughput"],
            //       "result": ["publish", 1,0,"1 tps", "10.78 s","10.78 s", "10.78 s", "1 tps"]
            //     },
            //     "resource": {
            //       "head": ["TYPE","NAME", "Memory(max)","Memory(avg)","CPU(max)", "CPU(avg)", "Traffic In","Traffic Out"],
            //       "results": [
            //         {
            //          "result": ["Docker","peer1.org1.example.com", "94.4MB", "94.4MB", "0.89%", "0.84%", "0B", "0B"]
            //         },
            //         {
            //           "result": ["Docker","peer0.org2.example.com","90.4MB", "90.4MB", "1.2%", "1.2%", "6KB", "0B"]
            //         }
            //       ]
            //     }
            //   },
            'rounds' : [],
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
    addSummarytableRow(row) {
        if(!Array.isArray(row) || row.length < 1) {
            throw new Error('unrecognized report row');
        }
        this.data.summary.results.push({'result' : row});
    }

    /**
    * add a new benchmark round
    * @param {String} description human readable description of this round
    * @return {Number} id of the round, be used to add details to this round
    */
    addBenchmarkRound(description) {
        let id = this.data.rounds.length;
        this.data.rounds.push({
            'id' : 'round ' + id,
            'description' : description,
            'performance' : {'head':[], 'result': []},
            'resource' : {'head':[], 'results': []}
        });

        return id;
    }

    /**
    * set performance table of a specific round
    * @param {Number} id id of the round
    * @param {Array} table table array containing the performance values
    */
    setRoundPerformance(id, table) {
        if(id < 0 || id >= this.data.rounds.length) {
            throw new Error('unrecognized report id');
        }
        if(!Array.isArray(table) || table.length < 1) {
            throw new Error('unrecognized report table');
        }

        this.data.rounds[id].performance.head = table[0];
        if(table.length > 1)
        {
            this.data.rounds[id].performance.result = table[1];
        }
    }

    /**
    * set resource consumption table of a specific round
    * @param {Number} id id of the round
    * @param {Array} table table array containing the resource consumption values
    */
    setRoundResource(id, table) {
        if(id < 0 || id >= this.data.rounds.length) {
            throw new Error('unrecognized report id');
        }
        if(!Array.isArray(table) || table.length < 1) {
            throw new Error('unrecognized report table');
        }

        this.data.rounds[id].resource.head = table[0];
        for(let i = 1 ; i < table.length ; i++) {
            if(!Array.isArray(table)) {
                throw new Error('unrecognized report table');
            }
            this.data.rounds[id].resource.results.push({'result' : table[i]});
        }
    }

    /**
    * set the readable information of the benchmark
    * @param {String} info information of the benchmark
    */
    setBenchmarkInfo(info) {
        this.data.benchmarkInfo = info;
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
    * @param {String} output filename of the output
    * @return {Promise} promise object
    */
    generate(output) {
        return new Promise((resolve, reject) => {
            let fs = require('fs');
            let Mustache = require('mustache');
            let templateStr = fs.readFileSync(this.template).toString();
            let html = Mustache.render(templateStr, this.data);
            fs.writeFile(output, html, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve('Report  created successfully!');
                }
            });
        });
    }
}

module.exports = Report;