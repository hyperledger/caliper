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

# Exit on first error
set -e

# distribute root README file before publishing
cp ./README.md ./packages/caliper-cli/README.md
cp ./README.md ./packages/caliper-core/README.md
cp ./README.md ./packages/caliper-ethereum/README.md
cp ./README.md ./packages/caliper-fabric/README.md
cp ./README.md ./packages/caliper-fisco-bcos/README.md

cd ./packages/caliper-publish/
npm i
./publish.js npm
./publish.js docker --user klenik --publish
