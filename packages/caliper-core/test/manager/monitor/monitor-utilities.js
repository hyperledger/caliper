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

const Utilities = require('../../../lib/manager/monitors/monitor-utilities');

const mocha = require('mocha');
const fail = mocha.fail;
const chai = require('chai');
chai.should;

describe('Monitor utilities', () => {

    describe('#Utilities.normalizeStats', () => {

        let valuesMap0;
        let valuesMap1;
        let valuesMap2;
        let mapArray;

        beforeEach(() => {
            // Dummy data
            valuesMap0 = new Map();
            valuesMap0.set('CPU', 500);
            valuesMap0.set('Memory', 80000000);
            valuesMap0.set('Disc', 200000000000);

            valuesMap1 = new Map();
            valuesMap1.set('CPU', 70000);
            valuesMap1.set('Memory', 100000);
            valuesMap1.set('Disc', 100000000000);

            valuesMap2 = new Map();
            valuesMap2.set('CPU', 4500);
            valuesMap2.set('Memory', 500000);
            valuesMap2.set('Disc', 300000000000);

            mapArray = [valuesMap0, valuesMap1, valuesMap2];
        });

        it('should normalize all values to the hightest KB value present in the passed map', () => {

            // Run static method
            Utilities.normalizeStats('CPU', mapArray);

            // Values for all 'CPU' items should be normalized to 70000 bytes
            // We are also changing the name of the metric to include a unit, so we need to check what that might be too

            let newName;
            for (const name of valuesMap0.keys()) {
                if (name.includes('CPU')) {
                    newName = name;
                    break;
                }
            }

            // Should have modified to be 'CPU [KB]'
            if (!newName) {
                fail('Unable to determine modified name within Map array');
            } else {
                newName.should.equal('CPU [KB]');
            }

            // Values should have been modified to ref
            valuesMap0.get(newName).should.equal('0.488');
            valuesMap1.get(newName).should.equal('68.4');
            valuesMap2.get(newName).should.equal('4.39');

        });

        it('should normalize all values to the hightest MB value present in the passed map', () => {
            // Run static method
            Utilities.normalizeStats('Memory', mapArray);

            // Values for all 'CPU' items should be normalized to 70000 bytes
            // We are also changing the name of the metric to include a unit, so we need to check what that might be too

            let newName;
            for (const name of valuesMap0.keys()) {
                if (name.includes('Memory')) {
                    newName = name;
                    break;
                }
            }

            // Should have modified to be 'Memory [MB]'
            if (!newName) {
                fail('Unable to determine modified name within Map array');
            } else {
                newName.should.equal('Memory [MB]');
            }

            // Values should have been modified to ref
            valuesMap0.get(newName).should.equal('76.3');
            valuesMap1.get(newName).should.equal('0.0954');
            valuesMap2.get(newName).should.equal('0.477');
        });

        it('should normalize all values to the hightest GB value present in the passed map', () => {
            // Run static method
            Utilities.normalizeStats('Disc', mapArray);

            // Values for all 'CPU' items should be normalized to 70000 bytes
            // We are also changing the name of the metric to include a unit, so we need to check what that might be too

            let newName;
            for (const name of valuesMap0.keys()) {
                if (name.includes('Disc')) {
                    newName = name;
                    break;
                }
            }

            // Should have modified to be 'Disc [GB]'
            if (!newName) {
                fail('Unable to determine modified name within Map array');
            } else {
                newName.should.equal('Disc [GB]');
            }

            // Values should have been modified to ref
            valuesMap0.get(newName).should.equal('186');
            valuesMap1.get(newName).should.equal('93.1');
            valuesMap2.get(newName).should.equal('279');
        });

        it('should return a normalized value that includes at least one significant figure', () => {

            // New item with small relative value
            const valuesMap3 = new Map();
            valuesMap3.set('Memory', 0.05);

            const newArray = [...mapArray, valuesMap3];
            // Run static method
            Utilities.normalizeStats('Memory', newArray);

            // Check for modified name
            let newName;
            for (const name of valuesMap0.keys()) {
                if (name.includes('Memory')) {
                    newName = name;
                    break;
                }
            }

            // Should have modified to be 'Memory [MB]'
            if (!newName) {
                fail('Unable to determine modified name within Map array');
            } else {
                newName.should.equal('Memory [MB]');
            }

            // Values should have been modified to ref
            valuesMap0.get(newName).should.equal('76.3');
            valuesMap1.get(newName).should.equal('0.0954');
            valuesMap2.get(newName).should.equal('0.477');
            valuesMap3.get(newName).should.equal('4.77e-8');
        });

    });

});
