/**
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
*
*/

'use strict';

const os = require('os');
const path = require('path');

const tempdir = path.join(os.homedir(), 'tmp/hfc');

const TxErrorEnum = {
    NoError: 0,
    ProposalResponseError: 1,
    BadProposalResponseError: 2,
    OrdererResponseError: 4,
    BadOrdererResponseError: 8,
    EventNotificationError: 16,
    BadEventNotificationError: 32
};

const TxErrorIndex = {
    ProposalResponseError: 0,
    BadProposalResponseError: 1,
    OrdererResponseError: 2,
    BadOrdererResponseError: 3,
    EventNotificationError: 4,
    BadEventNotificationError: 5
};

module.exports = {
    tempdir: tempdir,
    TxErrorIndex: TxErrorIndex,
    TxErrorEnum: TxErrorEnum
};
