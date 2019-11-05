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

const rewire = require('rewire');
const NoRate = rewire('../../../lib/worker/rate-control/noRate');

const chai = require('chai');
chai.should();
const sinon = require('sinon');
const assert = require('assert');

describe ('noRate controller implementation', () => {
    let controller;

    describe('#init', () => {
        it ('should throw an error if a value for the number of transactions is set', async () => {
            try {
                controller = new NoRate.createRateController({});
                const msg = {numb: 5};
                await controller.init(msg);
                assert.fail(null, null, 'Exception expected');
            } catch (error) {
                if (error.constructor.name === 'AssertionError') {
                    throw error;
                }
                error.message.should.equal('The no-rate controller can only be applied for duration-based rounds');
            }
        });

        it ('should set the sleep time based on the length of the round in seconds', () => {
            let msg = {txDuration: 100};
            controller = new NoRate.createRateController({});
            controller.init(msg);

            let sleepTime = msg.txDuration * 1000;
            controller.sleepTime.should.equal(sleepTime);
        });
    });

    describe('#applyRateControl', () => {
        it('should sleep for the set sleep time', () => {
            let sleepStub = sinon.stub();
            let msg = {txDuration: 100};
            NoRate.__set__('Util.sleep', sleepStub);

            controller = new NoRate.createRateController({});

            controller.sleepTime = msg.txDuration * 1000;
            let sleepTime = controller.sleepTime;

            controller.applyRateControl(null, null, null, null);
            sinon.assert.calledOnce(sleepStub);
            sinon.assert.calledWith(sleepStub, sleepTime);
        });
    });
});
