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

module.exports.BlockchainInterface = require('./lib/blockchain-interface');
module.exports.CaliperLocalClient = require('./lib/client/caliper-local-client');
module.exports.TxStatus = require('./lib/transaction-status');
module.exports.CaliperUtils = require('./lib/utils/caliper-utils');
module.exports.Version = require('./lib/utils/version');
module.exports.ConfigUtil = require('./lib/config/config-util');
module.exports.CaliperFlow = require('./lib/caliper-flow');

// More dependencies for caliper-flow test
module.exports.ClientOrchestrator = require('./lib/client/client-orchestrator');
module.exports.Blockchain = require('./lib/blockchain');
module.exports.MonitorOrchestrator = require('./lib/monitor/monitor-orchestrator');
module.exports.Report = require('./lib/report/report');
module.exports.DefaultTest = require('./lib/test-runners/default-test');
module.exports.LocalObserver = require('./lib/test-observers/local-observer');
module.exports.PrometheusObserver = require('./lib/test-observers/prometheus-observer');