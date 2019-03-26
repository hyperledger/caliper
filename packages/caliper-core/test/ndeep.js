'use strict';

const bc = require('../lib/blockchain');
const utils = require('../lib/utils/caliper-utils');


// eslint-disable-next-line require-jsdoc
async function main(){

    const blocky = new bc({bcType: 'demo'});
    const b2 = utils.flatten(blocky);
    const res = utils.objToString(blocky,10);
    console.log(res)
    console.log(utils.objToString(b2,10))
    const b = blocky.toString();
    console.log(JSON.stringify(JSON.parse(b)))


}


main();


