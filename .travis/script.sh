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

# Run benchmark
if [ "${BENCHMARK}" == "composer" ]; then
    # Run version
    if [ "${VERSION}" == "0.19" ]; then
        npm run composer-deps
        npm run test -- composer
        exit $?
    else
        echo "Unknown version ${VERSION} for benchmark ${BENCHMARK}"
        exit  1
    fi
elif [ "${BENCHMARK}" == "drm" ]; then
    npm run fabric-deps
    npm run test -- drm
    exit $?
elif [ "${BENCHMARK}" == "simple" ]; then
    npm run fabric-v1.1-deps
    npm run test -- simple
    exit $?
else
    echo "Unknown target benchmark ${BENCHMARK}"
    exit 1
fi