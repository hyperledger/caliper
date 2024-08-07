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

const AssignedMessage = require('../../../lib/common/messages/assignedMessage');
const MessageTypes = require('../../../lib/common/utils/constants').Messages.Types;

const chai = require('chai');
chai.should();

describe('AssignedMessage', () => {
    describe('Constructor', () => {
        it('should create an AssignedMessage instance with sender, recipients, and type', () => {
            const sender = 'John';
            const recipients = ['Alice', 'Bob'];
            const message = new AssignedMessage(sender, recipients);

            message.should.be.an.instanceOf(AssignedMessage);
            message.sender.should.equal(sender);
            message.recipients.should.deep.equal(recipients);
            message.type.should.equal(MessageTypes.Assigned);
        });

        it('should set the content of the message as an empty object', () => {
            const message = new AssignedMessage('John', ['Alice', 'Bob']);

            message.content.should.deep.equal({});
        });

        it('should parse the date argument as a Date object for the AssignedMessage', () => {
            const date = '2024-04-25';
            const message = new AssignedMessage('John', ['Alice', 'Bob'], date);

            message.date.should.be.an.instanceOf(Date);
            message.date
                .toISOString()
                .should.equal(new Date(date).toISOString());
        });

        it('should set the error correctly if passed', () => {
            const error = 'Some error';
            const message = new AssignedMessage(
                'John',
                ['Alice', 'Bob'],
                undefined,
                error
            );

            message.error.should.equal(error);
        });

        it('should create an AssignedMessage with undefined date and error if not provided', () => {
            const message = new AssignedMessage('John', ['Alice', 'Bob']);

            chai.expect(message.date).to.be.undefined;
            chai.expect(message.error).to.be.undefined;
        });
    });
});
