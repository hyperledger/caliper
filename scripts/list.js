/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict';

function main() {
    let path = require('path');
    let fs = require('fs-extra');
    let benchDir = path.join(__dirname, '../benchmark');
    let benchmarks = fs.readdirSync(benchDir);
    console.log('Available benchmarks:');
    benchmarks.forEach((item, index) => {
        let dir  = path.join(benchDir, item);
        let info = fs.statSync(dir);
        if(info.isDirectory()) {
            if(fs.existsSync(path.join(dir, 'main.js'))) {
                console.log(item);
            }
        }
    });
}

main();
