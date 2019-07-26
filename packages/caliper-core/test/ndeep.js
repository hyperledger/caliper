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

const bc = require('../lib/blockchain');
const utils = require('../lib/utils/caliper-utils');


// eslint-disable-next-line require-jsdoc
async function main(){

    const blocky = new bc({bcType: 'demo'});
    const b2 = utils.flatten(blocky);
    const res = utils.objToString(blocky,10);
    console.log(res);
    console.log(utils.objToString(b2,10));
    const b = blocky.toString();
    console.log(JSON.stringify(JSON.parse(b)));

}


main();


