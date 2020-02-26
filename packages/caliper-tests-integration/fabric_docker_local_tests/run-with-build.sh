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

# Publish the packages locally and build a local test image
cd ./../../caliper-publish/
./publish.js verdaccio start
sleep 5s
./publish.js npm --registry http://localhost:4873
./publish.js docker --registry http://localhost:4873 --image caliper --tag test
./publish.js verdaccio stop

# back to this dir
cd ${DIR}

npm i
docker-compose -p caliper up -d

