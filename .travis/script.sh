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

# Bootstrap the project
npm run bootstrap

# Run linting and unit tests
npm test

echo "---- Publishing packages locally"
cd ./packages/caliper-tests-integration/
npm run cleanup
npm run start_verdaccio
npm run publish_packages

echo "---- Installing CLI"
npm run install_cli
npm run cleanup

echo "---- Running Integration test for adaptor ${BENCHMARK}"
npm run run_tests
