#!/bin/bash
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# Exit on first error, print all commands.
set -e
set -o pipefail

echo "---- Running benchmark ${BENCHMARK}"

npm run bootstrap
cd ./packages/caliper-application/scripts

# Run benchmark
if [ "${BENCHMARK}" == "composer" ]; then
    node run-benchmark.js -c ../benchmark/composer/config.yaml -t composer -n ../network/fabric-v1.3/2org1peercouchdb/composer.json
    exit $?
elif [ "${BENCHMARK}" == "fabric" ]; then
    node run-benchmark.js -c ../benchmark/simple/config.yaml -t fabric -n ../network/fabric-v1.4/2org1peercouchdb/fabric-node.json
    exit $?
elif [ "${BENCHMARK}" == "fabric-ccp" ]; then
    node run-benchmark.js -c ../benchmark/simple/config.yaml -t fabric-ccp -n ../network/fabric-v1.2/2org1peercouchdb/fabric-ccp-node.yaml
    exit $?
else
    echo "Unknown target benchmark ${BENCHMARK}"
    exit 1
fi
