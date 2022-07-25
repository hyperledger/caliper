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

# Barf if we don't recognize this test connector.
if [[ "${BENCHMARK}" = "" ]]; then
    echo You must set BENCHMARK to one of the desired test adaptors 'besu|ethereum|fabric|fisco-bcos|generator'
    echo For example:
    echo  export BENCHMARK=fabric
    exit 1
fi

TEST_DIR="${BENCHMARK}_tests"
if [[ -d "${TEST_DIR}" ]]; then
    "${TEST_DIR}"/run.sh
else
    echo "Unknown target benchmark ${BENCHMARK}"
    exit 1
fi
