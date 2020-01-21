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

# check reference Caliper package names
# publishNpmPackages.js contains the package dir names as caliper-*, those are fine
if grep -rnE --exclude="publishNpmPackages.js" "['\"]caliper-(cli|core|burrow|composer|ethereum|fabric|fisco-bcos|iroha|sawtooth)['\"]" . ; then
    echo "^^^ Found incorrect Caliper package names. Use the @hyperledger/ prefix for Caliper packages, e.g., @hyperledger/caliper-core"
    exit 1
fi

echo "Caliper package names are correct."

# Bootstrap the project again
npm i && npm run repoclean -- --yes && npm run bootstrap

# Run linting, license check and unit tests
npm test
