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

# Print all commands.
set -v

# Grab the parent (generator_tests/fabric) directory.
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "${DIR}"

if [[ ! -d "fabric-samples" ]]; then
  curl -sSL -k https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/bootstrap.sh | bash -s -- 2.4.3
fi

TEST_NETWORK_DIR=${DIR}/fabric-samples/test-network

# change default settings (add config paths too)
export CALIPER_PROJECTCONFIG=../caliper.yaml

dispose () {
    pushd ${TEST_NETWORK_DIR}
    ./network.sh down
    popd

    cd ${DIR}
    rm -r myWorkspace/benchmarks
}

# Install yo
npm install --global yo@3.1.1

# back to this dir
cd ${DIR}

# Run benchmark generator using generator defaults (specify invalid values for options)
${GENERATOR_METHOD} -- --workspace 'myWorkspace' --contractId 'mymarbles' --contractVersion 'v0' --contractFunction 'queryMarblesByOwner' --contractArguments '["Alice"]' --workers 'marbles' --benchmarkName 'A name for the marbles benchmark' --benchmarkDescription 'A description for the marbles benchmark' --label 'A label for the round' --rateController 'fixed-rate' --txType 'txDuration' --txDuration 'marbles'
# start network and run benchmark test
cd ../
# bind the sdk into the packages directory as it will search for it there, this ensures it doesn't contaminate real node_modules dirs (2.2 will work with a 1.4 fabric)
# Note: Fabric 2.2 binding is cached in CI
export FABRIC_VERSION=2.2.20
export NODE_PATH="$SUT_DIR/cached/v$FABRIC_VERSION/node_modules"
if [[ "${BIND_IN_PACKAGE_DIR}" = "true" ]]; then
    mkdir -p $SUT_DIR/cached/v$FABRIC_VERSION
    pushd $SUT_DIR/cached/v$FABRIC_VERSION
    ${CALL_METHOD} bind --caliper-bind-sut fabric:$FABRIC_VERSION
    popd
fi

pushd ${TEST_NETWORK_DIR}
./network.sh up -s couchdb
./network.sh createChannel -c mychannel
./network.sh deployCC -ccn mymarbles -c mychannel -ccp ${DIR}/src/marbles/go -ccl go -ccv v0 -ccep "OR('Org1MSP.member','Org2MSP.member')"
popd

cd ${DIR}
# Run benchmark generator not using generator defaults
rm -r myWorkspace/benchmarks
${GENERATOR_METHOD} -- --workspace 'myWorkspace' --contractId 'mymarbles' --contractVersion 'v0' --contractFunction 'queryMarblesByOwner' --contractArguments '["Alice"]' --workers 2 --benchmarkName 'A name for the marbles benchmark' --benchmarkDescription 'A description for the marbles benchmark' --label 'A label for the round' --rateController 'fixed-rate' --txType 'txDuration' --txDuration 10

# Run benchmark test
cd ../
${CALL_METHOD} launch manager --caliper-workspace 'fabric/myWorkspace' --caliper-networkconfig 'networkconfig.yaml' --caliper-benchconfig 'benchmarks/config.yaml' --caliper-flow-only-test
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed run benchmark";
    rm -r fabric/myWorkspace/benchmarks
    dispose;
    exit ${rc};
fi

# dispose network
dispose
