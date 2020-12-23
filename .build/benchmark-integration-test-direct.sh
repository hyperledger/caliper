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

# Call CLI directly
# The CWD will be in one of the caliper-tests-integration/*_tests directories
export CALL_METHOD="node ../../caliper-cli/caliper.js"
# Use explicit binding for
export BIND_IN_PACKAGE_DIR=true
export GENERATOR_METHOD="yo ../../../generator-caliper/generators/benchmark/index.js"

echo "---- Running Integration test for adaptor ${BENCHMARK}"
cd ./packages/caliper-tests-integration/
./run-tests.sh
