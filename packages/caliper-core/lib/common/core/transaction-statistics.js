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

const Logger = require('../utils/caliper-utils').getLogger('transaction-statistics');

/**
 * Class for working on Transaction statistics
 */
class TransactionStatistics {

    /**
     * create a 'null' txStatistics object
     * @return {JSON} 'null' txStatistics object
     */
    static createNullDefaultTxStats() {
        return {
            succ: 0,
            fail: 0
        };
    }

    /**
    * Calculate the default transaction statistics
    * @param {Array} resultArray array of txStatus
    * @param {Boolean} detail indicates whether to keep detailed information
    * @return {JSON} txStatistics JSON object
    */
    static getDefaultTxStats(resultArray, detail) {
        let succ = 0, fail = 0, delay = 0;
        let minFinal, maxFinal, minCreate, maxCreate;
        let maxLastFinal;
        let minDelay = 100000, maxDelay = 0;
        let delays = [];
        let sTPTotal = 0;
        let sTTotal = 0;
        let invokeTotal = 0;
        for (let i = 0; i < resultArray.length; i++) {
            let stat = resultArray[i];
            sTPTotal = sTPTotal + stat.Get('sTP');
            sTTotal = sTTotal + stat.Get('sT');
            invokeTotal += stat.Get('invokeLatency');
            let create = stat.GetTimeCreate();

            if (typeof minCreate === 'undefined') {
                minCreate = create;
                maxCreate = create;
            } else {
                if (create < minCreate) {
                    minCreate = create;
                }
                if (create > maxCreate) {
                    maxCreate = create;
                }
            }

            if (stat.IsCommitted()) {
                succ++;
                let final = stat.GetTimeFinal();
                let d = (final - create) / 1000;
                if (typeof minFinal === 'undefined') {
                    minFinal = final;
                    maxFinal = final;
                } else {
                    if (final < minFinal) {
                        minFinal = final;
                    }
                    if (final > maxFinal) {
                        maxFinal = final;
                    }
                }

                delay += d;
                if (d < minDelay) {
                    minDelay = d;
                }
                if (d > maxDelay) {
                    maxDelay = d;
                }
                if (detail) {
                    delays.push(d);
                }
            } else {
                fail++;
            }

            let curFinal = stat.GetTimeFinal();
            if (typeof maxLastFinal === 'undefined') {
                maxLastFinal = curFinal;
            } else {
                if (curFinal > maxLastFinal) {
                    maxLastFinal = curFinal;
                }
            }
        }

        let stats = {
            'succ': succ,
            'fail': fail,
            'create': { 'min': minCreate / 1000, 'max': maxCreate / 1000 },    // convert to second
            'final': { 'min': minFinal / 1000, 'max': maxFinal / 1000, 'last': maxLastFinal / 1000 },
            'delay': { 'min': minDelay, 'max': maxDelay, 'sum': delay, 'detail': (detail ? delays : []) },
            'out': [],
            'sTPTotal': sTPTotal,
            'sTTotal': sTTotal,
            'invokeTotal': invokeTotal,
            'length': resultArray.length
        };
        return stats;
    }

    /**
     * merge an array of default 'txStatistics', the result is in first object of the array
     * Note even failed the first object of the array may still be changed
     * @param {Array} resultArray txStatistics array
     * @return {Number} 0 if failed; otherwise 1
     */
    static mergeDefaultTxStats(resultArray) {
        try {
            // skip invalid result
            let skip = 0;
            for (let i = 0; i < resultArray.length; i++) {
                let result = resultArray[i];

                if (!result.hasOwnProperty('succ') || !result.hasOwnProperty('fail') || (result.succ + result.fail) === 0) {
                    skip++;
                } else {
                    break;
                }
            }

            if (skip > 0) {
                resultArray.splice(0, skip);
            }

            if (resultArray.length === 0) {
                return 0;
            }

            let r = resultArray[0];
            for (let i = 1; i < resultArray.length; i++) {
                let v = resultArray[i];
                if (!v.hasOwnProperty('succ') || !v.hasOwnProperty('fail') || (v.succ + v.fail) === 0) {
                    continue;
                }
                r.succ += v.succ;
                r.fail += v.fail;
                r.sTPTotal += v.sTPTotal;
                r.sTTotal += v.sTTotal;
                r.invokeTotal += v.invokeTotal;
                r.length += v.length;
                r.out.push.apply(r.out, v.out);
                if (v.create.min < r.create.min) {
                    r.create.min = v.create.min;
                }
                if (v.create.max > r.create.max) {
                    r.create.max = v.create.max;
                }
                if (v.final.min < r.final.min) {
                    r.final.min = v.final.min;
                }
                if (v.final.max > r.final.max) {
                    r.final.max = v.final.max;
                }
                if (v.final.last > r.final.last) {
                    r.final.last = v.final.last;
                }
                if (v.delay.min < r.delay.min) {
                    r.delay.min = v.delay.min;
                }
                if (v.delay.max > r.delay.max) {
                    r.delay.max = v.delay.max;
                }
                r.delay.sum += v.delay.sum;
                for (let j = 0; j < v.delay.detail.length; j++) {
                    r.delay.detail.push(v.delay.detail[j]);
                }
            }
            return 1;
        }
        catch (err) {
            Logger.error(err);
            return 0;
        }
    }
}

module.exports = TransactionStatistics;
