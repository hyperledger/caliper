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

# Set ARCH
ARCH=`uname -m`

if [[ -z "${NPM_REGISTRY}" ]]
then
    if [[ -z "${NPM_TOKEN}" ]]
    then
        echo "NPM_TOKEN must be set when publishing to the public NPM registry."
        exit 1
    else
        # Set the NPM access token we will use to publish.
        npm config set registry https://registry.npmjs.org/
        npm config set //registry.npmjs.org/:_authToken ${NPM_TOKEN}
    fi
fi

npm publish --access public ${NPM_REGISTRY} ${DRY_RUN} --tag ${TAG}
