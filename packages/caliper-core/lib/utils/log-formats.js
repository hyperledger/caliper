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

const colors = require('colors/safe');
const { format } = require('logform');
const { LEVEL } = require('triple-beam');

const attributeRegex = /%attribute%/gi;

const colorizeExtra = format((info, opts) => {
    // The immutable level string of the message (the normal property could be mutated already)
    let lev = info[LEVEL];
    // colors enables multiple styles separated by spaces
    let colorStyles = opts.colors[lev].split(' ');

    for (let key of Object.keys(info)) {
        if (info[key] !== undefined && (opts.all || opts[key])) {
            // surround the value with the style codes one by one
            for (let style of colorStyles) {
                try {
                    info[key] = colors[style](info[key]);
                } catch (e) {
                    // silent fail, can't log here
                }
            }
        }
    }

    return info;
});

const padLevelExtra = format(info => {

    let padding = ' '.repeat(Math.max(5 - info[LEVEL].length, 0));
    info.level = `${info.level}${padding}`;
    return info;
});

const attributeFormat = format((info, opts) => {
    for (let key of Object.keys(info)) {
        if (typeof opts[key] === 'string') {
            if (typeof info[key] !== 'string') {
                info[key] = JSON.stringify(info[key]);
            }

            info[key] = opts[key].replace(attributeRegex, info[key]);
        }
    }

    return info;
});

module.exports.ColorizerExtra = colorizeExtra;
module.exports.PadLevelExtra = padLevelExtra;
module.exports.AttributeFormat = attributeFormat;
