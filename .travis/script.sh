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

echo "---- Running benchmark ${BENCHMARK}"
echo "---- Target version ${VERSION}"

# Run benchmark
if [ "${BENCHMARK}" == "composer" ]; then
    # Run version
    if [ "${VERSION}" == "0.19" ]; then
        npm install composer-admin@">=0.19.0 <0.20.0"
        npm install composer-client@">=0.19.0 <0.20.0"
        npm install composer-common@">=0.19.0 <0.20.0"
        npm install fabric-client@1.1.0
        npm run test -- composer
    else
        echo "Unknown version ${VERSION} for benchmark ${BENCHMARK}"
        exit  1
    fi
elif [ "${BENCHMARK}" == "drm" ]; then
    npm install grpc@1.10.1
    npm install fabric-ca-client@1.1.0
    npm install fabric-client@1.1.0
    npm run test -- drm
elif [ "${BENCHMARK}" == "simple" ]; then
    npm install grpc@1.10.1
    npm install fabric-ca-client@1.1.0
    npm install fabric-client@1.1.0
    npm run test -- simple
else
    echo "Unknown target benchmark ${BENCHMARK}"
    exit 1
fi

echo "---- Script complete"
exit