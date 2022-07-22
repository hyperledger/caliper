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
npm ci

# Get the root directory of the caliper source
ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
echo $ROOT_DIR

# Call the CLI directly in the source tree
export CALL_METHOD="node $ROOT_DIR/packages/caliper-cli/caliper.js"
# Use explicit binding for
export BIND_IN_PACKAGE_DIR=true

# Call the Generator code directly from source
export GENERATOR_METHOD="yo $ROOT_DIR/packages/generator-caliper/generators/benchmark/index.js"

# Create a directory outside of the source code tree to install SUT binding node modules
# We have to do this otherwise npm will attempt to hoist the npm modules to a directory
# which subsequently doesn't get searched
# This approach means we can drop having to declare dependencies on SUT bound modules in the
# connector and makes it more like the way a user would use caliper.
export SUT_DIR=$HOME/sut
echo $SUT_DIR
mkdir -p $SUT_DIR

# Ensure node searches this directory by setting NODE_PATH
export NODE_PATH=$SUT_DIR/node_modules

echo "---- Running Integration test for adaptor ${BENCHMARK}"
cd ./packages/caliper-tests-integration/
./run-tests.sh

rm -fr $SUT_DIR
