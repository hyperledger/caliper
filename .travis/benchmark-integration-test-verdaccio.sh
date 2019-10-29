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

# Bootstrap the project again
npm i && npm run repoclean -- --yes && npm run bootstrap

# Call CLI through the local binary
export CALL_METHOD="npx caliper"

echo "---- Publishing packages locally"
cd ./packages/caliper-tests-integration/

# clean up the bootstrap modules, they interfere
rm -rf node_modules
# reinstall the dev deps (pm2, verdaccio, etc)
npm i --only=dev
npm run start_verdaccio
npm run npm_publish_local

echo "---- Installing CLI"
npm i --registry http://localhost:4873 --only=prod @hyperledger/caliper-cli

# These are common for each scenario
export CALIPER_BIND_SDK=latest
export CALIPER_BIND_ARGS="--no-save"
export CALIPER_BIND_SUT="${BENCHMARK}"

echo "---- Binding CLI"
npx caliper bind

echo "---- Running Integration test for adaptor ${BENCHMARK}"
npm run run_tests

npm run cleanup
