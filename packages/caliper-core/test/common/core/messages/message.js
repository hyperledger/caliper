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

const Message = require('../../../../lib/common/messages/message');
const AllMessageTarget = require('../../../../lib/common/utils/constants').Messages.Targets.All

const chai = require('chai');
chai.should();

describe('Message', () => {
    const mockSender = 'Test User';
    const mockRecipients = ["recepient-id-1", "recepient-id-2", "recepient-id-3"];
    const mockType = 'Assigned';
    const mockContent = { message: 'Hello' };
    const mockDate = '2024-04-25';
    const mockError = "Test Error";

    describe("Constructor", () => {
        it("should create a Message instance with sender, recipients, type, content, date, and error", () => {
            const message = new Message(mockSender, mockRecipients, mockType, mockContent, mockDate, mockError);

            message.should.be.an.instanceOf(Message);
            message.sender.should.equal(mockSender);
            message.recipients.should.deep.equal(mockRecipients);
            message.type.should.equal(mockType);
            message.content.should.deep.equal(mockContent);
            message.date.should.be.an.instanceOf(Date);
            message.date.toISOString().should.equal(new Date(mockDate).toISOString());
            message.error.should.equal(mockError);
        });

        it("should set the date of the message as undefined not passed", () => {
            const message = new Message(mockSender, mockRecipients, mockType);

            chai.expect(message.date).to.be.undefined;
        });

        it("should set the date of the message as an invalid Date object if the date is invalid", () => {
            const message = new Message(mockSender, mockRecipients, mockType, mockContent, 'Invalid Date');

            message.date.should.be.an.instanceOf(Date);
            chai.expect(message.date.toString()).to.equal('Invalid Date');
        })
    })

    describe("Getters", () => {
        beforeEach(() => {
            this.message = new Message(mockSender, mockRecipients, mockType, mockContent, mockDate, mockError);
        })

        it("should get the sender of the message", () => {
            this.message.getSender().should.equal(mockSender);
        });

        it("should get the recipients of the message", () => {
            this.message.getRecipients().should.deep.equal(mockRecipients);
        });

        it("should get the type of the message", () => {
            this.message.getType().should.equal(mockType);
        });

        it("should get the content of the message", () => {
            this.message.getContent().should.deep.equal(mockContent);
        });
    })

    describe("hasError", () => {
        it("should return true if the message has an error", () => {
            const message = new Message(mockSender, mockRecipients, mockType, mockContent, mockDate, mockError);
            message.hasError().should.be.true;
        })

        it("should return false if the message has no error", () => {
            const message = new Message(mockSender, mockRecipients, mockType, mockContent, mockDate);
            message.hasError().should.be.false;
        })
    })

    describe("forRecipient", () => {
        it("should return true if the message is for the recipient", () => {
            const message = new Message(mockSender, mockRecipients, mockType, mockContent, mockDate);

            mockRecipients.forEach(recipient => {
                message.forRecipient(recipient).should.be.true;
            })
        })

        it("should return true for all people if the message if for all", () => {
            const message = new Message(mockSender, [AllMessageTarget], mockType, mockContent, mockDate);

            message.forRecipient(AllMessageTarget).should.be.true;
            message.forRecipient('random-id').should.be.true;
        })

        it("should return false if the message is not for the recipient", () => {
            const message = new Message(mockSender, mockRecipients, mockType, mockContent, mockDate);

            message.forRecipient('random-id').should.be.false;
        })
    })

    describe("stringify", () => {
        it("should contain the date and the error if present", () => {
            const message = new Message(mockSender, mockRecipients, mockType, mockContent, mockDate, mockError);
            const stringifiedMessage = message.stringify();
            const decodedMessage = JSON.parse(stringifiedMessage);

            decodedMessage.sender.should.equal(mockSender);
            decodedMessage.recipients.should.deep.equal(mockRecipients);
            decodedMessage.type.should.equal(mockType);
            decodedMessage.content.should.deep.equal(mockContent);
            decodedMessage.date.should.equal(new Date(mockDate).toISOString());
            decodedMessage.error.should.equal(mockError);
        })

        it("should not include the error attribute if the message had no error", () => {
            const message = new Message(mockSender, mockRecipients, mockType, mockContent, mockDate);
            const stringifiedMessage = message.stringify();
            const decodedMessage = JSON.parse(stringifiedMessage);

            chai.expect(decodedMessage.error).to.be.undefined;
        })

        it("should set the current date if the date is not provided", () => {
            const message = new Message(mockSender, mockRecipients, mockType, mockContent);
            const firstDate = new Date();
            const stringifiedMessage = message.stringify();
            const decodedMessage = JSON.parse(stringifiedMessage);
            const secondDate = new Date(decodedMessage.date);
            const millisecondDifference = secondDate - firstDate;
            // allow for upto 5 second discrepancy
            chai.assert(millisecondDifference < 5 * 1000);
        })
    })
})
