#!/bin/bash

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

# create missing file
mkdir ./finance/build/
mkdir ./finance/build/nodes
touch ./finance/build/nodes/docker-compose.yml

# compile kotlin, generate node skeleton
cd ./finance/
./gradlew
./gradlew deployNodes
cd ./../

# replace faulty docker-compose-yml
rm ./finance/build/nodes/docker-compose.yml
cp ./utils/cordapp-for-docker/docker-compose.yml ./finance/build/nodes/

# replace faulty Dockerfile
rm ./finance/build/nodes/Notary/Dockerfile
cp ./utils/cordapp-for-docker/Dockerfile ./finance/build/nodes/Notary/
rm ./finance/build/nodes/PartyA/Dockerfile
cp ./utils/cordapp-for-docker/Dockerfile ./finance/build/nodes/PartyA/
rm ./finance/build/nodes/PartyB/Dockerfile
cp ./utils/cordapp-for-docker/Dockerfile ./finance/build/nodes/PartyB/
rm ./finance/build/nodes/PartyC/Dockerfile
cp ./utils/cordapp-for-docker/Dockerfile ./finance/build/nodes/PartyC/

# replace faulty run-corda.sh
rm ./finance/build/nodes/Notary/run-corda.sh
cp ./utils/cordapp-for-docker/Notary/run-corda.sh ./finance/build/nodes/Notary/
rm ./finance/build/nodes/PartyA/run-corda.sh
cp ./utils/cordapp-for-docker/PartyA/run-corda.sh ./finance/build/nodes/PartyA/
rm ./finance/build/nodes/PartyB/run-corda.sh
cp ./utils/cordapp-for-docker/PartyB/run-corda.sh ./finance/build/nodes/PartyB/
rm ./finance/build/nodes/PartyC/run-corda.sh
cp ./utils/cordapp-for-docker/PartyC/run-corda.sh ./finance/build/nodes/PartyC/

# build nodes on docker
cd ./finance/build/nodes/
docker-compose up --build -d
# docker-compose down




