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
rm -rf ./node_modules

rm -rf ./packages/caliper-cli/node_modules
rm -rf ./packages/caliper-core/node_modules
rm -rf ./packages/caliper-ethereum/node_modules
rm -rf ./packages/caliper-fabric/node_modules
rm -rf ./packages/caliper-fisco-bcos/node_modules
rm -rf ./packages/caliper-gui-dashboard/node_modules
rm -rf ./packages/caliper-gui-server/node_modules
rm -rf ./packages/caliper-publish/node_modules
rm -rf ./packages/caliper-tests-integration/node_modules
rm -rf ./packages/generator-caliper/node_modules

git checkout -- ./packages/caliper-fabric/package.json
