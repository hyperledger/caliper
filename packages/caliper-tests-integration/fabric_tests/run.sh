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

# change default settings (add config paths too)
export CALIPER_PROJECTCONFIG=../caliper.yaml

dispose () {
    ${CALL_METHOD} benchmark run --caliper-workspace phase5 --caliper-flow-only-end
}

# PHASE 1: just starting the network
${CALL_METHOD} benchmark run --caliper-workspace phase1 --caliper-flow-only-start
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 1";
    dispose;
    exit ${rc};
fi

# PHASE 2: just initialize the network
# TODO: chaincodes shouldn't be required at this point
${CALL_METHOD} benchmark run --caliper-workspace phase2 --caliper-flow-only-init
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 2";
    dispose;
    exit ${rc};
fi

# PHASE 3: just init network and install the contracts (channels marked as created)
${CALL_METHOD} benchmark run --caliper-workspace phase3 --caliper-flow-skip-start --caliper-flow-skip-end --caliper-flow-skip-test
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 3";
    dispose;
    exit ${rc};
fi

# PHASE 3 again: deployed contracts should be detected
${CALL_METHOD} benchmark run --caliper-workspace phase3 --caliper-flow-skip-start --caliper-flow-skip-end --caliper-flow-skip-test
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 4";
    dispose;
    exit ${rc};
fi

# PHASE 4: testing through the low-level API
${CALL_METHOD} benchmark run --caliper-workspace phase4 --caliper-flow-only-test
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 5";
    dispose;
    exit ${rc};
fi

# PHASE 4 again: testing through the gateway API
${CALL_METHOD} benchmark run --caliper-workspace phase4 --caliper-flow-only-test --caliper-fabric-usegateway
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 6";
    dispose;
    exit ${rc};
fi

# PHASE 5: just disposing of the network
${CALL_METHOD} benchmark run --caliper-workspace phase5 --caliper-flow-only-end
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 7";
    exit ${rc};
fi
