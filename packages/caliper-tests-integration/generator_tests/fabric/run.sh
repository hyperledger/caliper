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

# Grab the parent (generator_tests) directory.
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "${DIR}"

# change default settings (add config paths too)
export CALIPER_PROJECTCONFIG=../caliper.yaml

dispose () {
    ${CALL_METHOD} launch manager --caliper-workspace 'fabric/myWorkspace' --caliper-flow-only-end
}

# Install yo
npm install --global yo

# generate the crypto materials
cd ./config
./generate.sh

# back to this dir
cd ${DIR}

# needed, since the peer looks for the latest, which is no longer on dockerhub
docker pull hyperledger/fabric-ccenv:1.4.8
docker image tag hyperledger/fabric-ccenv:1.4.8 hyperledger/fabric-ccenv:latest

# Run benchmark generator using generator defaults (specify invalid values for options)
${GENERATOR_METHOD} -- --workspace 'myWorkspace' --contractId 'mymarbles' --contractVersion 'v0' --contractFunction 'queryMarblesByOwner' --contractArguments '["Alice"]' --workers 'marbles' --benchmarkName 'A name for the marbles benchmark' --benchmarkDescription 'A description for the marbles benchmark' --label 'A label for the round' --rateController 'fixed-rate' --txType 'txDuration' --txDuration 'marbles'
# start network and run benchmark test
cd ../
${CALL_METHOD} launch manager --caliper-workspace 'fabric/myWorkspace' --caliper-networkconfig 'networkconfig.yaml' --caliper-benchconfig 'benchmarks/config.yaml' --caliper-flow-skip-end
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed start network";
    rm -r fabric/myWorkspace/benchmarks
    dispose;
    exit ${rc};
fi

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
${CALL_METHOD} launch manager --caliper-workspace 'fabric/myWorkspace' --caliper-networkconfig 'networkconfig.yaml' --caliper-benchconfig 'benchmarks/config.yaml' --caliper-flow-only-end
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed end network";
    rm -r fabric/myWorkspace/benchmarks
    exit ${rc};
fi
cd ${DIR}
rm -r myWorkspace/benchmarks
