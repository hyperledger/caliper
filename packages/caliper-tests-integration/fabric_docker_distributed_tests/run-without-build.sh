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
TEST_NETWORK_DIR=${DIR}/fabric-samples/test-network

cd "${DIR}"

if [[ ! -d "fabric-samples" ]]; then
  curl -sSL -k https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/bootstrap.sh | bash -s -- 2.4.3
fi

pushd ${TEST_NETWORK_DIR}
./network.sh up -s couchdb
./network.sh createChannel -c mychannel
./network.sh createChannel -c yourchannel
./network.sh deployCC -ccn mymarbles -c mychannel -ccp ${DIR}/src/marbles/go -ccl go -ccv v0 -ccep "OR('Org1MSP.member','Org2MSP.member')"
./network.sh deployCC -ccn yourmarbles -c yourchannel -ccp ${DIR}/src/marbles/go -ccl go -ccv v0 -ccep "OR('Org1MSP.member','Org2MSP.member')"
popd

# back to this dir
cd ${DIR}

npm i
docker-compose -p caliper up
