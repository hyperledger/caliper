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

# Grab the parent (fabric_tests) directory.
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "${DIR}"

# generate the crypto materials
cd ./config
./generate.sh

# back to this dir
cd ${DIR}

# bind during CI tests, using the package dir as CWD
# Note: do not use env variables for binding settings, as subsequent launch calls will pick them up and bind again
if [[ "${BIND_IN_PACKAGE_DIR}" = "true" ]]; then
    ${CALL_METHOD} bind --caliper-bind-sut fabric:1.4 --caliper-bind-cwd ./../../caliper-fabric/ --caliper-bind-args="--save-dev"
fi

# change default settings (add config paths too)
export CALIPER_PROJECTCONFIG=../caliper.yaml

dispose () {
    docker ps -a
    ${CALL_METHOD} launch manager --caliper-workspace phase7 --caliper-flow-only-end --caliper-fabric-gateway-enabled
}

# needed, since the peer looks for the latest, which is no longer on dockerhub
docker pull hyperledger/fabric-ccenv:1.4.8
docker image tag hyperledger/fabric-ccenv:1.4.8 hyperledger/fabric-ccenv:latest

# PHASE 1: just starting the network
${CALL_METHOD} launch manager --caliper-workspace phase1 --caliper-flow-only-start
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 1";
    dispose;
    exit ${rc};
fi

# PHASE 2: just initialize the network
# TODO: contracts shouldn't be required at this point
${CALL_METHOD} launch manager --caliper-workspace phase2 --caliper-flow-only-init
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 2";
    dispose;
    exit ${rc};
fi

# PHASE 3: just init network and install the contracts (channels marked as created)
${CALL_METHOD} launch manager --caliper-workspace phase3 --caliper-flow-skip-start --caliper-flow-skip-end --caliper-flow-skip-test
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 3";
    dispose;
    exit ${rc};
fi

# PHASE 3 again: deployed contracts should be detected
${CALL_METHOD} launch manager --caliper-workspace phase3 --caliper-flow-skip-start --caliper-flow-skip-end --caliper-flow-skip-test
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 4";
    dispose;
    exit ${rc};
fi

# PHASE 4: testing through the low-level API
${CALL_METHOD} launch manager --caliper-workspace phase4 --caliper-flow-only-test
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 5";
    dispose;
    exit ${rc};
fi

echo "Run Legacy connector. NOTE: Marble creation will fail with errors as they have already been created."
${CALL_METHOD} launch manager --caliper-workspace phase4 --caliper-networkconfig networkconfig-legacy.yaml --caliper-flow-only-test
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 6";
    dispose;
    exit ${rc};
fi

# PHASE 5: testing through the gateway API (v1 SDK)
${CALL_METHOD} launch manager --caliper-workspace phase5 --caliper-flow-only-test --caliper-fabric-gateway-enabled
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 6";
    dispose;
    exit ${rc};
fi

echo "Run Legacy connector"
${CALL_METHOD} launch manager --caliper-workspace phase5 --caliper-networkconfig networkconfig-legacy.yaml --caliper-flow-only-test --caliper-fabric-gateway-enabled
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 6";
    dispose;
    exit ${rc};
fi

# UNBIND SDK, using the package dir as CWD
# Note: do not use env variables for unbinding settings, as subsequent launch calls will pick them up and bind again
if [[ "${BIND_IN_PACKAGE_DIR}" = "true" ]]; then
    ${CALL_METHOD} unbind --caliper-bind-sut fabric:1.4 --caliper-bind-cwd ./../../caliper-fabric/ --caliper-bind-args="--save-dev" --caliper-projectconfig ./caliper.yaml
fi
# BIND with 2.2.2 SDK, using the package dir as CWD
# Note: do not use env variables for unbinding settings, as subsequent launch calls will pick them up and bind again
if [[ "${BIND_IN_PACKAGE_DIR}" = "true" ]]; then
    ${CALL_METHOD} bind --caliper-bind-sut fabric:2.1 --caliper-bind-cwd ./../../caliper-fabric/ --caliper-bind-args="--save-dev"
fi

# PHASE 6: testing through the gateway API (v2 SDK)
${CALL_METHOD} launch manager --caliper-workspace phase6 --caliper-flow-only-test --caliper-fabric-gateway-enabled
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 7";
    dispose;
    exit ${rc};
fi

echo "Run Legacy connector, NOTE: Marble creation will fail with errors as they have already been created."
${CALL_METHOD} launch manager --caliper-workspace phase6 --caliper-networkconfig networkconfig-legacy.yaml --caliper-flow-only-test --caliper-fabric-gateway-enabled
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 7";
    dispose;
    exit ${rc};
fi


# PHASE 7: just disposing of the network
${CALL_METHOD} launch manager --caliper-workspace phase7 --caliper-flow-only-end --caliper-fabric-gateway-enabled
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 8";
    exit ${rc};
fi
