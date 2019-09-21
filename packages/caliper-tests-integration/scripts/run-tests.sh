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
set -ev
set -o pipefail

# Set ARCH
ARCH=`uname -m`

# Grab the parent (root) directory.
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

# Switch into the integration tests directory to access required npm run commands
cd "${DIR}"

# Barf if we don't recognize this test adaptor.
if [[ "${BENCHMARK}" = "" ]]; then
    echo You must set BENCHMARK to one of the desired test adaptors 'composer|fabric-ccp'
    echo For example:
    echo  export BENCHMARK=fabric-ccp
    exit 1
fi

# Run benchmark adaptor
if [[ "${BENCHMARK}" == "composer" ]]; then
    caliper benchmark run -c benchmark/composer/config.yaml -n network/fabric-v1.3/2org1peercouchdb/composer.json -w ../caliper-samples/
    rc=$?
    exit $rc;
elif [ "${BENCHMARK}" == "fabric-ccp" ]; then
    # Run with channel creation using a createChannelTx in couchDB, using a Gateway
    caliper benchmark run -c benchmark/simple/config.yaml -n network/fabric-v1.4.1/2org1peercouchdb/fabric-ccp-node.yaml -w ../caliper-samples/ --caliper-fabricccp-usegateway
    rc=$?
    if [[ $rc != 0 ]]; then
        exit $rc;
    else
        # Run with channel creation using an existing tx file in LevelDB, using a low level Caliper client
        caliper benchmark run -c benchmark/simple/config.yaml -n network/fabric-v1.4/2org1peergoleveldb/fabric-ccp-go.yaml -w ../caliper-samples/
        rc=$?
        exit $rc;
    fi
else
    echo "Unknown target benchmark ${BENCHMARK}"
    exit 1
fi
