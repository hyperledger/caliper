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

# Grab the parent directory.
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "${DIR}"

# bind during CI tests, using the package dir as CWD
# Note: do not use env variables for binding settings, as subsequent launch calls will pick them up and bind again
if [[ "${BIND_IN_PACKAGE_DIR}" = "true" ]]; then
    ${CALL_METHOD} bind --caliper-bind-sut ethereum:latest --caliper-bind-cwd ./../../caliper-ethereum/ --caliper-bind-args="--no-save"
fi

# change default settings (add config paths too)
export CALIPER_PROJECTCONFIG=caliper.yaml

dispose () {
    docker ps -a
    ${CALL_METHOD} launch manager --caliper-flow-only-end
}

# PHASE 1: just starting the network
${CALL_METHOD} launch manager --caliper-flow-only-start
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 1";
    dispose;
    exit ${rc};
fi

# PHASE 2: init, install, test
${CALL_METHOD} launch manager --caliper-flow-skip-start --caliper-flow-skip-end
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 2";
    dispose;
    exit ${rc};
fi

# PHASE 5: just disposing of the network
${CALL_METHOD} launch manager --caliper-flow-only-end
rc=$?
if [[ ${rc} != 0 ]]; then
    echo "Failed CI step 3";
    exit ${rc};
fi
